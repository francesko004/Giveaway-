/**
 * Seeds site settings and (optionally) a demo campaign with QR sources.
 *   npm run db:seed            → settings only
 *   SEED_DEMO=1 npm run db:seed → also a demo campaign "Summer Giveaway 2026"
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../scripts/db";
import { DEFAULT_PRIVACY, DEFAULT_TERMS } from "../src/content/legal";

const code = () => randomBytes(8).toString("base64url").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 7).padEnd(7, "x");

async function main() {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: "Demo Company",
      companyLegalName: "Demo Company SHPK",
      contactEmail: "info@example.com",
      contactPhone: "+355 69 000 0000",
      address: "Rruga e Durrësit, Tiranë, Shqipëri",
      termsContent: DEFAULT_TERMS,
      privacyContent: DEFAULT_PRIVACY,
    },
  });
  console.log("✓ site settings");

  if (process.env.SEED_DEMO !== "1") return;
  const slug = "summer-giveaway-2026";
  if (await prisma.campaign.findUnique({ where: { slug } })) {
    console.log("• demo campaign already exists");
    return;
  }
  const now = Date.now();
  const minute = (ms: number) => new Date(Math.floor(ms / 60000) * 60000);
  const campaign = await prisma.campaign.create({
    data: {
      title: "Fito një weekend në Riviera Shqiptare",
      slug,
      description: "Regjistrohu falas dhe merr pjesë në shortin për një fundjavë për dy persona në Sarandë, me akomodim dhe makinë me qira të përfshira.",
      prizeName: "Fundjavë për 2 në Sarandë",
      prizeDescription: "2 netë në hotel 4★ me mëngjes\nMakinë me qira për 3 ditë\nKarburant i përfshirë",
      prizeValue: "€650",
      eligibility: "Mosha 18+. Banues në Shqipëri. Një regjistrim për person. Punonjësit e organizatorit nuk mund të marrin pjesë.",
      translations: {
        en: {
          title: "Win a weekend on the Albanian Riviera",
          description: "Enter for free for a chance to win a weekend for two in Saranda, with accommodation and a rental car included.",
          prizeName: "Weekend for 2 in Saranda",
          prizeDescription: "2 nights in a 4★ hotel with breakfast\n3-day car rental\nFuel included",
          eligibility: "Age 18+. Residents of Albania. One entry per person. Employees of the organiser cannot enter.",
        },
      },
      status: "ACTIVE",
      startsAt: minute(now - 86_400_000),
      endsAt: minute(now + 14 * 86_400_000),
      drawAt: minute(now + 14 * 86_400_000 + 3_600_000),
      winnerCount: 1,
      alternateCount: 2,
      showParticipantCount: true,
      settings: { cityField: "optional", minAge: 18, allowedPhoneCountries: [], maxEntriesPerIp: 5, sendConfirmationEmail: true },
    },
  });
  const sources: [string, string, "POSTER" | "LOCATION" | "EVENT" | "SOCIAL"][] = [
    ["Poster – Tirana Airport", "poster01", "POSTER"],
    ["Shop – Blloku", "shop01", "LOCATION"],
    ["Event stand", "event01", "EVENT"],
    ["Instagram bio", "instagram", "SOCIAL"],
  ];
  for (const [name, s, type] of sources) {
    await prisma.qRSource.create({ data: { campaignId: campaign.id, name, slug: s, type, code: code(), destination: `/giveaway/${slug}` } });
  }
  await prisma.siteSettings.update({ where: { id: 1 }, data: { featuredCampaignId: campaign.id } });
  console.log(`✓ demo campaign /giveaway/${slug} with ${sources.length} QR sources`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
