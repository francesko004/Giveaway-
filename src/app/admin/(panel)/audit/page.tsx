import { Download, FileClock } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/server";
import { formatDateTime } from "@/lib/time";
import { getSettings } from "@/services/settings";
import { verifyAuditChain } from "@/services/audit";
import { PageHeader } from "@/components/admin/shell";
import { Pagination } from "@/components/admin/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";

const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; action?: string }> }) {
  const user = await requireAdminPage();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.action ? { action: { startsWith: sp.action } } : {};
  const [rows, total, settings, chain] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { seq: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { name: true } }, campaign: { select: { title: true } } } }),
    prisma.auditLog.count({ where }),
    getSettings(),
    verifyAuditChain(),
  ]);
  const fmt = (d: Date) => formatDateTime(d, "en", settings.timezone, { dateStyle: "medium", timeStyle: "medium" });
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only, hash-chained record of every administrative action."
        actions={user.role !== "VIEWER" && <Button asChild variant="outline"><a href="/api/admin/audit/export"><Download /> Export CSV</a></Button>}
      />
      <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${chain.ok ? "border-success/30 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger"}`}>
        {chain.ok ? `✓ Hash chain intact — ${chain.checked} records verified` : `✗ Hash chain broken at record #${chain.brokenAt}. The audit log has been tampered with outside the application.`}
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {["", "campaign", "participant", "draw", "qr", "auth", "settings", "user", "privacy"].map((a) => (
          <a key={a} href={a ? `/admin/audit?action=${a}` : "/admin/audit"} className={`rounded-full border px-3 py-1 ${(sp.action ?? "") === a ? "border-brand bg-brand-soft text-brand" : "bg-white text-ink-muted hover:text-navy"}`}>{a || "all"}</a>
        ))}
      </div>
      <Card className="overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={<FileClock className="size-5" />} title="No audit records" /> : (
          <Table>
            <THead><TR><TH>#</TH><TH>Time</TH><TH>User</TH><TH>Action</TH><TH className="hidden lg:table-cell">Campaign</TH><TH className="hidden md:table-cell">Details</TH></TR></THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="text-xs text-ink-muted tabular-nums">{r.seq}</TD>
                  <TD className="whitespace-nowrap text-ink-muted">{fmt(r.createdAt)}</TD>
                  <TD>{r.user?.name ?? <span className="text-ink-muted">system</span>}</TD>
                  <TD><Badge variant={r.action.startsWith("draw") ? "navy" : r.action.includes("invalid") || r.action.includes("exceptional") ? "danger" : "neutral"}>{r.action}</Badge></TD>
                  <TD className="hidden max-w-48 truncate text-ink-muted lg:table-cell">{r.campaign?.title ?? "—"}</TD>
                  <TD className="hidden max-w-md md:table-cell"><code className="line-clamp-2 text-xs break-all text-ink-muted">{JSON.stringify(r.metadata)}</code></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} buildHref={(p) => `/admin/audit?page=${p}${sp.action ? `&action=${sp.action}` : ""}`} />
      </Card>
    </>
  );
}
