import { prisma } from "@/lib/db";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/security/rate-limit";
import { ipHash, isSameOrigin } from "@/lib/security/request";
import { dataRequestSchema } from "@/lib/validation/admin";
import { normalizePhone } from "@/lib/validation/phone";
import { adminNotificationAddress, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/** Public data-subject request (access / erasure / rectification / marketing opt-out). Processed manually by an admin. */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError("REJECTED", "Cross-site submissions are not accepted", 403);
    const ip = ipHash(request.headers);
    const limit = await rateLimit(`dsr:${ip}`, 5, 3600);
    if (!limit.allowed) throw new AppError("RATE_LIMITED", "Too many requests. Please try again later.", 429);
    const input = dataRequestSchema.parse(await readJson(request, 8000));
    if (input.website) throw new AppError("REJECTED", "Request rejected", 400);
    const created = await prisma.dataRequest.create({
      data: {
        type: input.type,
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        phone: input.phone ? normalizePhone(input.phone)?.e164 ?? input.phone : null,
        message: input.message || null,
        ipHash: ip,
      },
    });
    const to = adminNotificationAddress();
    if (to) void sendEmail(to, { subject: `[Admin] New data request (${created.type})`, html: `<p>A new personal data request was submitted. Review it in the admin dashboard under Privacy.</p>` });
    return jsonOk({ id: created.id }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
