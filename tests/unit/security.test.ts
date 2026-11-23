import { describe, expect, it } from "vitest";
import { checkFormToken, issueFormToken } from "@/lib/security/form-token";
import { generateReference, randomCode } from "@/lib/security/crypto";
import { isSameOrigin } from "@/lib/security/request";

describe("form token", () => {
  it("accepts a genuine token after the minimum fill time", () => {
    const t = issueFormToken("c1", 1_000_000);
    expect(checkFormToken(t, "c1", 3, 1_000_000 + 3000)).toEqual({ ok: true });
  });
  it("rejects too-fast, expired, tampered and foreign tokens", () => {
    const t = issueFormToken("c1", 1_000_000);
    expect(checkFormToken(t, "c1", 3, 1_000_000 + 500)).toEqual({ ok: false, reason: "too_fast" });
    expect(checkFormToken(t, "c1", 3, 1_000_000 + 7 * 3600_000)).toEqual({ ok: false, reason: "expired" });
    expect(checkFormToken(t, "c2", 0, 1_000_000)).toMatchObject({ ok: false, reason: "invalid" });
    const [cid, , nonce, sig] = t.split(".");
    expect(checkFormToken([cid, "1", nonce, sig].join("."), "c1", 0, 10_000_000)).toMatchObject({ ok: false, reason: "invalid" });
    expect(checkFormToken(undefined, "c1", 0)).toMatchObject({ ok: false });
  });
});

describe("references", () => {
  it("have the documented format and are not sequential", () => {
    const refs = new Set(Array.from({ length: 2000 }, () => generateReference("give", new Date("2026-05-01"))));
    expect(refs.size).toBe(2000);
    for (const r of refs) expect(r).toMatch(/^GIVE-2026-[0-9A-HJKMNP-TV-Z]{8}$/);
  });
  it("uses an unbiased alphabet", () => {
    const counts = new Map<string, number>();
    for (const ch of randomCode(64_000)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    expect(counts.size).toBe(32);
    for (const c of counts.values()) expect(c).toBeGreaterThan(1600);
  });
});

describe("same-origin check", () => {
  const mk = (h: Record<string, string>) => new Request("http://localhost:3000/api/x", { method: "POST", headers: h });
  it("accepts the app origin and rejects others", () => {
    expect(isSameOrigin(mk({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(mk({ origin: "https://evil.example", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(mk({ host: "localhost:3000" }))).toBe(false);
  });
});
