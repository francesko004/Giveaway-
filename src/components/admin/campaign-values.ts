import type { Campaign } from "@/generated/prisma/client";
import { utcToZonedLocal } from "@/lib/time";
import { parseCampaignSettings, campaignTranslationsSchema } from "@/lib/validation/campaign-settings";
import type { CampaignFormValues } from "./campaign-form";

export function toFormValues(c: Campaign, tz: string): CampaignFormValues {
  const t = campaignTranslationsSchema.safeParse(c.translations);
  return {
    title: c.title,
    slug: c.slug,
    description: c.description,
    prizeName: c.prizeName,
    prizeDescription: c.prizeDescription,
    prizeImage: c.prizeImage ?? "",
    prizeValue: c.prizeValue ?? "",
    eligibility: c.eligibility,
    startsAt: utcToZonedLocal(c.startsAt, tz),
    endsAt: utcToZonedLocal(c.endsAt, tz),
    drawAt: utcToZonedLocal(c.drawAt, tz),
    winnerCount: c.winnerCount,
    alternateCount: c.alternateCount,
    showParticipantCount: c.showParticipantCount,
    referencePrefix: c.referencePrefix,
    settings: parseCampaignSettings(c.settings),
    translations: { en: (t.success && t.data.en) || {} },
  };
}

export function emptyFormValues(tz: string): CampaignFormValues {
  const now = Date.now();
  const at = (days: number, h: number) => {
    const local = utcToZonedLocal(new Date(now + days * 86_400_000), tz).slice(0, 10);
    return `${local}T${String(h).padStart(2, "0")}:00`;
  };
  return {
    title: "",
    slug: "",
    description: "",
    prizeName: "",
    prizeDescription: "",
    prizeImage: "",
    prizeValue: "",
    eligibility: "Mosha 18+. Një regjistrim për person. Punonjësit e organizatorit nuk mund të marrin pjesë.",
    startsAt: at(1, 9),
    endsAt: at(31, 21),
    drawAt: at(32, 12),
    winnerCount: 1,
    alternateCount: 2,
    showParticipantCount: false,
    referencePrefix: "GIVE",
    settings: { cityField: "optional", minAge: 18, allowedPhoneCountries: [], maxEntriesPerIp: 5, sendConfirmationEmail: true },
    translations: { en: {} },
  };
}
