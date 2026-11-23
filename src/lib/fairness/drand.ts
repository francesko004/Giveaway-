import { bls12_381 } from "@noble/curves/bls12-381.js";
import { DEFAULT_DRAND_URLS, type DrandChain } from "./constants";
import { bytesToHex, concatBytes, hexToBytes, isHex, sha256Bytes, sha256Hex, uint64BE } from "./encoding";

export interface Beacon {
  round: number;
  randomness: string;
  signature: string;
  previous_signature?: string;
}

const DST_G1 = "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_";
const DST_G2 = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_";

/** Round that is current at `unixSeconds` (rounds start at 1 at genesis). */
export function roundAt(chain: DrandChain, unixSeconds: number): number {
  if (unixSeconds < chain.genesis) return 1;
  return Math.floor((unixSeconds - chain.genesis) / chain.period) + 1;
}

/** Unix seconds at which `round` is produced. */
export function roundTime(chain: DrandChain, round: number): number {
  if (!Number.isInteger(round) || round < 1) throw new Error("Invalid round");
  return chain.genesis + (round - 1) * chain.period;
}

/**
 * First round produced strictly after `notBeforeSeconds`.
 * Used to pick the committed future round: it cannot have been produced when the commitment was published.
 */
export function firstRoundAfter(chain: DrandChain, notBeforeSeconds: number): number {
  const r = roundAt(chain, notBeforeSeconds) + 1;
  return Math.max(r, 1);
}

export interface BeaconVerification {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies a beacon against the PINNED public key of the chain:
 *  1. signature is a valid BLS signature on the round message,
 *  2. randomness == SHA256(signature).
 */
export function verifyBeacon(chain: DrandChain, beacon: Beacon, expectedRound?: number): BeaconVerification {
  try {
    if (expectedRound !== undefined && beacon.round !== expectedRound) {
      return { valid: false, reason: `Beacon is for round ${beacon.round}, expected ${expectedRound}` };
    }
    const signatureHex = beacon.signature?.toLowerCase();
    if (!signatureHex || !isHex(signatureHex)) return { valid: false, reason: "Malformed signature" };
    const signature = hexToBytes(signatureHex);
    const publicKey = hexToBytes(chain.publicKey);

    let ok: boolean;
    if (chain.scheme === "bls-unchained-g1-rfc9380") {
      const message = sha256Bytes(uint64BE(beacon.round));
      const S = bls12_381.shortSignatures;
      ok = S.verify(signature, S.hash(message, DST_G1), publicKey);
    } else if (chain.scheme === "pedersen-bls-chained") {
      const prev = beacon.previous_signature?.toLowerCase();
      if (!prev || !isHex(prev)) return { valid: false, reason: "Chained beacon requires previous_signature" };
      const message = sha256Bytes(concatBytes(hexToBytes(prev), uint64BE(beacon.round)));
      const L = bls12_381.longSignatures;
      ok = L.verify(signature, L.hash(message, DST_G2), publicKey);
    } else {
      return { valid: false, reason: "Unsupported drand scheme" };
    }
    if (!ok) return { valid: false, reason: "BLS signature verification failed" };

    const expectedRandomness = sha256Hex(signature);
    if (expectedRandomness !== beacon.randomness?.toLowerCase()) {
      return { valid: false, reason: "Randomness does not equal SHA256(signature)" };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: `Verification error: ${(error as Error).message}` };
  }
}

export class BeaconNotYetAvailableError extends Error {
  constructor(public readonly round: number, public readonly availableAt: number) {
    super(`drand round ${round} is not available yet`);
  }
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetches a specific round from several relays and returns the first one that VERIFIES.
 * Relays are untrusted transport: a beacon is only accepted after signature verification.
 * The round is fixed by the commitment — this function cannot be asked for "some other" round.
 */
export async function fetchVerifiedBeacon(
  chain: DrandChain,
  round: number,
  options: { urls?: string[]; fetchImpl?: FetchLike; nowSeconds?: number; timeoutMs?: number } = {},
): Promise<Beacon> {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const availableAt = roundTime(chain, round);
  if (now < availableAt) throw new BeaconNotYetAvailableError(round, availableAt);

  const urls = options.urls?.length ? options.urls : DEFAULT_DRAND_URLS;
  const doFetch = options.fetchImpl ?? fetch;
  const errors: string[] = [];

  for (const base of urls) {
    const url = `${base.replace(/\/$/, "")}/${chain.chainHash}/public/${round}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
    try {
      const res = await doFetch(url, { signal: controller.signal, cache: "no-store", headers: { accept: "application/json" } });
      if (res.status === 425 || res.status === 404) {
        errors.push(`${base}: round not yet available (${res.status})`);
        continue;
      }
      if (!res.ok) {
        errors.push(`${base}: HTTP ${res.status}`);
        continue;
      }
      const body = (await res.json()) as Partial<Beacon>;
      const beacon: Beacon = {
        round: Number(body.round),
        randomness: String(body.randomness ?? "").toLowerCase(),
        signature: String(body.signature ?? "").toLowerCase(),
        ...(body.previous_signature ? { previous_signature: String(body.previous_signature).toLowerCase() } : {}),
      };
      const check = verifyBeacon(chain, beacon, round);
      if (check.valid) return beacon;
      errors.push(`${base}: ${check.reason}`);
    } catch (error) {
      errors.push(`${base}: ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Could not retrieve a verified beacon for round ${round}: ${errors.join("; ")}`);
}

export { bytesToHex };
