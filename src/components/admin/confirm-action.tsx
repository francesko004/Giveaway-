"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";

interface Props {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  /** Require a written reason (min length) that is passed to onConfirm. */
  reason?: { label: string; min?: number; placeholder?: string };
  /** Require typing this word to confirm (for irreversible actions). */
  typeToConfirm?: string;
  onConfirm: (reason: string) => Promise<unknown>;
  successMessage?: string;
  disabled?: boolean;
  triggerClassName?: string;
}

export function ConfirmAction(p: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const min = p.reason?.min ?? 10;
  const valid = (!p.reason || reason.trim().length >= min) && (!p.typeToConfirm || typed === p.typeToConfirm);

  const run = async () => {
    setBusy(true);
    try {
      await p.onConfirm(reason.trim());
      toast.success(p.successMessage ?? "Done");
      setOpen(false);
      setReason("");
      setTyped("");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={p.variant ?? "outline"} size={p.size} disabled={p.disabled} className={p.triggerClassName}>{p.trigger}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
          {p.description && <DialogDescription asChild><div className="space-y-2">{p.description}</div></DialogDescription>}
        </DialogHeader>
        {p.reason && (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="confirm-reason">{p.reason.label}</label>
            <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={p.reason.placeholder} />
            <p className="text-xs text-ink-muted">{reason.trim().length}/{min} characters minimum · recorded in the audit log</p>
          </div>
        )}
        {p.typeToConfirm && (
          <div className="grid gap-1.5">
            <label className="text-sm" htmlFor="confirm-typed">Type <strong className="font-mono">{p.typeToConfirm}</strong> to confirm</label>
            <input id="confirm-typed" value={typed} onChange={(e) => setTyped(e.target.value)} className="h-10 rounded-lg border px-3 font-mono text-sm" autoComplete="off" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant={p.variant === "destructive" ? "destructive" : "default"} onClick={run} disabled={!valid || busy}>
            {busy && <Loader2 className="animate-spin" />} {p.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
