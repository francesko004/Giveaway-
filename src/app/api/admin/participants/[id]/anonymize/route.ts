import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { reasonSchema } from "@/lib/validation/admin";
import { anonymizeParticipant } from "@/services/participants";

export const POST = adminRoute<{ id: string }>("SUPER_ADMIN", async (req, { user, ipHash }, { id }) => {
  const { reason } = reasonSchema.parse(await readJson(req));
  await anonymizeParticipant(id, reason, user, ipHash);
  return jsonOk({ ok: true });
});
