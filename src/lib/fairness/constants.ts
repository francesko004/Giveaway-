/**
 * Fairness engine constants.
 *
 * ALGORITHM_VERSION identifies the exact, documented procedure used to derive winners.
 * Any change to the snapshot format or the selection procedure MUST bump this version,
 * and the old procedure must remain available so historic draws stay verifiable.
 */
export const ALGORITHM_VERSION = "gv-sha256-drand-rs/1";
export const SNAPSHOT_HEADER = "giveaway-snapshot/v1";
export const ENTRY_DOMAIN = "giveaway-entry/v1";
export const DRAW_DOMAIN = "giveaway-draw/v1";

export type DrandScheme = "bls-unchained-g1-rfc9380" | "pedersen-bls-chained";

export interface DrandChain {
  /** Human readable beacon id */
  network: string;
  chainHash: string;
  publicKey: string;
  scheme: DrandScheme;
  /** Seconds between rounds */
  period: number;
  /** Unix seconds of round 1 */
  genesis: number;
}

/**
 * League of Entropy "quicknet" — unchained, 3 second rounds, signatures on G1 (RFC 9380 hash-to-curve).
 * Values pinned from https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/info
 * The public key is pinned in code and NEVER fetched at verification time.
 */
export const QUICKNET: DrandChain = {
  network: "quicknet",
  chainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  publicKey:
    "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a",
  scheme: "bls-unchained-g1-rfc9380",
  period: 3,
  genesis: 1692803367,
};

/** League of Entropy mainnet "default" chain (chained, 30 s). Supported for verification. */
export const LOE_DEFAULT: DrandChain = {
  network: "default",
  chainHash: "8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce",
  publicKey:
    "868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31",
  scheme: "pedersen-bls-chained",
  period: 30,
  genesis: 1595431050,
};

export const KNOWN_CHAINS: Record<string, DrandChain> = {
  [QUICKNET.chainHash]: QUICKNET,
  [LOE_DEFAULT.chainHash]: LOE_DEFAULT,
};

export const DEFAULT_DRAND_URLS = [
  "https://api.drand.sh",
  "https://api2.drand.sh",
  "https://api3.drand.sh",
  "https://drand.cloudflare.com",
];

/**
 * Minimum gap between publishing the commitment and the moment the chosen round is produced.
 * Guarantees the commitment is public well before anybody (including us) can know the randomness.
 */
export const MIN_COMMIT_LEAD_SECONDS = 60;
