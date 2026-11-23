import { requireAdminPage } from "@/lib/auth/server";
import { getSettings } from "@/services/settings";
import { PageHeader } from "@/components/admin/shell";
import { CampaignForm } from "@/components/admin/campaign-form";
import { emptyFormValues } from "@/components/admin/campaign-values";

export default async function NewCampaignPage() {
  await requireAdminPage("ADMIN");
  const { timezone } = await getSettings();
  return (
    <>
      <PageHeader title="New campaign" description="Campaigns are created as drafts. Publish when ready." />
      <CampaignForm initial={emptyFormValues(timezone)} timezone={timezone} locked={false} canOverride={false} />
    </>
  );
}
