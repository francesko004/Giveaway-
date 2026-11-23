import { requireAdminPage } from "@/lib/auth/server";
import { hasRole } from "@/lib/auth/session";
import { isClosedForEntries } from "@/services/campaign-status";
import { getSettings } from "@/services/settings";
import { CampaignHeader, loadCampaign } from "@/components/admin/campaign-header";
import { CampaignForm } from "@/components/admin/campaign-form";
import { toFormValues } from "@/components/admin/campaign-values";

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminPage();
  const [c, { timezone }] = await Promise.all([loadCampaign(id), getSettings()]);
  return (
    <>
      <CampaignHeader id={id} user={user} tab="edit" />
      <CampaignForm
        id={id}
        initial={toFormValues(c, timezone)}
        timezone={timezone}
        locked={isClosedForEntries(c) || !!c.lockedAt}
        canOverride={hasRole(user.role, "SUPER_ADMIN")}
        readOnly={!hasRole(user.role, "ADMIN")}
      />
    </>
  );
}
