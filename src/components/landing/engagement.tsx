"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { remaining } from "@/lib/time";

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(target);
  const from = useRef(0);
  useEffect(() => {
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = ms === 0 ? 1 : Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(a + (target - a) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Animated participant counter that refreshes every 30 s (aggregate numbers only). */
export function LiveCounter({ slug, initial, initialToday }: { slug: string; initial: number; initialToday: number }) {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState({ count: initial, today: initialToday });
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/campaigns/${slug}/stats`);
        if (res.ok) setStats(await res.json());
      } catch {}
    }, 30_000);
    return () => window.clearInterval(id);
  }, [slug]);
  const shown = useCountUp(stats.count);
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 shadow-card">
      <span className="relative flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <Users className="size-5" />
        <span className="absolute -top-0.5 -right-0.5 flex size-3">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-3 rounded-full border-2 border-white bg-success" />
        </span>
      </span>
      <div className="min-w-0">
        <p className="text-xl font-extrabold text-navy tabular-nums" data-testid="live-count">{shown.toLocaleString(locale === "sq" ? "sq-AL" : "en-GB")}</p>
        <p className="text-xs text-ink-muted">{t("game.liveCount")}</p>
      </div>
      {stats.today > 0 && <span className="ml-auto rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">{t("game.today", { n: stats.today })}</span>}
    </div>
  );
}

/** How far through its registration window the campaign is. */
export function CampaignProgress({ start, end, serverNow }: { start: string; end: string; serverNow: number }) {
  const { t } = useI18n();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const pct = Math.min(100, Math.max(0, Math.round(((serverNow - s) / (e - s)) * 100)));
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold tracking-wider text-ink-muted uppercase">{t("game.progress")}</span>
        <span className="font-medium text-ink-muted">{t("game.elapsed", { p: pct })}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("game.progress")}>
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-[#60A5FA] transition-[width] duration-1000 ease-out" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/** Mobile bottom bar that appears when the registration card is off-screen. */
export function StickyCta({ end, serverNow }: { end: string; serverNow: number }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const target = document.getElementById("register");
    if (!target) return;
    const obs = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top > 0), { threshold: 0.05 });
    obs.observe(target);
    const onEntered = () => setEntered(true);
    window.addEventListener("gv:registered", onEntered);
    const offset = serverNow - Date.now();
    const id = window.setInterval(() => setNow(Date.now() + offset), 30_000);
    return () => {
      obs.disconnect();
      window.clearInterval(id);
      window.removeEventListener("gv:registered", onEntered);
    };
  }, [serverNow]);
  if (entered) return null;
  const r = remaining(new Date(end).getTime(), now);
  const left = r.days > 0 ? `${r.days}d ${r.hours}h` : `${r.hours}h ${r.minutes}m`;
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(20_36_58/0.25)] backdrop-blur transition-transform duration-300 lg:hidden ${visible ? "translate-y-0" : "translate-y-full"}`}
      aria-hidden={!visible}
    >
      <a href="#register" tabIndex={visible ? 0 : -1} className="gv-shine flex h-12 items-center justify-between gap-3 rounded-xl bg-brand px-4 font-semibold text-white">
        <span>{t("game.stickyCta")}</span>
        <span className="flex items-center gap-2 text-sm font-medium text-white/80">
          {t("game.closesIn")} {left} <ArrowRight className="size-4 text-white" />
        </span>
      </a>
    </div>
  );
}
