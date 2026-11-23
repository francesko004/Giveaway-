"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Resizes to at most 1600 px and re-encodes as WebP in the browser (fast page loads on mobile data,
 * and re-encoding also drops any EXIF/GPS metadata). Falls back to the original file if the browser
 * cannot decode it.
 */
async function downscale(file: File, max = 1600): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
    if (!blob) return file;
    const type = blob.type === "image/webp" ? "image/webp" : "image/png";
    return new File([blob], `image.${type === "image/webp" ? "webp" : "png"}`, { type });
  } catch {
    return file;
  }
}

export function ImageUpload({ value, onChange, disabled }: { value: string; onChange: (url: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (original: File) => {
    if (original.size > 20 * 1024 * 1024) return toast.error("Images must be 20 MB or smaller");
    setBusy(true);
    try {
      const file = await downscale(original);
      if (file.size > 5 * 1024 * 1024) throw new Error("Image is still larger than 5 MB after resizing — use a smaller image");
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
      onChange(data.data.url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border bg-surface-muted sm:w-48">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Prize preview" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-8 text-ink-muted" />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={busy || disabled}>
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} {value ? "Replace image" : "Upload image"}
        </Button>
        {value && !disabled && <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}><X /> Remove</Button>}
        <p className="text-xs text-ink-muted">JPEG, PNG or WebP · resized to 1600 px, metadata removed</p>
      </div>
    </div>
  );
}
