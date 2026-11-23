import { z } from "zod";
import { adminRoute, jsonOk, readJson } from "@/lib/api";
import { transitionCampaign } from "@/services/campaigns";

const schema = z.object({ action: z.enum(["publish", "unpublish", "pause", "resume", "close"]) });

export const POST = adminRoute<{ id: string }>("ADMIN", async (req, { user, ipHash }, { id }) => {
  const { action } = schema.parse(await readJson(req));
  const c = await transitionCampaign(id, action, user, ipHash);
  return jsonOk({ status: c.status });
});
