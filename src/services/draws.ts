import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  ALGORITHM_VERSION,
  BeaconNotYetAvailableError,
  KNOWN_CHAINS,
  QUICKNET,
  buildSnapshot,
  entryHash,
  fetchVerifiedBeacon,
  firstRoundAfter,
  hashSnapshot,
  roundTime,
  selectWinners,
  serializeSnapshot,
  verifyDrawProof,
  type DrandChain,
  type DrawProof,
  type FetchLike,
} from "@/lib/fairness";
import type { Draw, DrawResult } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { writeAudit } from "./audit";
import { isClosedForEntries } from "./campaign-status";

export interface DrawOptions {
  now?: Date;
  chain?: DrandChain;
  fetchImpl?: FetchLike;
  urls?: string[];
  leadSeconds?: number;
}

function drandUrls(opts: DrawOptions) {
  if (opts.urls) return opts.urls;
  const configured = env().DRAND_URLS?.split(",").map((s) => s.trim()).filter(Boolean);
  return configured?.length ? configured : undefined;
}

/** Pre-flight checks shown in the admin draw console. */
export async function drawReadiness(campaignId: string, now = new Date()) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new AppError("NOT_FOUND", "Campaign not found", 404);
  const [eligible, flagged, invalid, activeDraw] = await Promise.all([
    prisma.participant.count({ where: { campaignId, status: "ELIGIBLE" } }),
    prisma.participant.count({ where: { campaignId, status: "FLAGGED" } }),
    prisma.participant.count({ where: { campaignId, status: "INVALID" } }),
    prisma.draw.findFirst({ where: { campaignId, status: { not: "INVALIDATED" } } }),
  ]);
  const closed = isClosedForEntries(campaign, now);
  const blockers: string[] = [];
  if (!closed) blockers.push("Registration is still open. Close the campaign or wait for the end date.");
  if (flagged > 0) blockers.push(`${flagged} flagged entr${flagged === 1 ? "y needs" : "ies need"} review (mark valid or invalid).`);
  if (eligible === 0) blockers.push("There are no eligible entries.");
  if (activeDraw) blockers.push("A draw already exists for this campaign.");
  return { campaign, eligible, flagged, invalid, closed, activeDraw, blockers, canCommit: blockers.length === 0 };
}

/**
 * STEP 1 + 2 + 3 (commit): freezes the eligible entry list, publishes SHA-256(snapshot) and fixes a FUTURE
 * drand round. After this call nobody — including administrators — can change the entries, the round,
 * or the algorithm; the database enforces it.
 */
