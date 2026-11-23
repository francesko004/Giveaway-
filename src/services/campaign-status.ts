import type { CampaignStatus } from "@prisma/client";

export interface StatusInput {
  status: CampaignStatus;
  startsAt: Date;
  endsAt: Date;
  closedAt?: Date | null;
  lockedAt?: Date | null;
}

/**
 * Effective status derived from the stored status and the server clock.
 * This — never the browser countdown — decides whether registration is open.
 */
export function effectiveStatus(c: StatusInput, now: Date = new Date()): CampaignStatus {
  if (c.status === "DRAFT" || c.status === "DRAW_COMPLETED" || c.status === "CLOSED") return c.status;
  if (c.closedAt || c.lockedAt || now.getTime() >= c.endsAt.getTime()) return "CLOSED";
  if (c.status === "PAUSED") return "PAUSED";
  return now.getTime() < c.startsAt.getTime() ? "SCHEDULED" : "ACTIVE";
}

export function isRegistrationOpen(c: StatusInput, now: Date = new Date()): boolean {
  return effectiveStatus(c, now) === "ACTIVE";
}

export function isPublished(status: CampaignStatus) {
  return status !== "DRAFT";
}

/** Registration has ended (by time or manually) — the entry list may be frozen. */
export function isClosedForEntries(c: StatusInput, now: Date = new Date()) {
  const s = effectiveStatus(c, now);
  return s === "CLOSED" || s === "DRAW_COMPLETED";
}
