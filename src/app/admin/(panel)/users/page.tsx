import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/server";
import { PageHeader } from "@/components/admin/shell";
import { UsersManager } from "@/components/admin/users-manager";
import { Card, CardContent } from "@/components/ui/card";

export default async function UsersPage() {
  const me = await requireAdminPage("SUPER_ADMIN");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, lockedUntil: true } });
  return (
    <>
      <PageHeader title="Users" description="Super admins manage users and settings and may perform exceptional, audited overrides. Admins run campaigns and draws. Viewers are read-only." />
      <Card><CardContent className="pt-5 sm:pt-6"><UsersManager me={me.id} users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, lockedUntil: u.lockedUntil?.toISOString() ?? null }))} /></CardContent></Card>
    </>
  );
}
