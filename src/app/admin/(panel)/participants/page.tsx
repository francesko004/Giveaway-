import Link from "next/link";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/server";
import { hasRole } from "@/lib/auth/session";
import { parseParticipantFilters } from "@/lib/admin-filters";
import { formatDateTime } from "@/lib/time";
import { formatPhone } from "@/lib/validation/phone";
import { searchParticipants } from "@/services/participants";
import { getSettings } from "@/services/settings";
import { PageHeader } from "@/components/admin/shell";
import { Pagination, ParticipantStatusBadge } from "@/components/admin/bits";
import { ParticipantFilters } from "@/components/admin/participant-filters";
import { Card } from "@/components/ui/card";
import { EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireAdminPage();
  const sp = await searchParams;
  const settings = await getSettings();
  const filters = parseParticipantFilters(sp, settings.timezone);
  const [result, campaigns, sources] = await Promise.all([
    searchParticipants(filters),
    prisma.campaign.findMany({ select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
    prisma.qRSource.findMany({ select: { id: true, name: true, campaignId: true }, orderBy: { name: "asc" } }),
  ]);
  const fmt = (d: Date) => formatDateTime(d, "en", settings.timezone, { dateStyle: "medium", timeStyle: "short" });
  const buildHref = (p: number) => {
    const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    q.set("page", String(p));
    return `/admin/participants?${q}`;
  };
  return (
    <>
      <PageHeader title="Participants" description={`${result.total.toLocaleString()} matching entries`} />
      <Card className="overflow-hidden">
        <ParticipantFilters campaigns={campaigns} sources={sources} canExport={hasRole(user.role, "ADMIN")} />
        {result.rows.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title="No participants found" description="Try a different search or filter." />
        ) : (
          <Table>
            <THead><TR><TH>Reference</TH><TH>Name</TH><TH className="hidden lg:table-cell">Contact</TH><TH className="hidden xl:table-cell">Campaign</TH><TH className="hidden md:table-cell">Source</TH><TH>Status</TH><TH className="hidden sm:table-cell">Registered</TH></TR></THead>
            <TBody>
              {result.rows.map((p) => (
                <TR key={p.id}>
                  <TD><Link href={`/admin/participants/${p.id}`} className="font-mono text-xs font-semibold text-brand hover:underline">{p.referenceNumber}</Link></TD>
                  <TD className="max-w-44 truncate font-medium">{p.fullName}</TD>
                  <TD className="hidden text-xs text-ink-muted lg:table-cell"><div>{p.email}</div><div>{formatPhone(p.phone)}</div></TD>
                  <TD className="hidden max-w-48 truncate text-ink-muted xl:table-cell">{p.campaign.title}</TD>
                  <TD className="hidden text-ink-muted md:table-cell">{p.qrSource?.name ?? "Direct"}</TD>
                  <TD><ParticipantStatusBadge status={p.status} /></TD>
                  <TD className="hidden whitespace-nowrap text-ink-muted sm:table-cell">{fmt(p.registeredAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination page={result.page} pages={result.pages} buildHref={buildHref} />
      </Card>
    </>
  );
}
