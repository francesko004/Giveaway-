"use client";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }) });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        window.location.href = "/admin";
        return;
      }
      setError(data?.error?.message ?? "Sign-in failed");
    } catch {
      setError("Network error");
    }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="E-mail" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="username" required autoFocus /></Field>
      <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger" role="alert">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Lock />} Sign in</Button>
    </form>
  );
}
