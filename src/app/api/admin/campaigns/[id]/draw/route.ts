import { z } from "zod";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk, readJson } from "@/lib/api";
import { commitDraw, executeDraw } from "@/services/draws";

const schema = z.object({ action: z.enum(["commit", "execute"]), confirm: z.literal(true) });

export const POST = adminRoute<{ id: string }>("ADMIN", async (req, { user, ipHash }, { id }) => {
  const { action } = schema.parse(await readJson(req));
  if (action === "commit") {
    const draw = await commitDraw(id, user, ipHash);
    return jsonOk({ id: draw.id, round: draw.drandRound, roundAt: draw.drandRoundAt });
  }
  const pending = await prisma.draw.findFirst({ where: { campaignId: id, status: "COMMITTED" } });
  if (!pending) return jsonError("NO_DRAW", "There is no committed draw waiting for randomness", 409);
  const draw = await executeDraw(pending.id, { userId: user.id, ipHash });
  return jsonOk({ id: draw.id, status: draw.status });
});
