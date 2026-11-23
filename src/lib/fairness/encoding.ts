// Isomorphic helpers (Node + browser) — no Node-only APIs so the public verifier can reuse them.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

export { bytesToHex, hexToBytes, utf8ToBytes };

export function sha256Hex(input: string | Uint8Array): string {
  return bytesToHex(sha256(typeof input === "string" ? utf8ToBytes(input) : input));
}

export function sha256Bytes(input: string | Uint8Array): Uint8Array {
  return sha256(typeof input === "string" ? utf8ToBytes(input) : input);
}

export function isHex(value: string, bytes?: number): boolean {
  if (!/^[0-9a-f]*$/.test(value) || value.length % 2 !== 0) return false;
  return bytes === undefined || value.length === bytes * 2;
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) result = (result << 8n) | BigInt(byte);
  return result;
}

/** 8-byte big-endian encoding of a non-negative integer (drand round encoding). */
export function uint64BE(value: number | bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(value));
  return out;
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}
