import { hash } from "@node-rs/argon2";
import { prisma } from "../../scripts/db";

export const E2E = { slug: "e2e-giveaway", qrCode: "e2eqr01", admin: "e2e-admin@example.com", password: "E2e-admin-password-1" };

async function main() {
  // Only ever wipe the dedicated end-to-end database.
  if (!/e2e/.test(process.env.DATABASE_URL ?? "")) throw new Error("Refusing to reset a non-e2e database");
  await prisma.$executeRawUnsafe(
    `TRUNCATE "DrawResult","Draw","ConsentRecord","Participant","PageVisit","QRSource","AuditLog","Session","RateLimit","DataRequest","Campaign","User","SiteSettings" RESTART IDENTITY CASCADE`,
  );
  await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, companyName: "E2E Company", minFormFillSeconds: 1 } });
  const now = Date.now();
  const c = await prisma.campaign.create({
    data: {
      title: "Fito një biçikletë",
      slug: E2E.slug,
      description: "Regjistrohu falas për të fituar një biçikletë elektrike.",
      prizeName: "Biçikletë elektrike",
      prizeDescription: "Biçikletë elektrike urbane",
      translations: { en: { title: "Win an e-bike", description: "Enter for free to win an electric bike." } },
      status: "ACTIVE",
      startsAt: new Date(now - 3600_000),
      endsAt: new Date(now + 7 * 86_400_000),
      drawAt: new Date(now + 8 * 86_400_000),
      showParticipantCount: true,
      settings: { cityField: "optional", minAge: 18, allowedPhoneCountries: [], maxEntriesPerIp: 50, sendConfirmationEmail: false },
    },
  });
  await prisma.qRSource.create({ data: { campaignId: c.id, name: "Poster E2E", slug: "poster01", code: E2E.qrCode, type: "POSTER", destination: `/giveaway/${E2E.slug}` } });
  await prisma.user.create({ data: { email: E2E.admin, name: "E2E Admin", role: "SUPER_ADMIN", passwordHash: await hash(E2E.password, { algorithm: 2 }) } });
}

main().finally(() => prisma.$disconnect());
