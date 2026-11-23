import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  ClipboardList,
  Hash,
  Lock,
  PauseCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Waves,
} from "lucide-react";
import type { Campaign, SiteSettings } from "@/generated/prisma/client";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { formatDateTime } from "@/lib/time";
import { appUrl, env, turnstileEnabled } from "@/lib/env";
import { issueFormToken } from "@/lib/security/form-token";
import { effectiveStatus } from "@/services/campaign-status";
import { campaignSettings, countEligible, localizeCampaign } from "@/services/campaigns";
import { recordLandingVisit } from "@/services/qr";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "./countdown";
import { RegistrationForm } from "./registration-form";

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function CampaignLanding({
  campaign,
  settings,
  locale,
  dict,
  searchParams,
  nonce,
}: {
  campaign: Campaign;
  settings: SiteSettings;
  locale: Locale;
  dict: Dictionary;
  searchParams: SearchParams;
  nonce?: string;
}) {
  const now = new Date();
  const status = effectiveStatus(campaign, now);
  const content = localizeCampaign(campaign, locale);
  const rules = campaignSettings(campaign);
  const tz = settings.timezone;
  const fmt = (d: Date) => formatDateTime(d, locale, tz);

  const rawSrc = one(searchParams.src);
  const src = rawSrc && /^[a-zA-Z0-9_-]{1,64}$/.test(rawSrc) ? rawSrc : undefined;
  const utm: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "term", "content"]) {
    const v = one(searchParams[`utm_${k}`]);
    if (v) utm[k] = v.slice(0, 100);
  }

  await recordLandingVisit(campaign.id, src, await headers());
  const participantCount = campaign.showParticipantCount ? await countEligible(campaign.id) : null;
  const image = campaign.prizeImage || "/images/prize-placeholder.webp";

  const statusVariant = { ACTIVE: "success", SCHEDULED: "default", PAUSED: "warning", CLOSED: "neutral", DRAW_COMPLETED: "navy", DRAFT: "neutral" } as const;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b bg-surface-muted">
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-brand/5" />
        <div className="container-page relative grid gap-8 py-8 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-12 lg:py-16">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant[status]}>
                <span className={status === "ACTIVE" ? "size-1.5 animate-pulse rounded-full bg-success" : "size-1.5 rounded-full bg-current"} />
                {dict.status[status]}
              </Badge>
              <Badge variant="outline"><Sparkles className="size-3" /> {dict.hero.freeEntry}</Badge>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-balance text-navy sm:text-4xl lg:text-5xl">{content.title}</h1>
              <p className="max-w-xl text-base leading-relaxed text-pretty text-ink-muted sm:text-lg">{content.description}</p>
            </div>

            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-white shadow-elevated">
              <Image src={image} alt={content.prizeName} fill priority sizes="(max-width: 1024px) 100vw, 560px" className="object-cover" />
              {campaign.prizeValue && (
                <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-1.5 text-sm font-semibold text-navy shadow-card backdrop-blur">
                  {dict.prize.value}: {campaign.prizeValue}
                </div>
              )}
            </div>

            {status === "ACTIVE" && <Countdown target={campaign.endsAt.toISOString()} serverNow={now.getTime()} mode="closes" />}
            {status === "SCHEDULED" && <Countdown target={campaign.startsAt.toISOString()} serverNow={now.getTime()} mode="opens" />}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-muted">
              <span className="flex items-center gap-1.5">
                <CalendarClock className="size-4 text-brand" />
                {status === "SCHEDULED" ? dict.hero.startsOn : status === "ACTIVE" || status === "PAUSED" ? dict.hero.closesOn : dict.hero.closedOn}{" "}
                <strong className="font-semibold text-ink">{fmt(status === "SCHEDULED" ? campaign.startsAt : campaign.closedAt ?? campaign.endsAt)}</strong>
              </span>
              {participantCount !== null && (
                <span className="flex items-center gap-1.5">
                  <Users className="size-4 text-brand" />
                  <strong className="font-semibold text-ink">{participantCount.toLocaleString(locale === "sq" ? "sq-AL" : "en-GB")}</strong> {dict.hero.participants}
                </span>
              )}
            </div>
          </div>

          {/* REGISTRATION */}
          <div id="register" className="scroll-mt-20 lg:sticky lg:top-24">
            <div className="rounded-2xl border bg-white p-5 shadow-elevated sm:p-7">
              {status === "ACTIVE" ? (
                <>
                  <div className="mb-5">
                    <h2 className="text-xl font-bold text-navy">{dict.form.title}</h2>
                    <p className="mt-1 text-sm text-ink-muted">{dict.form.subtitle}</p>
                  </div>
                  <RegistrationForm
                    campaignSlug={campaign.slug}
                    campaignTitle={content.title}
                    formToken={issueFormToken(campaign.id)}
                    src={src}
                    utm={Object.keys(utm).length ? utm : undefined}
                    cityField={rules.cityField}
                    minAge={rules.minAge}
                    timezone={tz}
                    turnstileSiteKey={turnstileEnabled() ? env().NEXT_PUBLIC_TURNSTILE_SITE_KEY : undefined}
                    nonce={nonce}
                    shareUrl={appUrl(`/giveaway/${campaign.slug}`)}
                  />
                </>
              ) : (
                <ClosedPanel status={status} dict={dict} campaign={campaign} fmt={fmt} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-16 py-14 sm:py-20">
        <div className="container-page">
          <SectionHeading title={dict.how.title} subtitle={dict.how.subtitle} />
          <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
            {[
              { icon: QrCode, ...dict.how.s1 },
              { icon: ClipboardList, ...dict.how.s2 },
              { icon: Trophy, ...dict.how.s3 },
            ].map((s, i) => (
              <li key={s.t} className="relative rounded-2xl border bg-white p-6 shadow-card">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><s.icon className="size-5" /></span>
                  <span className="text-sm font-bold text-brand/60">0{i + 1}</span>
                </div>
                <h3 className="font-semibold text-navy">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PRIZE */}
      <section id="prize" className="scroll-mt-16 border-y bg-surface-muted py-14 sm:py-20">
        <div className="container-page grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-white shadow-card">
            <Image src={image} alt={content.prizeName} fill loading="lazy" sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold tracking-wider text-brand uppercase">{dict.prize.title}</p>
            <h2 className="text-2xl font-bold text-navy sm:text-3xl">{content.prizeName}</h2>
            {campaign.prizeValue && (
              <p className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-navy shadow-card">
                {dict.prize.value}: {campaign.prizeValue}
              </p>
            )}
            <p className="leading-relaxed whitespace-pre-line text-ink-muted">{content.prizeDescription}</p>
            {status === "ACTIVE" && (
              <a href="#register" className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand px-6 font-semibold text-white shadow-sm transition hover:bg-brand-hover">
                {dict.hero.cta} <ArrowRight className="size-4" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* CAMPAIGN INFO */}
      <section className="py-14 sm:py-20">
        <div className="container-page">
          <SectionHeading title={dict.info.title} subtitle={dict.info.timezone} />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile icon={CalendarCheck2} label={dict.info.start} value={fmt(campaign.startsAt)} />
            <InfoTile icon={CalendarX2} label={dict.info.end} value={fmt(campaign.closedAt ?? campaign.endsAt)} />
            <InfoTile icon={Trophy} label={dict.info.draw} value={fmt(campaign.drawAt)} />
            {participantCount !== null ? (
              <InfoTile icon={Users} label={dict.info.participants} value={participantCount.toLocaleString(locale === "sq" ? "sq-AL" : "en-GB")} />
            ) : (
              <InfoTile icon={ShieldCheck} label={dict.hero.freeEntry} value={dict.footer.free} small />
            )}
          </div>
          {content.eligibility && (
            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-card">
              <h3 className="mb-2 font-semibold text-navy">{dict.info.eligibility}</h3>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-muted">{content.eligibility}</p>
            </div>
          )}
        </div>
      </section>

      {/* FAIRNESS */}
      <section id="fairness" className="scroll-mt-16 bg-navy py-14 text-white sm:py-20">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-wider text-blue-300 uppercase"><ShieldCheck className="size-4" /> drand · SHA-256</p>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{dict.fairness.title}</h2>
            <p className="mt-2 text-white/70">{dict.fairness.subtitle}</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Lock, ...dict.fairness.p1 },
              { icon: Hash, ...dict.fairness.p2 },
              { icon: Waves, ...dict.fairness.p3 },
              { icon: ShieldCheck, ...dict.fairness.p4 },
            ].map((p) => (
              <div key={p.t} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p.icon className="size-6 text-blue-300" />
                <h3 className="mt-4 font-semibold">{p.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/65">{p.d}</p>
              </div>
            ))}
          </div>
          <Link href={`/verify/${campaign.id}`} className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-navy transition hover:bg-blue-50">
            {dict.fairness.cta} <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

function ClosedPanel({ status, dict, campaign, fmt }: { status: string; dict: Dictionary; campaign: Campaign; fmt: (d: Date) => string }) {
  const paused = status === "PAUSED";
  return (
    <div className="space-y-4 py-6 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
        {paused ? <PauseCircle className="size-7" /> : <Lock className="size-7" />}
      </div>
      <div>
        <h2 className="text-xl font-bold text-navy">{paused ? dict.countdown.paused : dict.countdown.closed}</h2>
        <p className="mt-1.5 text-sm text-ink-muted">{paused ? dict.countdown.pausedText : dict.countdown.closedText}</p>
      </div>
      {!paused && (
        <>
          <p className="text-sm text-ink-muted">
            {dict.info.draw}: <strong className="text-ink">{fmt(campaign.drawAt)}</strong>
          </p>
          <Link href={`/verify/${campaign.id}`} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-hover">
            {dict.hero.seeResult} <ArrowRight className="size-4" />
          </Link>
        </>
      )}
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-bold text-navy sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, small }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-card">
      <Icon className="size-5 text-brand" />
      <p className="mt-3 text-xs font-semibold tracking-wider text-ink-muted uppercase">{label}</p>
      <p className={small ? "mt-1 text-sm text-ink" : "mt-1 font-semibold text-navy"}>{value}</p>
    </div>
  );
}
