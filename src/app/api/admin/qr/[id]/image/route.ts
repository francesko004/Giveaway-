import { prisma } from "@/lib/db";
import { adminRoute, jsonError } from "@/lib/api";
import { qrPng, qrSvg, stableQrUrl } from "@/services/qr";

export const GET = adminRoute<{ id: string }>("VIEWER", async (req, _ctx, { id }) => {
  const source = await prisma.qRSource.findUnique({ where: { id }, include: { campaign: { select: { slug: true } } } });
  if (!source) return jsonError("NOT_FOUND", "QR source not found", 404);
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "svg" ? "svg" : "png";
  const size = Math.min(Math.max(Number(url.searchParams.get("size") ?? 1024) || 1024, 256), 4096);
  const filename = `qr-${source.campaign.slug}-${source.slug}.${format}`;
  const disposition = url.searchParams.get("download") ? `attachment; filename="${filename}"` : "inline";
  const target = stableQrUrl(source.code);
  if (format === "svg") {
    return new Response(await qrSvg(target), { headers: { "content-type": "image/svg+xml", "content-disposition": disposition, "cache-control": "private, max-age=300" } });
  }
  return new Response(new Uint8Array(await qrPng(target, size)), { headers: { "content-type": "image/png", "content-disposition": disposition, "cache-control": "private, max-age=300" } });
});
