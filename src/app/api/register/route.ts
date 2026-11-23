import { handleError, jsonError, jsonOk, readJson } from "@/lib/api";
import { isSameOrigin } from "@/lib/security/request";
import { registerParticipant } from "@/services/participants";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError("REJECTED", "Cross-site submissions are not accepted", 403);
    const body = await readJson(request, 16_000);
    const result = await registerParticipant(body, request.headers);
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
