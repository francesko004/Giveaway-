const GMAIL = new Set(["gmail.com", "googlemail.com"]);
const PLUS_ALIAS = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "proton.me", "protonmail.com", "yahoo.com"]);

/** Small, deliberately conservative list of throwaway domains (entries are flagged, not rejected). */
export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com",
  "trashmail.com", "sharklasers.com", "getnada.com", "dispostable.com", "maildrop.cc", "fakeinbox.com", "throwawaymail.com",
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Canonical mailbox used for duplicate detection: removes +tags and Gmail dots. */
export function canonicalEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at < 1) return normalized;
  let local = normalized.slice(0, at);
  let domain = normalized.slice(at + 1);
  if (PLUS_ALIAS.has(domain)) local = local.split("+")[0];
  if (GMAIL.has(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

export function isDisposableEmail(email: string): boolean {
  const domain = normalizeEmail(email).split("@")[1] ?? "";
  return DISPOSABLE_DOMAINS.has(domain);
}
