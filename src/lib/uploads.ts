import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/security/crypto";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif"]);
const NAME_RE = /^[A-Za-z0-9_-]{16,64}\.webp$/;

function uploadDir() {
  return path.resolve(env().UPLOAD_DIR);
}

/**
 * Secure image upload: the content is decoded by sharp (the declared MIME type and file name are
 * ignored), must be a real raster image of an accepted format, and is RE-ENCODED to WebP. This strips
 * EXIF/GPS metadata and neutralises polyglot files. Files get random names outside the web root.
 */
export async function saveImage(data: ArrayBuffer): Promise<string> {
  if (data.byteLength === 0) throw new AppError("EMPTY", "The file is empty", 422);
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new AppError("TOO_LARGE", "Images must be 5 MB or smaller", 413);
  let meta;
  try {
    meta = await sharp(Buffer.from(data), { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new AppError("INVALID_IMAGE", "The file is not a valid image", 422);
  }
  if (!meta.format || !ACCEPTED.has(meta.format)) throw new AppError("INVALID_IMAGE", "Use a JPEG, PNG, WebP or AVIF image", 422);
  const output = await sharp(Buffer.from(data), { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer();
  const name = `${randomToken(18)}.webp`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), output, { mode: 0o640 });
  return `/api/uploads/${name}`;
}

export async function readUpload(name: string): Promise<Buffer | null> {
  if (!NAME_RE.test(name)) return null;
  const full = path.join(uploadDir(), name);
  if (path.dirname(full) !== uploadDir()) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}
