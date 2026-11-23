"use client";
import { useMemo, useState } from "react";
import Script from "next/script";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CheckCircle2, Copy, Loader2, Lock, Share2, ShieldCheck } from "lucide-react";
import { registrationFieldsSchema } from "@/lib/validation/registration";
import { normalizePhone } from "@/lib/validation/phone";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface Props {
  campaignSlug: string;
  campaignTitle: string;
  formToken: string;
  src?: string;
  utm?: Record<string, string>;
  cityField: "hidden" | "optional" | "required";
  minAge: number | null;
  timezone: string;
  turnstileSiteKey?: string;
  nonce?: string;
  shareUrl: string;
}

interface Success {
  referenceNumber: string;
  registeredAt: string;
  campaignTitle: string;
}

export function RegistrationForm(props: Props) {
  const { t, locale } = useI18n();
  const [success, setSuccess] = useState<Success | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      registrationFieldsSchema.superRefine((v, ctx) => {
        if (props.cityField === "required" && !v.city?.trim()) ctx.addIssue({ code: "custom", path: ["city"], message: "errors.city.required" });
        if (props.minAge && v.ageConfirmed !== true) ctx.addIssue({ code: "custom", path: ["ageConfirmed"], message: "errors.age.required" });
      }),
    [props.cityField, props.minAge],
  );

  type FormIn = z.input<typeof schema>;
  type FormOut = z.output<typeof schema>;
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { fullName: "", phone: "", email: "", city: "", acceptTerms: false as unknown as true, acceptPrivacy: false as unknown as true, ageConfirmed: false, marketingConsent: false },
  });
  const { register, handleSubmit, control, formState, setError, setValue } = form;
  const err = (name: keyof FormIn) => {
    const m = formState.errors[name]?.message;
    return m ? t(String(m)) : undefined;
  };

  const onSubmit = handleSubmit(async (values, event) => {
    setFormError(null);
    const formEl = event?.target as HTMLFormElement | undefined;
    const turnstileToken = props.turnstileSiteKey
      ? ((formEl?.querySelector('input[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value ?? "")
      : undefined;
    const honeypot = (formEl?.querySelector('input[name="website"]') as HTMLInputElement | null)?.value ?? "";
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          campaign: props.campaignSlug,
          src: props.src,
          utm: props.utm,
          formToken: props.formToken,
          website: honeypot,
          turnstileToken,
          locale,
          referrer: document.referrer || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setSuccess(data.data);
        requestAnimationFrame(() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }
      const code: string = data?.error?.code ?? "";
      const fields: Record<string, string> | undefined = data?.error?.details?.fields;
      if (fields) {
        for (const [name, message] of Object.entries(fields)) {
          if (name in values) setError(name as keyof FormIn, { message });
        }
      }
      const known = t(`errors.codes.${code}`);
      setFormError(known.startsWith("errors.") ? t("form.genericError") : known);
      if (props.turnstileSiteKey) (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
    } catch {
      setFormError(t("form.networkError"));
    }
  });

  if (success) return <SuccessCard success={success} timezone={props.timezone} shareUrl={props.shareUrl} />;

  const required = <span className="text-danger" aria-hidden> *</span>;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-describedby={formError ? "form-error" : undefined}>
      {/* Honeypot: invisible to people, attractive to bots */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <FormField id="fullName" label={<>{t("form.fullName")}{required}</>} error={err("fullName")}>
        <Input id="fullName" autoComplete="name" placeholder={t("form.fullNamePlaceholder")} aria-invalid={!!formState.errors.fullName} aria-describedby={formState.errors.fullName ? "fullName-error" : undefined} {...register("fullName")} />
      </FormField>

      <FormField id="phone" label={<>{t("form.phone")}{required}</>} error={err("phone")} hint={t("form.phoneHint")}>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t("form.phonePlaceholder")}
          aria-invalid={!!formState.errors.phone}
          aria-describedby={formState.errors.phone ? "phone-error" : "phone-hint"}
          {...register("phone", {
            onBlur: (e) => {
              const n = normalizePhone(e.target.value);
              if (n) setValue("phone", n.country === "AL" ? n.national : n.international);
            },
          })}
        />
      </FormField>

      <FormField id="email" label={<>{t("form.email")}{required}</>} error={err("email")}>
        <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder={t("form.emailPlaceholder")} aria-invalid={!!formState.errors.email} aria-describedby={formState.errors.email ? "email-error" : undefined} {...register("email")} />
      </FormField>

      {props.cityField !== "hidden" && (
        <FormField
          id="city"
          label={
            <>
              {t("form.city")}
              {props.cityField === "required" ? required : <span className="font-normal text-ink-muted"> ({t("form.optional")})</span>}
            </>
          }
          error={err("city")}
        >
          <Input id="city" autoComplete="address-level2" placeholder={t("form.cityPlaceholder")} aria-invalid={!!formState.errors.city} {...register("city")} />
        </FormField>
      )}

      <div className="space-y-3 rounded-xl border bg-surface-muted/60 p-4">
        <ConsentRow id="acceptTerms" error={err("acceptTerms")} control={control} name="acceptTerms">
          {t("form.acceptTermsBefore")}{" "}
          <a href="/terms" target="_blank" className="font-medium text-brand underline underline-offset-2">{t("form.terms")}</a>
          {required}
        </ConsentRow>
        <ConsentRow id="acceptPrivacy" error={err("acceptPrivacy")} control={control} name="acceptPrivacy">
          {t("form.acceptPrivacyBefore")}{" "}
          <a href="/privacy" target="_blank" className="font-medium text-brand underline underline-offset-2">{t("form.privacy")}</a>{" "}
          {t("form.acceptPrivacyAfter")}
          {required}
        </ConsentRow>
        {props.minAge && (
          <ConsentRow id="ageConfirmed" error={err("ageConfirmed")} control={control} name="ageConfirmed">
            {t("form.age", { age: props.minAge })}
            {required}
          </ConsentRow>
        )}
        <div className="border-t pt-3">
          <ConsentRow id="marketingConsent" control={control} name="marketingConsent" muted>
            {t("form.marketing")}
          </ConsentRow>
        </div>
      </div>

      {props.turnstileSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={props.nonce} />
          <div className="cf-turnstile" data-sitekey={props.turnstileSiteKey} data-language={locale === "sq" ? "sq" : "en"} data-size="flexible" />
        </>
      )}

      {formError && (
        <div id="form-error" role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">
          {formError}
        </div>
      )}

      <Button type="submit" size="xl" className="w-full text-base" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? (
          <>
            <Loader2 className="size-5 animate-spin" /> {t("form.submitting")}
          </>
        ) : (
          t("form.submit")
        )}
      </Button>
      <div className="flex flex-col items-center gap-1.5 text-center text-xs text-ink-muted">
        <p className="flex items-center gap-1.5"><Lock className="size-3.5" /> {t("form.secure")}</p>
        <p>{t("form.freeNote")}</p>
      </div>
    </form>
  );
}

