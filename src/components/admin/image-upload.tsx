"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ImageUpload({ value, onChange, disabled }: { value: string; onChange: (url: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Images must be 5 MB or smaller");
    setBusy(true);
    try {
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
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={busy || disabled}>
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} {value ? "Replace image" : "Upload image"}
        </Button>
        {value && !disabled && <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}><X /> Remove</Button>}
        <p className="text-xs text-ink-muted">JPEG, PNG, WebP or AVIF · max 5 MB · re-encoded and stripped of metadata</p>
      </div>
    </div>
  );
}
