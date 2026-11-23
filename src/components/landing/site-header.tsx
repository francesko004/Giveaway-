import Link from "next/link";
import { Gift } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { LanguageSwitcher } from "./language-switcher";

export function BrandMark({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <span className="flex items-center gap-2.5">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="h-9 w-auto max-w-40 object-contain" />
      ) : (
        <>
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
            <Gift className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-navy">{name}</span>
        </>
      )}
    </span>
  );
}

export function SiteHeader({
  companyName,
  logoUrl,
  locale,
  dict,
  showNav = false,
  homeHref = "/giveaway",
  ctaHref,
}: {
  companyName: string;
  logoUrl?: string | null;
  locale: Locale;
  dict: Dictionary;
  showNav?: boolean;
  homeHref?: string;
  ctaHref?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href={homeHref} className="rounded-lg" aria-label={companyName}>
          <BrandMark name={companyName} logoUrl={logoUrl} />
        </Link>
        {showNav && (
          <nav aria-label="Main" className="hidden items-center gap-7 text-sm font-medium text-ink-muted md:flex">
            <a href="#how" className="transition hover:text-navy">{dict.nav.howItWorks}</a>
            <a href="#prize" className="transition hover:text-navy">{dict.nav.prize}</a>
            <a href="#fairness" className="transition hover:text-navy">{dict.nav.fairness}</a>
            <Link href="/verify" className="transition hover:text-navy">{dict.nav.verify}</Link>
          </nav>
        )}
        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          {ctaHref && (
            <a href={ctaHref} className="hidden h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover sm:inline-flex">
              {dict.nav.enter}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
