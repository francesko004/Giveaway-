import Link from "next/link";
import { CalendarClock, CheckCircle2, Gift, TrendingUp, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/server";
import { formatDateTime } from "@/lib/time";
import { dashboardStats } from "@/services/analytics";
import { getSettings } from "@/services/settings";
import { PageHeader } from "@/components/admin/shell";
import { CampaignStatusBadge, ParticipantStatusBadge, StatCard } from "@/components/admin/bits";
import { GrowthChart, SourceChart } from "@/components/admin/charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ forbidden?: string }> }) {
  const user = await requireAdminPage();
  const [stats, settings, sp] = await Promise.all([dashboardStats(), getSettings(), searchParams]);
  const fmt = (d: Date) => formatDateTime(d, "en", settings.timezone, { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description={`Times shown in ${settings.timezone}`}
        actions={user.role !== "VIEWER" && <Button asChild><Link href="/admin/campaigns/new"><Gift /> New campaign</Link></Button>}
      />
      {sp.forbidden && <p className="mb-4 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">You do not have permission to open that page.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total registrations" value={stats.total.toLocaleString()} icon={Users} />
        <StatCard label="Today" value={stats.today.toLocaleString()} icon={TrendingUp} tone="success" />
        <StatCard label="This week" value={stats.week.toLocaleString()} icon={CalendarClock} />
        <StatCard label="Active campaigns" value={stats.activeCampaigns} icon={Gift} tone="success" />
        <StatCard label="Completed campaigns" value={stats.completedCampaigns} icon={CheckCircle2} tone="navy" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Registration growth</CardTitle><CardDescription>Daily registrations, last 30 days</CardDescription></CardHeader>
          <CardContent><GrowthChart data={stats.growth} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Registrations by source</CardTitle><CardDescription>All campaigns</CardDescription></CardHeader>
          <CardContent>{stats.bySource.length ? <SourceChart data={stats.bySource} /> : <EmptyState title="No registrations yet" />}</CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Recent registrations</CardTitle><Link href="/admin/participants" className="text-sm font-medium text-brand hover:underline">View all</Link></CardHeader>
          {stats.recent.length ? (
            <Table>
              <THead><TR><TH>Reference</TH><TH>Name</TH><TH className="hidden md:table-cell">Source</TH><TH>Status</TH><TH className="hidden sm:table-cell">Registered</TH></TR></THead>
              <TBody>
                {stats.recent.map((r) => (
                  <TR key={r.id}>
                    <TD><Link href={`/admin/participants/${r.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">{r.referenceNumber}</Link></TD>
                    <TD className="max-w-40 truncate">{r.fullName}</TD>
                    <TD className="hidden text-ink-muted md:table-cell">{r.qrSource?.name ?? "Direct"}</TD>
                    <TD><ParticipantStatusBadge status={r.status} /></TD>
                    <TD className="hidden whitespace-nowrap text-ink-muted sm:table-cell">{fmt(r.registeredAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState icon={<Users className="size-5" />} title="No registrations yet" description="Entries appear here as soon as people register." />
          )}
        </Card>
        <Card>
          <CardHeader><CardTitle>Upcoming draws</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.upcomingDraws.length === 0 && <p className="text-sm text-ink-muted">No upcoming draws.</p>}
            {stats.upcomingDraws.map((d) => (
              <Link key={d.id} href={`/admin/campaigns/${d.id}/draw`} className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:bg-surface-muted">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{d.title}</p>
                  <p className="text-xs text-ink-muted">{fmt(d.drawAt)} · {d.entries} entries</p>
                </div>
                <CampaignStatusBadge status={d.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
