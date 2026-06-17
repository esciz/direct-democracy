import Link from "next/link";

import { OfficialDirectoryCard } from "@/components/domain/official-directory-card";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getCommunityHierarchy, getDefaultCommunityForUser } from "@/lib/community/communities";
import { communityMatchesJurisdiction } from "@/lib/community/membership";
import { getOfficials } from "@/lib/officials/store";
import { getLightweightFollowState } from "@/lib/social/follows";
import type { OfficialProfileSummary } from "@/types/domain";

type OfficialsPageProps = {
  searchParams?: Promise<{
    communityId?: string;
    q?: string;
  }>;
};

function matchesOfficialQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

function resolveCommunityId(communityId: string | undefined, fallbackCommunityId: string) {
  return getCommunityById(communityId)?.id ?? fallbackCommunityId;
}

async function attachOfficialFollowState(viewerId: string, officials: OfficialProfileSummary[]) {
  const officialsWithState = await Promise.allSettled(
    officials.map(async (official) => {
      const linkedUserId = official.claimedByUserId;

      if (!linkedUserId) {
        return official;
      }

      const followState = await getLightweightFollowState(viewerId, linkedUserId, official.followerCount);

      return {
        ...official,
        followerCount: followState.followerCount,
        viewerIsFollowing: followState.viewerIsFollowing,
        viewerCanFollow: followState.viewerCanFollow,
      };
    }),
  );

  return officialsWithState.flatMap((result) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    console.error("[officials-page] official follow state fallback", result.reason);
    return [];
  });
}

export default async function OfficialsPage({ searchParams }: OfficialsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = resolveCommunityId(params?.communityId, defaultCommunity.id);
  const currentCommunity = getCommunityById(selectedCommunityId) ?? defaultCommunity;
  const query = params?.q?.trim() ?? "";
  const returnPath = query
    ? `/officials?communityId=${selectedCommunityId}&q=${encodeURIComponent(query)}`
    : `/officials?communityId=${selectedCommunityId}`;
  const hierarchy = getCommunityHierarchy(selectedCommunityId);
  const stateCommunityId = hierarchy.find((entry) => entry.level === "State")?.id ?? "nevada";
  const stateCommunity = getCommunityById(stateCommunityId);
  const nationalCommunity = getCommunityById("united-states");
  const allowDemoFallback = selectedCommunityId !== "nevada";
  const allOfficials = await getOfficials({ allowDemoFallback })
    .then((officials) => attachOfficialFollowState(user.id, officials))
    .catch((error) => {
      console.error("[officials-page] officials listing fallback", {
        communityId: selectedCommunityId,
        query,
        error,
      });
      return [] as OfficialProfileSummary[];
    });
  const localOfficials = allOfficials.filter((official) => communityMatchesJurisdiction(selectedCommunityId, official.jurisdictionName));
  const stateOfficials = allOfficials.filter((official) => communityMatchesJurisdiction(stateCommunityId, official.jurisdictionName)).slice(0, 6);
  const nationalOfficials = allOfficials.slice(0, 6);
  const officials = query
    ? allOfficials.filter((official) =>
        matchesOfficialQuery(query, official.name, official.officeTitle, official.bio ?? "", official.jurisdictionName, official.party),
      )
    : localOfficials;
  const localSearchMatches = query
    ? localOfficials.filter((official) =>
        matchesOfficialQuery(query, official.name, official.officeTitle, official.bio ?? "", official.jurisdictionName, official.party),
      )
    : [];
  const isImportedNevadaFeed = allOfficials.some((official) => official.sourceLabel);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Officials"
        title={query ? "Search officials" : `Officials in ${currentCommunity.name}`}
        description={
          query
            ? `Showing official profile matches for “${query}.”`
            : `Browse public officials in ${currentCommunity.name}, then widen the view to state and national previews.`
        }
        meta={
          isImportedNevadaFeed ? (
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
              Imported Nevada beta data
            </span>
          ) : null
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/who-represents-me?community=${selectedCommunityId}`}
              className="inline-flex rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              Who represents me?
            </Link>
            <Link
              href={`/explore?communityId=${selectedCommunityId}`}
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Back to Explore
            </Link>
          </div>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Official search</p>
            <p className="mt-2 text-sm text-slate-600">
              {query
                ? "Search results can include officials from any community."
                : `Showing officials connected to ${currentCommunity.name} by default.`}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {query ? "Search results" : "Local directory"}
          </span>
        </div>

        <PreserveScrollQueryForm action="/officials" className="mt-4 flex flex-wrap gap-3">
          <input type="hidden" name="communityId" value={selectedCommunityId} />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search officials"
            className="min-w-[18rem] flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          <button type="submit" className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Search
          </button>
          {query ? (
            <Link
              href={`/officials?communityId=${selectedCommunityId}`}
              scroll={false}
              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Back to {currentCommunity.shortName || currentCommunity.name}
            </Link>
          ) : null}
        </PreserveScrollQueryForm>
      </section>

      {query ? (
        <>
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Nationwide search</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Official profiles across the country</h2>
                <p className="mt-2 text-sm text-slate-600">Search results can include officials from any community.</p>
              </div>
              <span className="rounded-full bg-civic-50 px-4 py-2 text-sm font-semibold text-civic-700">
                {officials.length} official{officials.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {officials.length ? (
                officials.map((official) => <OfficialDirectoryCard key={official.id} official={official} returnPath={returnPath} />)
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
                  No official profiles match this search yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Matches in {currentCommunity.name}</h2>
            <p className="mt-2 text-sm text-slate-600">A quick view of which nationwide matches also belong to your current community context.</p>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {localSearchMatches.length ? (
                localSearchMatches.map((official) => <OfficialDirectoryCard key={official.id} official={official} returnPath={returnPath} />)
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
                  No local officials match this search yet.
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Local</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{currentCommunity.name}</h2>
                <p className="mt-2 text-sm text-slate-600">Officials tied to your current/default community.</p>
              </div>
              <Link href={`/officials?communityId=${selectedCommunityId}`} scroll={false} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                View all
              </Link>
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {localOfficials.length ? (
                localOfficials.map((official) => (
                  <div key={official.id} className="min-w-[20rem] max-w-[20rem] flex-none">
                    <OfficialDirectoryCard official={official} returnPath={returnPath} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No officials are listed for this community yet.</div>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">State</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{stateCommunity?.name ?? "State"}</h2>
                <p className="mt-2 text-sm text-slate-600">A lightweight preview of officials from across the state.</p>
              </div>
              {stateCommunity ? (
                <Link href={`/officials?communityId=${stateCommunity.id}`} scroll={false} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                  View all
                </Link>
              ) : null}
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {stateOfficials.length ? (
                stateOfficials.map((official) => (
                  <div key={official.id} className="min-w-[20rem] max-w-[20rem] flex-none">
                    <OfficialDirectoryCard official={official} returnPath={returnPath} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No officials are listed for this state yet.</div>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">National</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{nationalCommunity?.name ?? "United States"}</h2>
                <p className="mt-2 text-sm text-slate-600">A curated preview of official profiles from across the country.</p>
              </div>
              {nationalCommunity ? (
                <Link href={`/officials?communityId=${nationalCommunity.id}`} scroll={false} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                  View all
                </Link>
              ) : null}
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {nationalOfficials.length ? (
                nationalOfficials.map((official) => (
                  <div key={official.id} className="min-w-[20rem] max-w-[20rem] flex-none">
                    <OfficialDirectoryCard official={official} returnPath={returnPath} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No national officials are available yet.</div>
              )}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
