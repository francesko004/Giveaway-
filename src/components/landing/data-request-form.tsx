"use client";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";

export function DataRequestForm() {
  const { t, dict } = useI18n();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/data-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd)) });
      const data = await res.json().catch(() => null);
      if (res.ok) setDone(true);
      else setError(data?.error?.code === "RATE_LIMITED" ? t("errors.codes.RATE_LIMITED") : t("errors.codes.VALIDATION"));
    } catch {
      setError(t("form.networkError"));
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
        <CheckCircle2 className="size-10 text-success" />
        <p className="max-w-md text-ink">{t("dataRequest.done")}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[10000px]" aria-hidden />
      <Field label={t("dataRequest.type")} htmlFor="type">
        <NativeSelect id="type" name="type" required defaultValue="ACCESS" className="h-11">
          {Object.entries(dict.dataRequest.types).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </NativeSelect>
      </Field>
      <Field label={t("form.fullName")} htmlFor="fullName"><Input id="fullName" name="fullName" required minLength={3} autoComplete="name" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("form.email")} htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
        <Field label={<>{t("form.phone")} <span className="font-normal text-ink-muted">({t("form.optional")})</span></>} htmlFor="phone"><Input id="phone" name="phone" type="tel" autoComplete="tel" /></Field>
      </div>
      <Field label={t("dataRequest.message")} htmlFor="message"><Textarea id="message" name="message" maxLength={2000} /></Field>
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto">{busy && <Loader2 className="animate-spin" />} {t("dataRequest.submit")}</Button>
    </form>
  );
}
