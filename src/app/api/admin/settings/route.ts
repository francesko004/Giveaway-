import { prisma } from "@/lib/db";
import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { settingsInputSchema } from "@/lib/validation/admin";
import { writeAudit } from "@/services/audit";
import type { Prisma } from "@/generated/prisma/client";

export const PATCH = adminRoute("SUPER_ADMIN", async (req, { user, ipHash }) => {
  const input = settingsInputSchema.parse(await readJson(req, 200_000));
  await prisma.$transaction(async (tx) => {
    const before = await tx.siteSettings.findUnique({ where: { id: 1 } });
    const data = {
      ...input,
      logoUrl: input.logoUrl || null,
      featuredCampaignId: input.featuredCampaignId || null,
      socialLinks: input.socialLinks as Prisma.InputJsonValue,
      termsContent: input.termsContent as Prisma.InputJsonValue,
      privacyContent: input.privacyContent as Prisma.InputJsonValue,
    };
    await tx.siteSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
    const changed = before ? Object.keys(input).filter((k) => JSON.stringify((before as Record<string, unknown>)[k] ?? null) !== JSON.stringify((data as Record<string, unknown>)[k] ?? null)) : Object.keys(input);
    await writeAudit(tx, {
      userId: user.id,
      action: "settings.updated",
      entityType: "SiteSettings",
      entityId: "1",
      metadata: { fields: changed, termsVersion: input.termsVersion, privacyVersion: input.privacyVersion },
      ipHash,
    });
  });
  return jsonOk({ ok: true });
});
