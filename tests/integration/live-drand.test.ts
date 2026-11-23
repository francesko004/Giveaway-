import { describe, expect, it } from "vitest";
import { commitDraw, executeDraw, toProof } from "@/services/draws";
import { verifyDrawProof } from "@/lib/fairness";
import { makeCampaign, makeUser, prisma, resetDb, seedParticipants } from "../helpers";

/**
 * Opt-in: performs a REAL draw against the public drand quicknet network.
 *   LIVE_DRAND=1 npx vitest run tests/integration/live-drand.test.ts
 */
describe.runIf(process.env.LIVE_DRAND === "1")("live drand draw", () => {
  it("commits a future round, waits for it, fetches + verifies it and selects winners", async () => {
    await resetDb();
    const admin = await makeUser();
    const c = await makeCampaign({ status: "CLOSED", startsAt: new Date(Date.now() - 7200_000), endsAt: new Date(Date.now() - 3600_000), drawAt: new Date(Date.now() - 3600_000) });
    await seedParticipants(c.id, 50);
    const draw = await commitDraw(c.id, admin, undefined, { leadSeconds: 60 });
    const wait = draw.drandRoundAt.getTime() - Date.now() + 4000;
    expect(wait).toBeGreaterThan(55_000);
    await new Promise((r) => setTimeout(r, wait));
    const done = await executeDraw(draw.id);
    expect(done.status).toBe("COMPLETED");
    const full = await prisma.draw.findUniqueOrThrow({ where: { id: draw.id }, include: { results: true } });
    const report = verifyDrawProof(toProof(full), full.snapshot);
    expect(report.checks.filter((x) => !x.ok)).toEqual([]);
    console.log(`live round ${full.drandRound} → winner ${full.results.find((r) => r.position === 0)?.referenceNumber}`);
  }, 180_000);
});
