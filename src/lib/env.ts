import "server-only";
import { z } from "zod";

const boolish = z
  .string()
  .optional()
  .transform((v) => v === "1" || v?.toLowerCase() === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Optional on Cloudflare Workers when a HYPERDRIVE binding provides the connection. */
  DATABASE_URL: z.string().optional(),
  /** Public base URL, e.g. https://giveaway.example.al — used for QR codes, e-mails and metadata. */
  APP_URL: z.string().url(),
  /** ≥ 32 random characters. Used for HMACs (form tokens, IP hashing). Rotate to invalidate. */
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional().or(z.literal("")),
  EMAIL_DISABLED: boolish,
  TURNSTILE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional().or(z.literal("")),
  /** One-time token required by the /setup page to create the first administrator (≥ 12 characters). */
  SETUP_TOKEN: z.string().min(12, "SETUP_TOKEN must be at least 12 characters").optional().or(z.literal("")),
  /** Trust X-Forwarded-For / CF-Connecting-IP (only when behind your own reverse proxy / Cloudflare). */
  TRUST_PROXY: boolish,
  /** Comma separated drand relay URLs (optional override). */
  DRAND_URLS: z.string().optional(),
  /** Minimum seconds between commitment and the committed drand round (default 60, raise for extra margin). */
  DRAW_COMMIT_LEAD_SECONDS: z.coerce.number().int().min(60).max(86400).default(120),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Validated environment. Throws a descriptive error at first use if configuration is invalid. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && /change-me|dev-only/i.test(parsed.data.SESSION_SECRET)) {
    throw new Error("SESSION_SECRET still uses the example value — generate a new one (openssl rand -base64 48)");
  }
  cached = parsed.data;
  return cached;
}

export function appUrl(path = ""): string {
  return new URL(path, env().APP_URL).toString();
}

export function isProduction() {
  return env().NODE_ENV === "production";
}

export function emailEnabled() {
  const e = env();
  return !e.EMAIL_DISABLED && !!e.RESEND_API_KEY && !!e.EMAIL_FROM;
}

export function turnstileEnabled() {
  const e = env();
  return !!e.TURNSTILE_SECRET_KEY && !!e.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}

/** Test helper */
export function resetEnvCache() {
  cached = null;
}
