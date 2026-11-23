import "server-only";
import { hmac, randomToken, safeEqual } from "./crypto";

/**
 * Signed, time-stamped token embedded in the registration form when the page is rendered.
 * Blocks blind scripted POSTs (no token), replay of very old pages, and instant bot submissions.
 */
export function issueFormToken(campaignId: string, now = Date.now()): string {
  const payload = `${campaignId}.${now}.${randomToken(9)}`;
  return `${payload}.${hmac("form", payload)}`;
}

export type FormTokenCheck = { ok: true } | { ok: false; reason: "invalid" | "too_fast" | "expired" };

export function checkFormToken(token: string | undefined, campaignId: string, minSeconds: number, now = Date.now()): FormTokenCheck {
  if (!token) return { ok: false, reason: "invalid" };
  const parts = token.split(".");
  if (parts.length !== 4) return { ok: false, reason: "invalid" };
  const [cid, ts, nonce, sig] = parts;
  const payload = `${cid}.${ts}.${nonce}`;
  if (!safeEqual(sig, hmac("form", payload)) || cid !== campaignId) return { ok: false, reason: "invalid" };
  const issued = Number(ts);
  if (!Number.isFinite(issued)) return { ok: false, reason: "invalid" };
  if (now - issued < minSeconds * 1000) return { ok: false, reason: "too_fast" };
  if (now - issued > 6 * 3600 * 1000) return { ok: false, reason: "expired" };
  return { ok: true };
}
