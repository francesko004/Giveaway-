import { getDictionary } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { getSettings } from "@/services/settings";
import { SiteFooter } from "@/components/landing/site-footer";

export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, dict }, settings] = await Promise.all([getDictionary(), getSettings()]);
  return (
    <I18nProvider locale={locale} dict={dict}>
      <div className="flex min-h-dvh flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter settings={settings} dict={dict} />
      </div>
    </I18nProvider>
  );
}
