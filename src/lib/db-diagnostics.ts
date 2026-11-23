/**
 * Explains common DATABASE_URL mistakes without ever revealing credentials.
 * Shown on /setup (only reachable before the first admin exists).
 */
export interface DbTarget {
  host: string;
  port: string;
  database: string;
  hint?: string;
}

function maskHost(host: string) {
  // keep the provider part readable, hide most of the instance id
  return host.replace(/^([a-z0-9]{3})[a-z0-9-]*?([a-z0-9]{3})(?=\.)/i, "$1…$2");
}

export function describeDatabaseUrl(url: string | undefined): DbTarget | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { host: "?", port: "?", database: "?", hint: "DATABASE_URL is not a valid URL. It must look like postgresql://user:password@host:5432/dbname?sslmode=require" };
  }
  const host = u.hostname;
  const port = u.port || "5432";
  const target: DbTarget = { host: maskHost(host), port, database: u.pathname.replace(/^\//, "") || "?" };
  const isPrivate =
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1|\[::1\])/.test(host) || host.endsWith(".local") || host.endsWith(".internal");

  if (!/^postgres(ql)?:$/.test(u.protocol)) target.hint = "The URL must start with postgresql:// (or postgres://).";
  else if (host === "your-host" || u.username === "user" || u.password === "password") target.hint = "DATABASE_URL still contains the example value from .dev.vars.example — paste your real connection string.";
  else if (isPrivate) target.hint = "This host is private (localhost / internal network). Cloudflare Workers can only reach databases that are reachable from the public internet.";
  else if (/^db\.[a-z0-9]+\.supabase\.co$/.test(host))
    target.hint = "Supabase direct connections (db.<project>.supabase.co) are IPv6-only and cannot be reached from Workers. In Supabase → Connect, copy the Transaction pooler string (…pooler.supabase.com:6543) instead.";
  else if (host.endsWith(".neon.tech") && !host.includes("-pooler"))
    target.hint = "Use Neon's pooled connection string (host contains “-pooler”): Neon → Connect → enable Connection pooling.";
  else if (!/sslmode=(require|verify-full|verify-ca)/.test(u.search) && !/ssl=true/.test(u.search))
    target.hint = "Most hosted databases require TLS — add ?sslmode=require to the end of DATABASE_URL.";
  else if (port !== "5432" && port !== "6543" && port !== "6432")
    target.hint = `Port ${port} is unusual for PostgreSQL — check it is the right one and that the database accepts connections from the internet.`;
  return target;
}
