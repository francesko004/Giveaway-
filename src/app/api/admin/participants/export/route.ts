import { prisma } from "@/lib/db";
import { adminRoute } from "@/lib/api";
import { parseParticipantFilters } from "@/lib/admin-filters";
import { toCsv } from "@/lib/csv";
import { toXlsx } from "@/lib/xlsx";
import { writeAudit } from "@/services/audit";
import { EXPORT_HEADERS, exportParticipantRows } from "@/services/participants";
import { getSettings } from "@/services/settings";

/** Personal-data export. ADMIN+ only, always audited. Formula-injection safe (CSV and XLSX). */
export const GET = adminRoute("ADMIN", async (req, { user, ipHash }) => {
  const url = new URL(req.url);
  const settings = await getSettings();
  const filters = parseParticipantFilters(url.searchParams, settings.timezone);
  const marketingOnly = url.searchParams.get("marketing") === "1";
  const rows = await exportParticipantRows(filters, { marketingOnly });
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, {
      userId: user.id,
      campaignId: filters.campaignId ?? null,
      action: "participants.exported",
      entityType: "Participant",
      metadata: { format, rows: rows.length, marketingOnly, filters: { ...filters, q: filters.q ? "[redacted]" : undefined } },
      ipHash,
    });
  });

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    return new Response(toCsv(EXPORT_HEADERS, rows), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="participants-${stamp}.csv"`, "cache-control": "no-store" },
    });
  }
  const xlsx = toXlsx("Participants", EXPORT_HEADERS, rows);
  return new Response(xlsx as Uint8Array<ArrayBuffer>, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="participants-${stamp}.xlsx"`,
      "cache-control": "no-store",
    },
  });
});
