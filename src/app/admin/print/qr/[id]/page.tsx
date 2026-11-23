import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/server";
import { qrSvg, stableQrUrl } from "@/services/qr";
import { getSettings } from "@/services/settings";
import { AutoPrint } from "./auto-print";

/** Printable A4 poster with the QR code (bilingual call to action). */
export default async function PrintQr({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const source = await prisma.qRSource.findUnique({ where: { id }, include: { campaign: true } });
  if (!source) notFound();
  const settings = await getSettings();
  const url = stableQrUrl(source.code);
  const svg = await qrSvg(url);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[210mm] flex-col items-center justify-center gap-8 bg-white p-10 text-center">
      <AutoPrint />
      <p className="text-lg font-semibold tracking-wide text-brand uppercase">{settings.companyName}</p>
      <h1 className="text-4xl leading-tight font-extrabold text-navy">{source.campaign.title}</h1>
      <p className="text-xl text-ink-muted">{source.campaign.prizeName}</p>
      <div className="w-[110mm] max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="space-y-1">
        <p className="text-2xl font-bold text-navy">Skano dhe merr pjesë falas!</p>
        <p className="text-lg text-ink-muted">Scan to enter for free</p>
      </div>
      <p className="font-mono text-sm text-ink-muted">{url}</p>
      <p className="text-xs text-ink-muted/70">{source.name}</p>
    </main>
  );
}
