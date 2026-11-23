import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { adminRoute, jsonError, jsonOk } from "@/lib/api";
import { sendEmail } from "@/lib/email";
import { winnerNotification } from "@/lib/email/templates";
import { writeAudit } from "@/services/audit";
import { localizeCampaign } from "@/services/campaigns";
import { getSettings } from "@/services/settings";

export const POST = adminRoute<{ id: string }>("ADMIN", async (_req, { user, ipHash }, { id }) => {
  const result = await prisma.drawResult.findUnique({ where: { id }, include: { participant: true, draw: { include: { campaign: true } } } });
  if (!result || result.draw.status !== "COMPLETED") return jsonError("NOT_FOUND", "Result not found", 404);
  if (result.disqualifiedAt) return jsonError("BAD_STATE", "This entry was disqualified", 409);
  if (result.participant.anonymizedAt) return jsonError("BAD_STATE", "The participant's data was erased", 409);
  const settings = await getSettings();
  const locale = result.participant.locale === "en" ? "en" : "sq";
  const sent = await sendEmail(
    result.participant.email,
    winnerNotification({
      company: settings.companyName,
      campaignTitle: localizeCampaign(result.draw.campaign, locale).title,
      locale,
      fullName: result.participant.fullName,
      reference: result.referenceNumber,
      verifyUrl: appUrl(`/verify/${result.draw.campaignId}`),
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
    }),
  );
  if (!sent.sent) return jsonError("EMAIL", sent.skipped ? "E-mail is not configured (set RESEND_API_KEY and EMAIL_FROM)" : "The e-mail could not be sent", 503);
  await prisma.$transaction(async (tx) => {
    await tx.drawResult.update({ where: { id }, data: { notifiedAt: new Date() } });
    await writeAudit(tx, { userId: user.id, campaignId: result.draw.campaignId, action: "draw.winner_notified", entityType: "DrawResult", entityId: id, metadata: { reference: result.referenceNumber }, ipHash });
  });
  return jsonOk({ ok: true });
});
