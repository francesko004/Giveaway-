import "server-only";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { IMAGE_MIME, sanitizeImage } from "@/lib/image";
import { randomToken } from "@/lib/security/crypto";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const NAME_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * Secure image upload: the real format is detected from the bytes (declared type/name are ignored),
 * only JPEG/PNG/WebP are accepted, EXIF/GPS/XMP/text metadata is stripped, and the file gets a random
 * name. Files are stored in the database (no file system or object storage needed). The admin UI also
 * resizes and re-encodes images in the browser before uploading, so stored files are small.
 */
export async function saveImage(data: ArrayBuffer, userId?: string): Promise<string> {
  if (data.byteLength === 0) throw new AppError("EMPTY", "The file is empty", 422);
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new AppError("TOO_LARGE", "Images must be 5 MB or smaller", 413);
  let clean;
  try {
    clean = sanitizeImage(new Uint8Array(data));
  } catch {
    throw new AppError("INVALID_IMAGE", "Use a valid JPEG, PNG or WebP image", 422);
  }
  const id = randomToken(18);
  await prisma.upload.create({
    data: { id, contentType: IMAGE_MIME[clean.format], size: clean.data.length, data: clean.data as Uint8Array<ArrayBuffer>, createdById: userId ?? null },
  });
  return `/api/uploads/${id}`;
}

export async function readUpload(name: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  const id = name.replace(/\.(webp|png|jpe?g)$/i, "");
  if (!NAME_RE.test(id)) return null;
  const row = await prisma.upload.findUnique({ where: { id }, select: { data: true, contentType: true } });
  return row ? { data: row.data, contentType: row.contentType } : null;
}
