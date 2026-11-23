"use client";
import { useState } from "react";
import { CheckCircle2, Loader2, Search, ShieldCheck, XCircle } from "lucide-react";
import { entryHash, fetchVerifiedBeacon, KNOWN_CHAINS, verifyDrawProof, type DrawProof, type VerificationCheck } from "@/lib/fairness";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Independent verification in the visitor's browser:
 *  1. downloads the published snapshot + proof,
 *  2. fetches the committed round DIRECTLY from public drand relays (not from our server),
 *  3. verifies the BLS signature with the pinned network key and recomputes the winners.
 */
export function BrowserVerifier({ campaignId, sequence }: { campaignId: string; sequence: number }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [checks, setChecks] = useState<VerificationCheck[]>([]);
  const [ok, setOk] = useState<boolean | null>(null);

  const run = async () => {
    setState("running");
    const out: VerificationCheck[] = [];
    try {
      const [proofRes, snapRes] = await Promise.all([fetch(`/api/verify/${campaignId}/proof`), fetch(`/api/verify/${campaignId}/snapshot?draw=${sequence}`)]);
      const proofs = (await proofRes.json()) as { draws: DrawProof[] };
      const proof = proofs.draws.find((d) => d.sequence === sequence);
      if (!proof) throw new Error("Proof not found");
      const snapshot = snapRes.ok ? await snapRes.text() : null;
      if (!snapshot) out.push({ id: "snapshot-download", ok: false, detail: "Snapshot download is disabled by the organiser — entry hashes cannot be checked." });

      let beaconProof = proof;
      if (proof.beacon) {
        const chain = KNOWN_CHAINS[proof.commitment.drand.chainHash];
        if (!chain) throw new Error("Unknown drand chain");
        const beacon = await fetchVerifiedBeacon(chain, proof.commitment.drand.round);
        const same = beacon.randomness === proof.beacon.randomness;
        out.push({ id: "drand-direct", ok: same, detail: same ? `Fetched round ${beacon.round} directly from drand: randomness matches` : "Randomness from drand differs from the published value" });
        beaconProof = { ...proof, beacon };
      }
      const report = verifyDrawProof(beaconProof, snapshot);
      out.push(...report.checks);
      setChecks(out);
      setOk(out.every((c) => c.ok));
    } catch (e) {
      out.push({ id: "error", ok: false, detail: (e as Error).message });
      setChecks(out);
      setOk(false);
    }
    setState("done");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t("verify.browserNote")}</p>
      <Button onClick={run} disabled={state === "running"} variant="navy">
        {state === "running" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        {state === "running" ? t("verify.running") : t("verify.runInBrowser")}
      </Button>
      {state === "done" && (
        <div className={`rounded-xl border p-4 ${ok ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft"}`} role="status">
          <p className={`mb-3 flex items-center gap-2 font-semibold ${ok ? "text-success" : "text-danger"}`}>
            {ok ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />} {ok ? t("verify.verified") : t("verify.failed")}
          </p>
          <CheckList checks={checks} />
        </div>
      )}
    </div>
  );
}

export function CheckList({ checks }: { checks: VerificationCheck[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2">
          {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
          <span className="break-words text-ink">{c.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export function EntryChecker({ campaignId, sequence }: { campaignId: string; sequence: number }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = value.trim().toUpperCase();
    if (!ref) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/verify/${campaignId}/snapshot?draw=${sequence}`);
      if (!res.ok) throw new Error();
      const text = await res.text();
      // The hash is computed locally — your reference number is never sent to the server.
      setResult(text.includes(`\n${entryHash(campaignId, ref)}\n`));
    } catch {
      setResult(null);
    }
    setBusy(false);
  };
  return (
    <form onSubmit={check} className="space-y-3">
      <p className="text-sm text-ink-muted">{t("verify.checkEntryHint")}</p>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => { setValue(e.target.value); setResult(null); }} placeholder="GIVE-2026-XXXXXXXX" className="font-mono uppercase" aria-label={t("verify.reference")} />
        <Button type="submit" variant="outline" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Search />} {t("verify.check")}</Button>
      </div>
      {result !== null && (
        <p className={`flex items-center gap-2 text-sm font-medium ${result ? "text-success" : "text-danger"}`} role="status">
          {result ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} {result ? t("verify.included") : t("verify.notIncluded")}
        </p>
      )}
    </form>
  );
}
