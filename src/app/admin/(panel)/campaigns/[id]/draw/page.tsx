import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireAdminPage } from "@/lib/auth/server";
import { hasRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/time";
import { QUICKNET, firstRoundAfter, roundTime } from "@/lib/fairness";
import { currentWinners, drawReadiness, toProof } from "@/services/draws";
import { verifyDrawProof } from "@/lib/fairness";
import { getSettings } from "@/services/settings";
import { CampaignHeader } from "@/components/admin/campaign-header";
import { CommitButton, ExecuteButton, InvalidateButton, ProtectedNote, ResultActions } from "@/components/admin/draw-console";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Round the commitment would use if made now (the server recomputes it at commit time). */
function projectRound(drawAt: Date) {
  const lead = env().DRAW_COMMIT_LEAD_SECONDS;
  return firstRoundAfter(QUICKNET, Math.max(Math.floor(Date.now() / 1000) + lead, Math.floor(drawAt.getTime() / 1000)));
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="block rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs break-all text-ink">{children}</code>;
}

export default async function DrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminPage();
  const [ready, settings, draws] = await Promise.all([
    drawReadiness(id),
    getSettings(),
    prisma.draw.findMany({ where: { campaignId: id }, orderBy: { sequence: "desc" }, include: { results: { orderBy: { position: "asc" }, include: { participant: { select: { id: true, fullName: true, email: true, phone: true, anonymizedAt: true } } } } } }),
  ]);
  const fmt = (d: Date) => formatDateTime(d, "en", settings.timezone, { dateStyle: "medium", timeStyle: "medium" });
  const canAct = hasRole(user.role, "ADMIN");
  const active = draws.find((d) => d.status !== "INVALIDATED");
  const projectedRound = projectRound(ready.campaign.drawAt);
  const roundHint = `≈ round ${projectedRound.toLocaleString("en")} at ${fmt(new Date(roundTime(QUICKNET, projectedRound) * 1000))}`;

  return (
    <>
      <CampaignHeader id={id} user={user} tab="draw" />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {!active && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1–3 · Freeze entries and commit</CardTitle>
                <CardDescription>Creates the public commitment: SHA-256 of the canonical entry snapshot + a future drand round.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-success-soft p-3"><p className="text-2xl font-bold text-success">{ready.eligible}</p><p className="text-xs text-ink-muted">Eligible</p></div>
                  <div className="rounded-xl bg-warning-soft p-3"><p className="text-2xl font-bold text-warning">{ready.flagged}</p><p className="text-xs text-ink-muted">Needs review</p></div>
                  <div className="rounded-xl bg-danger-soft p-3"><p className="text-2xl font-bold text-danger">{ready.invalid}</p><p className="text-xs text-ink-muted">Invalid</p></div>
                </div>
                {ready.blockers.length > 0 ? (
                  <ul className="space-y-2">
                    {ready.blockers.map((b) => <li key={b} className="flex gap-2 text-sm text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {b}</li>)}
                    {ready.flagged > 0 && <li><Link className="text-sm font-medium text-brand hover:underline" href={`/admin/participants?campaign=${id}&status=FLAGGED`}>Review flagged entries →</Link></li>}
                  </ul>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" /> Ready to commit. Draw date: {fmt(ready.campaign.drawAt)}.</p>
                )}
                {canAct && <CommitButton campaignId={id} disabled={!ready.canCommit} entries={ready.eligible} roundHint={roundHint} />}
              </CardContent>
            </Card>
          )}

          {draws.map((d) => {
            const proof = toProof(d);
            const check = verifyDrawProof(proof, d.snapshot);
            const winners = currentWinners(d.results, d.winnerCount);
            return (
              <Card key={d.id} className={d.status === "INVALIDATED" ? "opacity-75" : ""}>
                <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CardTitle>Draw #{d.sequence}</CardTitle>
                    <Badge variant={d.status === "COMPLETED" ? "success" : d.status === "COMMITTED" ? "warning" : "danger"}>{d.status.toLowerCase()}</Badge>
                    {d.status !== "INVALIDATED" && <Badge variant={check.ok ? "success" : "danger"}>{check.ok ? "proof verifies" : "proof FAILS"}</Badge>}
                  </div>
                  <Link href={`/verify/${id}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Public page <ExternalLink className="size-3.5" /></Link>
                </CardHeader>
                <CardContent className="space-y-5">
                  {d.status === "INVALIDATED" && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">Invalidated {d.invalidatedAt && fmt(d.invalidatedAt)}: {d.invalidationReason}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><p className="mb-1 text-xs font-semibold text-ink-muted uppercase">Entries</p><p className="font-semibold">{d.entryCount}</p></div>
                    <div><p className="mb-1 text-xs font-semibold text-ink-muted uppercase">Committed</p><p className="font-semibold">{fmt(d.commitmentAt)}</p></div>
                    <div><p className="mb-1 text-xs font-semibold text-ink-muted uppercase">drand round</p><p className="font-semibold">{d.drandRound.toLocaleString("en")} ({d.drandNetwork})</p></div>
                    <div><p className="mb-1 text-xs font-semibold text-ink-muted uppercase">Round produced</p><p className="font-semibold">{fmt(d.drandRoundAt)}</p></div>
                  </div>
                  <div><p className="mb-1 text-xs font-semibold text-ink-muted uppercase">Snapshot SHA-256</p><Mono>{d.snapshotHash}</Mono></div>
                  {d.randomness && <div><p className="mb-1 text-xs font-semibold text-ink-muted uppercase">Verified randomness</p><Mono>{d.randomness}</Mono></div>}
                  {d.status === "COMMITTED" && (
                    <div className="space-y-3 rounded-xl border border-dashed p-4">
                      <p className="text-sm text-ink-muted">Step 4 · The scheduler reveals the draw automatically once round {d.drandRound.toLocaleString("en")} is produced. You can also trigger it manually; if the beacon is unreachable, the <strong>same</strong> round is retried.</p>
                      {d.attemptCount > 0 && d.lastError && <p className="text-xs text-warning">Last attempt {d.lastAttemptAt && fmt(d.lastAttemptAt)}: {d.lastError}</p>}
                      {canAct && <ExecuteButton campaignId={id} roundAt={d.drandRoundAt.toISOString()} />}
                    </div>
                  )}
                  {d.results.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-ink-muted uppercase">Results (published order)</p>
                      {d.results.map((r) => {
                        const isWinner = winners.some((w) => w.id === r.id);
                        return (
                          <div key={r.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-ink-muted">#{r.position + 1}</span>
                                <Link href={`/admin/participants/${r.participant.id}`} className="font-mono font-semibold text-navy hover:text-brand">{r.referenceNumber}</Link>
                                {r.disqualifiedAt ? <Badge variant="danger">disqualified</Badge> : isWinner ? <Badge variant="success">current winner</Badge> : <Badge variant="neutral">alternate</Badge>}
                                {r.notifiedAt && <Badge variant="outline">notified</Badge>}
                              </div>
                              <p className="mt-1 truncate text-sm text-ink-muted">{r.participant.anonymizedAt ? "Data erased" : `${r.participant.fullName} · ${r.participant.email} · ${r.participant.phone ?? ""}`}</p>
                              {r.disqualificationReason && <p className="text-xs text-danger">{r.disqualificationReason}</p>}
                            </div>
                            {canAct && d.status === "COMPLETED" && !r.disqualifiedAt && <ResultActions resultId={r.id} canDisqualify canNotify={!r.participant.anonymizedAt} notified={!!r.notifiedAt} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {hasRole(user.role, "SUPER_ADMIN") && d.status !== "INVALIDATED" && <div className="border-t pt-4"><InvalidateButton drawId={d.id} /></div>}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="size-4 text-brand" /> How the draw stays fair</CardTitle></CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-muted">
                <li>Registration closes (server-enforced).</li>
                <li>You review flagged entries; invalid ones need a recorded reason.</li>
                <li>Commit: entries are frozen, SHA-256 of the snapshot is published with a future drand round. Inserts and re-classification are blocked by the database.</li>
                <li>When that round is produced, its BLS signature is verified against the pinned League of Entropy key.</li>
                <li>Winners are derived deterministically with unbiased rejection sampling. Anyone can recompute them on the public page.</li>
              </ol>
              <div className="mt-4"><ProtectedNote /></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
