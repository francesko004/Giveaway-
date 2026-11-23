import { z } from "zod";
import { handleError, jsonError, jsonOk, readJson } from "@/lib/api";
import { isSameOrigin } from "@/lib/security/request";
import { runSetup } from "@/services/setup";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(1).max(500),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(256),
  demo: z.boolean().default(true),
});

// Simple in-memory brute-force brake (the DB-backed limiter may not exist before migrations run).
const attempts = new Map<string, { n: number; at: number }>();

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return jsonError("CSRF", "Cross-site request blocked", 403);
    const key = request.headers.get("cf-connecting-ip") ?? "local";
    const a = attempts.get(key);
    const now = Date.now();
    if (a && now - a.at < 15 * 60_000 && a.n >= 10) return jsonError("RATE_LIMITED", "Too many attempts. Try again in 15 minutes.", 429);
    attempts.set(key, { n: a && now - a.at < 15 * 60_000 ? a.n + 1 : 1, at: a && now - a.at < 15 * 60_000 ? a.at : now });

    const input = schema.parse(await readJson(request, 4000));
    const result = await runSetup(input);
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
