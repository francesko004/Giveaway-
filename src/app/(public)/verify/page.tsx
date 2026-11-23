import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate } from "@/lib/time";
import { getSettings } from "@/services/settings";
import { localizeCampaign } from "@/services/campaigns";
import { SiteHeader } from "@/components/landing/site-header";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata() {
  const { dict } = await getDictionary();
  return { title: dict.verify.title };
}

export default async function VerifyIndex() {
  const [{ locale, dict }, settings] = await Promise.all([getDictionary(), getSettings()]);
  const campaigns = await prisma.campaign.findMany({
    where: { status: { not: "DRAFT" }, draws: { some: {} } },
    orderBy: { drawAt: "desc" },
    include: { draws: { orderBy: { sequence: "desc" }, take: 1 } },
  });
  const v = dict.verify;
  return (
    <>
      <SiteHeader companyName={settings.companyName} logoUrl={settings.logoUrl} locale={locale} dict={dict} />
      <main className="container-page max-w-3xl py-10 sm:py-14">
        <div className="mb-8 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><ShieldCheck className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-bold text-navy sm:text-3xl">{v.listTitle}</h1>
            <p className="mt-1 text-ink-muted">{v.listSubtitle}</p>
          </div>
        </div>
        {campaigns.length === 0 ? (
          <p className="rounded-2xl border bg-surface-muted p-8 text-center text-ink-muted">{v.none}</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-white shadow-card">
            {campaigns.map((c) => {
              const d = c.draws[0];
              return (
                <li key={c.id}>
                  <Link href={`/verify/${c.id}`} className="flex items-center justify-between gap-4 p-5 transition hover:bg-surface-muted">
                    <div>
                      <p className="font-semibold text-navy">{localizeCampaign(c, locale).title}</p>
                      <p className="mt-0.5 text-sm text-ink-muted">{formatDate(c.drawAt, locale, settings.timezone)} · {d.entryCount} {dict.hero.participants}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={d.status === "COMPLETED" ? "success" : d.status === "COMMITTED" ? "warning" : "danger"}>
                        {d.status === "COMPLETED" ? v.completed : d.status === "COMMITTED" ? v.pending : v.invalidated}
                      </Badge>
                      <ChevronRight className="size-4 text-ink-muted" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
