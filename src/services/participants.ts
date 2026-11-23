import "server-only";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { AppError, isIntegrityGuardError, isUniqueViolation } from "@/lib/errors";
import { sendEmail } from "@/lib/email";
import { registrationConfirmation } from "@/lib/email/templates";
import { generateReference } from "@/lib/security/crypto";
import { checkFormToken } from "@/lib/security/form-token";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp, ipHash as hashIp } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { formatDateTime } from "@/lib/time";
import { canonicalEmail, isDisposableEmail, normalizeEmail } from "@/lib/validation/email";
import { registrationRequestSchema } from "@/lib/validation/registration";
import { parseCampaignSettings } from "@/lib/validation/campaign-settings";
import type { Prisma, ParticipantStatus } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { writeAudit } from "./audit";
import { effectiveStatus } from "./campaign-status";
import { localizeCampaign } from "./campaigns";
import { getSettings } from "./settings";

type HeaderSource = Headers | { get(name: string): string | null };

export interface RegistrationResult {
  referenceNumber: string;
  registeredAt: string;
  /** Pre-formatted in the visitor's language and the configured timezone */
  registeredAtLabel: string;
  campaignTitle: string;
  campaignSlug: string;
}

/**
 * Public registration. Every check here is authoritative and server-side:
 * schema → honeypot → rate limits → signed form token → (optional) Turnstile → campaign window →
 * field rules → duplicate detection → atomic insert guarded against the entry-list freeze.
 */
