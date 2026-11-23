import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toProof } from "@/services/draws";

export const dynamic = "force-dynamic";

/** Public machine-readable proof for every draw of a campaign (newest first). No personal data. */
export async function GET(_req: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true, title: true, status: true } });
  if (!campaign || campaign.status === "DRAFT") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const draws = await prisma.draw.findMany({ where: { campaignId }, orderBy: { sequence: "desc" }, include: { results: true } });
  return NextResponse.json(
    {
      campaign: { id: campaign.id, title: campaign.title },
      draws: draws.map((d) => ({
        ...toProof(d),
        invalidatedAt: d.invalidatedAt,
        invalidationReason: d.invalidationReason,
        supersedesId: d.supersedesId,
        disqualifications: d.results.filter((r) => r.disqualifiedAt).map((r) => ({ position: r.position, at: r.disqualifiedAt, reason: r.disqualificationReason })),
      })),
    },
    { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } },
  );
}
