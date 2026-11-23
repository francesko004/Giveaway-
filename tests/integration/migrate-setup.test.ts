import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { applyMigrations, pendingMigrations } from "@/lib/migrations/migrate";
import { MIGRATIONS } from "@/lib/migrations/bundle";
import { resetEnvCache } from "@/lib/env";
import { runSetup } from "@/services/setup";
import { prisma, resetDb } from "../helpers";

const base = process.env.DATABASE_URL!;
const FRESH = "giveaway_migrtest";
const freshUrl = base.replace(/\/[^/?]+(\?|$)/, `/${FRESH}$1`);
const adminUrl = base.replace(/\/[^/?]+(\?|$)/, "/postgres$1");

async function admin(sql: string) {
  const c = new Client({ connectionString: adminUrl });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
}

describe("in-app migrator (used on Cloudflare Workers)", () => {
  beforeAll(async () => {
    await admin(`DROP DATABASE IF EXISTS ${FRESH}`);
    await admin(`CREATE DATABASE ${FRESH}`);
  });
  afterAll(() => admin(`DROP DATABASE IF EXISTS ${FRESH}`));

  it("the bundled migrations match prisma/migrations", () => {
    expect(() => execSync("node scripts/bundle-migrations.mjs --check", { stdio: "pipe" })).not.toThrow();
  });

  it("applies every migration to an empty database exactly once", async () => {
    expect(await pendingMigrations(freshUrl)).toEqual(MIGRATIONS.map((m) => m.name));
    const [a, b] = await Promise.all([applyMigrations(freshUrl), applyMigrations(freshUrl)]);
    expect([...a.applied, ...b.applied].sort()).toEqual(MIGRATIONS.map((m) => m.name).sort());
    expect((await applyMigrations(freshUrl)).applied).toEqual([]);
    expect(await pendingMigrations(freshUrl)).toEqual([]);
  });

  it("is recognised by the Prisma CLI as fully migrated (same table and checksums)", () => {
    const out = execSync("npx prisma migrate status", { env: { ...process.env, DATABASE_URL: freshUrl }, stdio: "pipe" }).toString();
    expect(out).toMatch(/Database schema is up to date/);
  });

  it("creates the integrity triggers too", async () => {
    const c = new Client({ connectionString: freshUrl });
    await c.connect();
    const r = await c.query(`SELECT count(*)::int AS n FROM pg_trigger WHERE tgname LIKE 'gv_%'`);
    await c.end();
    expect(r.rows[0].n).toBeGreaterThanOrEqual(10);
  });
});

describe("first-run setup (/setup)", () => {
  beforeAll(() => {
    process.env.SETUP_TOKEN = "test-setup-token-123";
    resetEnvCache();
  });
  afterAll(() => {
    delete process.env.SETUP_TOKEN;
    resetEnvCache();
  });

  it("requires the setup token, creates the branded settings, the first super admin and a demo campaign — once", async () => {
    await resetDb();
    await prisma.siteSettings.deleteMany();
    const input = { token: "wrong-token-xxxx", name: "Owner", email: "Owner@MegaLLuksi.win", password: "MegaLLuksi-owner-2026", demo: true };
    await expect(runSetup(input)).rejects.toMatchObject({ code: "BAD_TOKEN" });
    await expect(runSetup({ ...input, token: "test-setup-token-123", password: "short" })).rejects.toMatchObject({ code: "WEAK_PASSWORD" });

    await runSetup({ ...input, token: "test-setup-token-123" });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "owner@megalluksi.win" } });
    expect(user.role).toBe("SUPER_ADMIN");
    const settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(settings.companyName).toBe("MegaLLuksi");
    const campaign = await prisma.campaign.findUniqueOrThrow({ where: { slug: "megalluksi-riviera" }, include: { qrSources: true } });
    expect(campaign.referencePrefix).toBe("MEGA");
    expect(campaign.qrSources).toHaveLength(4);
    expect(settings.featuredCampaignId).toBe(campaign.id);

    await expect(runSetup({ ...input, token: "test-setup-token-123", email: "second@megalluksi.win" })).rejects.toMatchObject({ code: "ALREADY_SET_UP" });
  });
});
