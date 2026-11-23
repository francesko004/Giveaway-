import "server-only";
import { Resend } from "resend";
import { emailEnabled, env } from "@/lib/env";

let client: Resend | null = null;

export interface SendResult {
  sent: boolean;
  skipped?: "disabled";
  error?: string;
}

/**
 * Sends a transactional e-mail via Resend. When e-mail is not configured the platform keeps working
 * and the message is simply skipped. Recipient addresses are never logged.
 */
export async function sendEmail(to: string, message: { subject: string; html: string }): Promise<SendResult> {
  if (!emailEnabled()) return { sent: false, skipped: "disabled" };
  try {
    client ??= new Resend(env().RESEND_API_KEY);
    const { error } = await client.emails.send({ from: env().EMAIL_FROM!, to, subject: message.subject, html: message.html });
    if (error) {
      console.error("[email] send failed:", error.name);
      return { sent: false, error: error.name };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] send failed:", (e as Error).message);
    return { sent: false, error: "exception" };
  }
}

export function adminNotificationAddress(): string | null {
  return env().ADMIN_NOTIFICATION_EMAIL || null;
}
