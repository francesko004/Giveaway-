import "server-only";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { randomCode } from "@/lib/security/crypto";
import { visitorHash } from "@/lib/security/request";
import type { SessionUser } from "@/lib/auth/session";
import type { SourceType } from "@/generated/prisma/enums";
import { writeAudit } from "./audit";
import { getSettings } from "./settings";

/** The URL printed in the QR code. Stable forever: only the server-side destination can change. */
export function stableQrUrl(code: string) {
  return appUrl(`/q/${code}`);
}

export function defaultDestination(campaignSlug: string) {
  return `/giveaway/${campaignSlug}`;
}

export interface QrSourceInput {
  name: string;
  slug: string;
  type: SourceType;
  destination?: string;
  notes?: string;
  active?: boolean;
}

export async function createQrSource(campaignId: string, input: QrSourceInput, user: SessionUser, ipHash?: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { slug: true } });
  if (!campaign) throw new AppError("NOT_FOUND", "Campaign not found", 404);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const source = await tx.qRSource.create({
          data: {
            campaignId,
            name: input.name,
            slug: input.slug,
            type: input.type,
            code: randomCode(7).toLowerCase(),
            destination: input.destination || defaultDestination(campaign.slug),
            notes: input.notes || null,
          },
        });
        await writeAudit(tx, { userId: user.id, campaignId, action: "qr.created", entityType: "QRSource", entityId: source.id, metadata: { name: source.name, slug: source.slug, code: source.code }, ipHash });
        return source;
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        if (String((e as Error).message).includes("code")) continue;
        throw new AppError("SLUG_TAKEN", "This source ID is already used in this campaign", 409);
      }
      throw e;
    }
  }
  throw new AppError("INTERNAL", "Could not allocate a QR code", 500);
}

export async function updateQrSource(id: string, input: Partial<QrSourceInput>, user: SessionUser, ipHash?: string) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.qRSource.findUnique({ where: { id }, include: { campaign: { select: { slug: true } } } });
    if (!before) throw new AppError("NOT_FOUND", "QR source not found", 404);
    // The ?src= value is part of attribution history: it cannot change once entries reference it.
    if (input.slug && input.slug !== before.slug && (await tx.participant.count({ where: { qrSourceId: id } })) > 0) {
      throw new AppError("SLUG_LOCKED", "The source ID cannot change after registrations were attributed to it", 409);
    }
    try {
      const updated = await tx.qRSource.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.destination !== undefined ? { destination: input.destination || defaultDestination(before.campaign.slug) } : {}),
          ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        campaignId: before.campaignId,
        action: input.active === false ? "qr.disabled" : input.active === true && !before.active ? "qr.enabled" : "qr.updated",
        entityType: "QRSource",
        entityId: id,
        metadata: { before: { name: before.name, slug: before.slug, destination: before.destination, active: before.active }, after: { name: updated.name, slug: updated.slug, destination: updated.destination, active: updated.active } },
        ipHash,
      });
      return updated;
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError("SLUG_TAKEN", "This source ID is already used in this campaign", 409);
      throw e;
    }
  });
}

const QR_COLORS = { dark: "#14243A", light: "#FFFFFF" };

export function qrPng(url: string, size = 1024) {
  return QRCode.toBuffer(url, { type: "png", errorCorrectionLevel: "M", margin: 2, width: size, color: QR_COLORS });
}

export function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: QR_COLORS });
}

export function qrDataUrl(url: string, size = 320) {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: size, color: QR_COLORS });
}

/**
 * Resolves a scanned stable code. Disabled sources and unpublished campaigns fall back to the
 * campaign page without attribution, so printed codes never lead to a dead end.
 */
export async function resolveScan(code: string, headers: Headers | { get(n: string): string | null }) {
  if (!/^[0-9a-z]{4,16}$/.test(code)) return null;
  const source = await prisma.qRSource.findUnique({ where: { code }, include: { campaign: { select: { id: true, slug: true, status: true } } } });
  if (!source) return null;
  if (!source.active || source.campaign.status === "DRAFT") return { url: "/giveaway", tracked: false };

  const settings = await getSettings();
  if (settings.analyticsEnabled) {
    await prisma.pageVisit
      .create({ data: { campaignId: source.campaignId, qrSourceId: source.id, kind: "SCAN", visitorHash: visitorHash(headers, source.campaignId) } })
      .catch(() => {});
  }
  const dest = new URL(source.destination, "http://internal.invalid");
  dest.searchParams.set("src", source.slug);
  if (!dest.searchParams.has("utm_medium")) dest.searchParams.set("utm_medium", "qr");
  return { url: `${dest.pathname}${dest.search}`, tracked: true };
}

export async function recordLandingVisit(campaignId: string, src: string | undefined, headers: Headers | { get(n: string): string | null }) {
  const settings = await getSettings();
  if (!settings.analyticsEnabled) return;
  const ua = headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|preview|facebookexternalhit|whatsapp|slackbot|telegram/i.test(ua)) return;
  const source = src ? await prisma.qRSource.findFirst({ where: { campaignId, slug: src }, select: { id: true } }) : null;
  await prisma.pageVisit
    .create({ data: { campaignId, qrSourceId: source?.id ?? null, kind: "LANDING", visitorHash: visitorHash(headers, campaignId) } })
    .catch(() => {});
}
