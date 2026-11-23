import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/server";
import { formatDateTime } from "@/lib/time";
import { canonicalEmail } from "@/lib/validation/email";
import { getSettings } from "@/services/settings";
import { PageHeader } from "@/components/admin/shell";
import { PrivacyActions } from "@/components/admin/privacy-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";

export default async function PrivacyRequestsPage() {
  await requireAdminPage("SUPER_ADMIN");
  const [requests, settings] = await Promise.all([prisma.dataRequest.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200, include: { resolvedBy: { select: { name: true } } } }), getSettings()]);
  const counts = await Promise.all(requests.map((r) => prisma.participant.count({ where: { OR: [{ emailCanonical: canonicalEmail(r.email) }, ...(r.phone ? [{ phone: r.phone }] : [])], anonymizedAt: null } })));
  const fmt = (d: Date) => formatDateTime(d, "en", settings.timezone, { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <PageHeader title="Privacy requests" description={`Data subject requests from /privacy/request. Retention setting: ${settings.retentionDays} days after a campaign ends.`} />
      <Card className="overflow-hidden">
        {requests.length === 0 ? <EmptyState icon={<ShieldCheck className="size-5" />} title="No requests" description="Access, erasure and opt-out requests will appear here." /> : (
          <Table>
            <THead><TR><TH>Received</TH><TH>Type</TH><TH>Requester</TH><TH className="hidden lg:table-cell">Message</TH><TH>Status</TH><TH /></TR></THead>
            <TBody>
              {requests.map((r, i) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap text-ink-muted">{fmt(r.createdAt)}</TD>
                  <TD><Badge variant={r.type === "DELETION" ? "danger" : "default"}>{r.type.replaceAll("_", " ").toLowerCase()}</Badge></TD>
                  <TD><p className="font-medium">{r.fullName}</p><p className="text-xs text-ink-muted">{r.email}{r.phone && ` · ${r.phone}`}</p></TD>
                  <TD className="hidden max-w-xs truncate text-ink-muted lg:table-cell">{r.message ?? "—"}</TD>
                  <TD>
                    <Badge variant={r.status === "PENDING" ? "warning" : r.status === "COMPLETED" ? "success" : "neutral"}>{r.status.toLowerCase()}</Badge>
                    {r.resolution && <p className="mt-1 max-w-xs text-xs text-ink-muted">{r.resolution}{r.resolvedBy && ` — ${r.resolvedBy.name}`}</p>}
                  </TD>
                  <TD>{r.status === "PENDING" && <PrivacyActions id={r.id} type={r.type} matches={counts[i]} />}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
