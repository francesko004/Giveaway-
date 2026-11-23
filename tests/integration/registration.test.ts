import { beforeEach, describe, expect, it } from "vitest";
import { registerParticipant } from "@/services/participants";
import { issueFormToken } from "@/lib/security/form-token";
import { headers, makeCampaign, prisma, registration, resetDb } from "../helpers";

describe("registration", () => {
  beforeEach(resetDb);

  it("registers a valid entry with consent records and a secure reference", async () => {
    const c = await makeCampaign();
    const res = await registerParticipant(registration(c, { marketingConsent: true }), headers());
    expect(res.referenceNumber).toMatch(/^GIVE-\d{4}-[0-9A-HJKMNP-TV-Z]{8}$/);
    const p = await prisma.participant.findUniqueOrThrow({ where: { referenceNumber: res.referenceNumber }, include: { consents: true } });
    expect(p.phone).toMatch(/^\+3556/);
    expect(p.status).toBe("ELIGIBLE");
    expect(p.ipHash).toBeTruthy();
    expect(p.ipHash).not.toContain("203.0.113.7");
    expect(p.consents.map((c) => `${c.consentType}:${c.accepted}`).sort()).toEqual(["MARKETING:true", "PRIVACY:true", "TERMS:true"]);
  });

  it("normalises Albanian phone formats and rejects invalid numbers", async () => {
    const c = await makeCampaign();
    const res = await registerParticipant(registration(c, { phone: "+355 69 222 3344" }), headers());
    const p = await prisma.participant.findUniqueOrThrow({ where: { referenceNumber: res.referenceNumber } });
    expect(p.phone).toBe("+355692223344");
    await expect(registerParticipant(registration(c, { phone: "12345" }), headers())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  describe("duplicate prevention", () => {
    it("rejects the same e-mail (case-insensitive, gmail dots/aliases)", async () => {
      const c = await makeCampaign();
      await registerParticipant(registration(c, { email: "arta.krasniqi@gmail.com" }), headers());
      for (const email of ["ARTA.KRASNIQI@gmail.com", "artakrasniqi@gmail.com", "arta.krasniqi+promo@googlemail.com"]) {
        await expect(registerParticipant(registration(c, { email }), headers())).rejects.toMatchObject({ code: "DUPLICATE" });
      }
    });

    it("rejects the same phone number written differently", async () => {
      const c = await makeCampaign();
      await registerParticipant(registration(c, { phone: "0692223344" }), headers());
      await expect(registerParticipant(registration(c, { phone: "+355 69 222 3344" }), headers())).rejects.toMatchObject({ code: "DUPLICATE" });
      await expect(registerParticipant(registration(c, { phone: "00355692223344" }), headers())).rejects.toMatchObject({ code: "DUPLICATE" });
    });

    it("allows the same person in a different campaign", async () => {
      const a = await makeCampaign();
      const b = await makeCampaign();
      await registerParticipant(registration(a, { email: "same@example.com", phone: "0692223344" }), headers());
      await expect(registerParticipant(registration(b, { email: "same@example.com", phone: "0692223344" }), headers())).resolves.toBeTruthy();
    });

    it("holds under concurrent submissions (DB unique constraints)", async () => {
      const c = await makeCampaign();
      const body = registration(c, { email: "race@example.com", phone: "0695556677" });
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => registerParticipant({ ...body }, headers())));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.participant.count({ where: { campaignId: c.id } })).toBe(1);
    });
  });

  describe("campaign window (server-side, independent of the browser countdown)", () => {
    it("rejects entries after the end time", async () => {
      const c = await makeCampaign({ startsAt: new Date(Date.now() - 7200_000), endsAt: new Date(Date.now() - 1000), drawAt: new Date() });
      await expect(registerParticipant(registration(c), headers())).rejects.toMatchObject({ code: "CLOSED" });
    });

    it("rejects entries exactly at the end boundary but accepts 1 ms before", async () => {
      const end = new Date(Date.now() + 3600_000);
      const c = await makeCampaign({ endsAt: end, drawAt: end });
      await expect(registerParticipant(registration(c), headers(), new Date(end.getTime()))).rejects.toMatchObject({ code: "CLOSED" });
      await expect(registerParticipant(registration(c), headers("198.51.100.1"), new Date(end.getTime() - 1))).resolves.toBeTruthy();
    });

    it("rejects entries before the start, while paused, when closed manually and for drafts", async () => {
      const scheduled = await makeCampaign({ status: "SCHEDULED", startsAt: new Date(Date.now() + 3600_000) });
      await expect(registerParticipant(registration(scheduled), headers())).rejects.toMatchObject({ code: "NOT_STARTED" });
      const paused = await makeCampaign({ status: "PAUSED" });
      await expect(registerParticipant(registration(paused), headers())).rejects.toMatchObject({ code: "PAUSED" });
      const closed = await makeCampaign({ status: "CLOSED", closedAt: new Date() });
      await expect(registerParticipant(registration(closed), headers())).rejects.toMatchObject({ code: "CLOSED" });
      const draft = await makeCampaign({ status: "DRAFT" });
      await expect(registerParticipant(registration(draft), headers())).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("is blocked by the database once the entry list is frozen, even if the app check were bypassed", async () => {
      const c = await makeCampaign();
      await prisma.campaign.update({ where: { id: c.id }, data: { lockedAt: new Date() } });
      await expect(
        prisma.participant.create({
          data: { campaignId: c.id, fullName: "Late Entry", email: "late@example.com", emailCanonical: "late@example.com", referenceNumber: "GIVE-2026-LATE0001", termsVersion: "1", privacyVersion: "1" },
        }),
      ).rejects.toThrow(/GV_LOCKED/);
    });
  });

  describe("bot protection", () => {
    it("rejects a filled honeypot", async () => {
      const c = await makeCampaign();
      await expect(registerParticipant(registration(c, { website: "http://spam" }), headers())).rejects.toMatchObject({ code: "REJECTED" });
    });

    it("rejects missing, forged or foreign form tokens", async () => {
      const c = await makeCampaign();
      const other = await makeCampaign();
      await expect(registerParticipant(registration(c, { formToken: "" }), headers())).rejects.toMatchObject({ code: "REJECTED" });
      await expect(registerParticipant(registration(c, { formToken: "a.b.c.d" }), headers())).rejects.toMatchObject({ code: "REJECTED" });
      await expect(registerParticipant(registration(c, { formToken: issueFormToken(other.id, Date.now() - 10_000) }), headers())).rejects.toMatchObject({ code: "REJECTED" });
    });

    it("rejects instant submissions when a minimum fill time is configured", async () => {
      await prisma.siteSettings.update({ where: { id: 1 }, data: { minFormFillSeconds: 3 } });
      const c = await makeCampaign();
      await expect(registerParticipant(registration(c, { formToken: issueFormToken(c.id, Date.now()) }), headers())).rejects.toMatchObject({ code: "TOO_FAST" });
    });

    it("rate-limits bursts from one network", async () => {
      const c = await makeCampaign();
      const outcomes = [];
      for (let i = 0; i < 7; i++) outcomes.push(await registerParticipant(registration(c), headers("192.0.2.50")).then(() => "ok", (e) => e.code));
      expect(outcomes.slice(0, 5)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
      expect(outcomes.slice(5)).toEqual(["RATE_LIMITED", "RATE_LIMITED"]);
    });

    it("flags many entries from the same network for review instead of silently accepting them", async () => {
      const c = await makeCampaign({ settings: { cityField: "optional", minAge: null, allowedPhoneCountries: [], maxEntriesPerIp: 2, sendConfirmationEmail: false } });
      const refs = [];
      for (let i = 0; i < 3; i++) refs.push((await registerParticipant(registration(c), headers("192.0.2.77"))).referenceNumber);
      const last = await prisma.participant.findUniqueOrThrow({ where: { referenceNumber: refs[2] } });
      expect(last.status).toBe("FLAGGED");
      expect(last.flags).toContain("many_entries_same_network");
    });

    it("flags disposable e-mail domains", async () => {
      const c = await makeCampaign();
      const r = await registerParticipant(registration(c, { email: "x@mailinator.com" }), headers());
      expect((await prisma.participant.findUniqueOrThrow({ where: { referenceNumber: r.referenceNumber } })).status).toBe("FLAGGED");
    });
  });

  describe("QR source attribution", () => {
    it("attributes entries to an active source of the same campaign", async () => {
      const c = await makeCampaign();
      const src = await prisma.qRSource.create({ data: { campaignId: c.id, name: "Poster 1", slug: "poster01", code: "abc1234", destination: "/giveaway" } });
      const r = await registerParticipant(registration(c, { src: "poster01", utm: { source: "qr", medium: "print" } }), headers());
      const p = await prisma.participant.findUniqueOrThrow({ where: { referenceNumber: r.referenceNumber } });
      expect(p.qrSourceId).toBe(src.id);
      expect(p.utmSource).toBe("qr");
      expect(p.utmMedium).toBe("print");
    });

    it("ignores unknown, disabled or foreign sources (no cross-campaign manipulation)", async () => {
      const c = await makeCampaign();
      const other = await makeCampaign();
      await prisma.qRSource.create({ data: { campaignId: other.id, name: "Other", slug: "foreign", code: "zzz9999", destination: "/giveaway" } });
      await prisma.qRSource.create({ data: { campaignId: c.id, name: "Off", slug: "off", code: "off0001", destination: "/giveaway", active: false } });
      for (const src of ["unknown", "foreign", "off"]) {
        const r = await registerParticipant(registration(c, { src }), headers(`198.51.100.${src.length}`));
        const p = await prisma.participant.findUniqueOrThrow({ where: { referenceNumber: r.referenceNumber } });
        expect(p.qrSourceId).toBeNull();
        expect(p.campaignId).toBe(c.id);
      }
    });

    it("rejects src values that are not plain identifiers", async () => {
      const c = await makeCampaign();
      await expect(registerParticipant(registration(c, { src: "x' OR 1=1 --" }), headers())).rejects.toMatchObject({ code: "VALIDATION" });
    });
  });

  describe("configurable fields & eligibility", () => {
    it("enforces a required city and age confirmation", async () => {
      const c = await makeCampaign({ settings: { cityField: "required", minAge: 18, allowedPhoneCountries: [], maxEntriesPerIp: 100, sendConfirmationEmail: false } });
      await expect(registerParticipant(registration(c, { city: "" }), headers())).rejects.toMatchObject({ details: { fields: { city: "errors.city.required", ageConfirmed: "errors.age.required" } } });
      const ok = await registerParticipant(registration(c, { ageConfirmed: true }), headers());
      const consents = await prisma.consentRecord.findMany({ where: { participant: { referenceNumber: ok.referenceNumber } } });
      expect(consents.some((x) => x.consentType === "AGE")).toBe(true);
    });

    it("restricts phone countries when configured", async () => {
      const c = await makeCampaign({ settings: { cityField: "optional", minAge: null, allowedPhoneCountries: ["AL"], maxEntriesPerIp: 100, sendConfirmationEmail: false } });
      await expect(registerParticipant(registration(c, { phone: "+39 312 345 6789" }), headers())).rejects.toMatchObject({ details: { fields: { phone: "errors.phone.country" } } });
    });

    it("requires both terms and privacy acceptance", async () => {
      const c = await makeCampaign();
      await expect(registerParticipant(registration(c, { acceptTerms: false }), headers())).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(registerParticipant(registration(c, { acceptPrivacy: false }), headers())).rejects.toMatchObject({ code: "VALIDATION" });
    });
  });
});
