"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { Checkbox } from "@/components/ui/checkbox";

export function SetupForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [demo, setDemo] = useState(true);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("password2")) return setError("Passwords do not match");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: fd.get("token"), name: fd.get("name"), email: fd.get("email"), password: fd.get("password"), demo }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) setDone(true);
      else {
        const detail = Array.isArray(data?.error?.details) && data.error.details[0] ? ` (${data.error.details[0].path}: ${data.error.details[0].message})` : "";
        setError((data?.error?.message ?? "Setup failed") + detail);
      }
    } catch {
      setError("Network error");
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-12 text-success" />
        <p className="text-lg font-semibold text-navy">MegaLLuksi is ready</p>
        <p className="text-sm text-ink-muted">Database created and your super-admin account is set up.</p>
        <div className="mt-2 flex gap-2">
          <Button asChild><Link href="/admin/login">Sign in to admin</Link></Button>
          <Button asChild variant="outline"><Link href="/giveaway">View site</Link></Button>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Setup token" htmlFor="token" hint="The SETUP_TOKEN secret you entered when deploying.">
        <Input id="token" name="token" type="password" autoComplete="off" required />
      </Field>
      <Field label="Your name" htmlFor="name"><Input id="name" name="name" required autoComplete="name" /></Field>
      <Field label="Admin e-mail" htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="username" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Password" htmlFor="password" hint="Min. 12 characters, letters and numbers"><Input id="password" name="password" type="password" minLength={12} required autoComplete="new-password" /></Field>
        <Field label="Repeat password" htmlFor="password2"><Input id="password2" name="password2" type="password" minLength={12} required autoComplete="new-password" /></Field>
      </div>
      <label className="flex items-start gap-3 rounded-xl border bg-surface-muted/60 p-3 text-sm">
        <Checkbox checked={demo} onCheckedChange={(v) => setDemo(v === true)} className="mt-0.5" />
        <span>Create a sample campaign with 4 QR codes so the site is not empty (you can edit or unpublish it later).</span>
      </label>
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Rocket />} Set up MegaLLuksi</Button>
    </form>
  );
}
