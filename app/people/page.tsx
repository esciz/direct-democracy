import Link from "next/link";

import { PeopleDirectoryCard } from "@/components/domain/people-directory-card";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { getPeopleDiscoveryData } from "@/lib/profile/discovery";

type PeoplePageProps = {
  searchParams?: Promise<{
    communityId?: string;
    q?: string;
  }>;
};

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = params?.communityId ?? defaultCommunity.id;
  const currentCommunity = getCommunityById(selectedCommunityId) ?? defaultCommunity;
  const query = params?.q?.trim() ?? "";
  const returnPath = query ? `/people?communityId=${selectedCommunityId}&q=${encodeURIComponent(query)}` : `/people?communityId=${selectedCommunityId}`;
  const discovery = await getPeopleDiscoveryData(user, {
    communityId: selectedCommunityId,
    search: query,
  });
  const isNationwideSearch = query.length > 0;
  const stateCommunity = getCommunityById(discovery.stateCommunityId);
  const nationalCommunity = getCommunityById("united-states");

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="People"
        title={isNationwideSearch ? "Search public profiles nationwide" : `People in ${currentCommunity.name}`}
        description={
          isNationwideSearch
            ? `Showing public profile matches from communities across the country for “${query}.”`
            : `Browse public profiles in ${currentCommunity.name}, then search across the country whenever you want to widen the view.`
        }
        actions={
          <Link
            href={`/my-community?communityId=${selectedCommunityId}`}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to My Community
          </Link>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Public profile search</p>
            <p className="mt-2 text-sm text-slate-600">
              {isNationwideSearch
                ? "Search is currently showing public profiles from anywhere in the country."
                : `Showing all public profiles tied to ${currentCommunity.name} by default.`}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {isNationwideSearch ? "Nationwide results" : "My Community"}
          </span>
        </div>

        <PreserveScrollQueryForm action="/people" className="mt-4 flex flex-wrap gap-3">
          <input type="hidden" name="communityId" value={selectedCommunityId} />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search public profiles across the U.S."
            className="min-w-[18rem] flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          <button type="submit" className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Search
          </button>
          {isNationwideSearch ? (
            <Link
              href={`/people?communityId=${selectedCommunityId}`}
              scroll={false}
              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Back to {currentCommunity.shortName || currentCommunity.name}
            </Link>
          ) : null}
        </PreserveScrollQueryForm>
      </section>

      {isNationwideSearch ? (
        <>
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Nationwide search</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Public profiles across the country</h2>
                <p className="mt-2 text-sm text-slate-600">These results can come from any community in the U.S.</p>
              </div>
              <span className="rounded-full bg-civic-50 px-4 py-2 text-sm font-semibold text-civic-700">
                {discovery.nationwideResults.length} profiles
              </span>
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {discovery.nationwideResults.length ? (
                discovery.nationwideResults.map((citizen) => (
                  <PeopleDirectoryCard key={citizen.id} citizen={citizen} returnPath={returnPath} />
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
                  No public profiles match this nationwide search yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Matches in {currentCommunity.name}</h2>
            <p className="mt-2 text-sm text-slate-600">A quick view of which nationwide matches also belong to your current community context.</p>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {discovery.localSearchMatches.length ? (
                discovery.localSearchMatches.map((citizen) => (
                  <PeopleDirectoryCard key={citizen.id} citizen={citizen} returnPath={returnPath} />
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
                  No local public profiles match this search yet.
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="space-y-6">
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Local directory</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{currentCommunity.name}</h2>
                <p className="mt-2 text-sm text-slate-600">All public profiles tied to your current community context.</p>
              </div>
              <Link
                href={`/people?communityId=${selectedCommunityId}`}
                scroll={false}
                className="text-sm font-semibold text-civic-700 hover:text-civic-900"
              >
                View all
              </Link>
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {discovery.localProfiles.length ? (
                discovery.localProfiles.map((citizen) => (
                  <div key={citizen.id} className="min-w-[20rem] max-w-[20rem] flex-none">
                    <PeopleDirectoryCard citizen={citizen} returnPath={returnPath} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No public profiles are available in this community yet.</div>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">State directory</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{stateCommunity?.name ?? "State"}</h2>
                <p className="mt-2 text-sm text-slate-600">A lightweight preview of trusted and popular public profiles from across the state.</p>
              </div>
              {stateCommunity ? (
                <Link
                  href={`/people?communityId=${stateCommunity.id}`}
                  scroll={false}
                  className="text-sm font-semibold text-civic-700 hover:text-civic-900"
                >
                  View all
                </Link>
              ) : null}
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {discovery.stateProfiles.length ? (
                discovery.stateProfiles.map((citizen) => (
                  <div key={citizen.id} className="min-w-[20rem] max-w-[20rem] flex-none">
                    <PeopleDirectoryCard citizen={citizen} returnPath={returnPath} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No public profiles are available for this state yet.</div>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">National directory</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{nationalCommunity?.name ?? "United States"}</h2>
                <p className="mt-2 text-sm text-slate-600">A curated preview of public profiles from across the country.</p>
              </div>
              {nationalCommunity ? (
                <Link
                  href={`/people?communityId=${nationalCommunity.id}`}
                  scroll={false}
                  className="text-sm font-semibold text-civic-700 hover:text-civic-900"
                >
                  View all
                </Link>
              ) : null}
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {discovery.nationalProfiles.length ? (
                discovery.nationalProfiles.map((citizen) => (
                  <div key={citizen.id} className="min-w-[20rem] max-w-[20rem] flex-none">
                    <PeopleDirectoryCard citizen={citizen} returnPath={returnPath} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No national public profiles are available yet.</div>
              )}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
