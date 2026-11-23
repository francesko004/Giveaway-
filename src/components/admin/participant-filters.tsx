"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ParticipantFilters({ campaigns, sources, canExport }: { campaigns: { id: string; title: string }[]; sources: { id: string; name: string; campaignId: string }[]; canExport: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const campaign = sp.get("campaign") ?? "";
  const apply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [k, v] of fd) if (v) params.set(k, String(v));
    router.push(`/admin/participants?${params}`);
  };
  const exportHref = (format: string, marketing = false) => {
    const p = new URLSearchParams(sp);
    p.delete("page");
    p.set("format", format);
    if (marketing) p.set("marketing", "1");
    return `/api/admin/participants/export?${p}`;
  };
  return (
    <form onSubmit={apply} className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr_0.8fr_auto]" key={sp.toString()}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
        <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="Name, e-mail, phone or reference" className="h-10 pl-9 text-sm" aria-label="Search" />
      </div>
      <NativeSelect name="campaign" defaultValue={campaign} aria-label="Campaign" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="">All campaigns</option>
        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
      </NativeSelect>
      <NativeSelect name="source" defaultValue={sp.get("source") ?? ""} aria-label="QR source">
        <option value="">All sources</option>
        <option value="none">Direct / no QR</option>
        {sources.filter((s) => !campaign || s.campaignId === campaign).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </NativeSelect>
      <NativeSelect name="status" defaultValue={sp.get("status") ?? ""} aria-label="Status">
        <option value="">Any status</option><option value="ELIGIBLE">Eligible</option><option value="FLAGGED">Needs review</option><option value="INVALID">Invalid</option>
      </NativeSelect>
      <Input type="date" name="from" defaultValue={sp.get("from") ?? ""} aria-label="Registered from" className="h-10 text-sm" />
      <Input type="date" name="to" defaultValue={sp.get("to") ?? ""} aria-label="Registered to" className="h-10 text-sm" />
      <div className="flex gap-2">
        <Button type="submit" variant="navy">Filter</Button>
        {sp.toString() && <Button type="button" variant="ghost" size="icon" onClick={() => router.push("/admin/participants")} aria-label="Clear filters"><X /></Button>}
        {canExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="outline"><Download /> Export</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><a href={exportHref("csv")}>CSV (filtered)</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={exportHref("xlsx")}>Excel (filtered)</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={exportHref("csv", true)}>Marketing opt-ins only (CSV)</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </form>
  );
}
