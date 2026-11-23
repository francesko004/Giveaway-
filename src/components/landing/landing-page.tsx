import type { Metadata } from "next";
import type { Campaign } from "@prisma/client";
import { getDictionary, getNonce } from "@/lib/i18n/server";
import { getSettings } from "@/services/settings";
import { localizeCampaign } from "@/services/campaigns";
import { SiteHeader } from "./site-header";
import { CampaignLanding } from "./campaign-landing";

export async function campaignMetadata(campaign: Campaign | null): Promise<Metadata> {
  const { locale, dict } = await getDictionary();
  const settings = await getSettings();
  if (!campaign) return { title: dict.noCampaign.title };
  const c = localizeCampaign(campaign, locale);
  const image = campaign.prizeImage || "/images/og-default.png";
  return {
    title: c.title,
    description: c.description.slice(0, 160),
    alternates: { canonical: `/giveaway/${campaign.slug}` },
    openGraph: { type: "website", title: c.title, description: c.description.slice(0, 200), siteName: settings.companyName, images: [{ url: image }], locale: locale === "sq" ? "sq_AL" : "en_GB" },
    twitter: { card: "summary_large_image", title: c.title, description: c.description.slice(0, 200), images: [image] },
  };
}

export async function LandingPage({ campaign, searchParams }: { campaign: Campaign | null; searchParams: Record<string, string | string[] | undefined> }) {
  const [{ locale, dict }, settings, nonce] = await Promise.all([getDictionary(), getSettings(), getNonce()]);
  return (
    <>
      <SiteHeader companyName={settings.companyName} logoUrl={settings.logoUrl} locale={locale} dict={dict} showNav={!!campaign} homeHref={campaign ? `/giveaway/${campaign.slug}` : "/giveaway"} ctaHref={campaign ? "#register" : undefined} />
      <main id="main">
        {campaign ? (
          <CampaignLanding campaign={campaign} settings={settings} locale={locale} dict={dict} searchParams={searchParams} nonce={nonce} />
        ) : (
          <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
            <h1 className="text-2xl font-bold text-navy">{dict.noCampaign.title}</h1>
            <p className="mt-2 text-ink-muted">{dict.noCampaign.text}</p>
          </div>
        )}
      </main>
    </>
  );
}
