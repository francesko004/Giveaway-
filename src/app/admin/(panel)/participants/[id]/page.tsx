import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Lock } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/server";
import { hasRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { formatPhone } from "@/lib/validation/phone";
import { getParticipant } from "@/services/participants";
import { getSettings } from "@/services/settings";
import { ParticipantStatusBadge } from "@/components/admin/bits";
import { ParticipantActions } from "@/components/admin/participant-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1 border-b py-2.5 last:border-0 sm:grid-cols-[180px_1fr]"><dt className="text-sm text-ink-muted">{label}</dt><dd className="text-sm font-medium break-words text-ink">{children}</dd></div>;
}

export default async function ParticipantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminPage();
  const [data, settings] = await Promise.all([getParticipant(id), getSettings()]);
  if (!data) notFound();
  const { participant: p, related, sameNetwork } = data;
  const fmt = (d: Date) => formatDateTime(d, "en", settings.timezone, { dateStyle: "medium", timeStyle: "medium" });
  const flags = (p.flags as string[]) ?? [];
  return (
    <>
      <Link href="/admin/participants" className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> Participants</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-navy">{p.referenceNumber}</h1>
            <ParticipantStatusBadge status={p.status} />
            {p.anonymizedAt && <Badge variant="neutral">erased</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-muted"><Link href={`/admin/campaigns/${p.campaign.id}`} className="hover:text-brand">{p.campaign.title}</Link></p>
        </div>
        {hasRole(user.role, "ADMIN") && <ParticipantActions id={p.id} status={p.status} locked={!!p.campaign.lockedAt} canErase={hasRole(user.role, "SUPER_ADMIN")} erased={!!p.anonymizedAt} />}
      </div>
      {p.campaign.lockedAt && <p className="mb-4 flex items-center gap-2 rounded-lg bg-brand-soft px-4 py-3 text-sm text-navy"><Lock className="size-4" /> The entry list is frozen for the draw — eligibility can no longer change.</p>}
      {flags.length > 0 && <p className="mb-4 flex items-center gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning"><AlertTriangle className="size-4" /> Automatic checks: {flags.join(", ").replaceAll("_", " ")}</p>}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Entry details</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <Row label="Full name">{p.fullName}</Row>
              <Row label="E-mail">{p.email}</Row>
              <Row label="Phone">{formatPhone(p.phone) || "—"}</Row>
              <Row label="City">{p.city ?? "—"}</Row>
              <Row label="Registered">{fmt(p.registeredAt)}</Row>
              <Row label="Language">{p.locale}</Row>
              <Row label="QR source">{p.qrSource ? `${p.qrSource.name} (src=${p.qrSource.slug})` : "Direct / no QR"}</Row>
              <Row label="UTM">{[p.utmSource, p.utmMedium, p.utmCampaign, p.utmTerm, p.utmContent].filter(Boolean).join(" · ") || "—"}</Row>
              <Row label="Referrer">{p.referrer ?? "—"}</Row>
              <Row label="Marketing consent">{p.marketingConsent ? "Yes" : "No"}</Row>
              <Row label="Policy versions">Terms {p.termsVersion} · Privacy {p.privacyVersion}</Row>
              {p.statusReason && <Row label="Status reason">{p.statusReason}{p.invalidatedBy && ` — ${p.invalidatedBy.name}`}{p.statusChangedAt && ` (${fmt(p.statusChangedAt)})`}</Row>}
            </dl>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Duplicate & abuse signals</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Other entries from the same network in this campaign: <strong>{sameNetwork}</strong></p>
              <div>
                <p className="mb-1">Same e-mail or phone in other campaigns:</p>
                {related.length === 0 ? <p className="text-ink-muted">None</p> : (
                  <ul className="space-y-1">{related.map((r) => <li key={r.id}><Link href={`/admin/participants/${r.id}`} className="font-mono text-brand hover:underline">{r.referenceNumber}</Link> <span className="text-ink-muted">· {r.campaign.title}</span></li>)}</ul>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Consent records</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {p.consents.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span>{c.consentType.toLowerCase()} <span className="text-ink-muted">v{c.policyVersion}</span></span>
                    <span className="flex items-center gap-2"><Badge variant={c.accepted ? "success" : "neutral"}>{c.accepted ? "accepted" : "declined"}</Badge><span className="text-xs text-ink-muted">{fmt(c.acceptedAt)}</span></span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {p.drawResults.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Draw results</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {p.drawResults.map((r) => <p key={r.id}>Draw #{r.draw.sequence} ({r.draw.status.toLowerCase()}): pick #{r.position + 1} — {r.role.toLowerCase()}{r.disqualifiedAt && " (disqualified)"}</p>)}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
