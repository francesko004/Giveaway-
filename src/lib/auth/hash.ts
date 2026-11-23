/**
 * Portable password hashing (Node.js, Cloudflare Workers and browsers — no native modules).
 *
 * Current scheme — chained PBKDF2-HMAC-SHA256, 600 000 iterations in total (OWASP 2023 recommendation):
 *   k₀ = password;  kᵢ = PBKDF2-SHA256(kᵢ₋₁, salt, ≤ 100 000 iterations, 32 bytes)
 * Cloudflare Workers' WebCrypto refuses more than 100 000 PBKDF2 iterations per call, so the work is
 * split into rounds of at most 100 000. Feeding each output into the next round keeps the total cost
 * (and therefore brute-force resistance) equal to one 600 000-iteration run, and stays fully native/fast.
 * Format: $pbkdf2c-sha256$i=<total>$<salt b64>$<hash b64>
 *
 * Still verified (and upgraded on the next successful login):
 *  - $pbkdf2-sha256$…  single-call PBKDF2 (falls back to a pure-JS implementation where WebCrypto
 *    rejects the iteration count, e.g. on Workers),
 *  - $argon2id$…       legacy Argon2id PHC hashes (pure JS).
 */
import { argon2id } from "@noble/hashes/argon2.js";
import { pbkdf2 as pbkdf2Js } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

export const PBKDF2_ITERATIONS = 600_000;
/** Maximum iterations Cloudflare Workers' WebCrypto accepts in a single PBKDF2 call. */
export const PBKDF2_MAX_PER_CALL = 100_000;
const enc = new TextEncoder();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");
const unb64 = (s: string) => {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm + "=".repeat((4 - (norm.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(secret: Uint8Array, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", secret as BufferSource, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Chained PBKDF2: total `iterations` split into WebCrypto-friendly rounds of ≤ 100 000. */
async function pbkdf2Chained(password: string, salt: Uint8Array, iterations: number) {
  let key: Uint8Array = enc.encode(password);
  for (let left = iterations; left > 0; left -= PBKDF2_MAX_PER_CALL) {
    key = await pbkdf2(key, salt, Math.min(left, PBKDF2_MAX_PER_CALL));
  }
  return key;
}

/** Single-call PBKDF2 (legacy format). Uses WebCrypto, or pure JS if the runtime rejects the count. */
async function pbkdf2Single(password: string, salt: Uint8Array, iterations: number) {
  try {
    return await pbkdf2(enc.encode(password), salt, iterations);
  } catch {
    return pbkdf2Js(sha256, enc.encode(password), salt, { c: iterations, dkLen: 32 });
  }
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return ["", "pbkdf2c-sha256", `i=${iterations}`, b64(salt), b64(await pbkdf2Chained(password, salt, iterations))].join("$");
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts[1] === "pbkdf2c-sha256" || parts[1] === "pbkdf2-sha256") {
      const [, scheme, params, salt, hash] = parts;
      const iterations = Number(params.replace("i=", ""));
      if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 10_000_000) return false;
      const derive = scheme === "pbkdf2c-sha256" ? pbkdf2Chained : pbkdf2Single;
      return constantTimeEqual(await derive(password, unb64(salt), iterations), unb64(hash));
    }
    if (parts[1] === "argon2id") {
      const [, , , params, salt, hash] = parts;
      const p = Object.fromEntries(params.split(",").map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)]));
      const expected = unb64(hash);
      const actual = argon2id(enc.encode(password), unb64(salt), { m: p.m, t: p.t, p: p.p, dkLen: expected.length });
      return constantTimeEqual(actual, expected);
    }
    return false;
  } catch {
    return false;
  }
}

/** True when the stored hash should be replaced with the current scheme/parameters. */
export function needsRehash(stored: string): boolean {
  const parts = stored.split("$");
  if (parts[1] !== "pbkdf2c-sha256") return true;
  return Number(parts[2]?.replace("i=", "")) < PBKDF2_ITERATIONS;
}

export function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters";
  if (password.length > 256) return "Password is too long";
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) return "Password must contain letters and numbers";
  return null;
}
