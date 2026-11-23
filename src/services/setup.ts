import "server-only";
import { randomBytes } from "node:crypto";
import { prisma, connectionString } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { safeEqual } from "@/lib/security/crypto";
import { applyMigrations, pendingMigrations } from "@/lib/migrations/migrate";
import { DEFAULT_PRIVACY, DEFAULT_TERMS } from "@/content/legal";
import { brandedSettings, demoCampaign, DEMO_QR_SOURCES } from "@/content/demo";
import { writeAudit } from "./audit";

export interface SetupStatus {
  databaseConfigured: boolean;
  databaseReachable: boolean;
  pendingMigrations: string[];
  hasAdmin: boolean;
  setupTokenConfigured: boolean;
  error?: string;
}

/** What still needs to happen before the site is usable. Never throws. */
export async function setupStatus(): Promise<SetupStatus> {
  const url = connectionString();
  const status: SetupStatus = {
    databaseConfigured: !!url,
    databaseReachable: false,
    pendingMigrations: [],
    hasAdmin: false,
    setupTokenConfigured: !!env().SETUP_TOKEN,
  };
  if (!url) return status;
  try {
    status.pendingMigrations = await pendingMigrations(url);
    status.databaseReachable = true;
    if (status.pendingMigrations.length === 0) status.hasAdmin = (await prisma.user.count()) > 0;
  } catch (e) {
    status.error = (e as Error).message.slice(0, 300);
  }
  return status;
}

export interface SetupInput {
  token: string;
  name: string;
  email: string;
  password: string;
  demo: boolean;
}

/**
 * First-run setup (used on Cloudflare Workers, also works on a VPS): applies database migrations,
 * creates the branded settings row and the first SUPER_ADMIN. Requires the SETUP_TOKEN secret and
 * refuses to run once an administrator exists.
 */
export async function runSetup(input: SetupInput) {
  const expected = env().SETUP_TOKEN;
  if (!expected) throw new AppError("SETUP_DISABLED", "Set the SETUP_TOKEN secret to enable first-run setup", 403);
  if (!safeEqual(input.token, expected)) throw new AppError("BAD_TOKEN", "The setup token is not correct", 403);
  const url = connectionString();
  if (!url) throw new AppError("NO_DATABASE", "DATABASE_URL is not configured", 500);

  const migrations = await applyMigrations(url);

  if ((await prisma.user.count()) > 0) throw new AppError("ALREADY_SET_UP", "Setup has already been completed. Sign in at /admin.", 409);
  const policy = passwordPolicyError(input.password);
  if (policy) throw new AppError("WEAK_PASSWORD", policy, 422);

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    await tx.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, ...brandedSettings(), termsContent: DEFAULT_TERMS, privacyContent: DEFAULT_PRIVACY } });
    const u = await tx.user.create({ data: { name: input.name, email: input.email.toLowerCase(), role: "SUPER_ADMIN", passwordHash } });
    await writeAudit(tx, { userId: u.id, action: "setup.completed", entityType: "User", entityId: u.id, metadata: { migrations: migrations.applied, demo: input.demo } });
    if (input.demo) {
      const data = demoCampaign();
      if (!(await tx.campaign.findUnique({ where: { slug: data.slug } }))) {
        const c = await tx.campaign.create({ data });
        for (const s of DEMO_QR_SOURCES) {
          await tx.qRSource.create({ data: { campaignId: c.id, ...s, code: randomBytes(6).toString("hex").slice(0, 7), destination: `/giveaway/${data.slug}` } });
        }
        await tx.siteSettings.update({ where: { id: 1 }, data: { featuredCampaignId: c.id } });
      }
    }
    return u;
  });
  return { userId: user.id, migrationsApplied: migrations.applied };
}
