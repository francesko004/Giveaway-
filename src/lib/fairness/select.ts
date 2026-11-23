import { DRAW_DOMAIN } from "./constants";
import { bytesToBigInt, isHex, sha256Bytes } from "./encoding";

const TWO_256 = 1n << 256n;

export interface SelectionInput {
  campaignId: string;
  snapshotHash: string;
  /** Verified drand randomness (hex) */
  randomness: string;
  /** Number of eligible entries in the snapshot */
  entryCount: number;
  /** Total picks = winners + alternates (sampling without replacement) */
  picks: number;
}

export interface Pick {
  position: number;
  /** Index into the list of entries remaining at the moment of this pick */
  remainingIndex: number;
  /** Index into the original sorted snapshot */
  snapshotIndex: number;
  /** Number of rejection-sampling rounds needed (0 in the overwhelmingly common case) */
  rejections: number;
}

/**
 * Deterministic 256-bit value for (pick, counter):
 *   SHA256("giveaway-draw/v1\n" + campaignId + "\n" + snapshotHash + "\n" + randomness + "\n" + pick + "\n" + counter)
 */
export function drawDigest(input: Omit<SelectionInput, "entryCount" | "picks">, pick: number, counter: number): bigint {
  const material = `${DRAW_DOMAIN}\n${input.campaignId}\n${input.snapshotHash}\n${input.randomness}\n${pick}\n${counter}`;
  return bytesToBigInt(sha256Bytes(material));
}

/**
 * Unbiased uniform index in [0, n) using rejection sampling.
 * Values >= limit (the largest multiple of n not exceeding 2^256) are rejected, so every index
 * has exactly limit/n preimages and there is no modulo bias.
 */
export function uniformIndex(n: number, next: (counter: number) => bigint, maxAttempts = 1024): { index: number; rejections: number } {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("Population must be a positive integer");
  const N = BigInt(n);
  const limit = TWO_256 - (TWO_256 % N);
  for (let counter = 0; counter < maxAttempts; counter++) {
    const x = next(counter);
    if (x < 0n || x >= TWO_256) throw new Error("Digest out of range");
    if (x < limit) return { index: Number(x % N), rejections: counter };
  }
  // Probability of reaching this is < 2^-(maxAttempts) — effectively impossible.
  throw new Error("Rejection sampling did not converge");
}

/**
 * Selects `picks` distinct entries without replacement:
 * pick k draws a uniform index over the entries still remaining, which are kept in snapshot order.
 */
export function selectWinners(input: SelectionInput): Pick[] {
  if (!isHex(input.snapshotHash, 32)) throw new Error("Invalid snapshot hash");
  if (!isHex(input.randomness, 32)) throw new Error("Invalid randomness");
  if (!Number.isSafeInteger(input.entryCount) || input.entryCount < 1) throw new Error("No eligible entries");
  if (!Number.isSafeInteger(input.picks) || input.picks < 1) throw new Error("Invalid number of picks");
  if (/[\n\r]/.test(input.campaignId)) throw new Error("Invalid campaignId");

  const picks = Math.min(input.picks, input.entryCount);
  const remaining: number[] = Array.from({ length: input.entryCount }, (_, i) => i);
  const result: Pick[] = [];
  for (let position = 0; position < picks; position++) {
    const { index, rejections } = uniformIndex(remaining.length, (counter) => drawDigest(input, position, counter));
    const [snapshotIndex] = remaining.splice(index, 1);
    result.push({ position, remainingIndex: index, snapshotIndex, rejections });
  }
  return result;
}
