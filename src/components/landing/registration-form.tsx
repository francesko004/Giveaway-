"use client";
import { useMemo, useState } from "react";
import Script from "next/script";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Mail, ShieldCheck, Sparkles, User } from "lucide-react";
import { registrationFieldsSchema } from "@/lib/validation/registration";
import { normalizePhone } from "@/lib/validation/phone";
import { useI18n } from "@/lib/i18n/client";
import { confetti } from "@/lib/client/confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EntrySuccess, type Success } from "./entry-success";

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
  drawAt: string;
  drawLabel: string;
  companyName: string;
  socialUrl?: string;
}

type FieldName = "fullName" | "city" | "phone" | "email" | "acceptTerms" | "acceptPrivacy" | "ageConfirmed" | "marketingConsent";
const STEP_FIELDS: FieldName[][] = [["fullName", "city"], ["phone", "email"], ["acceptTerms", "acceptPrivacy", "ageConfirmed", "marketingConsent"]];
const STEP_ICONS = [User, Mail, ShieldCheck];

export function RegistrationForm(props: Props) {
  const { t, locale } = useI18n();
  const [success, setSuccess] = useState<Success | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

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
  const { register, handleSubmit, control, formState, setError, setValue, trigger, getValues } = form;
  const err = (name: keyof FormIn) => {
    const m = formState.errors[name]?.message;
    return m ? t(String(m)) : undefined;
  };

  const goTo = (n: number) => {
    setFormError(null);
    setStep(n);
    // Move keyboard focus to the first field of the new step once it has rendered.
    requestAnimationFrame(() => {
      const first = STEP_FIELDS[n].find((f) => document.getElementById(f));
      if (first) document.getElementById(first)?.focus({ preventScroll: true });
    });
  };

  const next = async () => {
    const fields = STEP_FIELDS[step].filter((f) => f !== "city" || props.cityField !== "hidden") as (keyof FormIn)[];
    if (await trigger(fields, { shouldFocus: true })) goTo(step + 1);
  };

  const submit = handleSubmit(async (values, event) => {
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
        setSuccess({ ...data.data, fullName: values.fullName });
        window.dispatchEvent(new Event("gv:registered"));
        requestAnimationFrame(() => {
          const card = document.getElementById("register");
          card?.scrollIntoView({ behavior: "smooth", block: "start" });
          const rect = card?.getBoundingClientRect();
          confetti(rect ? { x: rect.left + rect.width / 2, y: Math.max(80, rect.top + 120) } : undefined);
        });
        return;
      }
      const code: string = data?.error?.code ?? "";
      const fields: Record<string, string> | undefined = data?.error?.details?.fields;
      if (fields) {
        let firstStep = 2;
        for (const [name, message] of Object.entries(fields)) {
          if (name in values) setError(name as keyof FormIn, { message });
          const s = STEP_FIELDS.findIndex((fs) => fs.includes(name as FieldName));
          if (s >= 0) firstStep = Math.min(firstStep, s);
        }
        if (firstStep !== step) goTo(firstStep);
      }
      const known = t(`errors.codes.${code}`);
      setFormError(known.startsWith("errors.") ? t("form.genericError") : known);
      if (props.turnstileSiteKey) (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
    } catch {
      setFormError(t("form.networkError"));
    }
  });

  if (success) {
    return (
      <EntrySuccess
        success={success}
        timezone={props.timezone}
        shareUrl={props.shareUrl}
        drawAt={props.drawAt}
        drawLabel={props.drawLabel}
        companyName={props.companyName}
        socialUrl={props.socialUrl}
      />
    );
  }

  const required = <span className="text-danger" aria-hidden> *</span>;
  const stepTitles = [t("game.steps.s1"), t("game.steps.s2"), t("game.steps.s3")];
  const stepHints = [t("game.hints.s1"), t("game.hints.s2"), t("game.hints.s3")];
  const firstName = (getValues("fullName") ?? "").trim().split(/\s+/)[0];

  return (
    <form
      onSubmit={(e) => {
        if (step < 2) {
          e.preventDefault();
          void next();
          return;
        }
        void submit(e);
      }}
      noValidate
      className="space-y-5"
      aria-describedby={formError ? "form-error" : undefined}
    >
      {/* Honeypot: invisible to people, attractive to bots */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div>
        <h2 className="text-xl font-bold text-navy">{t("form.title")}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t("form.subtitle")}</p>
      </div>

      {/* Progress */}
      <div>
        <ol className="flex items-center gap-2" aria-label={t("game.step", { n: step + 1, total: 3 })}>
          {stepTitles.map((title, i) => {
            const Icon = STEP_ICONS[i];
            const done = i < step;
            const current = i === step;
            return (
              <li key={title} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => i < step && goTo(i)}
                  disabled={i > step}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                    done && "border-success bg-success text-white",
                    current && "scale-110 border-brand bg-brand text-white shadow-[0_0_0_4px_rgb(37_99_235/0.15)]",
                    !done && !current && "border-line bg-white text-ink-muted",
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
                  <span className="sr-only">{title}</span>
                </button>
                {i < 2 && (
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div className={cn("h-full rounded-full bg-success transition-all duration-500", done ? "w-full" : "w-0")} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-4" aria-live="polite">
          <p className="text-xs font-semibold tracking-wider text-brand uppercase">{t("game.step", { n: step + 1, total: 3 })}</p>
          <p className="mt-0.5 text-lg font-bold text-navy">
            {step === 2 && firstName ? `${firstName}, ${stepHints[2].charAt(0).toLowerCase()}${stepHints[2].slice(1)}` : stepTitles[step]}
          </p>
          {step < 2 && <p className="text-sm text-ink-muted">{stepHints[step]}</p>}
        </div>
      </div>

      <div key={step} className="space-y-4 animate-in fade-in-0 slide-in-from-right-4 duration-300">
        {step === 0 && (
          <>
            <FormField id="fullName" label={<>{t("form.fullName")}{required}</>} error={err("fullName")}>
              <Input id="fullName" autoComplete="name" placeholder={t("form.fullNamePlaceholder")} aria-invalid={!!formState.errors.fullName} aria-describedby={formState.errors.fullName ? "fullName-error" : undefined} {...register("fullName")} />
            </FormField>
            {props.cityField !== "hidden" && (
              <FormField
                id="city"
                label={<>{t("form.city")}{props.cityField === "required" ? required : <span className="font-normal text-ink-muted"> ({t("form.optional")})</span>}</>}
                error={err("city")}
              >
                <Input id="city" autoComplete="address-level2" placeholder={t("form.cityPlaceholder")} aria-invalid={!!formState.errors.city} {...register("city")} />
              </FormField>
            )}
          </>
        )}

        {step === 1 && (
          <>
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
          </>
        )}

        {step === 2 && (
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
        )}
      </div>

      {props.turnstileSiteKey && (
        <div className={step === 2 ? "" : "hidden"}>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" nonce={props.nonce} />
          <div className="cf-turnstile" data-sitekey={props.turnstileSiteKey} data-language={locale === "sq" ? "sq" : "en"} data-size="flexible" />
        </div>
      )}

      {formError && (
        <div id="form-error" role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-3 text-sm font-medium text-danger">
          {formError}
        </div>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <Button type="button" variant="outline" size="xl" onClick={() => goTo(step - 1)} aria-label={t("game.back")} className="px-4">
            <ArrowLeft />
          </Button>
        )}
        {step < 2 ? (
          <Button type="submit" size="xl" className="flex-1 text-base">
            {t("game.next")} <ArrowRight />
          </Button>
        ) : (
          <Button type="submit" size="xl" className="gv-shine flex-1 text-base" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? (
              <>
                <Loader2 className="size-5 animate-spin" /> {t("form.submitting")}
              </>
            ) : (
              <>
                <Sparkles className="size-5" /> {t("form.submit")}
              </>
            )}
          </Button>
        )}
      </div>
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
