import Link from "next/link";
import { Gift, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/server";
import { formatDateTime } from "@/lib/time";
import { effectiveStatus } from "@/services/campaign-status";
import { getSettings } from "@/services/settings";
import { PageHeader } from "@/components/admin/shell";
import { CampaignStatusBadge } from "@/components/admin/bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";

export default async function CampaignsPage() {
  const user = await requireAdminPage();
  const [campaigns, settings] = await Promise.all([
    prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { participants: true, qrSources: true } } } }),
    getSettings(),
  ]);
  const fmt = (d: Date) => formatDateTime(d, "en", settings.timezone, { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <PageHeader title="Campaigns" description="Create, schedule and manage giveaways." actions={user.role !== "VIEWER" && <Button asChild><Link href="/admin/campaigns/new"><Plus /> New campaign</Link></Button>} />
      <Card className="overflow-hidden">
        {campaigns.length === 0 ? (
          <EmptyState icon={<Gift className="size-5" />} title="No campaigns yet" description="Create your first giveaway to get a landing page and QR codes." action={user.role !== "VIEWER" && <Button asChild><Link href="/admin/campaigns/new">Create campaign</Link></Button>} />
        ) : (
          <Table>
            <THead><TR><TH>Campaign</TH><TH>Status</TH><TH className="text-right">Entries</TH><TH className="hidden lg:table-cell">Closes</TH><TH className="hidden lg:table-cell">Draw</TH><TH className="hidden md:table-cell text-right">QR</TH></TR></THead>
            <TBody>
              {campaigns.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/admin/campaigns/${c.id}`} className="font-semibold text-navy hover:text-brand">{c.title}</Link>
                    <p className="text-xs text-ink-muted">/giveaway/{c.slug}{settings.featuredCampaignId === c.id && " · featured"}</p>
                  </TD>
                  <TD><CampaignStatusBadge status={effectiveStatus(c)} /></TD>
                  <TD className="text-right font-medium tabular-nums">{c._count.participants.toLocaleString()}</TD>
                  <TD className="hidden whitespace-nowrap text-ink-muted lg:table-cell">{fmt(c.closedAt ?? c.endsAt)}</TD>
                  <TD className="hidden whitespace-nowrap text-ink-muted lg:table-cell">{fmt(c.drawAt)}</TD>
                  <TD className="hidden text-right text-ink-muted md:table-cell">{c._count.qrSources}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