export async function commitDraw(campaignId: string, user: SessionUser, ipHash?: string, opts: DrawOptions = {}) {
  const now = opts.now ?? new Date();
  const chain = opts.chain ?? QUICKNET;
  const lead = Math.max(opts.leadSeconds ?? env().DRAW_COMMIT_LEAD_SECONDS, 60);

  return prisma.$transaction(
    async (tx) => {
      // FOR UPDATE waits for in-flight registrations (which hold FOR SHARE) and blocks new ones.
      await tx.$queryRaw`SELECT id FROM "Campaign" WHERE id = ${campaignId} FOR UPDATE`;
      const campaign = await tx.campaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new AppError("NOT_FOUND", "Campaign not found", 404);
      if (!isClosedForEntries(campaign, now)) throw new AppError("STILL_OPEN", "Registration must be closed before the draw is committed", 409);
      if (await tx.draw.findFirst({ where: { campaignId, status: { not: "INVALIDATED" } } })) {
        throw new AppError("DRAW_EXISTS", "A draw already exists for this campaign", 409);
      }
      const flagged = await tx.participant.count({ where: { campaignId, status: "FLAGGED" } });
      if (flagged > 0) throw new AppError("NEEDS_REVIEW", `${flagged} flagged entries must be reviewed first`, 409);

      const eligible = await tx.participant.findMany({ where: { campaignId, status: "ELIGIBLE" }, select: { referenceNumber: true } });
      if (eligible.length === 0) throw new AppError("NO_ENTRIES", "There are no eligible entries", 409);

      const snapshot = serializeSnapshot(buildSnapshot(campaignId, eligible.map((p) => entryHash(campaignId, p.referenceNumber))));
      const snapshotHash = hashSnapshot(snapshot);

      const nowSec = Math.floor(now.getTime() / 1000);
      const notBefore = Math.max(nowSec + lead, Math.floor(campaign.drawAt.getTime() / 1000));
      const round = firstRoundAfter(chain, notBefore);
      const roundAt = new Date(roundTime(chain, round) * 1000);

      const previous = await tx.draw.findFirst({ where: { campaignId }, orderBy: { sequence: "desc" }, include: { supersededBy: { select: { id: true } } } });

      await tx.campaign.update({ where: { id: campaignId }, data: { lockedAt: now, status: "CLOSED" } });
      const draw = await tx.draw.create({
        data: {
          campaignId,
          sequence: (previous?.sequence ?? 0) + 1,
          status: "COMMITTED",
          algorithmVersion: ALGORITHM_VERSION,
          snapshotHash,
          snapshot,
          entryCount: eligible.length,
          winnerCount: campaign.winnerCount,
          alternateCount: campaign.alternateCount,
          commitmentAt: now,
          drandNetwork: chain.network,
          drandChainHash: chain.chainHash,
          drandPublicKey: chain.publicKey,
          drandScheme: chain.scheme,
          drandPeriod: chain.period,
          drandGenesis: chain.genesis,
          drandRound: round,
          drandRoundAt: roundAt,
          supersedesId: previous && previous.status === "INVALIDATED" && !previous.supersededBy ? previous.id : null,
          createdById: user.id,
        },
      });
      await writeAudit(tx, {
        userId: user.id,
        campaignId,
        action: "draw.committed",
        entityType: "Draw",
        entityId: draw.id,
        metadata: { sequence: draw.sequence, snapshotHash, entryCount: eligible.length, drandRound: round, drandRoundAt: roundAt.toISOString(), chain: chain.chainHash },
        ipHash,
      });
      return draw;
    },
    { timeout: 60_000 },
  );
}

/**
 * STEP 3 (reveal) + STEP 4: retrieves the PRE-COMMITTED round, verifies its BLS signature against the pinned
 * network key, computes winners deterministically and stores everything. Safe to call repeatedly — if the
 * beacon is unavailable it only records the attempt and retries the same round next time.
 */
