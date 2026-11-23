import Link from "next/link";
import { getDictionary } from "@/lib/i18n/server";

export default async function NotFound() {
  const { dict } = await getDictionary().catch(() => ({ dict: null }));
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-muted px-4 text-center">
      <p className="text-6xl font-extrabold text-brand">404</p>
      <h1 className="text-xl font-bold text-navy">{dict?.notFound.title ?? "Page not found"}</h1>
      <p className="max-w-sm text-ink-muted">{dict?.notFound.text}</p>
      <Link href="/giveaway" className="mt-2 inline-flex h-11 items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover">{dict?.notFound.back ?? "Home"}</Link>
    </main>
  );
}
