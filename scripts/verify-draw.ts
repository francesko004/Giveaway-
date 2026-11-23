/**
 * Independent command-line verifier. Uses only the public endpoints and the public drand network.
 *
 *   npm run draw:verify -- https://giveaway.example.al <campaignId>
 *
 * Steps: download proof + snapshot → check SHA-256 commitment → fetch the committed round directly
 * from drand and verify its BLS signature against the pinned network key → recompute the winners.
 */
import { KNOWN_CHAINS, fetchVerifiedBeacon, verifyDrawProof, type DrawProof } from "../src/lib/fairness";

async function main() {
  const [base, campaignId] = process.argv.slice(2);
  if (!base || !campaignId) {
    console.error("Usage: npm run draw:verify -- <site-url> <campaignId>");
    process.exit(2);
  }
  const root = base.replace(/\/$/, "");
  const { draws } = (await (await fetch(`${root}/api/verify/${campaignId}/proof`)).json()) as { draws: DrawProof[] };
  if (!draws?.length) throw new Error("No draws published for this campaign");
  let allOk = true;
  for (const proof of draws) {
    console.log(`\nDraw #${proof.sequence} (${proof.status})`);
    const snapRes = await fetch(`${root}/api/verify/${campaignId}/snapshot?draw=${proof.sequence}`);
    const snapshot = snapRes.ok ? await snapRes.text() : null;
    let p = proof;
    if (proof.beacon) {
      const chain = KNOWN_CHAINS[proof.commitment.drand.chainHash];
      if (!chain) throw new Error("Unknown drand chain");
      const beacon = await fetchVerifiedBeacon(chain, proof.commitment.drand.round);
      const same = beacon.randomness === proof.beacon.randomness;
      console.log(`${same ? "✓" : "✗"} randomness fetched directly from drand ${same ? "matches" : "DIFFERS"}`);
      if (!same) allOk = false;
      p = { ...proof, beacon };
    }
    const report = verifyDrawProof(p, snapshot);
    for (const c of report.checks) console.log(`${c.ok ? "✓" : "✗"} ${c.detail}`);
    if (proof.status !== "INVALIDATED" && !report.ok) allOk = false;
    for (const r of proof.results) console.log(`  #${r.position + 1} ${r.role.padEnd(9)} ${r.referenceNumber}`);
  }
  console.log(allOk ? "\nRESULT: VERIFIED" : "\nRESULT: VERIFICATION FAILED");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
