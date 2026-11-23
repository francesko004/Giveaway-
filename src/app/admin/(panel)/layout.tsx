import { requireAdminPage } from "@/lib/auth/server";
import { getSettings } from "@/services/settings";
import { AdminShell } from "@/components/admin/shell";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([requireAdminPage("VIEWER"), getSettings()]);
  return (
    <AdminShell user={{ name: user.name, email: user.email, role: user.role }} companyName={settings.companyName}>
      {children}
    </AdminShell>
  );
}
