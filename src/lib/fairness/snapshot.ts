import { ENTRY_DOMAIN, SNAPSHOT_HEADER } from "./constants";
import { isHex, sha256Hex } from "./encoding";

/**
 * Entry hash ("leaf") for one eligible entry.
 *
 *   entryHash = SHA256("giveaway-entry/v1\n" + campaignId + "\n" + referenceNumber)
 *
 * Only the public reference number is used — never names, e-mails or phone numbers —
 * so every participant can recompute their own leaf and check it is in the snapshot.
 */
export function entryHash(campaignId: string, referenceNumber: string): string {
  assertField(campaignId, "campaignId");
  assertField(referenceNumber, "referenceNumber");
  return sha256Hex(`${ENTRY_DOMAIN}\n${campaignId}\n${referenceNumber}`);
}

export interface Snapshot {
  campaignId: string;
  /** Sorted ascending, unique, lowercase hex SHA-256 leaves */
  entries: string[];
}

/**
 * Canonical snapshot text:
 *
 *   giveaway-snapshot/v1\n
 *   campaign:<campaignId>\n
 *   count:<n>\n
 *   <leaf_0>\n ... <leaf_{n-1}>\n
 *
 * Leaves are sorted in ascending byte (hex) order, so the representation does not depend on
 * database ordering, insertion time or any other implementation detail.
 */
export function buildSnapshot(campaignId: string, leaves: string[]): Snapshot {
  assertField(campaignId, "campaignId");
  const normalized = leaves.map((l) => l.toLowerCase());
  for (const leaf of normalized) {
    if (!isHex(leaf, 32)) throw new Error(`Invalid entry hash: ${leaf}`);
  }
  const sorted = [...normalized].sort();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) throw new Error("Duplicate entry hash in snapshot");
  }
  return { campaignId, entries: sorted };
}

export function serializeSnapshot(snapshot: Snapshot): string {
  const lines = [SNAPSHOT_HEADER, `campaign:${snapshot.campaignId}`, `count:${snapshot.entries.length}`, ...snapshot.entries];
  return lines.join("\n") + "\n";
}

export function hashSnapshot(serialized: string): string {
  return sha256Hex(serialized);
}

/** Strict parser: rejects anything that is not byte-for-byte canonical. */
export function parseSnapshot(text: string): Snapshot {
  if (!text.endsWith("\n")) throw new Error("Snapshot must end with a newline");
  const lines = text.slice(0, -1).split("\n");
  if (lines[0] !== SNAPSHOT_HEADER) throw new Error("Unknown snapshot format");
  const campaignLine = lines[1] ?? "";
  const countLine = lines[2] ?? "";
  if (!campaignLine.startsWith("campaign:") || !countLine.startsWith("count:")) {
    throw new Error("Malformed snapshot header");
  }
  const campaignId = campaignLine.slice("campaign:".length);
  const count = Number(countLine.slice("count:".length));
  const entries = lines.slice(3);
  if (!Number.isInteger(count) || count !== entries.length) throw new Error("Snapshot count mismatch");
  const snapshot = buildSnapshot(campaignId, entries);
  if (serializeSnapshot(snapshot) !== text) throw new Error("Snapshot is not in canonical form");
  return snapshot;
}

function assertField(value: string, name: string) {
  if (!value || /[\n\r]/.test(value)) throw new Error(`Invalid ${name}`);
}
