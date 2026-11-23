import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Server clock for countdown synchronisation. */
export function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "cache-control": "no-store" } });
}
