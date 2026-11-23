import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Role } from "@/generated/prisma/client";
import { AppError, isAppError, isIntegrityGuardError } from "@/lib/errors";
import { hasRole, sessionFromRequest, type SessionUser } from "@/lib/auth/session";
import { ipHash, isSameOrigin } from "@/lib/security/request";

export function jsonError(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, ...(details ? { details } : {}) } }, { status, headers: { "cache-control": "no-store" } });
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });
}

/** Maps errors to safe responses. Internal details are logged server-side only. */
export function handleError(error: unknown) {
  if (isAppError(error)) return jsonError(error.code, error.message, error.status, error.details);
  if (error instanceof ZodError) {
    return jsonError("VALIDATION", "Invalid input", 422, error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  if (isIntegrityGuardError(error)) {
    return jsonError("INTEGRITY", "This change is not allowed: the draw record is protected.", 409);
  }
  console.error("[api] unhandled error", error instanceof Error ? error.message : error);
  return jsonError("INTERNAL", "Something went wrong. Please try again.", 500);
}

export interface AdminContext {
  user: SessionUser;
  ipHash: string;
}

type Handler<P> = (request: Request, ctx: AdminContext, params: P) => Promise<Response>;

/**
 * Wraps an admin API handler: server-side session check, role check, CSRF origin check
 * on state-changing methods, and safe error mapping.
 */
export function adminRoute<P = Record<string, string>>(minRole: Role, handler: Handler<P>) {
  return async (request: Request, context: { params: Promise<P> }) => {
    try {
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
      if (mutating && !isSameOrigin(request)) return jsonError("CSRF", "Cross-site request blocked", 403);
      const user = await sessionFromRequest(request);
      if (!user) return jsonError("UNAUTHENTICATED", "Authentication required", 401);
      if (!hasRole(user.role, minRole)) return jsonError("FORBIDDEN", "You do not have permission for this action", 403);
      const params = (await context?.params) ?? ({} as P);
      return await handler(request, { user, ipHash: ipHash(request.headers) }, params);
    } catch (error) {
      return handleError(error);
    }
  };
}

export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new AppError("UNSUPPORTED_MEDIA", "Expected JSON body", 415);
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError("TOO_LARGE", "Request body too large", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("BAD_JSON", "Malformed JSON", 400);
  }
}
