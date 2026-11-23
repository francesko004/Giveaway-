import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { reasonSchema } from "@/lib/validation/admin";
import { invalidateDraw } from "@/services/draws";

/** SUPER_ADMIN only: public cancellation of a draw (the proof is preserved and shown publicly). */
export const POST = adminRoute<{ id: string }>("SUPER_ADMIN", async (req, { user, ipHash }, { id }) => {
  const { reason } = reasonSchema.parse(await readJson(req));
  await invalidateDraw(id, reason, user, ipHash);
  return jsonOk({ ok: true });
});
