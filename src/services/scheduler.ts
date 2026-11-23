import "server-only";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { adminNotificationAddress, sendEmail } from "@/lib/email";
import { campaignClosed, drawResult } from "@/lib/email/templates";
import { syncCampaignStatuses } from "./campaigns";
import { executeDueDraws } from "./draws";
import { getSettings } from "./settings";

/**
 * Periodic housekeeping. Idempotent — safe to run from the built-in interval, an external cron
 * (POST /api/cron/tick) or both:
 *  - persists time-based status changes and notifies admins when registrations close,
 *  - reveals committed draws whose drand round has been produced (retrying the SAME round),
 *  - purges expired sessions / rate-limit windows.
 */
export async function runTick(now = new Date()) {
  const closed = await syncCampaignStatuses(now);
  const settings = await getSettings();
  const to = adminNotificationAddress();
  if (to) {
    for (const id of closed) {
      const c = await prisma.campaign.findUnique({ where: { id }, include: { _count: { select: { participants: true } } } });
      if (c) await sendEmail(to, campaignClosed({ company: settings.companyName, campaignTitle: c.title, locale: "en", entries: c._count.participants, adminUrl: appUrl(`/admin/campaigns/${id}/draw`) }));
    }
  }

  const draws = await executeDueDraws({ now });
  if (to) {
    for (const d of draws.filter((x) => x.ok)) {
      const draw = await prisma.draw.findUnique({ where: { id: d.id }, include: { campaign: true, results: { orderBy: { position: "asc" }, take: 1 } } });
      if (draw?.status === "COMPLETED" && draw.results[0]) {
        await sendEmail(
          to,
          drawResult({ company: settings.companyName, campaignTitle: draw.campaign.title, locale: "en", reference: draw.results[0].referenceNumber, verifyUrl: appUrl(`/verify/${draw.campaignId}`), round: draw.drandRound, snapshotHash: draw.snapshotHash }),
        );
      }
    }
  }

  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86_400_000) } } });
  return { closed, draws };
}
