import { prisma } from "@/lib/db";
import { adminRoute } from "@/lib/api";
import { toCsv } from "@/lib/csv";

export const GET = adminRoute("ADMIN", async () => {
  const rows = await prisma.auditLog.findMany({ orderBy: { seq: "asc" }, include: { user: { select: { email: true } } }, take: 200_000 });
  const csv = toCsv(
    ["seq", "createdAt", "user", "action", "entityType", "entityId", "campaignId", "metadata", "prevHash", "hash"],
    rows.map((r) => [r.seq, r.createdAt, r.user?.email ?? "system", r.action, r.entityType, r.entityId, r.campaignId, JSON.stringify(r.metadata), r.prevHash, r.hash]),
  );
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"` } });
});
