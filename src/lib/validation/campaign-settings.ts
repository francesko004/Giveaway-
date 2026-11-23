import { z } from "zod";

export const campaignSettingsSchema = z.object({
  cityField: z.enum(["hidden", "optional", "required"]).default("optional"),
  /** When set, entrants must confirm they are at least this old. */
  minAge: z.number().int().min(13).max(99).nullable().default(18),
  /** ISO country codes accepted for phone numbers. Empty = any country. */
  allowedPhoneCountries: z.array(z.string().length(2)).default([]),
  /** Entries from the same network beyond this count are flagged for review. */
  maxEntriesPerIp: z.number().int().min(1).max(1000).default(5),
  /** Send registration confirmation e-mail (if e-mail is configured). */
  sendConfirmationEmail: z.boolean().default(true),
});

export type CampaignSettings = z.infer<typeof campaignSettingsSchema>;

export function parseCampaignSettings(value: unknown): CampaignSettings {
  const parsed = campaignSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : campaignSettingsSchema.parse({});
}

export const campaignTranslationSchema = z.object({
  title: z.string().max(140).optional(),
  description: z.string().max(4000).optional(),
  prizeName: z.string().max(140).optional(),
  prizeDescription: z.string().max(4000).optional(),
  eligibility: z.string().max(4000).optional(),
});

export const campaignTranslationsSchema = z.object({ en: campaignTranslationSchema.optional() }).default({});
export type CampaignTranslations = z.infer<typeof campaignTranslationsSchema>;
