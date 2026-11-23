import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { connectionString } from "@/lib/db";
import { hmac, safeEqual } from "@/lib/security/crypto";
import { applyMigrations } from "@/lib/migrations/migrate";
import { runTick } from "@/services/scheduler";

export const dynamic = "force-dynamic";

/**
 * Housekeeping tick. Called by the Cloudflare Cron Trigger (worker.ts, authenticated with a token
 * derived from SESSION_SECRET) or by any external cron using `Authorization: Bearer $CRON_SECRET`.
 * On Workers it also applies pending database migrations, so updates deploy without the Prisma CLI.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const secret = env().CRON_SECRET;
  const internal = `Bearer ${hmac("cron", "tick")}`;
  const ok = safeEqual(auth, internal) || (!!secret && safeEqual(auth, `Bearer ${secret}`));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let migrations: string[] = [];
  if (new URL(request.url).searchParams.get("migrate") === "1") {
    const url = connectionString();
    if (url) migrations = (await applyMigrations(url)).applied;
  }
  const result = await runTick();
  return NextResponse.json({ ok: true, migrations, closed: result.closed.length, draws: result.draws });
}
