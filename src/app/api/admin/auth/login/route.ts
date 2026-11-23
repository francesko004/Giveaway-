import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleError, jsonError, readJson } from "@/lib/api";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { createSession, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { ipHash, isSameOrigin } from "@/lib/security/request";
import { writeAudit } from "@/services/audit";
import { getSettings } from "@/services/settings";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(256) });
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError("CSRF", "Cross-site request blocked", 403);
    const ip = ipHash(request.headers);
    const limit = await rateLimit(`login:${ip}`, 10, 900);
    if (!limit.allowed) return jsonError("RATE_LIMITED", "Too many login attempts. Try again in 15 minutes.", 429);

    const parsed = schema.safeParse(await readJson(request, 2000));
    if (!parsed.success) return jsonError("INVALID_CREDENTIALS", "Invalid e-mail or password", 401);
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    // Always run Argon2 so response time does not reveal whether the account exists.
    const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);

    if (!user || !user.active) return jsonError("INVALID_CREDENTIALS", "Invalid e-mail or password", 401);
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return jsonError("LOCKED", "Account temporarily locked after repeated failures. Try again later.", 423);
    }
    if (!ok) {
      const failed = user.failedLogins + 1;
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { failedLogins: failed >= MAX_FAILURES ? 0 : failed, lockedUntil: failed >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
        });
        if (failed >= MAX_FAILURES) await writeAudit(tx, { userId: user.id, action: "auth.locked", entityType: "User", entityId: user.id, ipHash: ip });
      });
      return jsonError("INVALID_CREDENTIALS", "Invalid e-mail or password", 401);
    }

    const settings = await getSettings();
    const { token, expiresAt } = await createSession(user.id, { ipHash: ip, userAgent: request.headers.get("user-agent") }, settings.sessionTtlHours);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
      await writeAudit(tx, { userId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ipHash: ip });
    });
    const res = NextResponse.json({ ok: true, data: { name: user.name, role: user.role } }, { headers: { "cache-control": "no-store" } });
    res.cookies.set(sessionCookieName(), token, sessionCookieOptions(expiresAt));
    return res;
  } catch (error) {
    return handleError(error);
  }
}
