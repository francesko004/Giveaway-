"use client";
import { CheckCircle2, Eraser, XCircle } from "lucide-react";
import { api } from "./api";
import { ConfirmAction } from "./confirm-action";

export function ParticipantActions({ id, status, locked, canErase, erased }: { id: string; status: string; locked: boolean; canErase: boolean; erased: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {!locked && status !== "ELIGIBLE" && (
        <ConfirmAction variant="default" trigger={<><CheckCircle2 /> Mark eligible</>} title="Mark this entry as eligible?" reason={{ label: "Reason (audit log)", min: 10, placeholder: "e.g. Verified by phone — genuine participant" }} confirmLabel="Mark eligible" onConfirm={(reason) => api(`/api/admin/participants/${id}`, "PATCH", { status: "ELIGIBLE", reason })} successMessage="Entry marked eligible" />
      )}
      {!locked && status !== "INVALID" && (
        <ConfirmAction variant="destructive" trigger={<><XCircle /> Mark invalid</>} title="Mark this entry as invalid?" description="Invalid entries are excluded from the draw. The record is kept with your reason." reason={{ label: "Mandatory reason", min: 10, placeholder: "e.g. Duplicate person registered with a second phone number" }} confirmLabel="Mark invalid" onConfirm={(reason) => api(`/api/admin/participants/${id}`, "PATCH", { status: "INVALID", reason })} successMessage="Entry marked invalid" />
      )}
      {canErase && !erased && (
        <ConfirmAction variant="ghost" trigger={<><Eraser /> Erase personal data</>} title="Erase this participant's personal data?" description="Name, e-mail, phone and city are irreversibly replaced. The anonymous reference is kept so draw proofs remain valid." reason={{ label: "Reason (e.g. erasure request ID)", min: 10 }} typeToConfirm="ERASE" confirmLabel="Erase" onConfirm={(reason) => api(`/api/admin/participants/${id}/anonymize`, "POST", { reason })} successMessage="Personal data erased" />
      )}
    </div>
  );
}
