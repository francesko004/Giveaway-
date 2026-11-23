import { beforeEach, describe, expect, it } from "vitest";
import { commitDraw, currentWinners, disqualifyResult, executeDraw, getPublicVerification, invalidateDraw, toProof } from "@/services/draws";
import { setParticipantStatus } from "@/services/participants";
import { updateCampaign } from "@/services/campaigns";
import { verifyAuditChain } from "@/services/audit";
import { QUICKNET, buildSnapshot, entryHash, hashSnapshot, roundTime, serializeSnapshot, verifyDrawProof } from "@/lib/fairness";
import { utcToZonedLocal } from "@/lib/time";
import { QUICKNET_BEACONS } from "../fixtures/drand";
import { makeCampaign, makeUser, prisma, resetDb, seedParticipants } from "../helpers";

const LEAD = 60;
const R1000_AT = roundTime(QUICKNET, 1000);
/** A commitment time at which the first eligible future round is exactly 1000. */
const COMMIT_AT = new Date((R1000_AT - 3 - LEAD + 1) * 1000);
const REVEAL_AT = new Date((R1000_AT + 5) * 1000);

const beaconFetch = (beacon: object | null, status = 200) => async () => (beacon ? Response.json(beacon) : new Response("too early", { status }));
const good = beaconFetch(QUICKNET_BEACONS[1000]);

async function closedCampaign(entries = 10) {
  const c = await makeCampaign({
    status: "CLOSED",
    startsAt: new Date("2023-08-01T00:00:00Z"),
    endsAt: new Date("2023-08-23T00:00:00Z"),
    drawAt: new Date("2023-08-23T00:00:00Z"),
    winnerCount: 1,
    alternateCount: 2,
  });
  const people = await seedParticipants(c.id, entries);
  return { c, people };
}

