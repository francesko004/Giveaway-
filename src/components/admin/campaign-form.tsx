"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/utils";
import { api, ApiError } from "./api";
import { ImageUpload } from "./image-upload";

export interface CampaignFormValues {
  title: string;
  slug: string;
  description: string;
  prizeName: string;
  prizeDescription: string;
  prizeImage: string;
  prizeValue: string;
  eligibility: string;
  startsAt: string;
  endsAt: string;
  drawAt: string;
  winnerCount: number;
  alternateCount: number;
  showParticipantCount: boolean;
  referencePrefix: string;
  settings: { cityField: "hidden" | "optional" | "required"; minAge: number | null; allowedPhoneCountries: string[]; maxEntriesPerIp: number; sendConfirmationEmail: boolean };
  translations: { en?: { title?: string; description?: string; prizeName?: string; prizeDescription?: string; eligibility?: string } };
}

export function CampaignForm({ id, initial, timezone, locked, canOverride, readOnly }: { id?: string; initial: CampaignFormValues; timezone: string; locked: boolean; canOverride: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [overrideReason, setOverrideReason] = useState("");
  const [slugTouched, setSlugTouched] = useState(!!id);

  const set = <K extends keyof CampaignFormValues>(k: K, val: CampaignFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const setS = <K extends keyof CampaignFormValues["settings"]>(k: K, val: CampaignFormValues["settings"][K]) => setV((p) => ({ ...p, settings: { ...p.settings, [k]: val } }));
  const setEn = (k: string, val: string) => setV((p) => ({ ...p, translations: { en: { ...p.translations.en, [k]: val } } }));

  const protectedChanged =
    locked &&
    (v.startsAt !== initial.startsAt || v.endsAt !== initial.endsAt || v.drawAt !== initial.drawAt || v.winnerCount !== initial.winnerCount || v.alternateCount !== initial.alternateCount || v.eligibility !== initial.eligibility || JSON.stringify(v.settings) !== JSON.stringify(initial.settings));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = { ...v, ...(protectedChanged ? { overrideReason } : {}) };
      if (id) {
        await api(`/api/admin/campaigns/${id}`, "PATCH", body);
        toast.success("Campaign saved");
        router.refresh();
      } else {
        const res = await api<{ id: string }>("/api/admin/campaigns", "POST", body);
        toast.success("Campaign created as draft");
        router.push(`/admin/campaigns/${res.id}`);
      }
    } catch (err) {
      const e2 = err as ApiError;
      if (Array.isArray(e2.details)) setErrors(Object.fromEntries((e2.details as { path: string; message: string }[]).map((d) => [d.path, d.message])));
      toast.error(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const ro = readOnly;
  const lockHint = locked ? "Protected after registration closes" : undefined;

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Campaign content</CardTitle><CardDescription>Albanian is the default language shown to visitors.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Title" htmlFor="title" error={errors.title}>
              <Input id="title" value={v.title} disabled={ro} onChange={(e) => { set("title", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} required />
            </Field>
            <Field label="URL slug" htmlFor="slug" error={errors.slug} hint={`Public page: /giveaway/${v.slug || "…"}`}>
              <Input id="slug" value={v.slug} disabled={ro} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} required />
            </Field>
            <Field label="Short promotional description" htmlFor="description" error={errors.description}>
              <Textarea id="description" value={v.description} disabled={ro} onChange={(e) => set("description", e.target.value)} rows={3} required />
            </Field>
            <Field label="Prize image">
              <ImageUpload value={v.prizeImage} onChange={(u) => set("prizeImage", u)} disabled={ro} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Prize name" htmlFor="prizeName" error={errors.prizeName}><Input id="prizeName" value={v.prizeName} disabled={ro} onChange={(e) => set("prizeName", e.target.value)} required /></Field>
              <Field label="Prize value (optional)" htmlFor="prizeValue"><Input id="prizeValue" value={v.prizeValue} disabled={ro} onChange={(e) => set("prizeValue", e.target.value)} placeholder="€500" /></Field>
            </div>
            <Field label="Prize description" htmlFor="prizeDescription" error={errors.prizeDescription}>
              <Textarea id="prizeDescription" value={v.prizeDescription} disabled={ro} onChange={(e) => set("prizeDescription", e.target.value)} rows={4} required />
            </Field>
            <Field label="Eligibility requirements" htmlFor="eligibility" hint={lockHint}>
              <Textarea id="eligibility" value={v.eligibility} disabled={ro} onChange={(e) => set("eligibility", e.target.value)} rows={3} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>English version (optional)</CardTitle><CardDescription>Shown when visitors switch to English. Empty fields fall back to Albanian.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Title (EN)" htmlFor="en-title"><Input id="en-title" value={v.translations.en?.title ?? ""} disabled={ro} onChange={(e) => setEn("title", e.target.value)} /></Field>
            <Field label="Description (EN)" htmlFor="en-desc"><Textarea id="en-desc" value={v.translations.en?.description ?? ""} disabled={ro} onChange={(e) => setEn("description", e.target.value)} rows={3} /></Field>
            <Field label="Prize name (EN)" htmlFor="en-prize"><Input id="en-prize" value={v.translations.en?.prizeName ?? ""} disabled={ro} onChange={(e) => setEn("prizeName", e.target.value)} /></Field>
            <Field label="Prize description (EN)" htmlFor="en-pdesc"><Textarea id="en-pdesc" value={v.translations.en?.prizeDescription ?? ""} disabled={ro} onChange={(e) => setEn("prizeDescription", e.target.value)} rows={3} /></Field>
            <Field label="Eligibility (EN)" htmlFor="en-elig"><Textarea id="en-elig" value={v.translations.en?.eligibility ?? ""} disabled={ro} onChange={(e) => setEn("eligibility", e.target.value)} rows={2} /></Field>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Schedule</CardTitle><CardDescription>Times in {timezone}. Registration is enforced on the server.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Registration opens" htmlFor="startsAt" error={errors.startsAt} hint={lockHint}><Input id="startsAt" type="datetime-local" value={v.startsAt} disabled={ro} onChange={(e) => set("startsAt", e.target.value)} required /></Field>
            <Field label="Registration closes" htmlFor="endsAt" error={errors.endsAt} hint={lockHint}><Input id="endsAt" type="datetime-local" value={v.endsAt} disabled={ro} onChange={(e) => set("endsAt", e.target.value)} required /></Field>
            <Field label="Draw date" htmlFor="drawAt" error={errors.drawAt} hint="The committed drand round will be the first one after this time"><Input id="drawAt" type="datetime-local" value={v.drawAt} disabled={ro} onChange={(e) => set("drawAt", e.target.value)} required /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Draw & registration rules</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Winners" htmlFor="winnerCount" hint={lockHint}><Input id="winnerCount" type="number" min={1} max={100} value={v.winnerCount} disabled={ro} onChange={(e) => set("winnerCount", Number(e.target.value))} /></Field>
              <Field label="Alternates" htmlFor="alternateCount" hint="Reserve winners, in order"><Input id="alternateCount" type="number" min={0} max={100} value={v.alternateCount} disabled={ro} onChange={(e) => set("alternateCount", Number(e.target.value))} /></Field>
            </div>
            <Field label="City field" htmlFor="cityField">
              <NativeSelect id="cityField" value={v.settings.cityField} disabled={ro} onChange={(e) => setS("cityField", e.target.value as CampaignFormValues["settings"]["cityField"])}>
                <option value="optional">Optional</option><option value="required">Required</option><option value="hidden">Hidden</option>
              </NativeSelect>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Minimum age" htmlFor="minAge" hint="Empty = no age confirmation"><Input id="minAge" type="number" min={13} max={99} value={v.settings.minAge ?? ""} disabled={ro} onChange={(e) => setS("minAge", e.target.value ? Number(e.target.value) : null)} /></Field>
              <Field label="Flag after N per network" htmlFor="maxIp"><Input id="maxIp" type="number" min={1} max={1000} value={v.settings.maxEntriesPerIp} disabled={ro} onChange={(e) => setS("maxEntriesPerIp", Number(e.target.value))} /></Field>
            </div>
            <Field label="Allowed phone countries" htmlFor="countries" hint="ISO codes, comma separated (e.g. AL, XK). Empty = any country.">
              <Input id="countries" value={v.settings.allowedPhoneCountries.join(", ")} disabled={ro} onChange={(e) => setS("allowedPhoneCountries", e.target.value.toUpperCase().split(/[\s,]+/).filter((c) => /^[A-Z]{2}$/.test(c)))} />
            </Field>
            <Field label="Reference prefix" htmlFor="prefix" hint={`e.g. ${v.referencePrefix || "GIVE"}-2026-7K3M9QX2`}><Input id="prefix" value={v.referencePrefix} disabled={ro} onChange={(e) => set("referencePrefix", e.target.value.toUpperCase())} maxLength={8} /></Field>
            <label className="flex items-center justify-between gap-3 text-sm"><span>Show participant count publicly</span><Switch checked={v.showParticipantCount} disabled={ro} onCheckedChange={(c) => set("showParticipantCount", c)} /></label>
            <label className="flex items-center justify-between gap-3 text-sm"><span>Send confirmation e-mail</span><Switch checked={v.settings.sendConfirmationEmail} disabled={ro} onCheckedChange={(c) => setS("sendConfirmationEmail", c)} /></label>
          </CardContent>
        </Card>

        {protectedChanged && (
          <Card className="border-warning/40 bg-warning-soft">
            <CardContent className="space-y-3 pt-5 sm:pt-6">
              <p className="flex items-start gap-2 text-sm font-medium text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Registration has closed. Changing draw parameters is an exceptional change: it is publicly recorded and invalidates any existing draw commitment.</p>
              {canOverride ? (
                <Field label="Public reason (min. 20 characters)" htmlFor="override"><Textarea id="override" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} /></Field>
              ) : (
                <p className="text-sm text-ink">Only a super admin can make this change.</p>
              )}
            </CardContent>
          </Card>
        )}

        {!ro && (
          <Button type="submit" size="lg" className="w-full" disabled={busy || (protectedChanged && (!canOverride || overrideReason.trim().length < 20))}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />} {id ? "Save changes" : "Create draft"}
          </Button>
        )}
      </div>
    </form>
  );
}
