import { notFound } from "next/navigation";
import { getPublishedCampaignBySlug } from "@/services/campaigns";
import { LandingPage, campaignMetadata } from "@/components/landing/landing-page";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return campaignMetadata(await getPublishedCampaignBySlug(slug));
}

export default async function CampaignPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) notFound();
  const campaign = await getPublishedCampaignBySlug(slug);
  if (!campaign) notFound();
  return <LandingPage campaign={campaign} searchParams={await searchParams} />;
}
