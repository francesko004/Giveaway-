import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const campaigns = await prisma.campaign.findMany({ where: { status: { not: "DRAFT" } }, select: { id: true, slug: true, updatedAt: true } }).catch(() => []);
  return [
    { url: `${base}/giveaway`, changeFrequency: "daily", priority: 1 },
    ...campaigns.flatMap((c) => [
      { url: `${base}/giveaway/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.9 },
      { url: `${base}/verify/${c.id}`, lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.5 },
    ]),
    { url: `${base}/verify`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/terms`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
