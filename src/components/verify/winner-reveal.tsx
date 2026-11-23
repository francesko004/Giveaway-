"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

const CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RevealCtx = createContext<{ run: number }>({ run: 0 });

/**
 * Purely cosmetic "decoding" animation for published results. The real reference is rendered
 * on the server (so it is correct without JavaScript); the animation only plays on top of it.
 */
export function RevealGroup({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setRun(1);
        obs.disconnect();
      }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <RevealCtx.Provider value={{ run }}>
      <div ref={ref} className="space-y-2">{children}</div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">{t("game.revealNote")}</p>
        <button type="button" onClick={() => setRun((r) => r + 1)} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
          <RotateCcw className="size-3.5" /> {t("game.replay")}
        </button>
      </div>
    </RevealCtx.Provider>
  );
}

export function ScrambleText({ text, delay = 0, className, testId }: { text: string; delay?: number; className?: string; testId?: string }) {
  const { run } = useContext(RevealCtx);
  const [shown, setShown] = useState(text);
  const [settled, setSettled] = useState(true);
  useEffect(() => {
    if (run === 0) return;
    let raf = 0;
    let start = 0;
    const duration = 1400;
    const tick = (t: number) => {
      if (!start) {
        start = t;
        setSettled(false);
      }
      const elapsed = t - start - delay;
      if (elapsed < 0) {
        setShown(text.replace(/[A-Z0-9]/g, () => CHARS[Math.floor(Math.random() * CHARS.length)]));
        raf = requestAnimationFrame(tick);
        return;
      }
      const fixed = Math.floor((elapsed / duration) * text.length);
      setShown(
        text
          .split("")
          .map((ch, i) => (i < fixed || !/[A-Z0-9]/.test(ch) ? ch : CHARS[Math.floor(Math.random() * CHARS.length)]))
          .join(""),
      );
      if (fixed < text.length) raf = requestAnimationFrame(tick);
      else {
        setShown(text);
        setSettled(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, text, delay]);
  return (
    <span className={className} data-testid={testId} aria-label={text}>
      <span aria-hidden className={settled ? "" : "text-brand/70"}>{shown}</span>
    </span>
  );
}
