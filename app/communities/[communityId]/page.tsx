import { redirect } from "next/navigation";

type CommunityDetailPageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityDetailPage({ params }: CommunityDetailPageProps) {
  const { communityId } = await params;
  redirect(`/community/${encodeURIComponent(communityId)}`);
}
