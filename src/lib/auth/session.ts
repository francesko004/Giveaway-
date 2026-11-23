import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/security/crypto";
import type { Role, User } from "@/generated/prisma/client";

export const ROLE_RANK: Record<Role, number> = { VIEWER: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export function hasRole(role: Role, min: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function isSecureCookie() {
  return env().APP_URL.startsWith("https://");
}

/** `__Host-` prefix pins the cookie to this exact origin (Secure, Path=/, no Domain). */
export function sessionCookieName() {
  return isSecureCookie() ? "__Host-gv_session" : "gv_session";
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export type SessionUser = Pick<User, "id" | "name" | "email" | "role">;

export async function createSession(userId: string, meta: { ipHash?: string; userAgent?: string | null }, ttlHours: number) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlHours * 3600_000);
  await prisma.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, ipHash: meta.ipHash, userAgent: meta.userAgent?.slice(0, 255) },
  });
  return { token, expiresAt };
}

/** Resolves a raw session token to an active user. Sliding expiration, refreshed at most every 5 minutes. */
export async function resolveSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  if (!session) return null;
  const now = new Date();
  if (session.expiresAt <= now || !session.user.active) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60_000) {
    const ttl = session.expiresAt.getTime() - session.lastSeenAt.getTime();
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: now, expiresAt: new Date(now.getTime() + ttl) } })
      .catch(() => {});
  }
  const { id, name, email, role } = session.user;
  return { id, name, email, role };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function destroyAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

export function sessionFromRequest(request: Request) {
  return resolveSession(readCookie(request.headers.get("cookie"), sessionCookieName()));
}
