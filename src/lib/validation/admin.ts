import { z } from "zod";
import { campaignSettingsSchema, campaignTranslationsSchema } from "./campaign-settings";

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use the date/time picker");
const imagePath = z
  .string()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/api/uploads/") || v.startsWith("/images/") || /^https:\/\//.test(v), "Invalid image URL");

export const campaignInputSchema = z
  .object({
    title: z.string().trim().min(3).max(140),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only"),
    description: z.string().trim().min(10).max(4000),
    prizeName: z.string().trim().min(2).max(140),
    prizeDescription: z.string().trim().min(2).max(4000),
    prizeImage: imagePath.optional().or(z.literal("")),
    prizeValue: z.string().trim().max(60).optional().or(z.literal("")),
    eligibility: z.string().trim().max(4000).default(""),
    startsAt: localDateTime,
    endsAt: localDateTime,
    drawAt: localDateTime,
    winnerCount: z.coerce.number().int().min(1).max(100),
    alternateCount: z.coerce.number().int().min(0).max(100),
    showParticipantCount: z.boolean().default(false),
    referencePrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, "2–8 letters or digits").default("GIVE"),
    settings: campaignSettingsSchema.default(campaignSettingsSchema.parse({})),
    translations: campaignTranslationsSchema,
    /** Required to change protected fields of a closed campaign (exceptional, audited, invalidates the draw). */
    overrideReason: z.string().trim().min(20).max(1000).optional(),
  })
  .refine((v) => v.startsAt < v.endsAt, { path: ["endsAt"], message: "End must be after start" })
  .refine((v) => v.endsAt <= v.drawAt, { path: ["drawAt"], message: "Draw must be at or after the end" });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const qrSourceInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, dash and underscore only"),
  type: z.enum(["LOCATION", "POSTER", "SOCIAL", "PARTNER", "EVENT", "OTHER"]).default("OTHER"),
  destination: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")), "Must be a path on this site, e.g. /giveaway")
    .optional(),
  notes: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
});

export const reasonSchema = z.object({ reason: z.string().trim().min(10, "Please give a reason (min. 10 characters)").max(1000) });

export const participantStatusSchema = z.object({
  status: z.enum(["ELIGIBLE", "INVALID"]),
  reason: z.string().trim().min(10, "Please give a reason (min. 10 characters)").max(1000),
});

export const userInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "VIEWER"]),
  password: z.string().min(12).max(256).optional(),
});

export const settingsInputSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  companyLegalName: z.string().trim().max(200).default(""),
  companyNipt: z.string().trim().max(40).default(""),
  logoUrl: imagePath.optional().or(z.literal("")),
  contactEmail: z.string().trim().email().or(z.literal("")),
  contactPhone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  socialLinks: z
    .object({
      facebook: z.string().url().or(z.literal("")).optional(),
      instagram: z.string().url().or(z.literal("")).optional(),
      tiktok: z.string().url().or(z.literal("")).optional(),
      website: z.string().url().or(z.literal("")).optional(),
    })
    .default({}),
  defaultLocale: z.enum(["sq", "en"]),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
  featuredCampaignId: z.string().max(40).nullable().optional(),
  registrationsPerIpPerHour: z.coerce.number().int().min(1).max(1000),
  minFormFillSeconds: z.coerce.number().int().min(0).max(60),
  sendConfirmationEmail: z.boolean(),
  analyticsEnabled: z.boolean(),
  publishSnapshot: z.boolean(),
  retentionDays: z.coerce.number().int().min(30).max(3650),
  sessionTtlHours: z.coerce.number().int().min(1).max(168),
  termsVersion: z.string().trim().min(1).max(20),
  privacyVersion: z.string().trim().min(1).max(20),
  termsContent: z.object({ sq: z.string().max(50000).optional(), en: z.string().max(50000).optional() }).default({}),
  privacyContent: z.object({ sq: z.string().max(50000).optional(), en: z.string().max(50000).optional() }).default({}),
});

export const dataRequestSchema = z.object({
  type: z.enum(["ACCESS", "DELETION", "RECTIFICATION", "MARKETING_OPT_OUT"]),
  fullName: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(24).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  website: z.string().max(200).optional(),
});
