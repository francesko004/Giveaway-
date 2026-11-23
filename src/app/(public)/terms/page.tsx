import { getDictionary } from "@/lib/i18n/server";
import { LegalPage } from "@/components/landing/legal-page";

export async function generateMetadata() {
  return { title: (await getDictionary()).dict.footer.terms };
}

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
