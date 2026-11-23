import Link from "next/link";
import { Gift } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { getSettings } from "@/services/settings";
import { SiteFooter } from "@/components/landing/site-footer";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, dict }, settings] = await Promise.all([getDictionary(), getSettings().catch(() => null)]);
  // Fresh deployment whose database has not been initialised yet → point to /setup instead of erroring.
  if (!settings) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-muted px-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white"><Gift className="size-6" /></span>
        <h1 className="text-xl font-bold text-navy">MegaLLuksi</h1>
        <p className="max-w-sm text-ink-muted">Faqja po konfigurohet. · The site is being set up.</p>
        <Link href="/setup" className="text-sm font-medium text-brand hover:underline">Administrator? Open /setup</Link>
      </main>
    );
  }
  return (
    <I18nProvider locale={locale} dict={dict}>
      <div className="flex min-h-dvh flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter settings={settings} dict={dict} />
      </div>
    </I18nProvider>
  );
}
