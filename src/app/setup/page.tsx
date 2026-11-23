import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Database, Gift, KeyRound } from "lucide-react";
import { setupStatus } from "@/services/setup";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Setup", robots: { index: false, follow: false } };

function Step({ ok, icon: Icon, title, children }: { ok: boolean; icon: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
        {ok ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
      </span>
      <div className="text-sm">
        <p className="font-semibold text-navy">{title}</p>
        {children && <div className="mt-0.5 text-ink-muted">{children}</div>}
      </div>
    </li>
  );
}

/** First-run setup: create database tables and the first administrator. Disabled once an admin exists. */
export default async function SetupPage() {
  const s = await setupStatus();
  if (s.hasAdmin && s.pendingMigrations.length === 0) redirect("/admin/login");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-muted px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white shadow-sm"><Gift className="size-6" /></span>
          <div>
            <h1 className="text-xl font-bold text-navy">Set up MegaLLuksi</h1>
            <p className="text-sm text-ink-muted">One-time setup after deploying</p>
          </div>
        </div>
        <div className="space-y-6 rounded-2xl border bg-white p-6 shadow-elevated">
          <ol className="space-y-4">
            <Step ok={s.databaseConfigured} icon={Database} title="Database connection">
              {s.databaseConfigured ? (s.databaseReachable ? "Connected." : <>Configured but not reachable{s.error ? `: ${s.error}` : ""}. Check the <code>DATABASE_URL</code> secret.</>) : <>Add the <code>DATABASE_URL</code> secret (PostgreSQL connection string) to the Worker.</>}
            </Step>
            <Step ok={s.databaseReachable && s.pendingMigrations.length === 0} icon={Database} title="Database tables">
              {s.pendingMigrations.length ? `${s.pendingMigrations.length} migration(s) will be applied when you submit the form below.` : s.databaseReachable ? "Up to date." : null}
            </Step>
            <Step ok={s.setupTokenConfigured} icon={KeyRound} title="Setup token">
              {s.setupTokenConfigured ? "Configured." : <>Add a <code>SETUP_TOKEN</code> secret (any random string of 12+ characters), then reload this page.</>}
            </Step>
          </ol>
          {s.databaseReachable && s.setupTokenConfigured ? (
            <div className="border-t pt-6"><SetupForm /></div>
          ) : (
            <p className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> Finish the steps above in your Cloudflare dashboard (Workers &amp; Pages → your Worker → Settings → Variables and Secrets), then reload.</p>
          )}
        </div>
      </div>
    </main>
  );
}
