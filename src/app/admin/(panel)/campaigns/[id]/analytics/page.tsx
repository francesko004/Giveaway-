import { Eye, Percent, QrCode, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/server";
import { campaignAnalytics } from "@/services/analytics";
import { CampaignHeader } from "@/components/admin/campaign-header";
import { StatCard } from "@/components/admin/bits";
import { GrowthChart, SourceChart } from "@/components/admin/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

export default async function CampaignAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminPage();
  const a = await campaignAnalytics(id);
  const totalScans = a.perSource.reduce((s, r) => s + r.scans, 0);
  return (
    <>
      <CampaignHeader id={id} user={user} tab="analytics" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registrations" value={a.total.toLocaleString()} hint={`${a.statusCounts.ELIGIBLE ?? 0} eligible · ${a.statusCounts.FLAGGED ?? 0} review · ${a.statusCounts.INVALID ?? 0} invalid`} icon={Users} />
        <StatCard label="QR scans" value={totalScans.toLocaleString()} icon={QrCode} />
        <StatCard label="Unique visitors" value={a.uniqueVisitors.toLocaleString()} hint="Cookieless, daily-rotating hash" icon={Eye} />
        <StatCard label="Conversion" value={pct(a.conversion)} hint="Registrations ÷ unique visitors" icon={Percent} tone="success" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Registrations over time</CardTitle><CardDescription>Last 30 days</CardDescription></CardHeader><CardContent><GrowthChart data={a.growth} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Registrations by source</CardTitle></CardHeader><CardContent><SourceChart data={a.perSource.filter((s) => s.registrations > 0 || s.id !== "none").map((s) => ({ name: s.name, count: s.registrations }))} /></CardContent></Card>
      </div>
      <Card className="mt-6 overflow-hidden">
        <CardHeader><CardTitle>Source performance</CardTitle></CardHeader>
        <Table>
          <THead><TR><TH>Source</TH><TH className="text-right">Scans</TH><TH className="text-right">Visitors</TH><TH className="text-right">Registrations</TH><TH className="text-right">Conversion</TH></TR></THead>
          <TBody>
            {[...a.perSource].sort((x, y) => y.registrations - x.registrations).map((s) => (
              <TR key={s.id}>
                <TD><span className="font-medium">{s.name}</span> {s.slug && <span className="text-xs text-ink-muted">src={s.slug}</span>} {!s.active && <Badge variant="neutral">disabled</Badge>}</TD>
                <TD className="text-right tabular-nums">{s.id === "none" ? "—" : s.scans}</TD>
                <TD className="text-right tabular-nums">{s.visitors}</TD>
                <TD className="text-right font-semibold tabular-nums">{s.registrations}</TD>
                <TD className="text-right tabular-nums">{pct(s.conversion)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
