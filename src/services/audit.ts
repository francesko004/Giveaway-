import "server-only";
import { prisma, type Db } from "@/lib/db";
import { sha256 } from "@/lib/security/crypto";
import { stableStringify } from "@/lib/stable-json";
import type { Prisma } from "@prisma/client";

export const GENESIS_HASH = "0".repeat(64);

export interface AuditEntry {
  userId?: string | null;
  campaignId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
}

function entryHash(prevHash: string, e: AuditEntry, createdAt: Date) {
  return sha256(
    stableStringify({
      prevHash,
      userId: e.userId ?? null,
      campaignId: e.campaignId ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      metadata: e.metadata ?? {},
      createdAt: createdAt.toISOString(),
    }),
  );
}

/**
 * Appends to the tamper-evident audit chain. Each record hashes the previous one, so any
 * edit or deletion breaks the chain (and UPDATE/DELETE are blocked by DB triggers anyway).
 * Must run inside a transaction so the record commits atomically with the change it describes.
 */
export async function writeAudit(tx: Db, e: AuditEntry) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(724001)`;
  const last = await tx.auditLog.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
  const prevHash = last?.hash ?? GENESIS_HASH;
  const createdAt = new Date();
  const metadata = JSON.parse(stableStringify(e.metadata ?? {})) as Prisma.InputJsonValue;
  return tx.auditLog.create({
    data: {
      userId: e.userId ?? null,
      campaignId: e.campaignId ?? null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      metadata,
      ipHash: e.ipHash ?? null,
      prevHash,
      hash: entryHash(prevHash, e, createdAt),
      createdAt,
    },
  });
}

/** Convenience wrapper for audit records not tied to another write. */
export function audit(e: AuditEntry) {
  return prisma.$transaction((tx) => writeAudit(tx, e));
}

export async function verifyAuditChain(): Promise<{ ok: boolean; checked: number; brokenAt?: number }> {
  let prevHash = GENESIS_HASH;
  let checked = 0;
  let cursor: number | undefined;
  for (;;) {
    const batch = await prisma.auditLog.findMany({
      orderBy: { seq: "asc" },
      take: 500,
      ...(cursor !== undefined ? { where: { seq: { gt: cursor } } } : {}),
    });
    if (batch.length === 0) break;
    for (const row of batch) {
      const expected = entryHash(
        prevHash,
        {
          userId: row.userId,
          campaignId: row.campaignId,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          metadata: row.metadata as Record<string, unknown>,
        },
        row.createdAt,
      );
      if (row.prevHash !== prevHash || row.hash !== expected) return { ok: false, checked, brokenAt: row.seq };
      prevHash = row.hash;
      checked++;
    }
    cursor = batch[batch.length - 1].seq;
  }
  return { ok: true, checked };
}
