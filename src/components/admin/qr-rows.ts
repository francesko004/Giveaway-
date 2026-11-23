import "server-only";
import { campaignAnalytics } from "@/services/analytics";
import { qrDataUrl, stableQrUrl } from "@/services/qr";
import type { QrRow } from "./qr-manager";
import { prisma } from "@/lib/db";

export async function qrRowsForCampaign(campaignId: string): Promise<QrRow[]> {
  const [analytics, sources] = await Promise.all([campaignAnalytics(campaignId), prisma.qRSource.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } })]);
  const stats = new Map(analytics.perSource.map((s) => [s.id, s]));
  return Promise.all(
    sources.map(async (s) => {
      const st = stats.get(s.id);
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        code: s.code,
        type: s.type,
        destination: s.destination,
        active: s.active,
        notes: s.notes,
        stableUrl: stableQrUrl(s.code),
        preview: await qrDataUrl(stableQrUrl(s.code), 240),
        scans: st?.scans ?? 0,
        visitors: st?.visitors ?? 0,
        registrations: st?.registrations ?? 0,
        conversion: st?.conversion ?? null,
      };
    }),
  );
}
