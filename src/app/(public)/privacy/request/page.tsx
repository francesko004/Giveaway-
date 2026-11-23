import { getDictionary } from "@/lib/i18n/server";
import { getSettings } from "@/services/settings";
import { SiteHeader } from "@/components/landing/site-header";
import { DataRequestForm } from "@/components/landing/data-request-form";

export async function generateMetadata() {
  return { title: (await getDictionary()).dict.dataRequest.title, robots: { index: false } };
}

export default async function DataRequestPage() {
  const [{ locale, dict }, settings] = await Promise.all([getDictionary(), getSettings()]);
  return (
    <>
      <SiteHeader companyName={settings.companyName} logoUrl={settings.logoUrl} locale={locale} dict={dict} />
      <main className="container-page max-w-2xl py-10 sm:py-14">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">{dict.dataRequest.title}</h1>
        <p className="mt-1 text-ink-muted">{dict.dataRequest.subtitle}</p>
        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-card sm:p-8">
          <DataRequestForm />
        </div>
      </main>
    </>
  );
}
