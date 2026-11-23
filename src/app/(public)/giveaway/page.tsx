import { getFeaturedCampaign } from "@/services/campaigns";
import { LandingPage, campaignMetadata } from "@/components/landing/landing-page";

export async function generateMetadata() {
  return campaignMetadata(await getFeaturedCampaign());
}

export default async function GiveawayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <LandingPage campaign={await getFeaturedCampaign()} searchParams={await searchParams} />;
}
