import "server-only";
import { Client } from "pg";
import { MIGRATIONS } from "./bundle";

/**
 * Applies pending migrations from inside the app — used on Cloudflare Workers (no Prisma CLI) and by
 * the /setup page. Fully compatible with `prisma migrate deploy`: it uses Prisma's own
 * `_prisma_migrations` table and checksums, so either tool can be used at any time.
 *
 * A PostgreSQL advisory lock guarantees that concurrent callers never apply a migration twice.
 */
export interface MigrationResult {
  applied: string[];
  total: number;
}

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

/**
 * A standalone pg client. On Cloudflare Workers the socket reports its own closing as an "error" event;
 * without a listener that becomes an uncaught exception ("This socket has been closed").
 */
function newClient(connectionString: string) {
  const client = new Client({ connectionString });
  client.on("error", () => {});
  return client;
}

export async function pendingMigrations(connectionString: string): Promise<string[]> {
  const client = newClient(connectionString);
  await client.connect();
  try {
    const exists = await client.query(`SELECT to_regclass('"_prisma_migrations"') AS t`);
    if (!exists.rows[0].t) return MIGRATIONS.map((m) => m.name);
    const done = await client.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`);
    const names = new Set(done.rows.map((r) => r.migration_name as string));
    return MIGRATIONS.filter((m) => !names.has(m.name)).map((m) => m.name);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function applyMigrations(connectionString: string): Promise<MigrationResult> {
  const client = newClient(connectionString);
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock(72707369)");
    await client.query(CREATE_TABLE);
    const rows = await client.query(`SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`);
    const done = new Map(rows.rows.map((r) => [r.migration_name as string, r]));
    for (const m of MIGRATIONS) {
      const prev = done.get(m.name);
      if (prev?.finished_at) {
        if (prev.checksum !== m.checksum) console.warn(`[migrate] checksum differs for applied migration ${m.name}`);
        continue;
      }
      if (prev) throw new Error(`Migration ${m.name} previously failed — resolve it manually (prisma migrate resolve)`);
      const id = crypto.randomUUID();
      await client.query(`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count) VALUES ($1, $2, $3, now(), 0)`, [id, m.checksum, m.name]);
      try {
        // Simple-query protocol (no parameters) so multi-statement SQL incl. PL/pgSQL bodies works.
        await client.query("BEGIN");
        await client.query(m.sql);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        await client.query(`UPDATE "_prisma_migrations" SET logs = $2 WHERE id = $1`, [id, String((error as Error).message).slice(0, 2000)]);
        throw new Error(`Migration ${m.name} failed: ${(error as Error).message}`);
      }
      await client.query(`UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`, [id]);
      applied.push(m.name);
    }
    return { applied, total: MIGRATIONS.length };
  } finally {
    await client.query("SELECT pg_advisory_unlock(72707369)").catch(() => {});
    await client.end().catch(() => {});
  }
}
