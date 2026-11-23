import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { getCurrentAdmin } from "@/lib/auth/server";
import { getSettings } from "@/services/settings";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  const settings = await getSettings();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white shadow-sm"><Gift className="size-6" /></span>
          <div>
            <h1 className="text-xl font-bold text-navy">{settings.companyName}</h1>
            <p className="text-sm text-ink-muted">Giveaway administration</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-elevated">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-ink-muted">Access is logged. Accounts lock after 5 failed attempts.</p>
      </div>
    </main>
  );
}
