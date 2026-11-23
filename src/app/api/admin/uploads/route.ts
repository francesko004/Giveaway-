import { adminRoute, jsonError, jsonOk } from "@/lib/api";
import { MAX_UPLOAD_BYTES, saveImage } from "@/lib/uploads";
import { audit } from "@/services/audit";

export const POST = adminRoute("ADMIN", async (req, { user, ipHash }) => {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64_000) return jsonError("TOO_LARGE", "Images must be 5 MB or smaller", 413);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("NO_FILE", "No file uploaded", 422);
  const url = await saveImage(await file.arrayBuffer(), user.id);
  await audit({ userId: user.id, action: "upload.created", entityType: "Upload", entityId: url, ipHash });
  return jsonOk({ url }, { status: 201 });
});
