"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Loader2, Pencil, Plus, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { EmptyState, Field } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { api } from "./api";

export interface QrRow {
  id: string;
  name: string;
  slug: string;
  code: string;
  type: string;
  destination: string;
  active: boolean;
  notes: string | null;
  stableUrl: string;
  preview: string;
  scans: number;
  visitors: number;
  registrations: number;
  conversion: number | null;
}

const TYPES = ["LOCATION", "POSTER", "SOCIAL", "PARTNER", "EVENT", "OTHER"];

export function QrManager({ campaignId, campaignSlug, rows, canEdit }: { campaignId: string; campaignSlug: string; rows: QrRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<QrRow | "new" | null>(null);

  const toggle = async (row: QrRow, active: boolean) => {
    try {
      await api(`/api/admin/qr/${row.id}`, "PATCH", { active });
      toast.success(active ? "QR code enabled" : "QR code disabled — scans now go to the main page without attribution");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">Each code prints a <strong>stable URL</strong> (<code>/q/…</code>). You can change where it leads without reprinting.</p>
        {canEdit && <Button onClick={() => setEditing("new")}><Plus /> New QR code</Button>}
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon={<QrCode className="size-5" />} title="No QR codes yet" description="Create one code per physical location, poster, partner or channel to compare their performance." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} className={`flex flex-col p-5 ${r.active ? "" : "opacity-70"}`}>
              <div className="flex gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.preview} alt={`QR code for ${r.name}`} className="size-28 shrink-0 rounded-lg border bg-white p-1" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-navy">{r.name}</p>
                    <Badge variant={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Disabled"}</Badge>
                  </div>
                  <p className="text-xs text-ink-muted">{r.type.toLowerCase()} · src=<code>{r.slug}</code></p>
                  <button className="flex max-w-full items-center gap-1 truncate text-left font-mono text-xs text-brand hover:underline" onClick={() => { navigator.clipboard.writeText(r.stableUrl); toast.success("URL copied"); }}>
                    <Copy className="size-3 shrink-0" /> <span className="truncate">{r.stableUrl}</span>
                  </button>
                  <p className="truncate text-xs text-ink-muted">→ {r.destination}?src={r.slug}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-surface-muted p-3 text-center">
                <div><dt className="text-[11px] text-ink-muted uppercase">Scans</dt><dd className="font-semibold tabular-nums">{r.scans}</dd></div>
                <div><dt className="text-[11px] text-ink-muted uppercase">Visitors</dt><dd className="font-semibold tabular-nums">{r.visitors}</dd></div>
                <div><dt className="text-[11px] text-ink-muted uppercase">Entries</dt><dd className="font-semibold tabular-nums">{r.registrations}</dd></div>
                <div><dt className="text-[11px] text-ink-muted uppercase">Conv.</dt><dd className="font-semibold tabular-nums">{r.conversion === null ? "—" : `${Math.round(r.conversion * 100)}%`}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline"><a href={`/api/admin/qr/${r.id}/image?format=png&size=2048&download=1`}><Download /> PNG</a></Button>
                <Button asChild size="sm" variant="outline"><a href={`/api/admin/qr/${r.id}/image?format=svg&download=1`}><Download /> SVG</a></Button>
                <Button asChild size="sm" variant="outline"><a href={`/admin/print/qr/${r.id}`} target="_blank"><Printer /> Print</a></Button>
                {canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing(r)}><Pencil /> Edit</Button>}
                {canEdit && (
                  <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
                    Active <Switch checked={r.active} onCheckedChange={(c) => toggle(r, c)} aria-label={`Toggle ${r.name}`} />
                  </label>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <QrDialog campaignId={campaignId} campaignSlug={campaignSlug} row={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function QrDialog({ campaignId, campaignSlug, row, onClose }: { campaignId: string; campaignSlug: string; row: QrRow | "new" | null; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isNew = row === "new";
  const r = row && row !== "new" ? row : null;
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      if (isNew) await api(`/api/admin/campaigns/${campaignId}/qr`, "POST", fd);
      else await api(`/api/admin/qr/${r!.id}`, "PATCH", fd);
      toast.success(isNew ? "QR code created" : "QR code updated");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "New QR code" : "Edit QR code"}</DialogTitle>
          <DialogDescription>The printed URL never changes. Attribution uses the source ID.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" key={r?.id ?? "new"}>
          <Field label="Name" htmlFor="qr-name"><Input id="qr-name" name="name" defaultValue={r?.name} placeholder="Poster – Tirana Airport" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source ID (?src=)" htmlFor="qr-slug" hint="Letters, numbers, - and _"><Input id="qr-slug" name="slug" defaultValue={r?.slug} placeholder="poster01" required pattern="[A-Za-z0-9_\-]+" /></Field>
            <Field label="Type" htmlFor="qr-type"><NativeSelect id="qr-type" name="type" defaultValue={r?.type ?? "POSTER"} className="h-11">{TYPES.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}</NativeSelect></Field>
          </div>
          <Field label="Destination path" htmlFor="qr-dest" hint="Must be a page on this site. Leave empty for the campaign page.">
            <Input id="qr-dest" name="destination" defaultValue={r?.destination} placeholder={`/giveaway/${campaignSlug}`} />
          </Field>
          <Field label="Notes" htmlFor="qr-notes"><Textarea id="qr-notes" name="notes" defaultValue={r?.notes ?? ""} rows={2} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} {isNew ? "Create" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