describe("fairness engine — end to end", () => {
  beforeEach(resetDb);

  it("commits a future round, reveals verified randomness and produces a publicly verifiable result", async () => {
    const admin = await makeUser();
    const { c } = await closedCampaign(10);

    const draw = await commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD });
    expect(draw.status).toBe("COMMITTED");
    expect(draw.drandRound).toBe(1000);
    expect(draw.drandRoundAt.getTime()).toBeGreaterThan(draw.commitmentAt.getTime());
    expect(draw.entryCount).toBe(10);
    expect(draw.snapshot).not.toMatch(/@|Participant|\+355/); // no personal data in the snapshot
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).lockedAt).not.toBeNull();

    await expect(executeDraw(draw.id, { now: new Date(COMMIT_AT.getTime() + 1000), fetchImpl: good })).rejects.toMatchObject({ code: "NOT_YET" });

    const done = await executeDraw(draw.id, { now: REVEAL_AT, fetchImpl: good, urls: ["https://relay.test"] });
    expect(done.status).toBe("COMPLETED");
    expect(done.randomness).toBe(QUICKNET_BEACONS[1000].randomness);

    const full = await prisma.draw.findUniqueOrThrow({ where: { id: draw.id }, include: { results: true } });
    expect(full.results).toHaveLength(3);
    expect(full.results.find((r) => r.position === 0)?.role).toBe("WINNER");
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("DRAW_COMPLETED");

    const report = verifyDrawProof(toProof(full), full.snapshot);
    expect(report.checks.filter((x) => !x.ok)).toEqual([]);

    const pub = await getPublicVerification(c.id);
    expect(JSON.stringify(pub)).not.toMatch(/@example\.com|\+3556900/);
  });

  it("snapshot contains exactly the eligible entries and is independent of insertion order", async () => {
    const admin = await makeUser();
    const { c, people } = await closedCampaign(6);
    const invalid = await prisma.participant.findUniqueOrThrow({ where: { referenceNumber: people[2].referenceNumber } });
    await setParticipantStatus(invalid.id, "INVALID", "Duplicate person using a second number", admin);

    const draw = await commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD });
    const expected = serializeSnapshot(
      buildSnapshot(
        c.id,
        people.filter((_, i) => i !== 2).reverse().map((p) => entryHash(c.id, p.referenceNumber)),
      ),
    );
    expect(draw.snapshot).toBe(expected);
    expect(draw.snapshotHash).toBe(hashSnapshot(expected));
    expect(draw.entryCount).toBe(5);
  });

  it("is deterministic: the same snapshot and randomness always give the same winner", async () => {
    const winners: string[] = [];
    for (let i = 0; i < 2; i++) {
      await resetDb();
      const u = await makeUser();
      const c = await makeCampaign({ id: "cmdeterminism000000000001", status: "CLOSED", startsAt: new Date("2023-01-01"), endsAt: new Date("2023-01-02"), drawAt: new Date("2023-01-02") });
      await seedParticipants(c.id, 25);
      const d = await commitDraw(c.id, u, undefined, { now: COMMIT_AT, leadSeconds: LEAD });
      await executeDraw(d.id, { now: REVEAL_AT, fetchImpl: good });
      const r = await prisma.drawResult.findFirstOrThrow({ where: { drawId: d.id, position: 0 } });
      winners.push(r.referenceNumber);
    }
    expect(winners[0]).toBe(winners[1]);
  });

  it("retries the SAME predetermined round when the beacon is unavailable and rejects forged beacons", async () => {
    const admin = await makeUser();
    const { c } = await closedCampaign(5);
    const draw = await commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD });

    await expect(executeDraw(draw.id, { now: REVEAL_AT, fetchImpl: beaconFetch(null, 500), urls: ["https://down.test"] })).rejects.toMatchObject({ code: "BEACON_UNAVAILABLE" });
    // A relay serving a genuine beacon for a DIFFERENT round must not be accepted.
    await expect(executeDraw(draw.id, { now: REVEAL_AT, fetchImpl: beaconFetch(QUICKNET_BEACONS[1001]), urls: ["https://evil.test"] })).rejects.toMatchObject({ code: "BEACON_UNAVAILABLE" });
    // Forged randomness with a real signature
    await expect(
      executeDraw(draw.id, { now: REVEAL_AT, fetchImpl: beaconFetch({ ...QUICKNET_BEACONS[1000], randomness: "11".repeat(32) }), urls: ["https://evil.test"] }),
    ).rejects.toMatchObject({ code: "BEACON_UNAVAILABLE" });

    const pending = await prisma.draw.findUniqueOrThrow({ where: { id: draw.id } });
    expect(pending.status).toBe("COMMITTED");
    expect(pending.attemptCount).toBe(3);
    expect(pending.drandRound).toBe(1000);

    const done = await executeDraw(draw.id, { now: REVEAL_AT, fetchImpl: good });
    expect(done.status).toBe("COMPLETED");
    // A second execution is a no-op: randomness can never be replaced.
    const again = await executeDraw(draw.id, { now: REVEAL_AT, fetchImpl: beaconFetch(QUICKNET_BEACONS[1001]) });
    expect(again.randomness).toBe(QUICKNET_BEACONS[1000].randomness);
  });

  it("refuses to commit while registration is open, while entries are flagged, or twice", async () => {
    const admin = await makeUser();
    const open = await makeCampaign();
    await seedParticipants(open.id, 3, "OP");
    await expect(commitDraw(open.id, admin)).rejects.toMatchObject({ code: "STILL_OPEN" });

    const { c, people } = await closedCampaign(3);
    await prisma.participant.update({ where: { referenceNumber: people[0].referenceNumber }, data: { status: "FLAGGED" } });
    await expect(commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD })).rejects.toMatchObject({ code: "NEEDS_REVIEW" });
    await prisma.participant.update({ where: { referenceNumber: people[0].referenceNumber }, data: { status: "ELIGIBLE" } });
    await commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD });
    await expect(commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD })).rejects.toMatchObject({ code: "DRAW_EXISTS" });
  });

  it("never commits to a round that is not in the future", async () => {
    const admin = await makeUser();
    const { c } = await closedCampaign(3);
    const draw = await commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: 10 }); // lead is clamped to >= 60 s
    expect(draw.drandRoundAt.getTime() - draw.commitmentAt.getTime()).toBeGreaterThanOrEqual(60_000);
  });

  it("honours a scheduled draw date: the committed round is the first one after drawAt", async () => {
    const admin = await makeUser();
    const drawAt = new Date((R1000_AT + 3600) * 1000);
    const c = await makeCampaign({ status: "CLOSED", startsAt: new Date("2023-01-01"), endsAt: new Date("2023-01-02"), drawAt });
    await seedParticipants(c.id, 3);
    const draw = await commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD });
    expect(draw.drandRoundAt.getTime()).toBeGreaterThan(drawAt.getTime());
    expect(draw.drandRoundAt.getTime() - drawAt.getTime()).toBeLessThanOrEqual(QUICKNET.period * 1000);
  });

  it("invalidation preserves the original proof and links the re-draw to it", async () => {
    const admin = await makeUser();
    const { c } = await closedCampaign(5);
    const first = await commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD });
    await executeDraw(first.id, { now: REVEAL_AT, fetchImpl: good });

    await expect(invalidateDraw(first.id, "short", admin)).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await invalidateDraw(first.id, "Winner list included staff members by mistake", admin);

    const kept = await prisma.draw.findUniqueOrThrow({ where: { id: first.id }, include: { results: true } });
    expect(kept.status).toBe("INVALIDATED");
    expect(kept.randomness).toBe(QUICKNET_BEACONS[1000].randomness);
    expect(kept.results).toHaveLength(3);

    const second = await commitDraw(c.id, admin, undefined, { now: new Date(REVEAL_AT.getTime() + 1000), leadSeconds: LEAD });
    expect(second.sequence).toBe(2);
    expect(second.supersedesId).toBe(first.id);
    expect(second.drandRound).toBeGreaterThan(first.drandRound);
  });

  it("alternates replace disqualified winners in the published order", async () => {
    const admin = await makeUser();
    const { c } = await closedCampaign(8);
    const d = await commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD });
    await executeDraw(d.id, { now: REVEAL_AT, fetchImpl: good });
    const results = await prisma.drawResult.findMany({ where: { drawId: d.id }, orderBy: { position: "asc" } });
    await disqualifyResult(results[0].id, "Winner could not be reached within 14 days", admin);
    const after = await prisma.drawResult.findMany({ where: { drawId: d.id } });
    expect(currentWinners(after, 1)[0].id).toBe(results[1].id);
  });

  it("protects draw parameters of a closed campaign; exceptional changes are audited and invalidate the draw", async () => {
    const superAdmin = await makeUser("SUPER_ADMIN");
    const admin = await makeUser("ADMIN");
    const { c } = await closedCampaign(4);
    const d = await commitDraw(c.id, superAdmin, undefined, { now: COMMIT_AT, leadSeconds: LEAD });
    const tz = "Europe/Tirane";
    const input = {
      title: c.title,
      slug: c.slug,
      description: c.description,
      prizeName: c.prizeName,
      prizeDescription: c.prizeDescription,
      prizeImage: "",
      prizeValue: "",
      eligibility: "",
      startsAt: utcToZonedLocal(c.startsAt, tz),
      endsAt: utcToZonedLocal(c.endsAt, tz),
      drawAt: utcToZonedLocal(c.drawAt, tz),
      winnerCount: 2,
      alternateCount: 2,
      showParticipantCount: false,
      referencePrefix: "GIVE",
      settings: c.settings as never,
      translations: {},
    };
    await expect(updateCampaign(c.id, input, admin)).rejects.toMatchObject({ code: "PROTECTED" });
    await expect(updateCampaign(c.id, input, superAdmin)).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    // Non-protected fields can still be edited
    await expect(updateCampaign(c.id, { ...input, winnerCount: 1, description: "Updated public description" }, admin)).resolves.toBeTruthy();

    await updateCampaign(c.id, { ...input, overrideReason: "Sponsor added a second prize after the campaign closed" }, superAdmin);
    expect((await prisma.draw.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("INVALIDATED");
    const log = await prisma.auditLog.findMany({ where: { campaignId: c.id, action: { in: ["draw.invalidated", "campaign.exceptional_change"] } } });
    expect(log).toHaveLength(2);
  });
});

