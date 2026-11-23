"use client";
import { createContext, useCallback, useContext } from "react";
import { translate, type Dictionary, type Locale } from "./dictionaries";

const I18nContext = createContext<{ locale: Locale; dict: Dictionary } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(ctx.dict, key, vars), [ctx.dict]);
  return { ...ctx, t };
}
