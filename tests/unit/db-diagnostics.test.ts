import { describe, expect, it } from "vitest";
import { describeDatabaseUrl } from "@/lib/db-diagnostics";

describe("DATABASE_URL diagnostics", () => {
  it("never exposes credentials", () => {
    const d = describeDatabaseUrl("postgresql://owner:SuperSecret123@ep-cool-name-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require")!;
    expect(JSON.stringify(d)).not.toMatch(/SuperSecret123|owner/);
    expect(d.hint).toBeUndefined();
    expect(d.database).toBe("neondb");
  });
  it.each([
    ["postgresql://user:password@your-host/dbname?sslmode=require", /example value/],
    ["postgresql://a:b@localhost:5432/db", /private/],
    ["postgresql://a:b@db.abcdefgh.supabase.co:5432/postgres?sslmode=require", /IPv6/],
    ["postgresql://a:b@ep-x-1.eu-central-1.aws.neon.tech/neondb?sslmode=require", /pooled/],
    ["postgresql://a:b@db.example.com/app", /sslmode=require/],
    ["not a url", /not a valid URL/],
  ])("explains %s", (url, hint) => {
    expect(describeDatabaseUrl(url)?.hint).toMatch(hint);
  });
});
