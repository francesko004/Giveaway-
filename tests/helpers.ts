import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { issueFormToken } from "@/lib/security/form-token";
import type { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";

export { prisma };

export async function resetDb() {
  // TRUNCATE bypasses the row-level append-only triggers — only ever used against the test database.
  if (!process.env.DATABASE_URL?.includes("test")) throw new Error("Refusing to reset a non-test database");
  await prisma.$executeRawUnsafe(
    `TRUNCATE "DrawResult","Draw","ConsentRecord","Participant","PageVisit","QRSource","AuditLog","Session","RateLimit","DataRequest","Upload","Campaign","User","SiteSettings" RESTART IDENTITY CASCADE`,
  );
  await prisma.siteSettings.create({ data: { id: 1, minFormFillSeconds: 0, registrationsPerIpPerHour: 1000, sendConfirmationEmail: false } });
}

export async function makeUser(role: Role = "SUPER_ADMIN", email = `${role.toLowerCase()}@test.local`, password = "correct-horse-battery-9"): Promise<SessionUser> {
  const u = await prisma.user.create({ data: { name: role, email, role, passwordHash: await hashPassword(password) } });
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

const HOUR = 3600_000;

export async function makeCampaign(overrides: Partial<Parameters<typeof prisma.campaign.create>[0]["data"]> = {}) {
  const now = Date.now();
  return prisma.campaign.create({
    data: {
      title: "Test Giveaway",
      slug: `test-${Math.random().toString(36).slice(2, 8)}`,
      description: "A test giveaway description",
      prizeName: "Prize",
      prizeDescription: "Prize description",
      status: "ACTIVE",
      startsAt: new Date(now - HOUR),
      endsAt: new Date(now + 24 * HOUR),
      drawAt: new Date(now + 25 * HOUR),
      settings: { cityField: "optional", minAge: null, allowedPhoneCountries: [], maxEntriesPerIp: 100, sendConfirmationEmail: false },
      ...overrides,
    },
  });
}

let counter = 0;
export function registration(campaign: { id: string; slug: string }, overrides: Record<string, unknown> = {}) {
  counter++;
  return {
    campaign: campaign.slug,
    fullName: "Arben Hoxha",
    phone: `069${String(1000000 + counter).slice(-7)}`,
    email: `arben${counter}@example.com`,
    city: "Tiranë",
    acceptTerms: true,
    acceptPrivacy: true,
    marketingConsent: false,
    formToken: issueFormToken(campaign.id, Date.now() - 10_000),
    locale: "sq",
    ...overrides,
  };
}

export function headers(ip = "203.0.113.7", extra: Record<string, string> = {}) {
  return new Headers({ "user-agent": "Mozilla/5.0 (iPhone) test", "x-forwarded-for": ip, ...extra });
}

/** Inserts ELIGIBLE participants directly (bypasses registration rules) for draw tests. */
export async function seedParticipants(campaignId: string, n: number, prefix = "TV") {
  const data = Array.from({ length: n }, (_, i) => ({
    campaignId,
    fullName: `Participant ${i}`,
    email: `p${i}-${campaignId}@example.com`,
    emailCanonical: `p${i}-${campaignId}@example.com`,
    phone: `+3556900${String(i).padStart(5, "0")}`,
    referenceNumber: `GIVE-2026-${prefix}${String(i).padStart(6, "0")}`,
    termsVersion: "1.0",
    privacyVersion: "1.0",
  }));
  await prisma.participant.createMany({ data });
  return data;
}