export async function executeDraw(drawId: string, opts: DrawOptions & { userId?: string | null; ipHash?: string } = {}) {
  const now = opts.now ?? new Date();
  const draw = await prisma.draw.findUnique({ where: { id: drawId } });
  if (!draw) throw new AppError("NOT_FOUND", "Draw not found", 404);
  if (draw.status !== "COMMITTED") return draw;

  const chain = KNOWN_CHAINS[draw.drandChainHash];
  if (!chain || chain.publicKey !== draw.drandPublicKey) throw new AppError("CHAIN", "Unknown drand chain", 500);

  let beacon;
  try {
    beacon = await fetchVerifiedBeacon(chain, draw.drandRound, {
      fetchImpl: opts.fetchImpl,
      urls: drandUrls(opts),
      nowSeconds: Math.floor(now.getTime() / 1000),
    });
  } catch (error) {
    if (error instanceof BeaconNotYetAvailableError) {
      throw new AppError("NOT_YET", `The committed drand round ${draw.drandRound} is produced at ${draw.drandRoundAt.toISOString()}`, 409);
    }
    await prisma.draw.update({
      where: { id: drawId },
      data: { attemptCount: { increment: 1 }, lastAttemptAt: now, lastError: (error as Error).message.slice(0, 500) },
    });
    throw new AppError("BEACON_UNAVAILABLE", "The randomness beacon could not be retrieved yet. The same round will be retried.", 503);
  }

  const picks = selectWinners({
    campaignId: draw.campaignId,
    snapshotHash: draw.snapshotHash,
    randomness: beacon.randomness,
    entryCount: draw.entryCount,
    picks: draw.winnerCount + draw.alternateCount,
  });

  const entries = buildSnapshot(draw.campaignId, draw.snapshot.trimEnd().split("\n").slice(3)).entries;
  if (hashSnapshot(serializeSnapshot({ campaignId: draw.campaignId, entries })) !== draw.snapshotHash) {
    throw new AppError("INTEGRITY", "Stored snapshot does not match its commitment", 500);
  }

  const winnerHashes = new Set(picks.map((p) => entries[p.snapshotIndex]));
  const participants = await prisma.participant.findMany({
    where: { campaignId: draw.campaignId },
    select: { id: true, referenceNumber: true },
  });
  const byHash = new Map<string, { id: string; referenceNumber: string }>();
  for (const p of participants) {
    const h = entryHash(draw.campaignId, p.referenceNumber);
    if (winnerHashes.has(h)) byHash.set(h, p);
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.draw.findUnique({ where: { id: drawId } });
    if (!current || current.status !== "COMMITTED") return current!;
    const results = picks.map((p) => {
      const hash = entries[p.snapshotIndex];
      const participant = byHash.get(hash);
      if (!participant) throw new AppError("INTEGRITY", "A selected entry could not be matched to a participant", 500);
      return {
        drawId,
        position: p.position,
        role: p.position < draw.winnerCount ? ("WINNER" as const) : ("ALTERNATE" as const),
        snapshotIndex: p.snapshotIndex,
        entryHash: hash,
        participantId: participant.id,
        referenceNumber: participant.referenceNumber,
      };
    });
    await tx.drawResult.createMany({ data: results });
    const completed = await tx.draw.update({
      where: { id: drawId },
      data: {
        status: "COMPLETED",
        randomness: beacon.randomness,
        signature: beacon.signature,
        beaconFetchedAt: now,
        winningEntryId: results[0].participantId,
        completedAt: now,
        lastAttemptAt: now,
        attemptCount: { increment: 1 },
        lastError: null,
      },
    });
    await tx.campaign.update({ where: { id: draw.campaignId }, data: { status: "DRAW_COMPLETED" } });
    await writeAudit(tx, {
      userId: opts.userId ?? null,
      campaignId: draw.campaignId,
      action: "draw.completed",
      entityType: "Draw",
      entityId: drawId,
      metadata: { round: draw.drandRound, randomness: beacon.randomness, winners: results.filter((r) => r.role === "WINNER").map((r) => r.referenceNumber) },
      ipHash: opts.ipHash,
    });
    return completed;
  });
}

/** Public, explicit cancellation. The original proof is kept; a new draw can then be committed and is linked to it. */
export async function invalidateDraw(drawId: string, reason: string, user: SessionUser, ipHash?: string) {
  if (reason.trim().length < 10) throw new AppError("REASON_REQUIRED", "A public reason is required", 422);
  return prisma.$transaction(async (tx) => {
    const draw = await tx.draw.findUnique({ where: { id: drawId } });
    if (!draw) throw new AppError("NOT_FOUND", "Draw not found", 404);
    if (draw.status === "INVALIDATED") throw new AppError("BAD_STATE", "Draw is already invalidated", 409);
    const updated = await tx.draw.update({ where: { id: drawId }, data: { status: "INVALIDATED", invalidatedAt: new Date(), invalidationReason: reason.trim() } });
    await tx.campaign.update({ where: { id: draw.campaignId }, data: { lockedAt: null, status: "CLOSED" } });
    await writeAudit(tx, { userId: user.id, campaignId: draw.campaignId, action: "draw.invalidated", entityType: "Draw", entityId: drawId, metadata: { reason, previousStatus: draw.status }, ipHash });
    return updated;
  });
}

