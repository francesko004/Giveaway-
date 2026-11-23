"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { remaining } from "@/lib/time";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Display-only countdown. It is synchronised to the SERVER clock (offset measured at render and
 * re-measured via /api/time), so a wrong device clock cannot change what users see. Whether
 * registration is accepted is always decided by the server.
 */
export function Countdown({ target, serverNow, mode = "closes", className }: { target: string; serverNow: number; mode?: "closes" | "opens"; className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const targetMs = new Date(target).getTime();
  const offset = useRef<number | null>(null);
  const [now, setNow] = useState(serverNow);
  const refreshed = useRef(false);

  useEffect(() => {
    offset.current = serverNow - Date.now();
    const tick = () => setNow(Date.now() + (offset.current ?? 0));
    tick();
    const id = window.setInterval(tick, 1000);

    const sync = async () => {
      try {
        const t0 = Date.now();
        const res = await fetch("/api/time", { cache: "no-store" });
        const { now: server } = (await res.json()) as { now: number };
        const rtt = Date.now() - t0;
        offset.current = server + rtt / 2 - Date.now();
      } catch {
        /* keep previous offset */
      }
    };
    const syncId = window.setInterval(sync, 5 * 60_000);
    const onVisible = () => document.visibilityState === "visible" && sync();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      window.clearInterval(syncId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [serverNow]);

  const r = remaining(targetMs, now);
  useEffect(() => {
    if (r.total === 0 && !refreshed.current) {
      refreshed.current = true;
      // Let the server decide the new state (opened / closed).
      const id = window.setTimeout(() => router.refresh(), 1200);
      return () => window.clearTimeout(id);
    }
  }, [r.total, router]);

  const units = [
    { label: t("countdown.days"), value: r.days },
    { label: t("countdown.hours"), value: r.hours },
    { label: t("countdown.minutes"), value: r.minutes },
    { label: t("countdown.seconds"), value: r.seconds },
  ];

  return (
    <div className={cn("w-full", className)}>
      <p className="mb-2.5 text-xs font-semibold tracking-wider text-ink-muted uppercase">{mode === "closes" ? t("countdown.title") : t("countdown.startsIn")}</p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-live="off" aria-atomic="true">
        {units.map((u) => (
          <div key={u.label} className="rounded-xl border bg-white px-1 py-3 text-center shadow-card">
            <div className="text-2xl font-bold text-navy tabular-nums sm:text-3xl" suppressHydrationWarning>
              {String(u.value).padStart(2, "0")}
            </div>
            <div className="mt-0.5 text-[11px] font-medium tracking-wide text-ink-muted uppercase">{u.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
