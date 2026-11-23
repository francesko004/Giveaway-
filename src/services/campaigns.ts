import "server-only";
import { prisma } from "@/lib/db";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { zonedLocalToUtc } from "@/lib/time";
import type { CampaignInput } from "@/lib/validation/admin";
import { parseCampaignSettings, campaignTranslationsSchema } from "@/lib/validation/campaign-settings";
import type { Campaign, Prisma } from "@prisma/client";
import type { CampaignStatus } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/session";
import { writeAudit } from "./audit";
import { effectiveStatus, isClosedForEntries } from "./campaign-status";
import { getSettings, type Locale } from "./settings";

export { effectiveStatus, isRegistrationOpen } from "./campaign-status";

const PROTECTED_FIELDS = ["startsAt", "endsAt", "drawAt", "winnerCount", "alternateCount", "eligibility", "settings"] as const;

export function withEffectiveStatus<T extends Campaign>(c: T, now = new Date()) {
  return { ...c, effectiveStatus: effectiveStatus(c, now) };
}

export function localizeCampaign(c: Campaign, locale: Locale) {
  const t = campaignTranslationsSchema.safeParse(c.translations);
  const en = locale === "en" && t.success ? t.data.en : undefined;
  return {
    title: en?.title || c.title,
    description: en?.description || c.description,
    prizeName: en?.prizeName || c.prizeName,
    prizeDescription: en?.prizeDescription || c.prizeDescription,
    eligibility: en?.eligibility || c.eligibility,
  };
}

async function toData(input: CampaignInput) {
  const { timezone } = await getSettings();
  return {
    title: input.title,
    slug: input.slug,
    description: input.description,
    prizeName: input.prizeName,
    prizeDescription: input.prizeDescription,
    prizeImage: input.prizeImage || null,
    prizeValue: input.prizeValue || null,
    eligibility: input.eligibility ?? "",
    startsAt: zonedLocalToUtc(input.startsAt, timezone),
    endsAt: zonedLocalToUtc(input.endsAt, timezone),
    drawAt: zonedLocalToUtc(input.drawAt, timezone),
    winnerCount: input.winnerCount,
    alternateCount: input.alternateCount,
    showParticipantCount: input.showParticipantCount,
    referencePrefix: input.referencePrefix,
    settings: input.settings as Prisma.InputJsonValue,
    translations: input.translations as Prisma.InputJsonValue,
  };
}

export async function createCampaign(input: CampaignInput, user: SessionUser, ipHash?: string) {
  const data = await toData(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({ data: { ...data, status: "DRAFT" } });
      await writeAudit(tx, {
        userId: user.id,
        campaignId: campaign.id,
        action: "campaign.created",
        entityType: "Campaign",
        entityId: campaign.id,
        metadata: { title: campaign.title, slug: campaign.slug },
        ipHash,
      });
      return campaign;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("SLUG_TAKEN", "This URL slug is already used by another campaign", 409);
    throw e;
  }
}

function changedFields(before: Campaign, after: Awaited<ReturnType<typeof toData>>) {
  const changes: string[] = [];
  for (const key of Object.keys(after) as (keyof typeof after)[]) {
    const a = before[key as keyof Campaign];
    const b = after[key];
    const same =
      a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!same) changes.push(key);
  }
  return changes;
}

/**
 * Updates a campaign. Draw-relevant fields of a campaign whose registration has ended are protected:
 * changing them is an exceptional, SUPER_ADMIN-only operation that requires a public reason and
 * invalidates any existing draw commitment (the original proof is preserved).
 */
export async function updateCampaign(id: string, input: CampaignInput, user: SessionUser, ipHash?: string) {
  const data = await toData(input);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
    const before = await tx.campaign.findUnique({ where: { id } });
    if (!before) throw new AppError("NOT_FOUND", "Campaign not found", 404);

    const changes = changedFields(before, data);
    const protectedChanges = changes.filter((c) => (PROTECTED_FIELDS as readonly string[]).includes(c));
    const closed = isClosedForEntries(before) || before.lockedAt !== null;
    const activeDraw = await tx.draw.findFirst({ where: { campaignId: id, status: { not: "INVALIDATED" } } });

    if (closed && protectedChanges.length > 0) {
      if (!hasRole(user.role, "SUPER_ADMIN")) {
        throw new AppError("PROTECTED", `Registration has closed — these fields are protected: ${protectedChanges.join(", ")}`, 409);
      }
      if (!input.overrideReason) {
        throw new AppError("REASON_REQUIRED", "An exceptional change to a closed campaign requires a written reason (min. 20 characters)", 422);
      }
      if (activeDraw) {
        await tx.draw.update({
          where: { id: activeDraw.id },
          data: { status: "INVALIDATED", invalidatedAt: new Date(), invalidationReason: `Campaign parameters changed: ${input.overrideReason}` },
        });
        await writeAudit(tx, {
          userId: user.id,
          campaignId: id,
          action: "draw.invalidated",
          entityType: "Draw",
          entityId: activeDraw.id,
          metadata: { reason: input.overrideReason, cause: "campaign.exceptional_change", fields: protectedChanges },
          ipHash,
        });
      }
      if (before.lockedAt) await tx.campaign.update({ where: { id }, data: { lockedAt: null, status: before.status === "DRAW_COMPLETED" ? "CLOSED" : before.status } });
    }

    // Slug changes would break printed QR codes that point to /giveaway/{slug}.
    if (changes.includes("slug") && before.status !== "DRAFT") {
      const sources = await tx.qRSource.count({ where: { campaignId: id } });
      if (sources > 0) throw new AppError("SLUG_LOCKED", "The URL slug cannot change after QR codes were created for a published campaign", 409);
    }

    let updated: Campaign;
    try {
      updated = await tx.campaign.update({ where: { id }, data });
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError("SLUG_TAKEN", "This URL slug is already used by another campaign", 409);
      throw e;
    }
    if (changes.length) {
      await writeAudit(tx, {
        userId: user.id,
        campaignId: id,
        action: closed && protectedChanges.length ? "campaign.exceptional_change" : "campaign.updated",
        entityType: "Campaign",
        entityId: id,
        metadata: { fields: changes, ...(input.overrideReason && protectedChanges.length ? { reason: input.overrideReason } : {}) },
        ipHash,
      });
    }
    return updated;
  });
}

