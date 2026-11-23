import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { participantStatusSchema } from "@/lib/validation/admin";
import { setParticipantStatus } from "@/services/participants";

export const PATCH = adminRoute<{ id: string }>("ADMIN", async (req, { user, ipHash }, { id }) => {
  const { status, reason } = participantStatusSchema.parse(await readJson(req));
  const p = await setParticipantStatus(id, status, reason, user, ipHash);
  return jsonOk({ id: p.id, status: p.status });
});
