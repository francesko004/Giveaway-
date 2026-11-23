/**
 * Portable password hashing (Node.js, Cloudflare Workers and browsers — no native modules).
 *
 * New hashes: PBKDF2-HMAC-SHA256 via WebCrypto, 600 000 iterations (OWASP 2023 recommendation),
 * 16-byte random salt, 32-byte key. Format: $pbkdf2-sha256$i=<iterations>$<salt b64>$<hash b64>
 *
 * Legacy Argon2id PHC hashes ($argon2id$v=19$m=…,t=…,p=…$salt$hash) are still verified (pure JS)
 * and transparently upgraded on the next successful login.
 */
import { argon2id } from "@noble/hashes/argon2.js";

export const PBKDF2_ITERATIONS = 600_000;
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

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return ["", "pbkdf2-sha256", `i=${iterations}`, b64(salt), b64(await pbkdf2(password, salt, iterations))].join("$");
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts[1] === "pbkdf2-sha256") {
      const [, , params, salt, hash] = parts;
      const iterations = Number(params.replace("i=", ""));
      if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 10_000_000) return false;
      return constantTimeEqual(await pbkdf2(password, unb64(salt), iterations), unb64(hash));
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
  if (parts[1] !== "pbkdf2-sha256") return true;
  return Number(parts[2]?.replace("i=", "")) < PBKDF2_ITERATIONS;
}

export function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters";
  if (password.length > 256) return "Password is too long";
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) return "Password must contain letters and numbers";
  return null;
}