export async function registerParticipant(body: unknown, headers: HeaderSource, now = new Date()): Promise<RegistrationResult> {
  const parsed = registrationRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Please check the highlighted fields", 422, {
      fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
    });
  }
  const input = parsed.data;

  if (input.website) throw new AppError("REJECTED", "Your registration could not be processed", 400);

  const settings = await getSettings();
  const ipH = hashIp(headers);

  const burst = await rateLimit(`reg:burst:${ipH}`, 5, 60, now);
  const hourly = await rateLimit(`reg:hour:${ipH}`, settings.registrationsPerIpPerHour, 3600, now);
  if (!burst.allowed || !hourly.allowed) {
    throw new AppError("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", 429);
  }

  const campaign = await prisma.campaign.findUnique({ where: { slug: input.campaign } });
  if (!campaign || campaign.status === "DRAFT") throw new AppError("NOT_FOUND", "Giveaway not found", 404);

  const token = checkFormToken(input.formToken, campaign.id, settings.minFormFillSeconds, now.getTime());
  if (!token.ok) {
    if (token.reason === "expired") throw new AppError("FORM_EXPIRED", "This page has expired. Please refresh and try again.", 400);
    if (token.reason === "too_fast") throw new AppError("TOO_FAST", "Please take a moment to review your details, then submit again.", 400);
    throw new AppError("REJECTED", "Your registration could not be processed. Please refresh the page.", 400);
  }

  if (!(await verifyTurnstile(input.turnstileToken, clientIp(headers)))) {
    throw new AppError("CAPTCHA", "Please complete the security check.", 400);
  }

  assertOpen(campaign, now);

  const rules = parseCampaignSettings(campaign.settings);
  const fieldErrors: Record<string, string> = {};

  const phone = parsePhoneNumberFromString(input.phone.trim().replace(/^00/, "+"), "AL");
  if (!phone || !phone.isValid()) fieldErrors.phone = "errors.phone.invalid";
  else if (rules.allowedPhoneCountries.length && (!phone.country || !rules.allowedPhoneCountries.includes(phone.country))) {
    fieldErrors.phone = "errors.phone.country";
  }
  const city = input.city?.trim() || null;
  if (rules.cityField === "required" && !city) fieldErrors.city = "errors.city.required";
  if (rules.minAge && input.ageConfirmed !== true) fieldErrors.ageConfirmed = "errors.age.required";
  if (Object.keys(fieldErrors).length) throw new AppError("VALIDATION", "Please check the highlighted fields", 422, { fields: fieldErrors });

  const email = normalizeEmail(input.email);
  const emailCanonical = canonicalEmail(email);
  const e164 = phone!.number as string;

  const duplicate = await prisma.participant.findFirst({
    where: { campaignId: campaign.id, OR: [{ emailCanonical }, { phone: e164 }] },
    select: { id: true },
  });
  if (duplicate) throw duplicateError();

  // Attribution: the src value is only looked up inside THIS campaign; unknown/disabled sources are ignored.
  const source = input.src
    ? await prisma.qRSource.findFirst({ where: { campaignId: campaign.id, slug: input.src, active: true }, select: { id: true } })
    : null;

  const flags: string[] = [];
  if (isDisposableEmail(email)) flags.push("disposable_email");
  const sameNetwork = await prisma.participant.count({ where: { campaignId: campaign.id, ipHash: ipH } });
  if (sameNetwork >= rules.maxEntriesPerIp) flags.push("many_entries_same_network");
  const status: ParticipantStatus = flags.length ? "FLAGGED" : "ELIGIBLE";

  const utm = input.utm ?? {};
  for (let attempt = 0; attempt < 5; attempt++) {
    const referenceNumber = generateReference(campaign.referencePrefix, now);
    try {
      const participant = await prisma.$transaction(async (tx) => {
        // FOR SHARE blocks a concurrent entry-list freeze until this insert commits (and vice versa).
        const rows = await tx.$queryRaw<{ lockedAt: Date | null; status: string; closedAt: Date | null; startsAt: Date; endsAt: Date }[]>`
          SELECT "lockedAt", "status"::text AS status, "closedAt", "startsAt", "endsAt" FROM "Campaign" WHERE id = ${campaign.id} FOR SHARE`;
        const fresh = rows[0];
        if (!fresh) throw new AppError("NOT_FOUND", "Giveaway not found", 404);
        assertOpen({ ...fresh, status: fresh.status as typeof campaign.status }, now);

        return tx.participant.create({
          data: {
            campaignId: campaign.id,
            fullName: input.fullName.replace(/\s+/g, " ").trim(),
            email,
            emailCanonical,
            phone: e164,
            city: rules.cityField === "hidden" ? null : city,
            referenceNumber,
            qrSourceId: source?.id ?? null,
            marketingConsent: input.marketingConsent === true,
            termsVersion: settings.termsVersion,
            privacyVersion: settings.privacyVersion,
            locale: input.locale,
            registeredAt: now,
            status,
            flags: flags as Prisma.InputJsonValue,
            statusReason: flags.length ? `Automatic review: ${flags.join(", ")}` : null,
            referrer: sanitizeReferrer(input.referrer),
            utmSource: utm.source || null,
            utmMedium: utm.medium || null,
            utmCampaign: utm.campaign || null,
            utmTerm: utm.term || null,
            utmContent: utm.content || null,
            ipHash: ipH,
            consents: {
              create: [
                { consentType: "TERMS", accepted: true, policyVersion: settings.termsVersion, acceptedAt: now },
                { consentType: "PRIVACY", accepted: true, policyVersion: settings.privacyVersion, acceptedAt: now },
                { consentType: "MARKETING", accepted: input.marketingConsent === true, policyVersion: settings.privacyVersion, acceptedAt: now },
                ...(rules.minAge ? [{ consentType: "AGE" as const, accepted: true, policyVersion: `min-age-${rules.minAge}`, acceptedAt: now }] : []),
              ],
            },
          },
        });
      });

      const localized = localizeCampaign(campaign, input.locale);
      if (settings.sendConfirmationEmail && rules.sendConfirmationEmail) {
        void sendEmail(
          participant.email,
          registrationConfirmation({
            company: settings.companyName,
            campaignTitle: localized.title,
            locale: input.locale,
            fullName: participant.fullName,
            reference: participant.referenceNumber,
            registeredAt: formatDateTime(participant.registeredAt, input.locale, settings.timezone),
            drawDate: formatDateTime(campaign.drawAt, input.locale, settings.timezone),
            url: appUrl(`/giveaway/${campaign.slug}`),
          }),
        );
      }

      return {
        referenceNumber: participant.referenceNumber,
        registeredAt: participant.registeredAt.toISOString(),
        registeredAtLabel: formatDateTime(participant.registeredAt, input.locale, settings.timezone, { dateStyle: "long", timeStyle: "medium" }),
        campaignTitle: localized.title,
        campaignSlug: campaign.slug,
      };
    } catch (e) {
      if (isIntegrityGuardError(e)) throw new AppError("CLOSED", "Registration for this giveaway is closed.", 409);
      if (isUniqueViolation(e)) {
        const target = JSON.stringify((e as { meta?: unknown }).meta ?? "") + String((e as Error).message);
        if (target.includes("referenceNumber")) continue; // astronomically rare collision → retry
        throw duplicateError();
      }
      throw e;
    }
  }
  throw new AppError("INTERNAL", "Could not create a reference number. Please try again.", 500);
}

