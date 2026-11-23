import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { hasRole, resolveSession, sessionCookieName, type SessionUser } from "./session";

/** For server components / layouts. */
export async function getCurrentAdmin(): Promise<SessionUser | null> {
  const store = await cookies();
  return resolveSession(store.get(sessionCookieName())?.value);
}

/** Server-side guard for admin pages. Redirects to the login page when unauthenticated. */
export async function requireAdminPage(min: Role = "VIEWER"): Promise<SessionUser> {
  const user = await getCurrentAdmin();
  if (!user) redirect("/admin/login");
  if (!hasRole(user.role, min)) redirect("/admin?forbidden=1");
  return user;
}
