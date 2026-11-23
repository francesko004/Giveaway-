import "server-only";
import { cookies, headers } from "next/headers";
import { getSettings } from "@/services/settings";
import { dictionaries, isLocale, LOCALE_COOKIE, type Locale } from "./dictionaries";

/** Locale: explicit cookie → admin default (Albanian unless changed). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const settings = await getSettings();
  return isLocale(settings.defaultLocale) ? settings.defaultLocale : "sq";
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, dict: dictionaries[locale] };
}

export async function getNonce() {
  return (await headers()).get("x-nonce") ?? undefined;
}
