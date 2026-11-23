import { describe, expect, it } from "vitest";
import { effectiveStatus, isRegistrationOpen } from "@/services/campaign-status";
import { remaining, startOfDayInZone, utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { csvCell, toCsv } from "@/lib/csv";
import { stableStringify } from "@/lib/stable-json";

const T = (s: string) => new Date(s);
const base = { status: "ACTIVE" as const, startsAt: T("2026-06-01T08:00:00Z"), endsAt: T("2026-07-01T20:00:00Z") };

describe("campaign activation and closing", () => {
  it("is scheduled before start, active from the exact start, closed from the exact end", () => {
    expect(effectiveStatus(base, T("2026-06-01T07:59:59.999Z"))).toBe("SCHEDULED");
    expect(effectiveStatus(base, T("2026-06-01T08:00:00Z"))).toBe("ACTIVE");
    expect(effectiveStatus(base, T("2026-07-01T19:59:59.999Z"))).toBe("ACTIVE");
    expect(effectiveStatus(base, T("2026-07-01T20:00:00Z"))).toBe("CLOSED");
  });
  it("honours manual pause, manual close and the entry freeze", () => {
    const now = T("2026-06-15T00:00:00Z");
    expect(effectiveStatus({ ...base, status: "PAUSED" }, now)).toBe("PAUSED");
    expect(effectiveStatus({ ...base, closedAt: now }, now)).toBe("CLOSED");
    expect(effectiveStatus({ ...base, lockedAt: now }, now)).toBe("CLOSED");
    expect(isRegistrationOpen({ ...base, status: "PAUSED" }, now)).toBe(false);
    expect(effectiveStatus({ ...base, status: "PAUSED" }, T("2026-08-01T00:00:00Z"))).toBe("CLOSED");
  });
  it("never opens drafts", () => {
    expect(effectiveStatus({ ...base, status: "DRAFT" }, T("2026-06-15T00:00:00Z"))).toBe("DRAFT");
  });
});

describe("countdown", () => {
  it("splits the remaining time", () => {
    const now = 0;
    expect(remaining(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000, now)).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });
  it("is exactly zero at and after the boundary (never negative)", () => {
    expect(remaining(1000, 1000)).toMatchObject({ total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
    expect(remaining(1000, 5000).total).toBe(0);
    expect(remaining(1000, 1).seconds).toBe(0);
    expect(remaining(1001, 0).seconds).toBe(1);
  });
});

describe("timezone conversion (Europe/Tirane)", () => {
  it("converts summer (UTC+2) and winter (UTC+1) wall-clock times", () => {
    expect(zonedLocalToUtc("2026-07-01T18:00", "Europe/Tirane").toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-01T18:00", "Europe/Tirane").toISOString()).toBe("2026-12-01T17:00:00.000Z");
  });
  it("round-trips", () => {
    const d = T("2026-03-29T10:30:00Z"); // DST change day
    expect(zonedLocalToUtc(utcToZonedLocal(d, "Europe/Tirane"), "Europe/Tirane").toISOString()).toBe(d.toISOString());
  });
  it("finds local midnight", () => {
    expect(startOfDayInZone(T("2026-07-01T23:30:00Z"), "Europe/Tirane").toISOString()).toBe("2026-07-01T22:00:00.000Z");
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formulas and quotes properly", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+355691234567")).toBe("'+355691234567");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell('a "quoted", value')).toBe('"a ""quoted"", value"');
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a"], [["ë"]]).startsWith("﻿a\r\n")).toBe(true);
  });
});

describe("stable JSON", () => {
  it("is independent of key order", () => {
    expect(stableStringify({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(stableStringify({ a: { c: null, d: [1, { y: 2, z: 1 }] }, b: 1 }));
  });
});
