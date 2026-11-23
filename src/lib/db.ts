import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaClient } from "@prisma/client";

/** True when running inside Cloudflare Workers (workerd). */
export const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

/** Database connection string for the current runtime (Hyperdrive binding, Worker secret or env). */
export function connectionString(): string | undefined {
  if (isWorkers) {
    try {
      // Prefer a Hyperdrive binding (connection pooling at the edge) when one is configured.
      const env = getCloudflareContext().env as unknown as { HYPERDRIVE?: { connectionString: string }; DATABASE_URL?: string };
      return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL ?? process.env.DATABASE_URL;
    } catch {
      /* outside a request (e.g. module init) */
    }
  }
  return process.env.DATABASE_URL;
}

function createClient() {
  if (isWorkers) {
    // Each request gets its own small pool. Workers close sockets when the request ends; swallow the
    // resulting "socket closed" errors on idle connections instead of surfacing unhandled rejections.
    const pool = new Pool({ connectionString: connectionString(), max: 3, idleTimeoutMillis: 5_000 });
    pool.on("error", () => {});
    pool.on("connect", (client) => client.on("error", () => {}));
    return new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });
  }
  // On Node.js a single shared pool is reused.
  const adapter = new PrismaPg({ connectionString: connectionString() });
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
// Workers forbid sharing I/O objects (sockets) between requests, so clients are scoped to the request.
const perRequest = new WeakMap<object, PrismaClient>();

function current(): PrismaClient {
  if (isWorkers) {
    const ctx = getCloudflareContext().ctx as object;
    let client = perRequest.get(ctx);
    if (!client) {
      client = createClient();
      perRequest.set(ctx, client);
    }
    return client;
  }
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * The Prisma client. A proxy so that every call resolves the right instance for the current runtime
 * (shared on Node.js, per request on Cloudflare Workers) without changing call sites.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = current();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Db = PrismaClient | Tx;
