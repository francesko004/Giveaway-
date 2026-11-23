"use client";
import { Ban, Hash, Mail, Play, ShieldAlert, Timer, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "./api";
import { ConfirmAction } from "./confirm-action";
import { Button } from "@/components/ui/button";

export function CommitButton({ campaignId, disabled, entries, roundHint }: { campaignId: string; disabled: boolean; entries: number; roundHint: string }) {
  return (
    <ConfirmAction
      variant="default"
      size="lg"
      disabled={disabled}
      trigger={<><Hash /> Freeze entries & publish commitment</>}
      title="Freeze the entry list and commit the draw?"
      description={
        <>
          <p>This permanently freezes the <strong>{entries}</strong> eligible entries, publishes their SHA-256 commitment and fixes a <strong>future drand round</strong> ({roundHint}).</p>
          <p>After this, nobody — including administrators — can add, remove or re-classify entries, pick another round, or change the winner. This is enforced by the database.</p>
        </>
      }
      typeToConfirm="COMMIT"
      confirmLabel="Commit draw"
      onConfirm={() => api(`/api/admin/campaigns/${campaignId}/draw`, "POST", { action: "commit", confirm: true })}
      successMessage="Commitment published"
    />
  );
}

export function ExecuteButton({ campaignId, roundAt }: { campaignId: string; roundAt: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const wait = Math.max(0, Math.ceil((new Date(roundAt).getTime() - now) / 1000));
  const run = async () => {
    setBusy(true);
    try {
      await api(`/api/admin/campaigns/${campaignId}/draw`, "POST", { action: "execute", confirm: true });
      toast.success("Randomness verified and winners selected");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="lg" onClick={run} disabled={wait > 0 || busy}>
      {wait > 0 ? <Timer /> : <Play />}
      {wait > 0 ? `Round available in ${wait >= 3600 ? `${Math.floor(wait / 3600)}h ${Math.floor((wait % 3600) / 60)}m` : wait >= 60 ? `${Math.floor(wait / 60)}m ${wait % 60}s` : `${wait}s`}` : busy ? "Retrieving beacon…" : "Retrieve randomness & select winners"}
    </Button>
  );
}

export function InvalidateButton({ drawId }: { drawId: string }) {
  return (
    <ConfirmAction
      variant="destructive"
      trigger={<><Ban /> Invalidate draw</>}
      title="Publicly invalidate this draw?"
      description={
        <>
          <p>The draw and its proof stay visible on the public verification page, marked as invalidated with your reason. The entry list is unfrozen so it can be corrected, and a new linked draw (with a new future round) can then be committed.</p>
          <p className="font-medium text-danger">Use only for genuine errors. Every invalidation is permanent and public.</p>
        </>
      }
      reason={{ label: "Public reason", min: 10, placeholder: "e.g. Staff entries were included by mistake" }}
      typeToConfirm="INVALIDATE"
      confirmLabel="Invalidate"
      onConfirm={(reason) => api(`/api/admin/draws/${drawId}/invalidate`, "POST", { reason })}
      successMessage="Draw invalidated"
    />
  );
}

export function ResultActions({ resultId, canDisqualify, canNotify, notified }: { resultId: string; canDisqualify: boolean; canNotify: boolean; notified: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {canNotify && (
        <ConfirmAction size="sm" trigger={<><Mail /> {notified ? "Re-send" : "Notify"}</>} title="Send the winner notification e-mail?" confirmLabel="Send" onConfirm={() => api(`/api/admin/draw-results/${resultId}/notify`, "POST")} successMessage="Notification sent" />
      )}
      {canDisqualify && (
        <ConfirmAction
          size="sm"
          variant="ghost"
          trigger={<><UserX /> Disqualify</>}
          title="Disqualify this pick?"
          description={<p>The reason is shown publicly. The next alternate in the published order takes the place. This cannot be undone.</p>}
          reason={{ label: "Public reason", min: 10, placeholder: "e.g. Winner did not respond within 14 days" }}
          confirmLabel="Disqualify"
          onConfirm={(reason) => api(`/api/admin/draw-results/${resultId}/disqualify`, "POST", { reason })}
          successMessage="Pick disqualified"
        />
      )}
    </div>
  );
}

export function ProtectedNote() {
  return <p className="flex items-center gap-2 text-xs text-ink-muted"><ShieldAlert className="size-3.5" /> Draw records are append-only and enforced by database triggers.</p>;
}
