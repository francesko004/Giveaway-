import "server-only";
import { env, turnstileEnabled } from "@/lib/env";

/** Optional Cloudflare Turnstile verification. Returns true when Turnstile is not configured. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: env().TURNSTILE_SECRET_KEY!, response: token });
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
