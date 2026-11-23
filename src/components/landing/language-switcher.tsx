"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ locale, className }: { locale: Locale; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next: Locale = locale === "sq" ? "en" : "sq";
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        start(() => router.refresh());
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-sm font-medium text-ink transition hover:bg-surface-muted disabled:opacity-60",
        className,
      )}
      disabled={pending}
      aria-label={next === "en" ? "Switch to English" : "Kalo në shqip"}
    >
      <Globe className="size-4 text-ink-muted" />
      <span className="uppercase">{locale}</span>
      <span className="text-ink-muted">/</span>
      <span className="text-ink-muted uppercase">{next}</span>
    </button>
  );
}
