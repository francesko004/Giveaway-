import { prisma } from "@/lib/db";
import { adminRoute, jsonError } from "@/lib/api";
import { exportPersonalData } from "@/services/participants";
import { writeAudit } from "@/services/audit";

/** Machine-readable copy of all data held about the requester (right of access / portability). */
export const GET = adminRoute<{ id: string }>("SUPER_ADMIN", async (_req, { user, ipHash }, { id }) => {
  const request = await prisma.dataRequest.findUnique({ where: { id } });
  if (!request) return jsonError("NOT_FOUND", "Request not found", 404);
  const data = await exportPersonalData(request.email, request.phone ?? undefined);
  await prisma.$transaction((tx) => writeAudit(tx, { userId: user.id, action: "privacy.data_exported", entityType: "DataRequest", entityId: id, metadata: { records: data.length }, ipHash }));
  return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), subject: { email: request.email, phone: request.phone }, records: data }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="data-export-${id}.json"`, "cache-control": "no-store" },
  });
});
