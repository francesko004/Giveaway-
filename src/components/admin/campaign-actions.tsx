"use client";
import { Pause, Play, Rocket, Square, Undo2 } from "lucide-react";
import type { CampaignStatus } from "@prisma/client";
import { api } from "./api";
import { ConfirmAction } from "./confirm-action";

export function CampaignActions({ id, status, hasDraw }: { id: string; status: CampaignStatus; hasDraw: boolean }) {
  const act = (action: string) => () => api(`/api/admin/campaigns/${id}/status`, "POST", { action });
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <ConfirmAction variant="default" trigger={<><Rocket /> Publish</>} title="Publish this campaign?" description="The landing page becomes public. Registration opens at the configured start time." confirmLabel="Publish" onConfirm={act("publish")} successMessage="Campaign published" />
      )}
      {(status === "ACTIVE" || status === "SCHEDULED") && (
        <ConfirmAction trigger={<><Pause /> Pause</>} title="Pause registrations?" description="Visitors see a paused message and the server rejects new entries until you resume." confirmLabel="Pause" onConfirm={act("pause")} successMessage="Registrations paused" />
      )}
      {status === "PAUSED" && <ConfirmAction trigger={<><Play /> Resume</>} title="Resume registrations?" confirmLabel="Resume" onConfirm={act("resume")} successMessage="Registrations resumed" />}
      {(status === "ACTIVE" || status === "PAUSED" || status === "SCHEDULED") && (
        <ConfirmAction variant="destructive" trigger={<><Square /> Close now</>} title="Close registrations now?" description="This cannot be undone. No further entries will be accepted, and the campaign becomes ready for the draw." typeToConfirm="CLOSE" confirmLabel="Close registrations" onConfirm={act("close")} successMessage="Registrations closed" />
      )}
      {(status === "ACTIVE" || status === "PAUSED" || status === "SCHEDULED") && !hasDraw && (
        <ConfirmAction variant="ghost" trigger={<><Undo2 /> Unpublish</>} title="Unpublish (back to draft)?" description="The public page disappears and registration stops. Existing entries are kept." confirmLabel="Unpublish" onConfirm={act("unpublish")} successMessage="Campaign unpublished" />
      )}
    </div>
  );
}
