import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { DEFAULT_PRIVACY, DEFAULT_TERMS } from "@/content/legal";
import type { SiteSettings } from "@/generated/prisma/client";

export type Locale = "sq" | "en";

/** Singleton settings row (created on first access). Cached per request. */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const existing = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, termsContent: DEFAULT_TERMS, privacyContent: DEFAULT_PRIVACY } });
});

export function fillTemplate(template: string, settings: SiteSettings): string {
  const values: Record<string, string> = {
    companyName: settings.companyName,
    companyLegalName: settings.companyLegalName || settings.companyName,
    companyNipt: settings.companyNipt || "—",
    address: settings.address || "—",
    contactEmail: settings.contactEmail || "—",
    contactPhone: settings.contactPhone || "—",
    retentionDays: String(settings.retentionDays),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

export function legalContent(settings: SiteSettings, kind: "terms" | "privacy", locale: Locale): string {
  const stored = (kind === "terms" ? settings.termsContent : settings.privacyContent) as Partial<Record<Locale, string>>;
  const fallback = kind === "terms" ? DEFAULT_TERMS : DEFAULT_PRIVACY;
  return fillTemplate(stored?.[locale] || fallback[locale], settings);
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  website?: string;
}
