import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id with OWASP-recommended parameters (19 MiB, t=2, p=1).
const OPTIONS = { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** A valid hash used to equalise timing when the user does not exist. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  return dummyHash;
}

export function passwordPolicyError(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters";
  if (password.length > 256) return "Password is too long";
  if (!/[a-z]/i.test(password) || !/[0-9]/.test(password)) return "Password must contain letters and numbers";
  return null;
}
