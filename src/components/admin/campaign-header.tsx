import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/db";
import { hasRole, type SessionUser } from "@/lib/auth/session";
import { effectiveStatus } from "@/services/campaign-status";
import { CampaignStatusBadge, SubNav } from "./bits";
import { CampaignActions } from "./campaign-actions";

export async function loadCampaign(id: string) {
  const c = await prisma.campaign.findUnique({ where: { id }, include: { _count: { select: { participants: true, qrSources: true } }, draws: { select: { id: true, status: true } } } });
  if (!c) notFound();
  return c;
}

export async function CampaignHeader({ id, user, tab }: { id: string; user: SessionUser; tab: "edit" | "qr" | "draw" | "analytics" }) {
  const c = await loadCampaign(id);
  const status = effectiveStatus(c);
  const hasDraw = c.draws.some((d) => d.status !== "INVALIDATED");
  return (
    <>
      <Link href="/admin/campaigns" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> Campaigns</Link>
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-navy">{c.title}</h1>
            <CampaignStatusBadge status={status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink-muted">
            <span>{c._count.participants} entries</span>
            <span>{c._count.qrSources} QR sources</span>
            {status !== "DRAFT" && <a href={`/giveaway/${c.slug}`} target="_blank" className="inline-flex items-center gap-1 text-brand hover:underline">/giveaway/{c.slug} <ExternalLink className="size-3" /></a>}
          </p>
        </div>
        {hasRole(user.role, "ADMIN") && <CampaignActions id={c.id} status={status} hasDraw={hasDraw} />}
      </div>
      <SubNav
        items={[
          { href: `/admin/campaigns/${id}`, label: "Details", active: tab === "edit" },
          { href: `/admin/campaigns/${id}/qr`, label: "QR codes", active: tab === "qr" },
          { href: `/admin/campaigns/${id}/analytics`, label: "Analytics", active: tab === "analytics" },
          { href: `/admin/campaigns/${id}/draw`, label: "Draw", active: tab === "draw" },
          { href: `/admin/participants?campaign=${id}`, label: "Participants" },
        ]}
      />
    </>
  );
}
