import type { ParticipantFilters } from "@/services/participants";
import { zonedLocalToUtc } from "@/lib/time";

const STATUSES = new Set(["ELIGIBLE", "FLAGGED", "INVALID"]);

/** Parses participant filters from URL search params (shared by the list page and the export endpoint). */
export function parseParticipantFilters(sp: URLSearchParams | Record<string, string | string[] | undefined>, timezone: string): ParticipantFilters {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? undefined;
  };
  const day = (v?: string, end = false) => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
    const d = zonedLocalToUtc(`${v}T00:00`, timezone);
    return end ? new Date(d.getTime() + 86_400_000) : d;
  };
  const status = get("status");
  return {
    q: get("q")?.slice(0, 100),
    campaignId: get("campaign") || undefined,
    sourceId: get("source") || undefined,
    status: status && STATUSES.has(status) ? (status as ParticipantFilters["status"]) : undefined,
    from: day(get("from")),
    to: day(get("to"), true),
    page: Number(get("page")) || 1,
    pageSize: Number(get("pageSize")) || 25,
  };
}
