import { describe, expect, it } from "vitest";
import {
  ALGORITHM_VERSION,
  LOE_DEFAULT,
  MIN_COMMIT_LEAD_SECONDS,
  QUICKNET,
  buildSnapshot,
  drawDigest,
  entryHash,
  fetchVerifiedBeacon,
  firstRoundAfter,
  hashSnapshot,
  parseSnapshot,
  roundAt,
  roundTime,
  selectWinners,
  serializeSnapshot,
  uniformIndex,
  verifyBeacon,
  verifyDrawProof,
  BeaconNotYetAvailableError,
  type DrawProof,
} from "@/lib/fairness";
import { DEFAULT_CHAIN_BEACON_1000, QUICKNET_BEACONS } from "../fixtures/drand";

const CID = "cmtestvector0000000000001";
const REFS = Array.from({ length: 10 }, (_, i) => `GIVE-2026-TV${String(i).padStart(6, "0")}`);
const LEAVES = REFS.map((r) => entryHash(CID, r));
const SNAPSHOT = serializeSnapshot(buildSnapshot(CID, LEAVES));
const SNAPSHOT_HASH = hashSnapshot(SNAPSHOT);
const R1000 = QUICKNET_BEACONS[1000];

describe("entry snapshot & SHA-256 commitment", () => {
  it("matches the fixed test vector (cross-checked with an independent Python implementation)", () => {
    expect(entryHash(CID, REFS[0])).toBe("99e6147794443836977088c3009b53ae47b6298484c995957cf8d87649d55efa");
    expect(SNAPSHOT_HASH).toBe("1a92eada9fd497c06bc3dbe8bceb784862d5089eec76d15061db35a16057fb5c");
  });

  it("is independent of input ordering", () => {
    const shuffled = [...LEAVES].reverse();
    expect(serializeSnapshot(buildSnapshot(CID, shuffled))).toBe(SNAPSHOT);
  });

  it("has the documented canonical layout", () => {
    const lines = SNAPSHOT.split("\n");
    expect(lines[0]).toBe("giveaway-snapshot/v1");
    expect(lines[1]).toBe(`campaign:${CID}`);
    expect(lines[2]).toBe("count:10");
    expect(SNAPSHOT.endsWith("\n")).toBe(true);
    expect(parseSnapshot(SNAPSHOT).entries).toHaveLength(10);
  });

  it("changes when a single entry ID changes", () => {
    const tampered = [...LEAVES];
    tampered[3] = entryHash(CID, "GIVE-2026-TV999999");
    expect(hashSnapshot(serializeSnapshot(buildSnapshot(CID, tampered)))).not.toBe(SNAPSHOT_HASH);
  });

  it("rejects duplicates, malformed leaves and non-canonical text", () => {
    expect(() => buildSnapshot(CID, [LEAVES[0], LEAVES[0]])).toThrow(/Duplicate/);
    expect(() => buildSnapshot(CID, ["xyz"])).toThrow(/Invalid entry hash/);
    expect(() => parseSnapshot(SNAPSHOT.replace("count:10", "count:9"))).toThrow();
    expect(() => parseSnapshot(SNAPSHOT.trimEnd())).toThrow();
    const unsorted = SNAPSHOT.split("\n");
    [unsorted[3], unsorted[4]] = [unsorted[4], unsorted[3]];
    expect(() => parseSnapshot(unsorted.join("\n"))).toThrow(/canonical/);
  });

  it("refuses identifiers that could break the line-based format", () => {
    expect(() => entryHash("a\nb", "x")).toThrow();
    expect(() => entryHash(CID, "")).toThrow();
  });
});

