import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { campaignInputSchema } from "@/lib/validation/admin";
import { createCampaign } from "@/services/campaigns";

export const POST = adminRoute("ADMIN", async (req, { user, ipHash }) => {
  const input = campaignInputSchema.parse(await readJson(req));
  const campaign = await createCampaign(input, user, ipHash);
  return jsonOk({ id: campaign.id }, { status: 201 });
});
