import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database readiness probe (used by Docker HEALTHCHECK and uptime monitors). */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok", latencyMs: Date.now() - started, time: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", db: "unreachable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