export type CampaignAction = "publish" | "unpublish" | "pause" | "resume" | "close";

/** Status transitions available to administrators. */
export async function transitionCampaign(id: string, action: CampaignAction, user: SessionUser, ipHash?: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${id} FOR UPDATE`;
    const c = await tx.campaign.findUnique({ where: { id }, include: { _count: { select: { draws: true } } } });
    if (!c) throw new AppError("NOT_FOUND", "Campaign not found", 404);
    const eff = effectiveStatus(c, now);
    let data: Prisma.CampaignUpdateInput;

    switch (action) {
      case "publish":
        if (c.status !== "DRAFT") throw new AppError("BAD_STATE", "Only draft campaigns can be published", 409);
        if (c.endsAt <= now) throw new AppError("BAD_STATE", "The end date is in the past", 409);
        data = { status: c.startsAt > now ? "SCHEDULED" : "ACTIVE" };
        break;
      case "unpublish":
        if (!["SCHEDULED", "ACTIVE", "PAUSED"].includes(eff) || c._count.draws > 0) {
          throw new AppError("BAD_STATE", "Only campaigns that are still open can be unpublished", 409);
        }
        data = { status: "DRAFT" };
        break;
      case "pause":
        if (eff !== "ACTIVE" && eff !== "SCHEDULED") throw new AppError("BAD_STATE", "Only active campaigns can be paused", 409);
        data = { status: "PAUSED" };
        break;
      case "resume":
        if (eff !== "PAUSED") throw new AppError("BAD_STATE", "Campaign is not paused", 409);
        data = { status: c.startsAt > now ? "SCHEDULED" : "ACTIVE" };
        break;
      case "close":
        if (!["ACTIVE", "PAUSED", "SCHEDULED"].includes(eff)) throw new AppError("BAD_STATE", "Campaign is not open", 409);
        data = { status: "CLOSED", closedAt: now };
        break;
    }
    const updated = await tx.campaign.update({ where: { id }, data });
    await writeAudit(tx, {
      userId: user.id,
      campaignId: id,
      action: `campaign.${action}`,
      entityType: "Campaign",
      entityId: id,
      metadata: { from: c.status, to: updated.status },
      ipHash,
    });
    return updated;
  });
}

/**
 * Persists time-driven transitions (SCHEDULED→ACTIVE, →CLOSED). Idempotent; returns campaigns that
 * were closed by this call so closing notifications are sent exactly once.
 */
export async function syncCampaignStatuses(now = new Date()) {
  await prisma.campaign.updateMany({
    where: { status: "SCHEDULED", startsAt: { lte: now }, endsAt: { gt: now }, closedAt: null },
    data: { status: "ACTIVE" },
  });
  const due = await prisma.campaign.findMany({
    where: { status: { in: ["SCHEDULED", "ACTIVE", "PAUSED"] }, OR: [{ endsAt: { lte: now } }, { closedAt: { not: null } }] },
    select: { id: true, status: true },
  });
  const closed: string[] = [];
  for (const c of due) {
    const res = await prisma.$transaction(async (tx) => {
      const r = await tx.campaign.updateMany({ where: { id: c.id, status: c.status }, data: { status: "CLOSED" } });
      if (r.count === 1) {
        await writeAudit(tx, { campaignId: c.id, action: "campaign.auto_closed", entityType: "Campaign", entityId: c.id, metadata: { from: c.status } });
      }
      return r.count;
    });
    if (res === 1) closed.push(c.id);
  }
  return closed;
}

/** The campaign shown at /giveaway: the featured one, else the most relevant published one. */
export async function getFeaturedCampaign(now = new Date()) {
  const settings = await getSettings();
  if (settings.featuredCampaignId) {
    const c = await prisma.campaign.findUnique({ where: { id: settings.featuredCampaignId } });
    if (c && c.status !== "DRAFT") return c;
  }
  const published = await prisma.campaign.findMany({
    where: { status: { not: "DRAFT" } },
    orderBy: [{ endsAt: "desc" }],
    take: 20,
  });
  const rank = (s: CampaignStatus) => ({ ACTIVE: 0, SCHEDULED: 1, PAUSED: 2, CLOSED: 3, DRAW_COMPLETED: 4, DRAFT: 9 })[s];
  return published.sort((a, b) => rank(effectiveStatus(a, now)) - rank(effectiveStatus(b, now)))[0] ?? null;
}

export async function getPublishedCampaignBySlug(slug: string) {
  const c = await prisma.campaign.findUnique({ where: { slug } });
  return c && c.status !== "DRAFT" ? c : null;
}

export async function countEligible(campaignId: string) {
  return prisma.participant.count({ where: { campaignId, status: { not: "INVALID" } } });
}

export function campaignSettings(c: Campaign) {
  return parseCampaignSettings(c.settings);
}
