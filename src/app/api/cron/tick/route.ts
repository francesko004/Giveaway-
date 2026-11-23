import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/security/crypto";
import { runTick } from "@/services/scheduler";

export const dynamic = "force-dynamic";

/** External scheduler hook (optional — the app also runs this internally every 30 s). */
export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runTick();
  return NextResponse.json({ ok: true, closed: result.closed.length, draws: result.draws });
}
