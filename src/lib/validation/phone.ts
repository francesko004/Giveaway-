import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "AL";

/**
 * Normalises a phone number to E.164. Accepts local Albanian formats ("069 123 4567", "0691234567")
 * as well as international ones ("+39 ...", "0039 ...").
 */
export function normalizePhone(raw: string, defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY) {
  const cleaned = raw.trim().replace(/^00/, "+");
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return { e164: parsed.number as string, country: parsed.country ?? null, national: parsed.formatNational(), international: parsed.formatInternational() };
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