describe("drand beacon verification", () => {
  it("verifies real quicknet beacons against the pinned public key", () => {
    for (const beacon of Object.values(QUICKNET_BEACONS)) {
      expect(verifyBeacon(QUICKNET, beacon, beacon.round)).toEqual({ valid: true });
    }
  });

  it("verifies a real chained (LoE default) beacon", () => {
    expect(verifyBeacon(LOE_DEFAULT, DEFAULT_CHAIN_BEACON_1000, 1000).valid).toBe(true);
  });

  it("rejects a signature presented for a different round", () => {
    const res = verifyBeacon(QUICKNET, { ...R1000, round: 1001 }, 1001);
    expect(res.valid).toBe(false);
  });

  it("rejects a round mismatch with the commitment", () => {
    expect(verifyBeacon(QUICKNET, R1000, 1001).valid).toBe(false);
  });

  it("rejects forged randomness even when the signature is genuine", () => {
    const res = verifyBeacon(QUICKNET, { ...R1000, randomness: QUICKNET_BEACONS[1001].randomness });
    expect(res).toMatchObject({ valid: false, reason: expect.stringMatching(/SHA256/) });
  });

  it("rejects a tampered signature", () => {
    const sig = R1000.signature.slice(0, -2) + (R1000.signature.endsWith("39") ? "38" : "39");
    expect(verifyBeacon(QUICKNET, { ...R1000, signature: sig }).valid).toBe(false);
  });

  it("rejects beacons verified under a different public key", () => {
    const fake = { ...QUICKNET, publicKey: LOE_DEFAULT.publicKey.padEnd(192, "0") };
    expect(verifyBeacon(fake, R1000).valid).toBe(false);
  });

  it("computes round numbers and times from the published schedule", () => {
    expect(roundTime(QUICKNET, 1)).toBe(QUICKNET.genesis);
    expect(roundTime(QUICKNET, 1000)).toBe(QUICKNET.genesis + 999 * 3);
    expect(roundAt(QUICKNET, QUICKNET.genesis + 999 * 3)).toBe(1000);
    expect(roundAt(QUICKNET, QUICKNET.genesis + 999 * 3 + 2)).toBe(1000);
    const t = QUICKNET.genesis + 5000;
    const r = firstRoundAfter(QUICKNET, t);
    expect(roundTime(QUICKNET, r)).toBeGreaterThan(t);
    expect(roundTime(QUICKNET, r - 1)).toBeLessThanOrEqual(t);
  });

  it("refuses to fetch a round before it exists and only accepts verified relay responses", async () => {
    await expect(fetchVerifiedBeacon(QUICKNET, 1000, { nowSeconds: QUICKNET.genesis, fetchImpl: async () => new Response("{}") })).rejects.toBeInstanceOf(
      BeaconNotYetAvailableError,
    );

    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      if (url.startsWith("https://evil")) return Response.json({ ...R1000, randomness: "00".repeat(32) });
      return Response.json(R1000);
    };
    const beacon = await fetchVerifiedBeacon(QUICKNET, 1000, { urls: ["https://evil.example", "https://good.example"], fetchImpl });
    expect(beacon.randomness).toBe(R1000.randomness);
    expect(calls).toEqual([
      `https://evil.example/${QUICKNET.chainHash}/public/1000`,
      `https://good.example/${QUICKNET.chainHash}/public/1000`,
    ]);

    await expect(fetchVerifiedBeacon(QUICKNET, 1000, { urls: ["https://evil.example"], fetchImpl })).rejects.toThrow(/Could not retrieve/);
  });
});

describe("deterministic winner selection", () => {
  const input = { campaignId: CID, snapshotHash: SNAPSHOT_HASH, randomness: R1000.randomness, entryCount: 10, picks: 3 };

  it("matches the fixed test vector", () => {
    expect(selectWinners(input).map((p) => p.snapshotIndex)).toEqual([6, 0, 8]);
  });

  it("always returns the same result for the same inputs", () => {
    const a = selectWinners(input);
    for (let i = 0; i < 20; i++) expect(selectWinners(input)).toEqual(a);
  });

  it("changes when the randomness or snapshot changes", () => {
    const other = selectWinners({ ...input, randomness: QUICKNET_BEACONS[1001].randomness }).map((p) => p.snapshotIndex);
    const otherSnap = selectWinners({ ...input, snapshotHash: "00".repeat(32) }).map((p) => p.snapshotIndex);
    expect([other, otherSnap]).not.toContainEqual([6, 0, 8]);
  });

  it("never picks the same entry twice and caps picks at the population", () => {
    const picks = selectWinners({ ...input, entryCount: 5, picks: 10 });
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((p) => p.snapshotIndex)).size).toBe(5);
  });

  it("works for a single entry", () => {
    expect(selectWinners({ ...input, entryCount: 1, picks: 1 })[0].snapshotIndex).toBe(0);
  });

  it("rejects invalid inputs", () => {
    expect(() => selectWinners({ ...input, entryCount: 0 })).toThrow();
    expect(() => selectWinners({ ...input, randomness: "abc" })).toThrow();
    expect(() => selectWinners({ ...input, snapshotHash: "zz" })).toThrow();
  });
});

