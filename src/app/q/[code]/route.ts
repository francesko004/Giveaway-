import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { resolveScan } from "@/services/qr";

export const dynamic = "force-dynamic";

/**
 * Stable QR entry point: /q/{code}. The printed URL never changes; the destination is resolved
 * server-side so it can be updated without reprinting. Only same-origin paths are ever returned.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const target = await resolveScan(code.toLowerCase(), request.headers).catch(() => null);
  const url = new URL(appUrl(target?.url ?? "/giveaway"));
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
}
