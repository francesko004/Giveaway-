import { prisma } from "@/lib/db";
import { getSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

/**
 * Canonical frozen entry list — opaque SHA-256 entry hashes only (no names, e-mails or phones).
 * SHA-256 of this exact byte stream must equal the published commitment.
 */
export async function GET(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const settings = await getSettings();
  if (!settings.publishSnapshot) return new Response("Snapshot publication is disabled", { status: 403 });
  const seq = Number(new URL(request.url).searchParams.get("draw") ?? "0");
  const draw = await prisma.draw.findFirst({
    where: { campaignId, campaign: { status: { not: "DRAFT" } }, ...(seq > 0 ? { sequence: seq } : {}) },
    orderBy: { sequence: "desc" },
    select: { snapshot: true, sequence: true, snapshotHash: true },
  });
  if (!draw) return new Response("Not found", { status: 404 });
  return new Response(draw.snapshot, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="snapshot-${campaignId}-draw${draw.sequence}.txt"`,
      "x-snapshot-sha256": draw.snapshotHash,
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
