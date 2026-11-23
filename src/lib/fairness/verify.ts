import { ALGORITHM_VERSION, KNOWN_CHAINS, MIN_COMMIT_LEAD_SECONDS, type DrandChain, type DrandScheme } from "./constants";
import { roundTime, verifyBeacon, type Beacon } from "./drand";
import { selectWinners } from "./select";
import { entryHash, hashSnapshot, parseSnapshot } from "./snapshot";

export interface DrawProof {
  algorithmVersion: string;
  campaignId: string;
  drawId: string;
  sequence: number;
  status: "COMMITTED" | "COMPLETED" | "INVALIDATED";
  commitment: {
    snapshotHash: string;
    entryCount: number;
    winnerCount: number;
    alternateCount: number;
    commitmentAt: string;
    drand: {
      network: string;
      chainHash: string;
      publicKey: string;
      scheme: DrandScheme;
      period: number;
      genesis: number;
      round: number;
      roundAt: string;
    };
  };
  beacon: Beacon | null;
  results: Array<{
    position: number;
    role: "WINNER" | "ALTERNATE";
    snapshotIndex: number;
    entryHash: string;
    referenceNumber: string;
  }>;
  completedAt: string | null;
}

export interface VerificationCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface VerificationReport {
  ok: boolean;
  checks: VerificationCheck[];
  /** Recomputed winning entry hashes in pick order */
  recomputed: string[];
}

/**
 * Independently re-checks a published draw. Runs in Node and in the browser.
 *
 * @param proof     the public proof (from /api/verify/{campaignId}/proof)
 * @param snapshot  optional canonical snapshot text (from /api/verify/{campaignId}/snapshot)
 * @param chains    pinned chain parameters — the verifier never trusts the key embedded in the proof
 */
export function verifyDrawProof(
  proof: DrawProof,
  snapshot?: string | null,
  chains: Record<string, DrandChain> = KNOWN_CHAINS,
): VerificationReport {
  const checks: VerificationCheck[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const recomputed: string[] = [];

  add("algorithm", proof.algorithmVersion === ALGORITHM_VERSION, `Algorithm ${proof.algorithmVersion}`);

  const d = proof.commitment.drand;
  const pinned = chains[d.chainHash];
  const chainOk =
    !!pinned &&
    pinned.publicKey === d.publicKey &&
    pinned.scheme === d.scheme &&
    pinned.period === d.period &&
    pinned.genesis === d.genesis;
  add("chain", chainOk, chainOk ? `drand ${pinned!.network} (${d.chainHash.slice(0, 16)}…) matches pinned parameters` : "drand chain parameters do not match the pinned public network");
  if (!pinned || !chainOk) return { ok: false, checks, recomputed };

  const committedAt = Math.floor(Date.parse(proof.commitment.commitmentAt) / 1000);
  const producedAt = roundTime(pinned, d.round);
  const leadOk = producedAt - committedAt >= MIN_COMMIT_LEAD_SECONDS && Math.abs(Date.parse(d.roundAt) / 1000 - producedAt) < 1;
  add(
    "future-round",
    leadOk,
    `Round ${d.round} produced at ${new Date(producedAt * 1000).toISOString()}, ${producedAt - committedAt}s after the commitment`,
  );

  let entries: string[] | null = null;
  if (snapshot != null) {
    try {
      const parsed = parseSnapshot(snapshot);
      const hash = hashSnapshot(snapshot);
      const hashOk = hash === proof.commitment.snapshotHash;
      add("snapshot-hash", hashOk, hashOk ? `SHA-256(snapshot) = ${hash}` : `SHA-256(snapshot) = ${hash} ≠ committed ${proof.commitment.snapshotHash}`);
      const metaOk = parsed.campaignId === proof.campaignId && parsed.entries.length === proof.commitment.entryCount;
      add("snapshot-meta", metaOk, `${parsed.entries.length} entries for campaign ${parsed.campaignId}`);
      if (hashOk && metaOk) entries = parsed.entries;
    } catch (error) {
      add("snapshot-hash", false, `Snapshot is not canonical: ${(error as Error).message}`);
    }
  }

  if (!proof.beacon) {
    add("beacon", proof.status === "COMMITTED", "Randomness not revealed yet — the committed round is still pending");
    return { ok: checks.every((c) => c.ok), checks, recomputed };
  }

  const beaconCheck = verifyBeacon(pinned, proof.beacon, d.round);
  add("beacon", beaconCheck.valid, beaconCheck.valid ? `BLS signature for round ${d.round} is valid and randomness = SHA256(signature)` : beaconCheck.reason ?? "Invalid beacon");
  if (!beaconCheck.valid) return { ok: false, checks, recomputed };

  let picks;
  try {
    picks = selectWinners({
      campaignId: proof.campaignId,
      snapshotHash: proof.commitment.snapshotHash,
      randomness: proof.beacon.randomness,
      entryCount: proof.commitment.entryCount,
      picks: proof.commitment.winnerCount + proof.commitment.alternateCount,
    });
  } catch (error) {
    add("selection", false, (error as Error).message);
    return { ok: false, checks, recomputed };
  }

  const countOk = picks.length === proof.results.length;
  add("selection-count", countOk, `${picks.length} picks recomputed, ${proof.results.length} published`);

  let selectionOk = countOk;
  for (const pick of picks) {
    const published = proof.results.find((r) => r.position === pick.position);
    const expectedRole = pick.position < proof.commitment.winnerCount ? "WINNER" : "ALTERNATE";
    if (!published || published.snapshotIndex !== pick.snapshotIndex || published.role !== expectedRole) {
      selectionOk = false;
      continue;
    }
    if (entryHash(proof.campaignId, published.referenceNumber) !== published.entryHash) selectionOk = false;
    if (entries) {
      recomputed.push(entries[pick.snapshotIndex]);
      if (entries[pick.snapshotIndex] !== published.entryHash) selectionOk = false;
    }
  }
  add(
    "selection",
    selectionOk,
    selectionOk
      ? entries
        ? "Recomputed winners match the published results"
        : "Recomputed indices match the published results (download the snapshot to also check entry hashes)"
      : "Recomputed winners DO NOT match the published results",
  );

  return { ok: checks.every((c) => c.ok), checks, recomputed };
}
