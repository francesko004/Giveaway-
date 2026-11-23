import { BRAND } from "./brand";

/** Sample campaign used by `SEED_DEMO=1 npm run db:seed` and the optional demo on the /setup page. */
export function demoCampaign(now = Date.now()) {
  const minute = (ms: number) => new Date(Math.floor(ms / 60000) * 60000);
  return {
    title: "Fito një weekend në Riviera Shqiptare",
    slug: "megalluksi-riviera",
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
    status: "ACTIVE" as const,
    startsAt: minute(now - 86_400_000),
    endsAt: minute(now + 14 * 86_400_000),
    drawAt: minute(now + 14 * 86_400_000 + 3_600_000),
    winnerCount: 1,
    alternateCount: 2,
    showParticipantCount: true,
    referencePrefix: BRAND.referencePrefix,
    settings: { cityField: "optional", minAge: 18, allowedPhoneCountries: [], maxEntriesPerIp: 5, sendConfirmationEmail: true },
  };
}

export const DEMO_QR_SOURCES: { name: string; slug: string; type: "POSTER" | "LOCATION" | "EVENT" | "SOCIAL" }[] = [
  { name: "Poster – Tirana Airport", slug: "poster01", type: "POSTER" },
  { name: "Shop – Blloku", slug: "shop01", type: "LOCATION" },
  { name: "Event stand", slug: "event01", type: "EVENT" },
  { name: "Instagram bio", slug: "instagram", type: "SOCIAL" },
];

export function brandedSettings() {
  return {
    companyName: BRAND.name,
    companyLegalName: BRAND.legalName,
    contactEmail: BRAND.email,
    socialLinks: { website: BRAND.url },
  };
}