function duplicateError() {
  return new AppError("DUPLICATE", "This e-mail address or phone number is already registered for this giveaway.", 409);
}

function assertOpen(c: Parameters<typeof effectiveStatus>[0], now: Date) {
  const s = effectiveStatus(c, now);
  if (s === "ACTIVE") return;
  if (s === "SCHEDULED") throw new AppError("NOT_STARTED", "Registration has not opened yet.", 409);
  if (s === "PAUSED") throw new AppError("PAUSED", "Registration is temporarily paused. Please try again later.", 409);
  throw new AppError("CLOSED", "Registration for this giveaway is closed.", 409);
}

function sanitizeReferrer(ref?: string) {
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return `${u.protocol}//${u.host}${u.pathname}`.slice(0, 300); // drop query strings (may contain personal data)
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Admin side
// ─────────────────────────────────────────────────────────────

export interface ParticipantFilters {
  q?: string;
  campaignId?: string;
  sourceId?: string;
  status?: ParticipantStatus;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export function participantWhere(f: ParticipantFilters): Prisma.ParticipantWhereInput {
  const where: Prisma.ParticipantWhereInput = {};
  if (f.campaignId) where.campaignId = f.campaignId;
  if (f.sourceId) where.qrSourceId = f.sourceId === "none" ? null : f.sourceId;
  if (f.status) where.status = f.status;
  if (f.from || f.to) where.registeredAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) };
  const q = f.q?.trim();
  if (q) {
    const digits = q.replace(/[^\d+]/g, "");
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q.toLowerCase() } },
      { referenceNumber: { contains: q.toUpperCase() } },
      ...(digits.length >= 4 ? [{ phone: { contains: digits.replace(/^0/, "") } }] : []),
    ];
  }
  return where;
}

export async function searchParticipants(f: ParticipantFilters) {
  const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 100);
  const page = Math.max(f.page ?? 1, 1);
  const where = participantWhere(f);
  const [total, rows] = await prisma.$transaction([
    prisma.participant.count({ where }),
    prisma.participant.findMany({
      where,
      orderBy: { registeredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { campaign: { select: { title: true } }, qrSource: { select: { name: true, slug: true } } },
    }),
  ]);
  return { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), rows };
}

export async function getParticipant(id: string) {
  const participant = await prisma.participant.findUnique({
    where: { id },
    include: {
      campaign: { select: { id: true, title: true, lockedAt: true, status: true } },
      qrSource: { select: { name: true, slug: true } },
      consents: { orderBy: { acceptedAt: "asc" } },
      invalidatedBy: { select: { name: true } },
      drawResults: { include: { draw: { select: { sequence: true, status: true } } } },
    },
  });
  if (!participant) return null;
  const [samePhoneOrEmail, sameNetwork] = await Promise.all([
    prisma.participant.findMany({
      where: {
        id: { not: id },
        OR: [{ emailCanonical: participant.emailCanonical }, ...(participant.phone ? [{ phone: participant.phone }] : [])],
      },
      select: { id: true, referenceNumber: true, campaign: { select: { title: true } } },
      take: 20,
    }),
    participant.ipHash
      ? prisma.participant.count({ where: { campaignId: participant.campaignId, ipHash: participant.ipHash, id: { not: id } } })
      : 0,
  ]);
  return { participant, related: samePhoneOrEmail, sameNetwork };
}

