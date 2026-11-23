import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { qrSourceInputSchema } from "@/lib/validation/admin";
import { createQrSource } from "@/services/qr";

export const POST = adminRoute<{ id: string }>("ADMIN", async (req, { user, ipHash }, { id }) => {
  const input = qrSourceInputSchema.parse(await readJson(req));
  const s = await createQrSource(id, input, user, ipHash);
  return jsonOk({ id: s.id, code: s.code }, { status: 201 });
});
