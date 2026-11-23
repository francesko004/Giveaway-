"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { api } from "./api";
import { ImageUpload } from "./image-upload";

export interface SettingsValues {
  companyName: string;
  companyLegalName: string;
  companyNipt: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  socialLinks: { facebook?: string; instagram?: string; tiktok?: string; website?: string };
  defaultLocale: "sq" | "en";
  timezone: string;
  featuredCampaignId: string | null;
  registrationsPerIpPerHour: number;
  minFormFillSeconds: number;
  sendConfirmationEmail: boolean;
  analyticsEnabled: boolean;
  publishSnapshot: boolean;
  retentionDays: number;
  sessionTtlHours: number;
  termsVersion: string;
  privacyVersion: string;
  termsContent: { sq?: string; en?: string };
  privacyContent: { sq?: string; en?: string };
}

export function SettingsForm({ initial, campaigns, status }: { initial: SettingsValues; campaigns: { id: string; title: string }[]; status: { email: boolean; turnstile: boolean; cron: boolean } }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SettingsValues>(k: K, val: SettingsValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/settings", "PATCH", v);
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const legalChanged = JSON.stringify([v.termsContent, v.privacyContent]) !== JSON.stringify([initial.termsContent, initial.privacyContent]);
  const versionBumped = v.termsVersion !== initial.termsVersion || v.privacyVersion !== initial.privacyVersion;

  return (
    <form onSubmit={save} className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Company & branding</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Logo"><ImageUpload value={v.logoUrl} onChange={(u) => set("logoUrl", u)} /></Field>
          <Field label="Brand name" htmlFor="cn"><Input id="cn" value={v.companyName} onChange={(e) => set("companyName", e.target.value)} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name" htmlFor="ln"><Input id="ln" value={v.companyLegalName} onChange={(e) => set("companyLegalName", e.target.value)} /></Field>
            <Field label="NIPT (tax ID)" htmlFor="nipt"><Input id="nipt" value={v.companyNipt} onChange={(e) => set("companyNipt", e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact e-mail" htmlFor="ce"><Input id="ce" type="email" value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></Field>
            <Field label="Contact phone" htmlFor="cp"><Input id="cp" value={v.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></Field>
          </div>
          <Field label="Address" htmlFor="addr"><Input id="addr" value={v.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["facebook", "instagram", "tiktok", "website"] as const).map((k) => (
              <Field key={k} label={k[0].toUpperCase() + k.slice(1)} htmlFor={`s-${k}`}><Input id={`s-${k}`} type="url" placeholder="https://" value={v.socialLinks[k] ?? ""} onChange={(e) => set("socialLinks", { ...v.socialLinks, [k]: e.target.value })} /></Field>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Localisation</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Default language" htmlFor="loc"><NativeSelect id="loc" value={v.defaultLocale} onChange={(e) => set("defaultLocale", e.target.value as "sq" | "en")}><option value="sq">Shqip (Albanian)</option><option value="en">English</option></NativeSelect></Field>
            <Field label="Timezone" htmlFor="tz"><Input id="tz" value={v.timezone} onChange={(e) => set("timezone", e.target.value)} /></Field>
            <Field label="Featured campaign at /giveaway" htmlFor="feat" className="sm:col-span-2">
              <NativeSelect id="feat" value={v.featuredCampaignId ?? ""} onChange={(e) => set("featuredCampaignId", e.target.value || null)}>
                <option value="">Automatic (active campaign first)</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </NativeSelect>
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Registration & security</CardTitle><CardDescription>Abuse protection applied on the server.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Max entries / IP / hour" htmlFor="rl"><Input id="rl" type="number" min={1} value={v.registrationsPerIpPerHour} onChange={(e) => set("registrationsPerIpPerHour", Number(e.target.value))} /></Field>
              <Field label="Min. form fill time (s)" htmlFor="mf"><Input id="mf" type="number" min={0} max={60} value={v.minFormFillSeconds} onChange={(e) => set("minFormFillSeconds", Number(e.target.value))} /></Field>
              <Field label="Admin session (hours)" htmlFor="st"><Input id="st" type="number" min={1} max={168} value={v.sessionTtlHours} onChange={(e) => set("sessionTtlHours", Number(e.target.value))} /></Field>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm"><span>Send registration confirmation e-mails</span><Switch checked={v.sendConfirmationEmail} onCheckedChange={(c) => set("sendConfirmationEmail", c)} /></label>
            <div className="grid gap-2 rounded-xl bg-surface-muted p-3 text-sm">
              <p>E-mail (Resend): <strong className={status.email ? "text-success" : "text-warning"}>{status.email ? "configured" : "not configured"}</strong></p>
              <p>Cloudflare Turnstile: <strong className={status.turnstile ? "text-success" : "text-ink-muted"}>{status.turnstile ? "enabled" : "off (honeypot + signed form token + rate limits active)"}</strong></p>
              <p>External cron secret: <strong>{status.cron ? "set" : "not set (built-in scheduler only)"}</strong></p>
              <p className="text-xs text-ink-muted">These are configured with environment variables — secrets are never shown in the browser.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Privacy</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Data retention after campaign end (days)" htmlFor="ret"><Input id="ret" type="number" min={30} max={3650} value={v.retentionDays} onChange={(e) => set("retentionDays", Number(e.target.value))} /></Field>
            <label className="flex items-center justify-between gap-3 text-sm"><span>Cookieless visit analytics (daily-rotating hash, no raw IP)</span><Switch checked={v.analyticsEnabled} onCheckedChange={(c) => set("analyticsEnabled", c)} /></label>
            <label className="flex items-center justify-between gap-3 text-sm"><span>Publish anonymised snapshot for public verification</span><Switch checked={v.publishSnapshot} onCheckedChange={(c) => set("publishSnapshot", c)} /></label>
          </CardContent>
        </Card>
      </div>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Legal texts</CardTitle>
          <CardDescription>Markdown (## headings, - lists, **bold**). Placeholders: {"{{companyName}} {{companyLegalName}} {{companyNipt}} {{address}} {{contactEmail}} {{contactPhone}} {{retentionDays}}"}. Have these reviewed by qualified legal counsel before launch.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <Field label="Terms version" htmlFor="tv"><Input id="tv" value={v.termsVersion} onChange={(e) => set("termsVersion", e.target.value)} /></Field>
          <Field label="Privacy policy version" htmlFor="pv"><Input id="pv" value={v.privacyVersion} onChange={(e) => set("privacyVersion", e.target.value)} /></Field>
          <Field label="Terms (Albanian)" htmlFor="t-sq"><Textarea id="t-sq" rows={12} className="font-mono text-xs" value={v.termsContent.sq ?? ""} onChange={(e) => set("termsContent", { ...v.termsContent, sq: e.target.value })} /></Field>
          <Field label="Terms (English)" htmlFor="t-en"><Textarea id="t-en" rows={12} className="font-mono text-xs" value={v.termsContent.en ?? ""} onChange={(e) => set("termsContent", { ...v.termsContent, en: e.target.value })} /></Field>
          <Field label="Privacy policy (Albanian)" htmlFor="p-sq"><Textarea id="p-sq" rows={12} className="font-mono text-xs" value={v.privacyContent.sq ?? ""} onChange={(e) => set("privacyContent", { ...v.privacyContent, sq: e.target.value })} /></Field>
          <Field label="Privacy policy (English)" htmlFor="p-en"><Textarea id="p-en" rows={12} className="font-mono text-xs" value={v.privacyContent.en ?? ""} onChange={(e) => set("privacyContent", { ...v.privacyContent, en: e.target.value })} /></Field>
          {legalChanged && !versionBumped && <p className="text-sm text-warning lg:col-span-2">You changed legal text — consider bumping the version so new consents reference the new text.</p>}
        </CardContent>
      </Card>

      <div className="xl:col-span-2 flex justify-end">
        <Button type="submit" size="lg" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />} Save settings</Button>
      </div>
    </form>
  );
}
