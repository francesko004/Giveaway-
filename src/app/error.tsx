"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error.digest ?? "client error");
  }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-muted px-4 text-center">
      <h1 className="text-xl font-bold text-navy">Diçka shkoi keq · Something went wrong</h1>
      <p className="max-w-sm text-ink-muted">Ju lutemi provoni përsëri. · Please try again.</p>
      <button onClick={reset} className="inline-flex h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover">Provo përsëri · Retry</button>
    </main>
  );
}
