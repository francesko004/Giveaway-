import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/admin/auth/login/route";
import { POST as createCampaign } from "@/app/api/admin/campaigns/route";
import { POST as campaignStatus } from "@/app/api/admin/campaigns/[id]/status/route";
import { POST as drawAction } from "@/app/api/admin/campaigns/[id]/draw/route";
import { GET as exportParticipants } from "@/app/api/admin/participants/export/route";
import { PATCH as patchParticipant } from "@/app/api/admin/participants/[id]/route";
import { POST as invalidate } from "@/app/api/admin/draws/[id]/invalidate/route";
import { PATCH as patchSettings } from "@/app/api/admin/settings/route";
import { POST as register } from "@/app/api/register/route";
import { GET as proof } from "@/app/api/verify/[campaignId]/proof/route";
import { GET as qrRedirect } from "@/app/q/[code]/route";
import { createSession } from "@/lib/auth/session";
import { makeCampaign, makeUser, prisma, registration, resetDb, seedParticipants } from "../helpers";

const ORIGIN = "http://localhost:3000";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = (params: Record<string, string> = {}) => ({ params: Promise.resolve(params as any) });

function req(path: string, init: { method?: string; body?: unknown; cookie?: string; origin?: string | null } = {}) {
  const headers = new Headers({ "content-type": "application/json", "user-agent": "vitest" });
  if (init.origin !== null) headers.set("origin", init.origin ?? ORIGIN);
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`${ORIGIN}${path}`, { method: init.method ?? "POST", headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
}

async function cookieFor(role: "SUPER_ADMIN" | "ADMIN" | "VIEWER") {
  const user = await makeUser(role);
  const { token } = await createSession(user.id, {}, 1);
  return `gv_session=${token}`;
}

const campaignBody = {
  title: "API Campaign",
  slug: "api-campaign",
  description: "Created through the API in tests",
  prizeName: "Prize",
  prizeDescription: "Prize description",
  startsAt: "2030-01-01T10:00",
  endsAt: "2030-02-01T10:00",
  drawAt: "2030-02-02T10:00",
  winnerCount: 1,
  alternateCount: 1,
  translations: {},
};

describe("admin API authorization", () => {
  beforeEach(resetDb);

  it("rejects unauthenticated access to every protected endpoint", async () => {
    const c = await makeCampaign();
    const p = (await seedParticipants(c.id, 1))[0];
    const participant = await prisma.participant.findUniqueOrThrow({ where: { referenceNumber: p.referenceNumber } });
    const calls: Response[] = [
      await createCampaign(req("/api/admin/campaigns", { body: campaignBody }), ctx()),
      await campaignStatus(req(`/api/admin/campaigns/${c.id}/status`, { body: { action: "close" } }), ctx({ id: c.id })),
      await drawAction(req(`/api/admin/campaigns/${c.id}/draw`, { body: { action: "commit", confirm: true } }), ctx({ id: c.id })),
      await exportParticipants(req("/api/admin/participants/export", { method: "GET" }), ctx()),
      await patchParticipant(req(`/api/admin/participants/${participant.id}`, { method: "PATCH", body: { status: "INVALID", reason: "trying without auth" } }), ctx({ id: participant.id })),
      await patchSettings(req("/api/admin/settings", { method: "PATCH", body: {} }), ctx()),
    ];
    for (const r of calls) expect(r.status).toBe(401);
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("ACTIVE");
  });

  it("rejects forged or expired session tokens", async () => {
    const r = await createCampaign(req("/api/admin/campaigns", { body: campaignBody, cookie: "gv_session=forged-token-forged-token-forged" }), ctx());
    expect(r.status).toBe(401);
    const user = await makeUser("ADMIN");
    const { token } = await createSession(user.id, {}, 1);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await createCampaign(req("/api/admin/campaigns", { body: campaignBody, cookie: `gv_session=${token}` }), ctx())).status).toBe(401);
  });

  it("enforces roles: viewers are read-only, only super admins change settings or invalidate draws", async () => {
    const viewer = await cookieFor("VIEWER");
    expect((await createCampaign(req("/api/admin/campaigns", { body: campaignBody, cookie: viewer }), ctx())).status).toBe(403);
    expect((await exportParticipants(req("/api/admin/participants/export", { method: "GET", cookie: viewer }), ctx())).status).toBe(403);
    const admin = await cookieFor("ADMIN");
    expect((await patchSettings(req("/api/admin/settings", { method: "PATCH", body: {}, cookie: admin }), ctx())).status).toBe(403);
    expect((await invalidate(req("/api/admin/draws/x/invalidate", { body: { reason: "some long reason here" }, cookie: admin }), ctx({ id: "x" }))).status).toBe(403);
    const created = await createCampaign(req("/api/admin/campaigns", { body: campaignBody, cookie: admin }), ctx());
    expect(created.status).toBe(201);
  });

  it("blocks cross-site (CSRF) mutations even with a valid session", async () => {
    const admin = await cookieFor("ADMIN");
    expect((await createCampaign(req("/api/admin/campaigns", { body: campaignBody, cookie: admin, origin: "https://evil.example" }), ctx())).status).toBe(403);
    expect((await createCampaign(req("/api/admin/campaigns", { body: campaignBody, cookie: admin, origin: null }), ctx())).status).toBe(403);
  });

  it("validates input and never leaks internals", async () => {
    const admin = await cookieFor("ADMIN");
    const r = await createCampaign(req("/api/admin/campaigns", { body: { ...campaignBody, slug: "Bad Slug!" }, cookie: admin }), ctx());
    expect(r.status).toBe(422);
    const body = await r.json();
    expect(JSON.stringify(body)).not.toMatch(/prisma|stack|postgres/i);
  });

  it("audits every administrative change", async () => {
    const admin = await cookieFor("ADMIN");
    const res = await createCampaign(req("/api/admin/campaigns", { body: campaignBody, cookie: admin }), ctx());
    const { data } = await res.json();
    await campaignStatus(req(`/api/admin/campaigns/${data.id}/status`, { body: { action: "publish" }, cookie: admin }), ctx({ id: data.id }));
    const actions = (await prisma.auditLog.findMany({ where: { campaignId: data.id }, orderBy: { seq: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["campaign.created", "campaign.publish"]);
  });
});

describe("login", () => {
  beforeEach(resetDb);

  it("signs in with correct credentials and sets an HttpOnly session cookie", async () => {
    await makeUser("ADMIN", "a@test.local", "correct-horse-battery-9");
    const r = await login(req("/api/admin/auth/login", { body: { email: "A@test.local", password: "correct-horse-battery-9" } }));
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/gv_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it("uses the same error for unknown users and wrong passwords, and locks after 5 failures", async () => {
    await makeUser("ADMIN", "b@test.local", "correct-horse-battery-9");
    const unknown = await (await login(req("/api/admin/auth/login", { body: { email: "nobody@test.local", password: "x" } }))).json();
    const wrong = await (await login(req("/api/admin/auth/login", { body: { email: "b@test.local", password: "x" } }))).json();
    expect(unknown.error.message).toBe(wrong.error.message);
    for (let i = 0; i < 4; i++) await login(req("/api/admin/auth/login", { body: { email: "b@test.local", password: "x" } }));
    const locked = await login(req("/api/admin/auth/login", { body: { email: "b@test.local", password: "correct-horse-battery-9" } }));
    expect(locked.status).toBe(423);
  });
});

describe("participant export", () => {
  beforeEach(resetDb);

  it("exports filtered CSV with formula-injection protection and audits the export", async () => {
    const c = await makeCampaign();
    await prisma.participant.create({
      data: { campaignId: c.id, fullName: "=HYPERLINK(\"http://evil\")", email: "x@example.com", emailCanonical: "x@example.com", phone: "+355691111111", referenceNumber: "GIVE-2026-CSV00001", termsVersion: "1", privacyVersion: "1" },
    });
    const other = await makeCampaign();
    await seedParticipants(other.id, 2, "OTH");
    const admin = await cookieFor("ADMIN");
    const r = await exportParticipants(req(`/api/admin/participants/export?campaign=${c.id}&format=csv`, { method: "GET", cookie: admin }), ctx());
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text.split("\r\n").filter(Boolean)).toHaveLength(2); // header + 1 row (filtered)
    expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(await prisma.auditLog.count({ where: { action: "participants.exported" } })).toBe(1);

    const x = await exportParticipants(req(`/api/admin/participants/export?format=xlsx`, { method: "GET", cookie: admin }), ctx());
    expect(x.headers.get("content-type")).toContain("spreadsheetml");
    expect((await x.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });
});

describe("public endpoints", () => {
  beforeEach(resetDb);

  it("registration endpoint rejects cross-site posts and returns a reference", async () => {
    const c = await makeCampaign();
    expect((await register(req("/api/register", { body: registration(c), origin: "https://evil.example" }))).status).toBe(403);
    const ok = await register(req("/api/register", { body: registration(c) }));
    expect(ok.status).toBe(201);
    expect((await ok.json()).data.referenceNumber).toMatch(/^GIVE-/);
  });

  it("QR redirect tracks the scan and only redirects to same-origin paths", async () => {
    const c = await makeCampaign();
    await prisma.qRSource.create({ data: { campaignId: c.id, name: "Shop", slug: "shop01", code: "shop001", destination: `/giveaway/${c.slug}` } });
    const r = await qrRedirect(new Request(`${ORIGIN}/q/shop001`, { headers: { "user-agent": "Mozilla/5.0" } }), ctx({ code: "shop001" }));
    expect(r.status).toBe(302);
    const loc = new URL(r.headers.get("location")!);
    expect(loc.origin).toBe(ORIGIN);
    expect(loc.pathname).toBe(`/giveaway/${c.slug}`);
    expect(loc.searchParams.get("src")).toBe("shop01");
    expect(await prisma.pageVisit.count({ where: { kind: "SCAN" } })).toBe(1);
    const unknown = await qrRedirect(new Request(`${ORIGIN}/q/nope123`), ctx({ code: "nope123" }));
    expect(new URL(unknown.headers.get("location")!).pathname).toBe("/giveaway");
  });

  it("public proof contains no personal data", async () => {
    const c = await makeCampaign({ status: "CLOSED" });
    await seedParticipants(c.id, 3);
    const r = await proof(new Request(`${ORIGIN}/api/verify/${c.id}/proof`), ctx({ campaignId: c.id }));
    expect(JSON.stringify(await r.json())).not.toMatch(/@example\.com|\+3556900|Participant /);
  });
});
