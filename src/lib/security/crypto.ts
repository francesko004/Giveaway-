import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function hmac(purpose: string, data: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(`${purpose}\n${data}`).digest("base64url");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Crockford base32 without ambiguous characters (no I, L, O, U). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomCode(length: number): string {
  // 32 divides 256 evenly, so byte % 32 is unbiased.
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

/** Participation reference, e.g. GIVE-2026-7K3M9QX2 (40 bits of entropy, not enumerable). */
export function generateReference(prefix: string, date = new Date()): string {
  const clean = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "GIVE";
  return `${clean}-${date.getUTCFullYear()}-${randomCode(8)}`;
}
