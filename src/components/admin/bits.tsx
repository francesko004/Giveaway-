import Link from "next/link";
import type { CampaignStatus, ParticipantStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const map = {
    DRAFT: ["neutral", "Draft"],
    SCHEDULED: ["default", "Scheduled"],
    ACTIVE: ["success", "Active"],
    PAUSED: ["warning", "Paused"],
    CLOSED: ["neutral", "Closed"],
    DRAW_COMPLETED: ["navy", "Draw completed"],
  } as const;
  const [variant, label] = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function ParticipantStatusBadge({ status }: { status: ParticipantStatus }) {
  const map = { ELIGIBLE: ["success", "Eligible"], FLAGGED: ["warning", "Needs review"], INVALID: ["danger", "Invalid"] } as const;
  const [variant, label] = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "brand" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon: React.ComponentType<{ className?: string }>; tone?: "brand" | "success" | "warning" | "navy" }) {
  const tones = { brand: "bg-brand-soft text-brand", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", navy: "bg-navy text-white" };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-muted">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-navy tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
        </div>
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tones[tone])}><Icon className="size-5" /></span>
      </div>
    </Card>
  );
}

export function SubNav({ items }: { items: { href: string; label: string; active?: boolean }[] }) {
  return (
    <nav className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b px-1" aria-label="Section">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={i.active ? "page" : undefined} className={cn("border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition", i.active ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-navy")}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({ page, pages, buildHref }: { page: number; pages: number; buildHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
      <span className="text-ink-muted">Page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className="rounded-lg border bg-white px-3 py-1.5 font-medium hover:bg-surface-muted" href={buildHref(page - 1)}>Previous</Link> : <span className="rounded-lg border px-3 py-1.5 text-ink-muted/50">Previous</span>}
        {page < pages ? <Link className="rounded-lg border bg-white px-3 py-1.5 font-medium hover:bg-surface-muted" href={buildHref(page + 1)}>Next</Link> : <span className="rounded-lg border px-3 py-1.5 text-ink-muted/50">Next</span>}
      </div>
    </div>
  );
}