function FormField({ id, label, error, hint, children }: { id: string; label: React.ReactNode; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ConsentRow({ id, name, control, error, muted, children }: { id: string; name: string; control: any; error?: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <Checkbox
              id={id}
              checked={field.value === true}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
              ref={field.ref}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              className="mt-0.5"
            />
          )}
        />
        <label htmlFor={id} className={cn("text-sm leading-snug", muted ? "text-ink-muted" : "text-ink")}>{children}</label>
      </div>
      {error && <p id={`${id}-error`} className="mt-1.5 pl-8 text-xs font-medium text-danger" role="alert">{error}</p>}
    </div>
  );
}

function SuccessCard({ success, timezone, shareUrl }: { success: Success; timezone: string; shareUrl: string }) {
  const { t, locale } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  const when = new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", { dateStyle: "long", timeStyle: "medium", timeZone: timezone }).format(new Date(success.registeredAt));

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
        await navigator.share({ title: success.campaignTitle, url: shareUrl });
        return;
      } catch {
        return;
      }
    }
    copy(shareUrl, "link");
  };

  return (
    <div className="space-y-5 text-center animate-in fade-in-0 zoom-in-95 duration-300" role="status" aria-live="polite">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 className="size-9" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-navy" tabIndex={-1}>{t("success.title")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("success.message")}</p>
      </div>
      <div className="rounded-xl border-2 border-dashed border-brand/40 bg-brand-soft/60 p-4">
        <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{t("success.reference")}</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wide break-all text-brand" data-testid="reference-number">{success.referenceNumber}</p>
        <button type="button" onClick={() => copy(success.referenceNumber, "ref")} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
          <Copy className="size-3.5" /> {copied === "ref" ? "✓" : t("success.copy")}
        </button>
      </div>
      <dl className="grid gap-2 rounded-xl border bg-white p-4 text-left text-sm">
        <div className="flex justify-between gap-4"><dt className="text-ink-muted">{t("success.campaign")}</dt><dd className="text-right font-medium text-ink">{success.campaignTitle}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-ink-muted">{t("success.registeredAt")}</dt><dd className="text-right font-medium text-ink">{when}</dd></div>
      </dl>
      <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted"><ShieldCheck className="size-3.5" /> {t("success.screenshot")} {t("success.emailNote")}</p>
      <Button type="button" variant="outline" size="lg" className="w-full" onClick={share}>
        <Share2 /> {copied === "link" ? t("success.copied") : t("success.share")}
      </Button>
    </div>
  );
}
