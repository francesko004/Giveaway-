import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock, Download, FileJson, Trophy } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/time";
import { getSettings } from "@/services/settings";
import { getPublicVerification, currentWinners } from "@/services/draws";
import { localizeCampaign } from "@/services/campaigns";
import { SiteHeader } from "@/components/landing/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrowserVerifier, CheckList, EntryChecker } from "@/components/verify/browser-verifier";
import { RevealGroup, ScrambleText } from "@/components/verify/winner-reveal";
import type { Campaign } from "@/generated/prisma/client";

type Props = { params: Promise<{ campaignId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { campaignId } = await params;
  const { dict } = await getDictionary();
  const data = await getPublicVerification(campaignId);
  return { title: data ? `${dict.verify.title} – ${data.campaign.title}` : dict.verify.title, robots: { index: true } };
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-1 border-b py-3 last:border-0 sm:grid-cols-[220px_1fr] sm:gap-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className={mono ? "font-mono text-xs leading-relaxed break-all text-ink sm:text-sm" : "text-sm font-medium text-ink"}>{value}</dd>
    </div>
  );
}

export default async function VerifyCampaignPage({ params }: Props) {
  const { campaignId } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(campaignId)) notFound();
  const [{ locale, dict }, settings, data] = await Promise.all([getDictionary(), getSettings(), getPublicVerification(campaignId)]);
  if (!data) notFound();
  const v = dict.verify;
  const fmt = (d: Date | string) => formatDateTime(d, locale, settings.timezone, { dateStyle: "medium", timeStyle: "medium" });
  const title = localizeCampaign(data.campaign as unknown as Campaign, locale).title;

  return (
    <>
      <SiteHeader companyName={settings.companyName} logoUrl={settings.logoUrl} locale={locale} dict={dict} homeHref={`/giveaway/${data.campaign.slug}`} />
      <main className="container-page max-w-4xl py-10 sm:py-14">
        <Link href="/verify" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-navy"><ArrowLeft className="size-4" /> {v.listTitle}</Link>
        <p className="text-sm font-semibold tracking-wider text-brand uppercase">{v.title}</p>
        <h1 className="mt-1 text-2xl font-bold text-navy sm:text-3xl">{title}</h1>

        {data.draws.length === 0 && (
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center sm:py-12">
              <Clock className="size-10 text-ink-muted" />
              <p className="font-semibold text-navy">{v.noDraw}</p>
              <p className="max-w-md text-sm text-ink-muted">{v.noDrawText}</p>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 space-y-10">
          {data.draws.map(({ draw, results, serverCheck }) => {
            const winners = currentWinners(results.map((r, i) => ({ ...r, id: String(i) })), draw.winnerCount);
            return (
              <section key={draw.id} className="space-y-5" aria-labelledby={`draw-${draw.sequence}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 id={`draw-${draw.sequence}`} className="text-lg font-semibold text-navy">{v.draw} #{draw.sequence}</h2>
                  {draw.status === "COMPLETED" && <Badge variant="success">{v.completed}</Badge>}
                  {draw.status === "COMMITTED" && <Badge variant="warning">{v.pending}</Badge>}
                  {draw.status === "INVALIDATED" && <Badge variant="danger">{v.invalidated}</Badge>}
                  {draw.status !== "INVALIDATED" && serverCheck && (
                    <Badge variant={serverCheck.ok ? "success" : "danger"}>{serverCheck.ok ? `✓ ${v.verified}` : v.failed}</Badge>
                  )}
                </div>

                {draw.status === "INVALIDATED" && (
                  <div className="flex gap-3 rounded-xl border border-danger/25 bg-danger-soft p-4 text-sm">
                    <AlertTriangle className="size-5 shrink-0 text-danger" />
                    <div>
                      <p className="font-semibold text-danger">{v.invalidatedBecause} · {draw.invalidatedAt && fmt(draw.invalidatedAt)}</p>
                      <p className="mt-1 text-ink">{v.reason}: {draw.invalidationReason}</p>
                    </div>
                  </div>
                )}
                {draw.supersedesId && <p className="text-sm text-ink-muted">{v.supersedes}{draw.sequence - 1}</p>}

                {draw.status === "COMPLETED" && (
                  <Card className="border-brand/30 bg-brand-soft/40">
                    <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="size-5 text-brand" /> {v.result}</CardTitle></CardHeader>
                    <CardContent>
                      <RevealGroup>
                      {results.map((r) => {
                        const isCurrent = winners.some((w) => w.position === r.position);
                        return (
                          <div key={r.position} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-4 py-3 ${r.disqualifiedAt ? "opacity-60" : ""}`}>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-ink-muted">#{r.position + 1}</span>
                              <ScrambleText text={r.referenceNumber} delay={r.position * 450} className="font-mono text-base font-bold text-navy" testId={r.role === "WINNER" ? "winner-reference" : undefined} />
                            </div>
                            <div className="flex items-center gap-2">
                              {r.disqualifiedAt ? (
                                <Badge variant="danger" title={r.disqualificationReason ?? ""}>{v.disqualified}</Badge>
                              ) : isCurrent ? (
                                <Badge variant="success">{v.winner}</Badge>
                              ) : (
                                <Badge variant="neutral">{v.alternate}</Badge>
                              )}
                            </div>
                            {r.disqualifiedAt && <p className="w-full text-xs text-ink-muted">{v.reason}: {r.disqualificationReason}</p>}
                          </div>
                        );
                      })}
                      </RevealGroup>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader><CardTitle>1 · {v.commitment}</CardTitle></CardHeader>
                  <CardContent>
                    <dl>
                      <Row label={v.entries} value={draw.entryCount.toLocaleString()} />
                      <Row label={v.snapshotHash} value={draw.snapshotHash} mono />
                      <Row label={v.committedAt} value={fmt(draw.commitmentAt)} />
                      <Row label={v.network} value={`${draw.drandNetwork} · ${draw.drandChainHash}`} mono />
                      <Row label={v.round} value={draw.drandRound.toLocaleString("en")} />
                      <Row label={v.roundAt} value={fmt(draw.drandRoundAt)} />
                      <Row label={v.algorithm} value={draw.algorithmVersion} mono />
                    </dl>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>2 · {v.reveal}</CardTitle></CardHeader>
                  <CardContent>
                    {draw.randomness ? (
                      <dl>
                        <Row label={v.randomness} value={draw.randomness} mono />
                        <Row label={v.signature} value={draw.signature} mono />
                        {draw.completedAt && <Row label={v.completedAt} value={fmt(draw.completedAt)} />}
                      </dl>
                    ) : (
                      <p className="text-sm text-ink-muted">{v.awaiting} <strong className="text-ink">{fmt(draw.drandRoundAt)}</strong>.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>3 · {v.status}</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    {serverCheck && <CheckList checks={serverCheck.checks} />}
                    <div className="flex flex-wrap gap-2">
                      {settings.publishSnapshot && (
                        <a href={`/api/verify/${campaignId}/snapshot?draw=${draw.sequence}`} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-surface-muted"><Download className="size-4" /> {v.downloadSnapshot}</a>
                      )}
                      <a href={`/api/verify/${campaignId}/proof`} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-surface-muted"><FileJson className="size-4" /> {v.downloadProof}</a>
                    </div>
                    {draw.status !== "INVALIDATED" && (
                      <>
                        <div className="border-t pt-6"><BrowserVerifier campaignId={campaignId} sequence={draw.sequence} /></div>
                        {settings.publishSnapshot && (
                          <div className="border-t pt-6">
                            <h3 className="mb-2 font-semibold text-navy">{v.checkEntry}</h3>
                            <EntryChecker campaignId={campaignId} sequence={draw.sequence} />
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </section>
            );
          })}
        </div>

        <Card className="mt-10">
          <CardHeader><CardTitle>{v.howTo}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-ink-muted">
            <ol className="list-decimal space-y-2 pl-5">
              <li><code className="text-ink">{`entryHash = SHA256("giveaway-entry/v1\\n" + campaignId + "\\n" + reference)`}</code> for every eligible entry.</li>
              <li>Snapshot = <code className="text-ink">giveaway-snapshot/v1</code>, <code className="text-ink">campaign:&lt;id&gt;</code>, <code className="text-ink">count:&lt;n&gt;</code>, then the entry hashes sorted ascending, one per line (LF, trailing newline). Its SHA-256 must equal the published commitment.</li>
              <li>The drand round was fixed at commitment time and is produced later. Check its BLS signature with the network&apos;s public key (e.g. <code className="text-ink">drand-client</code> or <a className="text-brand underline" href="https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/info" rel="noopener noreferrer">api.drand.sh</a>); randomness = SHA256(signature).</li>
              <li>For pick k = 0,1,… and counter c = 0,1,…: <code className="text-ink">{`x = SHA256("giveaway-draw/v1\\n" + campaignId + "\\n" + snapshotHash + "\\n" + randomness + "\\n" + k + "\\n" + c)`}</code> as a 256-bit integer. Accept if <code className="text-ink">x &lt; 2²⁵⁶ − (2²⁵⁶ mod m)</code> (m = entries remaining), else increment c. Index = x mod m; remove that entry and continue.</li>
              <li>The first picks are winners, the rest are alternates in order.</li>
            </ol>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