describe("rejection sampling", () => {
  const TWO_256 = 1n << 256n;

  it("rejects values in the biased tail and retries with the next counter", () => {
    const n = 3; // 2^256 mod 3 = 1 → exactly one biased value: 2^256 - 1
    const values = [TWO_256 - 1n, 7n];
    const out = uniformIndex(n, (c) => values[c]);
    expect(out).toEqual({ index: 7 % 3, rejections: 1 });
  });

  it("accepts the largest unbiased value", () => {
    const n = 3;
    const limit = TWO_256 - (TWO_256 % 3n);
    expect(uniformIndex(n, () => limit - 1n).rejections).toBe(0);
  });

  it("is uniform in practice (chi-squared sanity check)", () => {
    const n = 7;
    const counts = new Array(n).fill(0);
    const trials = 7000;
    for (let i = 0; i < trials; i++) {
      const { index } = uniformIndex(n, (c) => drawDigest({ campaignId: "chi", snapshotHash: SNAPSHOT_HASH, randomness: R1000.randomness }, i, c));
      counts[index]++;
    }
    const expected = trials / n;
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(22.46); // p = 0.001 for 6 degrees of freedom
  });

  it("fails closed if it can never converge", () => {
    expect(() => uniformIndex(3, () => TWO_256 - 1n, 5)).toThrow(/converge/);
  });
});

describe("public proof verification", () => {
  const commitmentAt = new Date((roundTime(QUICKNET, 1000) - MIN_COMMIT_LEAD_SECONDS - 30) * 1000).toISOString();
  const picks = selectWinners({ campaignId: CID, snapshotHash: SNAPSHOT_HASH, randomness: R1000.randomness, entryCount: 10, picks: 3 });
  const sorted = buildSnapshot(CID, LEAVES).entries;
  const refByLeaf = new Map(REFS.map((r) => [entryHash(CID, r), r]));

  const proof: DrawProof = {
    algorithmVersion: ALGORITHM_VERSION,
    campaignId: CID,
    drawId: "draw1",
    sequence: 1,
    status: "COMPLETED",
    commitment: {
      snapshotHash: SNAPSHOT_HASH,
      entryCount: 10,
      winnerCount: 1,
      alternateCount: 2,
      commitmentAt,
      drand: {
        network: QUICKNET.network,
        chainHash: QUICKNET.chainHash,
        publicKey: QUICKNET.publicKey,
        scheme: QUICKNET.scheme,
        period: QUICKNET.period,
        genesis: QUICKNET.genesis,
        round: 1000,
        roundAt: new Date(roundTime(QUICKNET, 1000) * 1000).toISOString(),
      },
    },
    beacon: R1000,
    results: picks.map((p) => ({
      position: p.position,
      role: p.position === 0 ? "WINNER" : "ALTERNATE",
      snapshotIndex: p.snapshotIndex,
      entryHash: sorted[p.snapshotIndex],
      referenceNumber: refByLeaf.get(sorted[p.snapshotIndex])!,
    })),
    completedAt: new Date().toISOString(),
  };

  it("accepts an honest proof", () => {
    const report = verifyDrawProof(proof, SNAPSHOT);
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.recomputed[0]).toBe(sorted[6]);
  });

  it("fails if even one participant ID is modified after the commitment", () => {
    const tampered = [...LEAVES];
    tampered[0] = entryHash(CID, "GIVE-2026-SNEAKY01");
    const tamperedSnapshot = serializeSnapshot(buildSnapshot(CID, tampered));
    const report = verifyDrawProof(proof, tamperedSnapshot);
    expect(report.ok).toBe(false);
    expect(report.checks.find((c) => c.id === "snapshot-hash")?.ok).toBe(false);
  });

  it("fails if the published winner is swapped", () => {
    const swapped = { ...proof, results: proof.results.map((r, i) => (i === 0 ? { ...r, snapshotIndex: 1, entryHash: sorted[1], referenceNumber: refByLeaf.get(sorted[1])! } : r)) };
    expect(verifyDrawProof(swapped, SNAPSHOT).ok).toBe(false);
  });

  it("fails if randomness is replaced by another (genuine) round", () => {
    const replaced = { ...proof, beacon: QUICKNET_BEACONS[1001] };
    expect(verifyDrawProof(replaced, SNAPSHOT).ok).toBe(false);
  });

  it("fails if the round was not in the future at commitment time", () => {
    const late = { ...proof, commitment: { ...proof.commitment, commitmentAt: new Date(roundTime(QUICKNET, 1000) * 1000).toISOString() } };
    expect(verifyDrawProof(late, SNAPSHOT).checks.find((c) => c.id === "future-round")?.ok).toBe(false);
  });

  it("fails if the proof embeds a different public key", () => {
    const forged = { ...proof, commitment: { ...proof.commitment, drand: { ...proof.commitment.drand, publicKey: "00".repeat(96) } } };
    expect(verifyDrawProof(forged, SNAPSHOT).ok).toBe(false);
  });

  it("can verify without the snapshot (indices only)", () => {
    expect(verifyDrawProof(proof).ok).toBe(true);
  });
});
