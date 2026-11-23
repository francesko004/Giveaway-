"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, FileClock, Gift, LayoutDashboard, LogOut, Menu, QrCode, Settings, ShieldCheck, UserCog, Users } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Role = "SUPER_ADMIN" | "ADMIN" | "VIEWER";
const NAV: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; min?: Role }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/campaigns", label: "Campaigns", icon: Gift },
  { href: "/admin/participants", label: "Participants", icon: Users },
  { href: "/admin/qr", label: "QR codes", icon: QrCode },
  { href: "/admin/audit", label: "Audit log", icon: FileClock },
  { href: "/admin/privacy", label: "Privacy requests", icon: ShieldCheck, min: "SUPER_ADMIN" },
  { href: "/admin/users", label: "Users", icon: UserCog, min: "SUPER_ADMIN" },
  { href: "/admin/settings", label: "Settings", icon: Settings, min: "SUPER_ADMIN" },
];
const RANK: Record<Role, number> = { VIEWER: 1, ADMIN: 2, SUPER_ADMIN: 3 };

function NavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-0.5 p-3" aria-label="Admin">
      {NAV.filter((n) => RANK[role] >= RANK[n.min ?? "VIEWER"]).map((n) => {
        const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition", active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}
          >
            <n.icon className="size-4" /> {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ user, companyName, children }: { user: { name: string; email: string; role: Role }; companyName: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };
  const brand = (
    <Link href="/admin" className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white"><Gift className="size-4" /></span>
      <span className="truncate font-semibold text-white">{companyName}</span>
    </Link>
  );
  return (
    <div className="min-h-dvh bg-surface-muted">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy lg:flex">
        {brand}
        <NavLinks role={user.role} />
        <div className="mt-auto border-t border-white/10 p-4 text-xs text-white/50">
          <a href="/giveaway" target="_blank" className="flex items-center gap-2 hover:text-white"><BarChart3 className="size-3.5" /> View public site</a>
        </div>
      </aside>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="left" className="bg-navy p-0 [&>button]:text-white">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          {brand}
          <NavLinks role={user.role} onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 hover:bg-surface-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></button>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg p-1.5 pr-3 outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-brand/30">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{user.name.slice(0, 1).toUpperCase()}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium text-ink">{user.name}</span>
                <span className="block text-xs text-ink-muted">{user.role.replace("_", " ").toLowerCase()}</span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout}><LogOut /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
