import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { getSettings } from "@/services/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings().catch(() => null);
  const name = settings?.companyName ?? "Giveaway";
  return {
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    title: { default: name, template: `%s · ${name}` },
    description: "Free-entry giveaway with publicly verifiable winner selection.",
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
