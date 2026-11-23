import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import type { SiteSettings } from "@/generated/prisma/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { SocialLinks } from "@/services/settings";
import { BrandMark } from "./site-header";

const ICONS: Record<keyof SocialLinks, React.ReactNode> = {
  facebook: <path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" />
    </>
  ),
  tiktok: <path d="M16 3c.4 2.3 1.8 3.7 4 4v3.2c-1.5 0-2.9-.4-4-1.2V15a6 6 0 1 1-6-6v3.3a2.7 2.7 0 1 0 2.7 2.7V3H16z" />,
  website: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  ),
};

export function SiteFooter({ settings, dict }: { settings: SiteSettings; dict: Dictionary }) {
  const social = (settings.socialLinks ?? {}) as SocialLinks;
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-navy text-white/80">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <div className="[&_span]:text-white">
            <BrandMark name={settings.companyName} logoUrl={settings.logoUrl} />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/65">{dict.footer.free}</p>
          {(settings.companyLegalName || settings.companyNipt) && (
            <p className="text-xs text-white/55">
              {settings.companyLegalName}
              {settings.companyNipt && ` · ${dict.footer.nipt} ${settings.companyNipt}`}
            </p>
          )}
          <div className="flex gap-2">
            {(Object.keys(ICONS) as (keyof SocialLinks)[])
              .filter((k) => social[k])
              .map((k) => (
                <a key={k} href={social[k]} target="_blank" rel="noopener noreferrer" aria-label={k} className="flex size-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20">
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                    {ICONS[k]}
                  </svg>
                </a>
              ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-white">{dict.footer.contact}</p>
          <ul className="space-y-2.5 text-sm">
            {settings.contactEmail && (
              <li className="flex items-center gap-2"><Mail className="size-4 text-white/50" /><a href={`mailto:${settings.contactEmail}`} className="hover:text-white">{settings.contactEmail}</a></li>
            )}
            {settings.contactPhone && (
              <li className="flex items-center gap-2"><Phone className="size-4 text-white/50" /><a href={`tel:${settings.contactPhone.replace(/\s/g, "")}`} className="hover:text-white">{settings.contactPhone}</a></li>
            )}
            {settings.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-white/50" /><span>{settings.address}</span></li>}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-white">Info</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/terms" className="hover:text-white">{dict.footer.terms}</Link></li>
            <li><Link href="/privacy" className="hover:text-white">{dict.footer.privacy}</Link></li>
            <li><Link href="/privacy/request" className="hover:text-white">{dict.footer.dataRequest}</Link></li>
            <li><Link href="/verify" className="hover:text-white">{dict.footer.verify}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page py-5 text-xs text-white/50">
          © {year} {settings.companyLegalName || settings.companyName}. {dict.footer.rights}
        </div>
      </div>
    </footer>
  );
}
