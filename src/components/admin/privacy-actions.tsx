"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "./api";

export function PrivacyActions({ id, type, matches }: { id: string; type: string; matches: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolution, setResolution] = useState("");
  const [apply, setApply] = useState(type === "DELETION" || type === "MARKETING_OPT_OUT");
  const resolve = async (status: "COMPLETED" | "REJECTED") => {
    setBusy(true);
    try {
      const r = await api<{ affected: number }>(`/api/admin/data-requests/${id}`, "PATCH", { status, resolution, apply: status === "COMPLETED" && apply });
      toast.success(`Request ${status.toLowerCase()}${r.affected ? ` · ${r.affected} record(s) updated` : ""}`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline"><a href={`/api/admin/data-requests/${id}/export`}><Download /> Data export ({matches})</a></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm">Resolve</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve request</DialogTitle>
            <DialogDescription>Verify the requester&apos;s identity before acting (e.g. reply from the registered e-mail). {matches} matching record(s).</DialogDescription>
          </DialogHeader>
          {(type === "DELETION" || type === "MARKETING_OPT_OUT") && (
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>{type === "DELETION" ? "Anonymise all matching entries (draw proofs stay valid)" : "Withdraw marketing consent on all matching entries"}</span>
              <Switch checked={apply} onCheckedChange={setApply} />
            </label>
          )}
          <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resolution note (min. 10 characters), e.g. identity verified via e-mail reply on …" />
          <DialogFooter>
            <Button variant="outline" onClick={() => resolve("REJECTED")} disabled={busy || resolution.trim().length < 10}>Reject</Button>
            <Button onClick={() => resolve("COMPLETED")} disabled={busy || resolution.trim().length < 10}>{busy && <Loader2 className="animate-spin" />} Complete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
