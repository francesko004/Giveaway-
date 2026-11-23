import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { qrSourceInputSchema } from "@/lib/validation/admin";
import { updateQrSource } from "@/services/qr";

export const PATCH = adminRoute<{ id: string }>("ADMIN", async (req, { user, ipHash }, { id }) => {
  const input = qrSourceInputSchema.partial().parse(await readJson(req));
  const s = await updateQrSource(id, input, user, ipHash);
  return jsonOk({ id: s.id, active: s.active });
});
