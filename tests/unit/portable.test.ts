import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { argon2id } from "@noble/hashes/argon2.js";
import { hashPassword, needsRehash, verifyPassword } from "@/lib/auth/hash";
import { detectImageFormat, sanitizeImage } from "@/lib/image";
import { toXlsx } from "@/lib/xlsx";

describe("portable password hashing (Node + Workers)", () => {
  it("hashes with chained PBKDF2-SHA256 (600k total, ≤100k per WebCrypto call — the Workers limit) and verifies", async () => {
    const calls: number[] = [];
    const orig = crypto.subtle.deriveBits.bind(crypto.subtle);
    const spy = vi.spyOn(crypto.subtle, "deriveBits").mockImplementation(async (alg, key, len) => {
      calls.push((alg as Pbkdf2Params).iterations);
      return orig(alg, key, len);
    });
    const h = await hashPassword("correct horse battery 9");
    spy.mockRestore();
    expect(calls).toEqual([100_000, 100_000, 100_000, 100_000, 100_000, 100_000]);
    expect(h).toMatch(/^\$pbkdf2c-sha256\$i=600000\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
    expect(await verifyPassword(h, "correct horse battery 9")).toBe(true);
    expect(await verifyPassword(h, "correct horse battery 8")).toBe(false);
    expect(needsRehash(h)).toBe(false);
  });

  it("uses a random salt", async () => {
    expect(await hashPassword("same-password-123")).not.toBe(await hashPassword("same-password-123"));
  });

  it("still verifies legacy Argon2id PHC hashes and flags them for upgrade", async () => {
    const salt = new Uint8Array(16).fill(7);
    const hash = argon2id(new TextEncoder().encode("legacy-password-1"), salt, { m: 1024, t: 2, p: 1, dkLen: 32 });
    const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64").replace(/=+$/, "");
    const phc = `$argon2id$v=19$m=1024,t=2,p=1$${b64(salt)}$${b64(hash)}`;
    expect(await verifyPassword(phc, "legacy-password-1")).toBe(true);
    expect(await verifyPassword(phc, "legacy-password-2")).toBe(false);
    expect(needsRehash(phc)).toBe(true);
  });

  it("verifies older single-call PBKDF2 hashes even where WebCrypto rejects >100k iterations, and flags them for upgrade", async () => {
    const { pbkdf2 } = await import("@noble/hashes/pbkdf2.js");
    const { sha256 } = await import("@noble/hashes/sha2.js");
    const salt = new Uint8Array(16).fill(3);
    const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64").replace(/=+$/, "");
    const legacy = ["", "pbkdf2-sha256", "i=600000", b64(salt), b64(pbkdf2(sha256, "old-password-12", salt, { c: 600_000, dkLen: 32 }))].join("$");
    expect(await verifyPassword(legacy, "old-password-12")).toBe(true);
    // Simulate Cloudflare Workers: WebCrypto refuses more than 100 000 iterations per call.
    const orig = crypto.subtle.deriveBits.bind(crypto.subtle);
    const spy = vi.spyOn(crypto.subtle, "deriveBits").mockImplementation(async (alg, key, len) => {
      if ((alg as Pbkdf2Params).iterations > 100_000) throw new Error("Pbkdf2 failed: iteration counts above 100000 are not supported");
      return orig(alg, key, len);
    });
    expect(await verifyPassword(legacy, "old-password-12")).toBe(true);
    expect(await verifyPassword(legacy, "wrong-password-12")).toBe(false);
    expect(await verifyPassword(await hashPassword("new-password-12"), "new-password-12")).toBe(true);
    spy.mockRestore();
    expect(needsRehash(legacy)).toBe(true);
  });

  it("rejects malformed hashes and absurd parameters", async () => {
    expect(await verifyPassword("", "x")).toBe(false);
    expect(await verifyPassword("$pbkdf2-sha256$i=1$AAAA$AAAA", "x")).toBe(false);
    expect(await verifyPassword("plaintext", "plaintext")).toBe(false);
  });
});

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const seg = (marker: number, payload: number[]) => [0xff, marker, ((payload.length + 2) >> 8) & 0xff, (payload.length + 2) & 0xff, ...payload];

describe("image sanitising", () => {
  it("strips EXIF (APP1) and comments from JPEG but keeps JFIF and image data", () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8,
      ...seg(0xe0, ascii("JFIF\0\x01\x01")),
      ...seg(0xe1, ascii("Exif\0\0GPS-LATITUDE-41.3275")),
      ...seg(0xfe, ascii("secret comment")),
      ...seg(0xdb, [0, 1, 2, 3]),
      0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x55, 0x66, 0x77, 0xff, 0xd9,
    ]);
    const out = sanitizeImage(jpeg);
    expect(out.format).toBe("jpeg");
    const text = Buffer.from(out.data).toString("latin1");
    expect(text).toContain("JFIF");
    expect(text).not.toContain("GPS-LATITUDE");
    expect(text).not.toContain("secret comment");
    expect(Array.from(out.data.slice(-5))).toEqual(Array.from(jpeg.slice(-5))); // scan data untouched
  });

  it("strips text and EXIF chunks from PNG", () => {
    const chunk = (type: string, data: number[]) => {
      const len = [0, 0, 0, data.length];
      return [...len, ...ascii(type), ...data, 0, 0, 0, 0];
    };
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...chunk("IHDR", new Array(13).fill(1)),
      ...chunk("tEXt", ascii("Author\0Jane Doe")),
      ...chunk("eXIf", ascii("GPSDATA")),
      ...chunk("IDAT", [1, 2, 3]),
      ...chunk("IEND", []),
    ]);
    const text = Buffer.from(sanitizeImage(png).data).toString("latin1");
    expect(text).toContain("IHDR");
    expect(text).toContain("IDAT");
    expect(text).not.toContain("Jane Doe");
    expect(text).not.toContain("GPSDATA");
  });

  it("strips EXIF/XMP from WebP, clears the VP8X flags and fixes the RIFF size", () => {
    const chunk = (type: string, data: number[]) => {
      const len = data.length;
      return [...ascii(type), len & 0xff, (len >> 8) & 0xff, 0, 0, ...data, ...(len % 2 ? [0] : [])];
    };
    const body = [...ascii("WEBP"), ...chunk("VP8X", [0x0c, 0, 0, 0, 1, 0, 0, 1, 0, 0]), ...chunk("VP8 ", [9, 9, 9, 9]), ...chunk("EXIF", ascii("GPS!")), ...chunk("XMP ", ascii("<xmp/>"))];
    const webp = new Uint8Array([...ascii("RIFF"), body.length & 0xff, (body.length >> 8) & 0xff, 0, 0, ...body]);
    const out = sanitizeImage(webp).data;
    const text = Buffer.from(out).toString("latin1");
    expect(text).not.toContain("GPS!");
    expect(text).not.toContain("<xmp/>");
    expect(out[20] & 0x0c).toBe(0); // VP8X flags byte
    expect(new DataView(out.buffer, out.byteOffset).getUint32(4, true)).toBe(out.length - 8);
  });

  it("rejects anything that is not a JPEG, PNG or WebP regardless of the declared type", () => {
    expect(detectImageFormat(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageFormat(new TextEncoder().encode("GIF89a...."))).toBeNull();
    expect(() => sanitizeImage(new TextEncoder().encode("<html><script>x</script>"))).toThrow();
    expect(() => sanitizeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00]))).toThrow();
  });
});

describe("XLSX writer", () => {
  it("produces a workbook Excel libraries can read, with a bold header and formula-safe cells", async () => {
    const bytes = toXlsx("Participants", ["Reference", "Name", "Phone"], [
      ["MEGA-2026-AAAA1111", "Ëngjëll Çela", "+355691234567"],
      ["MEGA-2026-BBBB2222", "=HYPERLINK(\"http://evil\")", null],
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Participants")!;
    expect(ws.getRow(1).values).toEqual([undefined, "Reference", "Name", "Phone"]);
    expect(ws.getCell("A1").font?.bold).toBe(true);
    expect(ws.getCell("B2").value).toBe("Ëngjëll Çela");
    expect(ws.getCell("C2").value).toBe("'+355691234567");
    expect(ws.getCell("B3").value).toBe(`'=HYPERLINK("http://evil")`);
    expect(ws.getCell("B3").formula).toBeUndefined();
  });
});
