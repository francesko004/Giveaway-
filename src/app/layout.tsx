import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { getSettings } from "@/services/settings";
import { BRAND } from "@/content/brand";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings().catch(() => null);
  const name = settings?.companyName ?? BRAND.name;
  return {
    metadataBase: new URL(process.env.APP_URL ?? BRAND.url),
    title: { default: name, template: `%s · ${name}` },
    description: `${BRAND.name} — konkurse me pjesëmarrje falas dhe short të verifikueshëm publikisht. Free-entry giveaways with a publicly verifiable draw.`,
    applicationName: name,
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#14243A",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale().catch(() => "sq" as const);
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-white">{children}</body>
    </html>
  );
}
