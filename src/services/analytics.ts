import "server-only";
import { prisma } from "@/lib/db";
import { dayKeyInZone, startOfDayInZone } from "@/lib/time";
import { effectiveStatus } from "./campaign-status";
import { getSettings } from "./settings";

export interface DailyPoint {
  day: string;
  count: number;
}

async function dailyRegistrations(timezone: string, days: number, campaignId?: string): Promise<DailyPoint[]> {
  const since = startOfDayInZone(new Date(Date.now() - (days - 1) * 86_400_000), timezone);
  const rows = campaignId
    ? await prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT to_char(("registeredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, count(*) AS count
        FROM "Participant" WHERE "registeredAt" >= ${since} AND "campaignId" = ${campaignId} GROUP BY 1 ORDER BY 1`
    : await prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT to_char(("registeredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, count(*) AS count
        FROM "Participant" WHERE "registeredAt" >= ${since} GROUP BY 1 ORDER BY 1`;
  const map = new Map(rows.map((r) => [r.day, Number(r.count)]));
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKeyInZone(new Date(Date.now() - i * 86_400_000), timezone);
    if (!out.some((p) => p.day === key)) out.push({ day: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export async function dashboardStats() {
  const { timezone } = await getSettings();
  const now = new Date();
  const today = startOfDayInZone(now, timezone);
  const weekStart = new Date(today.getTime() - ((new Date(dayKeyInZone(now, timezone)).getUTCDay() + 6) % 7) * 86_400_000);

  const [total, todayCount, weekCount, campaigns, bySourceRaw, recent, growth] = await Promise.all([
    prisma.participant.count(),
    prisma.participant.count({ where: { registeredAt: { gte: today } } }),
    prisma.participant.count({ where: { registeredAt: { gte: weekStart } } }),
    prisma.campaign.findMany({ orderBy: { drawAt: "asc" }, include: { _count: { select: { participants: true } } } }),
    prisma.participant.groupBy({ by: ["qrSourceId"], _count: { _all: true } }),
    prisma.participant.findMany({
      orderBy: { registeredAt: "desc" },
      take: 8,
      select: { id: true, fullName: true, referenceNumber: true, registeredAt: true, status: true, campaign: { select: { title: true } }, qrSource: { select: { name: true } } },
    }),
    dailyRegistrations(timezone, 30),
  ]);

  const sourceIds = bySourceRaw.map((s) => s.qrSourceId).filter((id): id is string => !!id);
  const sources = await prisma.qRSource.findMany({ where: { id: { in: sourceIds } }, select: { id: true, name: true, campaign: { select: { title: true } } } });
  const sourceName = new Map(sources.map((s) => [s.id, `${s.name}`]));
  const bySource = bySourceRaw
    .map((s) => ({ name: s.qrSourceId ? sourceName.get(s.qrSourceId) ?? "Unknown" : "Direct / no QR", count: s._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const withStatus = campaigns.map((c) => ({ ...c, effectiveStatus: effectiveStatus(c, now) }));
  return {
    total,
    today: todayCount,
    week: weekCount,
    activeCampaigns: withStatus.filter((c) => c.effectiveStatus === "ACTIVE").length,
    completedCampaigns: withStatus.filter((c) => c.effectiveStatus === "DRAW_COMPLETED").length,
    bySource,
    recent,
    growth,
    upcomingDraws: withStatus
      .filter((c) => c.effectiveStatus !== "DRAW_COMPLETED" && c.effectiveStatus !== "DRAFT")
      .slice(0, 6)
      .map((c) => ({ id: c.id, title: c.title, drawAt: c.drawAt, status: c.effectiveStatus, entries: c._count.participants })),
  };
}

export async function campaignAnalytics(campaignId: string) {
  const { timezone } = await getSettings();
  const [sources, regBySource, scans, landingUnique, landingUniqueBySource, total, statusCounts, growth] = await Promise.all([
    prisma.qRSource.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } }),
    prisma.participant.groupBy({ by: ["qrSourceId"], where: { campaignId }, _count: { _all: true } }),
    prisma.pageVisit.groupBy({ by: ["qrSourceId"], where: { campaignId, kind: "SCAN" }, _count: { _all: true } }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT count(DISTINCT "visitorHash") AS n FROM "PageVisit" WHERE "campaignId" = ${campaignId} AND kind = 'LANDING'`,
    prisma.$queryRaw<{ qrSourceId: string | null; n: bigint }[]>`
      SELECT "qrSourceId", count(DISTINCT "visitorHash") AS n FROM "PageVisit" WHERE "campaignId" = ${campaignId} AND kind = 'LANDING' GROUP BY 1`,
    prisma.participant.count({ where: { campaignId } }),
    prisma.participant.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } }),
    dailyRegistrations(timezone, 30, campaignId),
  ]);
  const reg = new Map(regBySource.map((r) => [r.qrSourceId, r._count._all]));
  const scan = new Map(scans.map((r) => [r.qrSourceId, r._count._all]));
  const uniq = new Map(landingUniqueBySource.map((r) => [r.qrSourceId, Number(r.n)]));
  const rate = (r: number, v: number) => (v > 0 ? Math.min(1, r / v) : null);

  const perSource = [
    ...sources.map((s) => {
      const registrations = reg.get(s.id) ?? 0;
      const visitors = uniq.get(s.id) ?? 0;
      return { id: s.id, name: s.name, slug: s.slug, code: s.code, type: s.type, active: s.active, destination: s.destination, scans: scan.get(s.id) ?? 0, visitors, registrations, conversion: rate(registrations, visitors) };
    }),
    {
      id: "none",
      name: "Direct / no QR",
      slug: "",
      code: "",
      type: "OTHER" as const,
      active: true,
      destination: "",
      scans: 0,
      visitors: uniq.get(null) ?? 0,
      registrations: reg.get(null) ?? 0,
      conversion: rate(reg.get(null) ?? 0, uniq.get(null) ?? 0),
    },
  ];
  const uniqueVisitors = Number(landingUnique[0]?.n ?? 0);
  return {
    total,
    uniqueVisitors,
    conversion: rate(total, uniqueVisitors),
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])) as Record<string, number>,
    perSource,
    growth,
  };
}
