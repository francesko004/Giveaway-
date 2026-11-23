import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/services/settings";
import { startOfDayInZone } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Public participant count — only when the campaign is configured to show it. Aggregate numbers only. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c = await prisma.campaign.findUnique({ where: { slug }, select: { id: true, status: true, showParticipantCount: true } });
  if (!c || c.status === "DRAFT" || !c.showParticipantCount) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { timezone } = await getSettings();
  const [count, today] = await Promise.all([
    prisma.participant.count({ where: { campaignId: c.id, status: { not: "INVALID" } } }),
    prisma.participant.count({ where: { campaignId: c.id, status: { not: "INVALID" }, registeredAt: { gte: startOfDayInZone(new Date(), timezone) } } }),
  ]);
  return NextResponse.json({ count, today }, { headers: { "cache-control": "public, max-age=15, s-maxage=15" } });
}
