import Link from "next/link";
import { QrCode } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/server";
import { stableQrUrl } from "@/services/qr";
import { PageHeader } from "@/components/admin/shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";

export default async function QrOverview() {
  await requireAdminPage();
  const [sources, regs, scans] = await Promise.all([
    prisma.qRSource.findMany({ orderBy: [{ campaign: { createdAt: "desc" } }, { createdAt: "asc" }], include: { campaign: { select: { id: true, title: true } } } }),
    prisma.participant.groupBy({ by: ["qrSourceId"], _count: { _all: true } }),
    prisma.pageVisit.groupBy({ by: ["qrSourceId"], where: { kind: "SCAN" }, _count: { _all: true } }),
  ]);
  const r = new Map(regs.map((x) => [x.qrSourceId, x._count._all]));
  const s = new Map(scans.map((x) => [x.qrSourceId, x._count._all]));
  const rows = sources.map((q) => ({ ...q, registrations: r.get(q.id) ?? 0, scans: s.get(q.id) ?? 0 })).sort((a, b) => b.registrations - a.registrations);
  return (
    <>
      <PageHeader title="QR codes" description="All traffic sources across campaigns, ranked by registrations. Manage codes inside each campaign." />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<QrCode className="size-5" />} title="No QR codes yet" description="Open a campaign and create QR codes under the “QR codes” tab." />
        ) : (
          <Table>
            <THead><TR><TH>Source</TH><TH>Campaign</TH><TH className="hidden md:table-cell">Stable URL</TH><TH className="text-right">Scans</TH><TH className="text-right">Entries</TH><TH className="text-right">Scan → entry</TH></TR></THead>
            <TBody>
              {rows.map((q) => (
                <TR key={q.id}>
                  <TD><span className="font-medium">{q.name}</span> {!q.active && <Badge variant="neutral">disabled</Badge>}<p className="text-xs text-ink-muted">src={q.slug} · {q.type.toLowerCase()}</p></TD>
                  <TD><Link href={`/admin/campaigns/${q.campaign.id}/qr`} className="text-brand hover:underline">{q.campaign.title}</Link></TD>
                  <TD className="hidden font-mono text-xs text-ink-muted md:table-cell">{stableQrUrl(q.code)}</TD>
                  <TD className="text-right tabular-nums">{q.scans}</TD>
                  <TD className="text-right font-semibold tabular-nums">{q.registrations}</TD>
                  <TD className="text-right tabular-nums">{q.scans ? `${Math.min(100, Math.round((q.registrations / q.scans) * 100))}%` : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
