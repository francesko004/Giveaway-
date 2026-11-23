import { z } from "zod";
import { normalizePhone } from "./phone";

/**
 * Shared by the client form (instant feedback) and the API (authoritative check).
 * Error messages are i18n keys resolved by the UI.
 */
const name = z
  .string()
  .trim()
  .min(3, "errors.fullName.min")
  .max(100, "errors.fullName.max")
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'\-]*$/u, "errors.fullName.invalid")
  .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "errors.fullName.full");

export const registrationFieldsSchema = z.object({
  fullName: name,
  phone: z
    .string()
    .trim()
    .min(6, "errors.phone.invalid")
    .max(24, "errors.phone.invalid")
    .refine((v) => normalizePhone(v) !== null, "errors.phone.invalid"),
  email: z.string().trim().max(254, "errors.email.invalid").email("errors.email.invalid"),
  city: z.string().trim().max(80, "errors.city.max").optional().or(z.literal("")),
  acceptTerms: z.literal(true, { error: "errors.terms.required" }),
  acceptPrivacy: z.literal(true, { error: "errors.privacy.required" }),
  ageConfirmed: z.boolean().optional(),
  marketingConsent: z.boolean().default(false),
});

export type RegistrationFields = z.infer<typeof registrationFieldsSchema>;

const utmValue = z.string().trim().max(100).optional();

export const registrationRequestSchema = registrationFieldsSchema.extend({
  campaign: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  src: z.string().trim().max(64).regex(/^[a-zA-Z0-9_-]*$/).optional(),
  formToken: z.string().max(300),
  /** Honeypot — must stay empty. */
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(4096).optional(),
  locale: z.enum(["sq", "en"]).default("sq"),
  referrer: z.string().max(500).optional(),
  utm: z
    .object({ source: utmValue, medium: utmValue, campaign: utmValue, term: utmValue, content: utmValue })
    .partial()
    .optional(),
});

export type RegistrationRequest = z.infer<typeof registrationRequestSchema>;
