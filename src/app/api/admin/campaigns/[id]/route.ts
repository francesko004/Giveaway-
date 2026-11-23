import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { campaignInputSchema } from "@/lib/validation/admin";
import { updateCampaign } from "@/services/campaigns";

export const PATCH = adminRoute<{ id: string }>("ADMIN", async (req, { user, ipHash }, { id }) => {
  const input = campaignInputSchema.parse(await readJson(req));
  const c = await updateCampaign(id, input, user, ipHash);
  return jsonOk({ id: c.id });
});
