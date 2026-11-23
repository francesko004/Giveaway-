import "server-only";
import { prisma } from "@/lib/db";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: Date;
}

/**
 * Fixed-window rate limiter backed by PostgreSQL, so limits hold across restarts and
 * multiple app instances. One atomic UPSERT per check.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number, now = new Date()): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  // Opportunistic cleanup of expired windows (~1% of calls).
  if (Math.random() < 0.01) {
    await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86_400_000) } } }).catch(() => {});
  }
  return { allowed: count <= limit, count, limit, resetAt: new Date(windowStart.getTime() + windowMs) };
}
