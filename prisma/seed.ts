/**
 * Seeds site settings (MegaLLuksi branding) and, optionally, a demo campaign with QR sources.
 *   npm run db:seed             → settings only
 *   SEED_DEMO=1 npm run db:seed → also the demo campaign
 * The /setup page offers the same demo campaign when deploying to Cloudflare Workers.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../scripts/db";
import { DEFAULT_PRIVACY, DEFAULT_TERMS } from "../src/content/legal";
import { brandedSettings, demoCampaign, DEMO_QR_SOURCES } from "../src/content/demo";

const code = () => randomBytes(8).toString("base64url").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 7).padEnd(7, "x");

async function main() {
  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...brandedSettings(), termsContent: DEFAULT_TERMS, privacyContent: DEFAULT_PRIVACY },
  });
  console.log("✓ site settings");

  if (process.env.SEED_DEMO !== "1") return;
  const data = demoCampaign();
  if (await prisma.campaign.findUnique({ where: { slug: data.slug } })) {
    console.log("• demo campaign already exists");
    return;
  }
  const campaign = await prisma.campaign.create({ data });
  for (const s of DEMO_QR_SOURCES) {
    await prisma.qRSource.create({ data: { campaignId: campaign.id, ...s, code: code(), destination: `/giveaway/${data.slug}` } });
  }
  await prisma.siteSettings.update({ where: { id: 1 }, data: { featuredCampaignId: campaign.id } });
  console.log(`✓ demo campaign /giveaway/${data.slug} with ${DEMO_QR_SOURCES.length} QR sources`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