/** Marks an entry valid/invalid with a mandatory reason. Blocked once the entry list is frozen. */
export async function setParticipantStatus(id: string, status: "ELIGIBLE" | "INVALID", reason: string, user: SessionUser, ipHash?: string) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.participant.findUnique({ where: { id }, include: { campaign: { select: { lockedAt: true } } } });
    if (!p) throw new AppError("NOT_FOUND", "Participant not found", 404);
    if (p.campaign.lockedAt) throw new AppError("LOCKED", "The entry list is frozen for the draw — entries can no longer be re-classified.", 409);
    if (p.status === status) return p;
    const updated = await tx.participant.update({
      where: { id },
      data: { status, statusReason: reason, statusChangedAt: new Date(), invalidatedById: status === "INVALID" ? user.id : null },
    });
    await writeAudit(tx, {
      userId: user.id,
      campaignId: p.campaignId,
      action: status === "INVALID" ? "participant.invalidated" : p.status === "FLAGGED" ? "participant.review_approved" : "participant.revalidated",
      entityType: "Participant",
      entityId: id,
      metadata: { reference: p.referenceNumber, from: p.status, to: status, reason },
      ipHash,
    });
    return updated;
  });
}

/**
 * Erasure: personal fields are replaced; the opaque reference stays so historic draw proofs remain valid.
 */
export async function anonymizeParticipant(id: string, reason: string, user: SessionUser | null, ipHash?: string) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.participant.findUnique({ where: { id } });
    if (!p) throw new AppError("NOT_FOUND", "Participant not found", 404);
    if (p.anonymizedAt) return p;
    const updated = await tx.participant.update({
      where: { id },
      data: {
        fullName: "Anonymised participant",
        email: `erased+${p.id}@invalid.local`,
        emailCanonical: `erased+${p.id}@invalid.local`,
        phone: null,
        city: null,
        referrer: null,
        ipHash: null,
        marketingConsent: false,
        anonymizedAt: new Date(),
      },
    });
    await tx.consentRecord.create({ data: { participantId: id, consentType: "MARKETING", accepted: false, policyVersion: "erasure" } });
    await writeAudit(tx, {
      userId: user?.id ?? null,
      campaignId: p.campaignId,
      action: "participant.anonymized",
      entityType: "Participant",
      entityId: id,
      metadata: { reference: p.referenceNumber, reason },
      ipHash,
    });
    return updated;
  });
}

/** Everything we hold about a data subject (access request). */
export async function exportPersonalData(email: string, phone?: string) {
  const canonical = canonicalEmail(email);
  const rows = await prisma.participant.findMany({
    where: { OR: [{ emailCanonical: canonical }, ...(phone ? [{ phone }] : [])] },
    include: { consents: true, campaign: { select: { title: true, slug: true } }, qrSource: { select: { name: true } } },
  });
  return rows.map((r) => ({
    campaign: r.campaign.title,
    referenceNumber: r.referenceNumber,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone,
    city: r.city,
    registeredAt: r.registeredAt,
    status: r.status,
    marketingConsent: r.marketingConsent,
    source: r.qrSource?.name ?? null,
    utm: { source: r.utmSource, medium: r.utmMedium, campaign: r.utmCampaign, term: r.utmTerm, content: r.utmContent },
    consents: r.consents.map((c) => ({ type: c.consentType, accepted: c.accepted, version: c.policyVersion, at: c.acceptedAt })),
  }));
}

export const EXPORT_HEADERS = [
  "Reference",
  "Campaign",
  "Full name",
  "Email",
  "Phone",
  "City",
  "Status",
  "Status reason",
  "Source",
  "Marketing consent",
  "Registered at (UTC)",
  "UTM source",
  "UTM medium",
  "UTM campaign",
  "Terms version",
  "Privacy version",
];

export async function exportParticipantRows(f: ParticipantFilters, opts: { marketingOnly?: boolean } = {}) {
  const where = participantWhere(f);
  if (opts.marketingOnly) where.marketingConsent = true;
  const rows = await prisma.participant.findMany({
    where,
    orderBy: { registeredAt: "asc" },
    take: 100_000,
    include: { campaign: { select: { title: true } }, qrSource: { select: { name: true } } },
  });
  return rows.map((r) => [
    r.referenceNumber,
    r.campaign.title,
    r.fullName,
    r.email,
    r.phone ?? "",
    r.city ?? "",
    r.status,
    r.statusReason ?? "",
    r.qrSource?.name ?? "Direct",
    r.marketingConsent ? "yes" : "no",
    r.registeredAt.toISOString(),
    r.utmSource ?? "",
    r.utmMedium ?? "",
    r.utmCampaign ?? "",
    r.termsVersion,
    r.privacyVersion,
  ]);
}

export { effectiveStatus };
