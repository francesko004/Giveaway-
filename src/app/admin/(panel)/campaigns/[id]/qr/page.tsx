import { requireAdminPage } from "@/lib/auth/server";
import { hasRole } from "@/lib/auth/session";
import { CampaignHeader, loadCampaign } from "@/components/admin/campaign-header";
import { QrManager } from "@/components/admin/qr-manager";
import { qrRowsForCampaign } from "@/components/admin/qr-rows";

export default async function CampaignQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdminPage();
  const [c, rows] = await Promise.all([loadCampaign(id), qrRowsForCampaign(id)]);
  return (
    <>
      <CampaignHeader id={id} user={user} tab="qr" />
      <QrManager campaignId={id} campaignSlug={c.slug} rows={rows} canEdit={hasRole(user.role, "ADMIN")} />
    </>
  );
}