describe("database-level immutability", () => {
  beforeEach(resetDb);

  async function completedDraw() {
    const admin = await makeUser();
    const { c, people } = await closedCampaign(5);
    const d = await commitDraw(c.id, admin, undefined, { now: COMMIT_AT, leadSeconds: LEAD });
    await executeDraw(d.id, { now: REVEAL_AT, fetchImpl: good });
    return { c, d, people };
  }

  it("blocks rewriting the commitment", async () => {
    const { d } = await completedDraw();
    await expect(prisma.draw.update({ where: { id: d.id }, data: { snapshotHash: "00".repeat(32) } })).rejects.toThrow(/GV_IMMUTABLE/);
    await expect(prisma.draw.update({ where: { id: d.id }, data: { drandRound: 1001 } })).rejects.toThrow(/GV_IMMUTABLE/);
    await expect(prisma.draw.update({ where: { id: d.id }, data: { entryCount: 4 } })).rejects.toThrow(/GV_IMMUTABLE/);
  });

  it("blocks replacing revealed randomness or the winner", async () => {
    const { d } = await completedDraw();
    await expect(prisma.draw.update({ where: { id: d.id }, data: { randomness: QUICKNET_BEACONS[1001].randomness } })).rejects.toThrow(/GV_IMMUTABLE/);
    await expect(prisma.draw.update({ where: { id: d.id }, data: { winningEntryId: "someone-else" } })).rejects.toThrow(/GV_IMMUTABLE/);
    const r = await prisma.drawResult.findFirstOrThrow({ where: { drawId: d.id } });
    await expect(prisma.drawResult.update({ where: { id: r.id }, data: { referenceNumber: "GIVE-2026-FAKE" } })).rejects.toThrow(/GV_IMMUTABLE/);
  });

  it("blocks deleting draws, results and audit records", async () => {
    const { d } = await completedDraw();
    await expect(prisma.drawResult.deleteMany({ where: { drawId: d.id } })).rejects.toThrow(/GV_IMMUTABLE/);
    await expect(prisma.draw.delete({ where: { id: d.id } })).rejects.toThrow(/GV_IMMUTABLE/);
    await expect(prisma.auditLog.deleteMany({})).rejects.toThrow(/GV_IMMUTABLE/);
    const a = await prisma.auditLog.findFirstOrThrow();
    await expect(prisma.auditLog.update({ where: { id: a.id }, data: { action: "nothing.happened" } })).rejects.toThrow(/GV_IMMUTABLE/);
  });

  it("blocks re-classifying entries or inserting new ones after the freeze", async () => {
    const { c, people } = await completedDraw();
    await expect(prisma.participant.update({ where: { referenceNumber: people[0].referenceNumber }, data: { status: "INVALID" } })).rejects.toThrow(/GV_LOCKED/);
    await expect(seedParticipants(c.id, 1, "LATE")).rejects.toThrow(/GV_LOCKED/);
    await expect(prisma.campaign.update({ where: { id: c.id }, data: { lockedAt: null } })).rejects.toThrow(/GV_LOCKED/);
  });

  it("blocks completed draws from going back to committed and rejects draws created with randomness", async () => {
    const { c, d } = await completedDraw();
    await expect(prisma.draw.update({ where: { id: d.id }, data: { status: "COMMITTED" } })).rejects.toThrow(/GV_IMMUTABLE/);
    await expect(
      prisma.draw.create({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        data: { ...((({ id, results, ...rest }) => rest)(await prisma.draw.findUniqueOrThrow({ where: { id: d.id }, include: { results: true } })) as Record<string, unknown>), campaignId: c.id, sequence: 9, supersedesId: null } as never,
      }),
    ).rejects.toThrow(/GV_IMMUTABLE/);
  });

  it("keeps a verifiable hash chain over the audit log and detects tampering", async () => {
    await completedDraw();
    expect((await verifyAuditChain()).ok).toBe(true);
    // Simulate a DBA bypassing the triggers.
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" DISABLE TRIGGER gv_audit_update`);
    await prisma.$executeRawUnsafe(`UPDATE "AuditLog" SET "metadata" = '{"tampered":true}' WHERE seq = 1`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditLog" ENABLE TRIGGER gv_audit_update`);
    expect(await verifyAuditChain()).toMatchObject({ ok: false, brokenAt: 1 });
  });
});