/** A winner who is ineligible or unreachable is publicly disqualified; the next alternate in published order takes the place. */
export async function disqualifyResult(resultId: string, reason: string, user: SessionUser, ipHash?: string) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.drawResult.findUnique({ where: { id: resultId }, include: { draw: true } });
    if (!result) throw new AppError("NOT_FOUND", "Result not found", 404);
    if (result.draw.status !== "COMPLETED") throw new AppError("BAD_STATE", "Draw is not completed", 409);
    if (result.disqualifiedAt) throw new AppError("BAD_STATE", "Already disqualified", 409);
    const updated = await tx.drawResult.update({ where: { id: resultId }, data: { disqualifiedAt: new Date(), disqualificationReason: reason } });
    await writeAudit(tx, {
      userId: user.id,
      campaignId: result.draw.campaignId,
      action: "draw.result_disqualified",
      entityType: "DrawResult",
      entityId: resultId,
      metadata: { reference: result.referenceNumber, position: result.position, reason },
      ipHash,
    });
    return updated;
  });
}

/** Current prize holders: first `winnerCount` picks that were not disqualified, in published order. */
export function currentWinners<T extends Pick<DrawResult, "position" | "disqualifiedAt">>(results: T[], winnerCount: number): T[] {
  return [...results].sort((a, b) => a.position - b.position).filter((r) => !r.disqualifiedAt).slice(0, winnerCount);
}

export function toProof(draw: Draw & { results: DrawResult[] }): DrawProof {
  return {
    algorithmVersion: draw.algorithmVersion,
    campaignId: draw.campaignId,
    drawId: draw.id,
    sequence: draw.sequence,
    status: draw.status,
    commitment: {
      snapshotHash: draw.snapshotHash,
      entryCount: draw.entryCount,
      winnerCount: draw.winnerCount,
      alternateCount: draw.alternateCount,
      commitmentAt: draw.commitmentAt.toISOString(),
      drand: {
        network: draw.drandNetwork,
        chainHash: draw.drandChainHash,
        publicKey: draw.drandPublicKey,
        scheme: draw.drandScheme as DrawProof["commitment"]["drand"]["scheme"],
        period: draw.drandPeriod,
        genesis: draw.drandGenesis,
        round: draw.drandRound,
        roundAt: draw.drandRoundAt.toISOString(),
      },
    },
    beacon: draw.randomness && draw.signature ? { round: draw.drandRound, randomness: draw.randomness, signature: draw.signature } : null,
    results: [...draw.results]
      .sort((a, b) => a.position - b.position)
      .map((r) => ({ position: r.position, role: r.role, snapshotIndex: r.snapshotIndex, entryHash: r.entryHash, referenceNumber: r.referenceNumber })),
    completedAt: draw.completedAt?.toISOString() ?? null,
  };
}

/** Public data for /verify/{campaignId}. Contains no personal data. */
export async function getPublicVerification(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, title: true, slug: true, status: true, drawAt: true, endsAt: true, translations: true, winnerCount: true },
  });
  if (!campaign || campaign.status === "DRAFT") return null;
  const draws = await prisma.draw.findMany({ where: { campaignId }, orderBy: { sequence: "desc" }, include: { results: true } });
  return {
    campaign,
    draws: draws.map((d) => {
      const proof = toProof(d);
      return {
        draw: d,
        proof,
        serverCheck: verifyDrawProof(proof, d.snapshot),
        results: [...d.results].sort((a, b) => a.position - b.position).map((r) => ({
          position: r.position,
          role: r.role,
          referenceNumber: r.referenceNumber,
          entryHash: r.entryHash,
          disqualifiedAt: r.disqualifiedAt,
          disqualificationReason: r.disqualificationReason,
        })),
      };
    }),
  };
}

/** Executes every committed draw whose round has been produced (called by the scheduler). */
export async function executeDueDraws(opts: DrawOptions = {}) {
  const now = opts.now ?? new Date();
  const due = await prisma.draw.findMany({ where: { status: "COMMITTED", drandRoundAt: { lte: now } }, select: { id: true } });
  const out: { id: string; ok: boolean; error?: string }[] = [];
  for (const d of due) {
    try {
      await executeDraw(d.id, opts);
      out.push({ id: d.id, ok: true });
    } catch (e) {
      out.push({ id: d.id, ok: false, error: (e as Error).message });
    }
  }
  return out;
}
