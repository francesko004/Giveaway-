"use client";
import { useState } from "react";
import { CalendarPlus, Check, Copy, Download, Gift, Share2, Trophy, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { downloadCalendar, downloadTicket } from "@/lib/client/ticket";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Success {
  referenceNumber: string;
  registeredAt: string;
  registeredAtLabel?: string;
  campaignTitle: string;
  fullName?: string;
}

type Quest = "registered" | "share" | "save" | "calendar" | "follow";

function loadQuests(ref: string): Quest[] {
  try {
    const raw = localStorage.getItem(`gv-quests-${ref}`);
    return raw ? (JSON.parse(raw) as Quest[]) : ["registered"];
  } catch {
    return ["registered"];
  }
}

/**
 * Post-registration experience: a digital entry ticket and optional "challenges".
 * Challenges are purely for engagement — they never add entries or change the odds,
 * and the UI says so explicitly.
 */
export function EntrySuccess(p: { success: Success; timezone: string; shareUrl: string; drawAt: string; drawLabel: string; companyName: string; socialUrl?: string }) {
  const { t, locale } = useI18n();
  const ref = p.success.referenceNumber;
  // Rendered only on the client after a successful submission, so reading localStorage here is safe.
  const [done, setDone] = useState<Quest[]>(() => loadQuests(ref));
  const [copied, setCopied] = useState<string | null>(null);

  const complete = (q: Quest) =>
    setDone((prev) => {
      if (prev.includes(q)) return prev;
      const nextDone = [...prev, q];
      try {
        localStorage.setItem(`gv-quests-${ref}`, JSON.stringify(nextDone));
      } catch {}
      return nextDone;
    });

  const when =
    p.success.registeredAtLabel ??
    new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: p.timezone }).format(new Date(p.success.registeredAt));
  const parts = (p.success.fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const holder = parts.length ? `${parts[0]}${parts.length > 1 ? ` ${parts[parts.length - 1][0]}.` : ""}` : "—";

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: p.success.campaignTitle, url: p.shareUrl });
        complete("share");
      } catch {}
      return;
    }
    await copy(p.shareUrl, "link");
    complete("share");
  };

  const save = async () => {
    await downloadTicket({
      title: t("game.ticketTitle"),
      campaign: p.success.campaignTitle,
      reference: ref,
      holderLabel: t("game.holder"),
      holder,
      dateLabel: t("success.registeredAt"),
      date: when,
      drawLabel: t("game.drawOn"),
      draw: p.drawLabel,
      company: p.companyName,
    });
    complete("save");
  };

  const calendar = () => {
    downloadCalendar({ title: `${t("game.drawOn")}: ${p.success.campaignTitle}`, start: p.drawAt, url: p.shareUrl, description: `${t("success.reference")}: ${ref}` });
    complete("calendar");
  };

  const quests: { id: Quest; label: string; icon: React.ComponentType<{ className?: string }>; action?: () => void }[] = [
    { id: "registered", label: t("game.quests.registered"), icon: Gift },
    { id: "share", label: t("game.quests.share"), icon: Share2, action: share },
    { id: "save", label: t("game.quests.save"), icon: Download, action: save },
    { id: "calendar", label: t("game.quests.calendar"), icon: CalendarPlus, action: calendar },
    ...(p.socialUrl
      ? [{ id: "follow" as const, label: t("game.quests.follow"), icon: Users, action: () => { window.open(p.socialUrl, "_blank", "noopener"); complete("follow"); } }]
      : []),
  ];
  const doneCount = quests.filter((q) => done.includes(q.id)).length;
  const pct = doneCount / quests.length;

  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-success-soft text-success animate-pop">
          <Check className="size-8" strokeWidth={3} />
        </div>
        <h3 className="text-xl font-bold text-navy">{t("success.title")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("success.message")}</p>
      </div>

      {/* Ticket */}
      <div className="animate-pop overflow-hidden rounded-2xl border shadow-elevated [animation-delay:120ms]" data-testid="entry-ticket">
        <div className="gv-shine bg-gradient-to-br from-brand to-navy px-5 pt-5 pb-6 text-white">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase">{p.companyName}</p>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">{t("game.valid")} ✓</span>
          </div>
          <p className="mt-2 text-lg leading-snug font-bold text-balance">{p.success.campaignTitle}</p>
        </div>
        <div className="bg-white px-5 pt-5">
          <p className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{t("game.ticketTitle")}</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-wide break-all text-brand" data-testid="reference-number">{ref}</p>
          <button type="button" onClick={() => copy(ref, "ref")} className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
            <Copy className="size-3.5" /> {copied === "ref" ? "✓" : t("success.copy")}
          </button>
        </div>
        {/* Perforation with side notches (the circles match the card background) */}
        <div aria-hidden className="relative h-6 bg-white">
          <span className="absolute top-1/2 -left-3 size-6 -translate-y-1/2 rounded-full border bg-white" />
          <span className="absolute top-1/2 -right-3 size-6 -translate-y-1/2 rounded-full border bg-white" />
          <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-line" />
        </div>
        <div className="bg-white px-5 pt-2 pb-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-ink-muted">{t("game.holder")}</dt><dd className="font-semibold text-ink">{holder}</dd></div>
            <div><dt className="text-xs text-ink-muted">{t("success.registeredAt")}</dt><dd className="font-semibold text-ink">{when}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-ink-muted">{t("game.drawOn")}</dt><dd className="font-semibold text-ink">{p.drawLabel}</dd></div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={save}><Download /> {t("game.saveTicket")}</Button>
        <Button type="button" variant="outline" onClick={calendar}><CalendarPlus /> {t("game.addCalendar")}</Button>
        <Button type="button" className="col-span-2" size="lg" onClick={share}>
          <Share2 /> {copied === "link" ? t("success.copied") : t("success.share")}
        </Button>
      </div>

      {/* Challenges */}
      <div className="rounded-2xl border bg-surface-muted/60 p-4">
        <div className="mb-3 flex items-center gap-3">
          <ProgressRing value={pct} />
          <div>
            <p className="flex items-center gap-1.5 font-semibold text-navy"><Trophy className="size-4 text-brand" /> {t("game.questsTitle")}</p>
            <p className="text-xs text-ink-muted">{pct === 1 ? t("game.allDone") : t("game.done", { done: doneCount, total: quests.length })}</p>
          </div>
        </div>
        <ul className="space-y-1.5">
          {quests.map((q) => {
            const isDone = done.includes(q.id);
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={q.action}
                  disabled={!q.action}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left text-sm transition",
                    isDone ? "border-success/30" : "hover:border-brand/40 hover:bg-brand-soft/40",
                  )}
                >
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full transition", isDone ? "bg-success text-white animate-pop" : "bg-surface-muted text-ink-muted")}>
                    {isDone ? <Check className="size-4" strokeWidth={3} /> : <q.icon className="size-3.5" />}
                  </span>
                  <span className={cn("flex-1", isDone ? "text-ink-muted line-through decoration-success/50" : "font-medium text-ink")}>{q.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">{t("game.questsNote")}</p>
      </div>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-11 shrink-0 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#E4E7EC" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="#16A34A" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-[stroke-dashoffset] duration-700" />
    </svg>
  );
}
