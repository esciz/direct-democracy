import Link from "next/link";

import { CommunitySelector } from "@/components/domain/community-selector";
import { SchoolCard } from "@/components/domain/school-card";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { getSchoolsForCommunity } from "@/lib/schools/store";

type SchoolsPageProps = {
  searchParams?: Promise<{
    communityId?: string;
  }>;
};

export default async function SchoolsPage({ searchParams }: SchoolsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = params?.communityId ?? defaultCommunity.id;
  const currentCommunity = getCommunityById(selectedCommunityId) ?? defaultCommunity;
  const [schools] = await Promise.all([
    Promise.resolve(getSchoolsForCommunity(selectedCommunityId)),
  ]);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Schools"
        title={`Schools in ${currentCommunity.name}`}
        description="A community-focused school layer with civic signals, related issues, petitions, officials, and local education context. This page avoids rankings and treats optional metrics as background context only."
        actions={
          <Link
            href={`/my-community?communityId=${selectedCommunityId}`}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to My Community
          </Link>
        }
      />

      <CommunitySelector
        currentCommunity={currentCommunity}
        followedCommunities={[]}
        suggestedCommunities={[]}
        followedIds={[]}
        returnPath="/schools"
        destinationBase="/schools"
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Local schools</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Community context, not school rankings</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            School pages focus on the issues people discuss around each school, the officials connected to district decisions, and the petitions,
            posts, and events shaping local education conversations.
          </p>
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {schools.length ? (
            schools.map((school) => <SchoolCard key={school.id} school={school} />)
          ) : (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
              No schools are seeded for this community view yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
