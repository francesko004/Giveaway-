import { readUpload } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const upload = await readUpload(file);
  if (!upload) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(upload.data), {
    headers: {
      "content-type": upload.contentType,
      // File names are random and never reused, so the CDN and browsers can cache forever.
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
