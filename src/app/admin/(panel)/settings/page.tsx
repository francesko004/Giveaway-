import { prisma } from "@/lib/db";
import { emailEnabled, env, turnstileEnabled } from "@/lib/env";
import { requireAdminPage } from "@/lib/auth/server";
import { getSettings } from "@/services/settings";
import { DEFAULT_PRIVACY, DEFAULT_TERMS } from "@/content/legal";
import { PageHeader } from "@/components/admin/shell";
import { SettingsForm, type SettingsValues } from "@/components/admin/settings-form";

export default async function SettingsPage() {
  await requireAdminPage("SUPER_ADMIN");
  const [s, campaigns] = await Promise.all([getSettings(), prisma.campaign.findMany({ where: { status: { not: "DRAFT" } }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } })]);
  const raw = (v: unknown) => (v ?? {}) as { sq?: string; en?: string };
  const terms = raw(s.termsContent);
  const privacy = raw(s.privacyContent);
  // Show the effective template text when nothing custom was stored yet.
  const withDefaults = (stored: { sq?: string; en?: string }, kind: "terms" | "privacy") => ({
    sq: stored.sq || legalTemplate(kind, "sq"),
    en: stored.en || legalTemplate(kind, "en"),
  });
  const initial: SettingsValues = {
    companyName: s.companyName,
    companyLegalName: s.companyLegalName,
    companyNipt: s.companyNipt,
    logoUrl: s.logoUrl ?? "",
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    address: s.address,
    socialLinks: (s.socialLinks ?? {}) as SettingsValues["socialLinks"],
    defaultLocale: s.defaultLocale === "en" ? "en" : "sq",
    timezone: s.timezone,
    featuredCampaignId: s.featuredCampaignId,
    registrationsPerIpPerHour: s.registrationsPerIpPerHour,
    minFormFillSeconds: s.minFormFillSeconds,
    sendConfirmationEmail: s.sendConfirmationEmail,
    analyticsEnabled: s.analyticsEnabled,
    publishSnapshot: s.publishSnapshot,
    retentionDays: s.retentionDays,
    sessionTtlHours: s.sessionTtlHours,
    termsVersion: s.termsVersion,
    privacyVersion: s.privacyVersion,
    termsContent: withDefaults(terms, "terms"),
    privacyContent: withDefaults(privacy, "privacy"),
  };
  return (
    <>
      <PageHeader title="Settings" description="Branding, localisation, registration, privacy and legal texts." />
      <SettingsForm initial={initial} campaigns={campaigns} status={{ email: emailEnabled(), turnstile: turnstileEnabled(), cron: !!env().CRON_SECRET }} />
    </>
  );
}

function legalTemplate(kind: "terms" | "privacy", locale: "sq" | "en") {
  return (kind === "terms" ? DEFAULT_TERMS : DEFAULT_PRIVACY)[locale];
}
