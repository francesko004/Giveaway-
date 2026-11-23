/**
 * Cloudflare Workers entry point: the OpenNext-generated Next.js handler plus a Cron Trigger.
 *
 * The cron (see wrangler.jsonc → triggers.crons) calls the app's own /api/cron/tick route in-process,
 * authenticated with HMAC-SHA256(SESSION_SECRET, "cron\ntick") — no extra secret needed. The tick applies
 * pending database migrations, closes campaigns at their end time and reveals due draws.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- `.open-next/worker.js` is generated at build time by `opennextjs-cloudflare build`
// @ts-ignore
import { default as handler } from "./.open-next/worker.js";

interface Env {
  SESSION_SECRET?: string;
  [key: string]: unknown;
}

async function cronToken(secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode("cron\ntick")));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default {
  fetch: handler.fetch,

  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (!env.SESSION_SECRET) return;
    const request = new Request("https://cron.internal/api/cron/tick?migrate=1", {
      method: "POST",
      headers: { authorization: `Bearer ${await cronToken(env.SESSION_SECRET)}` },
    });
    ctx.waitUntil(
      handler.fetch(request, env, ctx).then(async (res: Response) => {
        if (!res.ok) console.error("[cron] tick failed", res.status, (await res.text()).slice(0, 500));
      }),
    );
  },
};
