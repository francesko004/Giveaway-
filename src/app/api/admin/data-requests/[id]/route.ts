import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { canonicalEmail } from "@/lib/validation/email";
import { anonymizeParticipant } from "@/services/participants";
import { writeAudit } from "@/services/audit";

const schema = z.object({
  status: z.enum(["COMPLETED", "REJECTED"]),
  resolution: z.string().trim().min(10).max(2000),
  /** For DELETION: anonymise all matching entries. For MARKETING_OPT_OUT: withdraw marketing consent. */
  apply: z.boolean().default(false),
});

export const PATCH = adminRoute<{ id: string }>("SUPER_ADMIN", async (req, { user, ipHash }, { id }) => {
  const input = schema.parse(await readJson(req));
  const request = await prisma.dataRequest.findUnique({ where: { id } });
  if (!request) throw new AppError("NOT_FOUND", "Request not found", 404);
  if (request.status !== "PENDING") throw new AppError("BAD_STATE", "Request already resolved", 409);

  const matches = await prisma.participant.findMany({
    where: { OR: [{ emailCanonical: canonicalEmail(request.email) }, ...(request.phone ? [{ phone: request.phone }] : [])], anonymizedAt: null },
    select: { id: true },
  });
  let affected = 0;
  if (input.apply && input.status === "COMPLETED") {
    if (request.type === "DELETION") {
      for (const m of matches) await anonymizeParticipant(m.id, `Data subject erasure request ${id}`, user, ipHash);
      affected = matches.length;
    } else if (request.type === "MARKETING_OPT_OUT") {
      await prisma.$transaction(async (tx) => {
        for (const m of matches) {
          await tx.participant.update({ where: { id: m.id }, data: { marketingConsent: false } });
          await tx.consentRecord.create({ data: { participantId: m.id, consentType: "MARKETING", accepted: false, policyVersion: `withdrawn:${id}` } });
        }
      });
      affected = matches.length;
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.dataRequest.update({ where: { id }, data: { status: input.status, resolution: input.resolution, resolvedAt: new Date(), resolvedById: user.id } });
    await writeAudit(tx, { userId: user.id, action: "privacy.request_resolved", entityType: "DataRequest", entityId: id, metadata: { type: request.type, status: input.status, affected }, ipHash });
  });
  return jsonOk({ affected });
});
