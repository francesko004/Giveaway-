import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { getSettings, legalContent } from "@/services/settings";
import { SiteHeader } from "./site-header";
import { Markdown } from "@/components/shared/markdown";

export async function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const [{ locale, dict }, settings] = await Promise.all([getDictionary(), getSettings()]);
  const title = kind === "terms" ? dict.footer.terms : dict.footer.privacy;
  const version = kind === "terms" ? settings.termsVersion : settings.privacyVersion;
  return (
    <>
      <SiteHeader companyName={settings.companyName} logoUrl={settings.logoUrl} locale={locale} dict={dict} />
      <main className="container-page max-w-3xl py-10 sm:py-14">
        <Link href="/giveaway" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> {dict.legal.back}</Link>
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-ink-muted">{dict.legal.lastUpdated} {version}</p>
        <article className="mt-6 rounded-2xl border bg-white p-6 shadow-card sm:p-8">
          <Markdown source={legalContent(settings, kind, locale)} />
        </article>
      </main>
    </>
  );
}
