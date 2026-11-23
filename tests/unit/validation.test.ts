import { describe, expect, it } from "vitest";
import { registrationFieldsSchema, registrationRequestSchema } from "@/lib/validation/registration";
import { normalizePhone } from "@/lib/validation/phone";
import { canonicalEmail, isDisposableEmail } from "@/lib/validation/email";
import { campaignInputSchema, qrSourceInputSchema } from "@/lib/validation/admin";

const valid = { fullName: "Arta Krasniqi", phone: "069 123 4567", email: "arta@example.com", acceptTerms: true, acceptPrivacy: true };

describe("registration validation", () => {
  it("accepts a valid entry with Albanian characters", () => {
    expect(registrationFieldsSchema.safeParse({ ...valid, fullName: "Ëngjëll Çela" }).success).toBe(true);
  });

  it.each([
    ["fullName", "A", "errors.fullName.min"],
    ["fullName", "Arta", "errors.fullName.full"],
    ["fullName", "<script>x</script> y", "errors.fullName.invalid"],
    ["phone", "123", "errors.phone.invalid"],
    ["phone", "069 12", "errors.phone.invalid"],
    ["email", "not-an-email", "errors.email.invalid"],
  ])("rejects %s=%s", (field, value, message) => {
    const r = registrationFieldsSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error!.issues.find((i) => i.path[0] === field)?.message).toBe(message);
  });

  it("requires terms and privacy consent, while marketing defaults to false", () => {
    expect(registrationFieldsSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
    expect(registrationFieldsSchema.safeParse({ ...valid, acceptPrivacy: undefined }).success).toBe(false);
    expect(registrationFieldsSchema.parse(valid).marketingConsent).toBe(false);
  });

  it("restricts campaign and src identifiers", () => {
    const base = { ...valid, campaign: "summer-2026", formToken: "t" };
    expect(registrationRequestSchema.safeParse(base).success).toBe(true);
    expect(registrationRequestSchema.safeParse({ ...base, campaign: "../admin" }).success).toBe(false);
    expect(registrationRequestSchema.safeParse({ ...base, src: "poster01" }).success).toBe(true);
    expect(registrationRequestSchema.safeParse({ ...base, src: "<x>" }).success).toBe(false);
  });
});

describe("phone numbers", () => {
  it.each([
    ["0691234567", "+355691234567"],
    ["069 123 4567", "+355691234567"],
    ["+355 69 123 4567", "+355691234567"],
    ["00355691234567", "+355691234567"],
    ["042 222 333", "+35542222333"],
    ["+39 312 345 6789", "+393123456789"],
    ["+383 44 123 456", "+38344123456"],
  ])("normalises %s", (raw, e164) => {
    expect(normalizePhone(raw)?.e164).toBe(e164);
  });
  it("rejects invalid numbers", () => {
    expect(normalizePhone("0000")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("e-mail canonicalisation", () => {
  it("detects provider aliases", () => {
    expect(canonicalEmail("A.Rta+promo@GMAIL.com")).toBe("arta@gmail.com");
    expect(canonicalEmail("arta@googlemail.com")).toBe("arta@gmail.com");
    expect(canonicalEmail("arta+x@outlook.com")).toBe("arta@outlook.com");
    expect(canonicalEmail("ar.ta+x@company.al")).toBe("ar.ta+x@company.al");
  });
  it("flags disposable domains", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@gmail.com")).toBe(false);
  });
});

describe("admin validation", () => {
  const campaign = {
    title: "Summer",
    slug: "summer",
    description: "A long enough description",
    prizeName: "Car",
    prizeDescription: "A car",
    startsAt: "2026-06-01T10:00",
    endsAt: "2026-07-01T10:00",
    drawAt: "2026-07-02T10:00",
    winnerCount: 1,
    alternateCount: 2,
  };
  it("accepts a valid campaign and checks date ordering", () => {
    expect(campaignInputSchema.safeParse(campaign).success).toBe(true);
    expect(campaignInputSchema.safeParse({ ...campaign, endsAt: "2026-05-01T10:00" }).success).toBe(false);
    expect(campaignInputSchema.safeParse({ ...campaign, drawAt: "2026-06-15T10:00" }).success).toBe(false);
  });
  it("rejects external images and open-redirect QR destinations", () => {
    expect(campaignInputSchema.safeParse({ ...campaign, prizeImage: "javascript:alert(1)" }).success).toBe(false);
    for (const d of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:x"]) {
      expect(qrSourceInputSchema.safeParse({ name: "x1", slug: "x1", destination: d }).success).toBe(false);
    }
    expect(qrSourceInputSchema.safeParse({ name: "x1", slug: "x1", destination: "/giveaway/summer" }).success).toBe(true);
  });
});
