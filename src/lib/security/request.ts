import "server-only";
import { env } from "@/lib/env";
import { hmac } from "./crypto";

type HeaderSource = Headers | { get(name: string): string | null };

/** Client IP. Proxy headers are only trusted when TRUST_PROXY=true (i.e. behind Cloudflare / Caddy / Nginx). */
export function clientIp(headers: HeaderSource): string {
  if (env().TRUST_PROXY) {
    const cf = headers.get("cf-connecting-ip");
    if (cf) return cf.trim();
    const xff = headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return "unknown";
}

/** Keyed hash of the IP — raw IP addresses are never stored. */
export function ipHash(headers: HeaderSource): string {
  return hmac("ip", clientIp(headers)).slice(0, 32);
}

/** Daily-rotating visitor hash for privacy-friendly unique-visit counting (no cookies). */
export function visitorHash(headers: HeaderSource, campaignId: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return hmac(`visitor:${day}`, `${clientIp(headers)}|${headers.get("user-agent") ?? ""}|${campaignId}`).slice(0, 32);
}

/**
 * CSRF defence for cookie-authenticated mutations: the Origin (or Referer) must match the app origin
 * or the request host. Combined with SameSite=Lax cookies and JSON-only bodies.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(env().APP_URL).host);
  } catch {}
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) allowed.add(host);
  return allowed.has(originHost);
}

export function isBotUserAgent(ua: string | null): boolean {
  if (!ua) return true;
  return /bot|crawl|spider|slurp|curl|wget|python-requests|headless|httpclient|scrapy|go-http/i.test(ua);
}
