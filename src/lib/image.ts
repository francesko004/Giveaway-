/**
 * Dependency-free image validation and metadata stripping (runs on Node.js and Cloudflare Workers).
 *
 * The real format is detected from the file's magic bytes (the declared MIME type and file name are
 * ignored). Metadata that can leak personal data — EXIF (incl. GPS), XMP, comments, text chunks — is
 * removed. Only JPEG, PNG and WebP are accepted; anything else is rejected.
 */
export type ImageFormat = "jpeg" | "png" | "webp";

export const IMAGE_MIME: Record<ImageFormat, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export function detectImageFormat(b: Uint8Array): ImageFormat | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "png";
  if (b.length > 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  return null;
}

function ascii(b: Uint8Array, at: number, len: number) {
  return String.fromCharCode(...b.subarray(at, at + len));
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** JPEG: drop APP1 (EXIF/XMP), APP3–APP13 and COM segments; keep JFIF, ICC (APP2) and Adobe (APP14). */
function stripJpeg(b: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error("Corrupt JPEG");
    const marker = b[i + 1];
    if (marker === 0xd9) {
      parts.push(b.subarray(i, i + 2));
      return concat(parts);
    }
    if (marker === 0xda) {
      parts.push(b.subarray(i)); // start of scan: copy the compressed image data unchanged
      return concat(parts);
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) throw new Error("Corrupt JPEG");
    const drop = marker === 0xe1 || (marker >= 0xe3 && marker <= 0xed) || marker === 0xfe;
    if (!drop) parts.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  throw new Error("Corrupt JPEG");
}

/** PNG: drop textual/metadata chunks (tEXt, zTXt, iTXt, eXIf, tIME). */
function stripPng(b: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  while (i + 12 <= b.length) {
    const len = view.getUint32(i);
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) throw new Error("Corrupt PNG");
    if (!["tEXt", "zTXt", "iTXt", "eXIf", "tIME"].includes(type)) parts.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") return concat(parts);
  }
  throw new Error("Corrupt PNG");
}

/** WebP: drop EXIF and XMP chunks and clear their flags in the VP8X header. */
function stripWebp(b: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let i = 12;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = view.getUint32(i + 4, true);
    const end = i + 8 + len + (len % 2);
    if (i + 8 + len > b.length) throw new Error("Corrupt WebP");
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = b.slice(i, Math.min(end, b.length));
      if (type === "VP8X") chunk[8] &= ~(0x08 | 0x04);
      chunks.push(chunk);
    }
    i = end;
  }
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(b.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return concat([header, body]);
}

export function sanitizeImage(data: Uint8Array): { format: ImageFormat; data: Uint8Array } {
  const format = detectImageFormat(data);
  if (!format) throw new Error("Unsupported image format");
  const clean = format === "jpeg" ? stripJpeg(data) : format === "png" ? stripPng(data) : stripWebp(data);
  return { format, data: clean };
}
