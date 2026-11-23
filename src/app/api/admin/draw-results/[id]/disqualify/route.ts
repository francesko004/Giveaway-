import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { reasonSchema } from "@/lib/validation/admin";
import { disqualifyResult } from "@/services/draws";

export const POST = adminRoute<{ id: string }>("ADMIN", async (req, { user, ipHash }, { id }) => {
  const { reason } = reasonSchema.parse(await readJson(req));
  await disqualifyResult(id, reason, user, ipHash);
  return jsonOk({ ok: true });
});
