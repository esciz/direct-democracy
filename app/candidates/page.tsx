import Link from "next/link";

import { CandidateDirectoryCard } from "@/components/domain/candidate-directory-card";
import { PageIntro } from "@/components/ui/page-intro";
import { PreserveScrollQueryForm } from "@/components/ui/preserve-scroll-query-form";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById, getCommunityHierarchy, getDefaultCommunityForUser } from "@/lib/community/communities";
import { communityMatchesJurisdiction } from "@/lib/community/membership";
import { getAllCandidateCampaigns, getCandidateProfiles } from "@/lib/server/elections-context";
import { getLightweightFollowState } from "@/lib/social/follows";
import type { PublicProfileSummary } from "@/types/domain";

type CandidatesPageProps = {
  searchParams?: Promise<{
    communityId?: string;
    q?: string;
    sort?: string;
  }>;
};

function matchesCandidateQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalized));
}

async function attachCandidateFollowState(viewerId: string, candidates: PublicProfileSummary[]) {
  return Promise.all(
    candidates.map(async (candidate) => {
      const linkedUserId = candidate.claimedByUserId;

      if (!linkedUserId) {
        return candidate;
      }

      const followState = await getLightweightFollowState(viewerId, linkedUserId, candidate.followerCount ?? 0);

      return {
        ...candidate,
        followerCount: followState.followerCount,
        viewerIsFollowing: followState.viewerIsFollowing,
        viewerCanFollow: followState.viewerCanFollow,
      };
    }),
  );
}

async function sortCandidatesByRace(candidates: PublicProfileSummary[]) {
  const campaigns = await getAllCandidateCampaigns();
  const primaryCampaignByProfileId = new Map(
    campaigns.map((campaign) => [
      campaign.publicProfileId,
      {
        electionTitle: campaign.electionTitle ?? campaign.officeSought,
        officeSought: campaign.officeSought,
      },
    ]),
  );

  return [...candidates].sort((a, b) => {
    const campaignA = primaryCampaignByProfileId.get(a.id);
    const campaignB = primaryCampaignByProfileId.get(b.id);
    const raceLabelA = `${campaignA?.electionTitle ?? ""} ${campaignA?.officeSought ?? ""}`.trim();
    const raceLabelB = `${campaignB?.electionTitle ?? ""} ${campaignB?.officeSought ?? ""}`.trim();
    const byRace = raceLabelA.localeCompare(raceLabelB);

    if (byRace !== 0) {
      return byRace;
    }

    return a.name.localeCompare(b.name);
  });
}

export default async function CandidatesPage({ searchParams }: CandidatesPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = params?.communityId ?? defaultCommunity.id;
  const currentCommunity = getCommunityById(selectedCommunityId) ?? defaultCommunity;
  const query = params?.q?.trim() ?? "";
  const sort = params?.sort === "race" ? "race" : "default";
  const returnPath = query
    ? `/candidates?communityId=${selectedCommunityId}&sort=${sort}&q=${encodeURIComponent(query)}`
    : `/candidates?communityId=${selectedCommunityId}&sort=${sort}`;
  const allCandidatesWithFollowState = await attachCandidateFollowState(user.id, await getCandidateProfiles());
  const allCandidates = sort === "race" ? await sortCandidatesByRace(allCandidatesWithFollowState) : allCandidatesWithFollowState;
  const hierarchy = getCommunityHierarchy(selectedCommunityId);
  const stateCommunityId = hierarchy.find((entry) => entry.level === "State")?.id ?? "nevada";
  const stateCommunity = getCommunityById(stateCommunityId);
  const nationalCommunity = getCommunityById("united-states");
  const localCandidates = allCandidates.filter((candidate) => communityMatchesJurisdiction(selectedCommunityId, candidate.jurisdictionName));
  const stateCandidates = allCandidates.filter((candidate) => communityMatchesJurisdiction(stateCommunityId, candidate.jurisdictionName)).slice(0, 6);
  const nationalCandidates = allCandidates.slice(0, 6);
  const candidates = query
    ? allCandidates.filter((candidate) =>
        matchesCandidateQuery(query, candidate.name, candidate.bio ?? "", candidate.jurisdictionName, candidate.partyText ?? ""),
      )
    : localCandidates;
  const localSearchMatches = query
    ? localCandidates.filter((candidate) =>
        matchesCandidateQuery(query, candidate.name, candidate.bio ?? "", candidate.jurisdictionName, candidate.partyText ?? ""),
      )
    : [];

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Candidates"
        title={query ? "Search candidates" : `Candidates in ${currentCommunity.name}`}
        description={
          query
            ? `Showing candidate profile matches for “${query}.”`
            : sort === "race"
              ? `Candidates tied to ${currentCommunity.name}, organized by race to make endorsements easier.`
              : `A lightweight directory of candidates tied to ${currentCommunity.name}.`
        }
        actions={
          <Link
            href={`/explore?communityId=${selectedCommunityId}`}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to Explore
          </Link>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Candidate search</p>
            <p className="mt-2 text-sm text-slate-600">
              {query
                ? "Search results can include candidates from any community."
                : sort === "race"
                  ? `Showing candidates connected to ${currentCommunity.name}, grouped in race order by default.`
                  : `Showing candidates connected to ${currentCommunity.name} by default.`}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            {query ? "Search results" : sort === "race" ? "Race order" : "Local directory"}
          </span>
        </div>

        <PreserveScrollQueryForm action="/candidates" className="mt-4 flex flex-wrap gap-3">
          <input type="hidden" name="communityId" value={selectedCommunityId} />
          <input type="hidden" name="sort" value={sort} />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search candidates"
            className="min-w-[18rem] flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          <button type="submit" className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Search
          </button>
          {query ? (
            <Link
              href={`/candidates?communityId=${selectedCommunityId}&sort=${sort}`}
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
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Candidate profiles across the country</h2>
                <p className="mt-2 text-sm text-slate-600">Search results can include candidates from any community.</p>
              </div>
              <span className="rounded-full bg-civic-50 px-4 py-2 text-sm font-semibold text-civic-700">
                {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {candidates.length ? (
                candidates.map((candidate) => <CandidateDirectoryCard key={candidate.id} candidate={candidate} returnPath={returnPath} />)
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
                  No candidate profiles match this search yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Matches in {currentCommunity.name}</h2>
            <p className="mt-2 text-sm text-slate-600">A quick view of which nationwide matches also belong to your current community context.</p>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {localSearchMatches.length ? (
                localSearchMatches.map((candidate) => <CandidateDirectoryCard key={candidate.id} candidate={candidate} returnPath={returnPath} />)
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600 xl:col-span-2">
                  No local candidates match this search yet.
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
                <p className="mt-2 text-sm text-slate-600">Candidates tied to your current/default community.</p>
              </div>
              <Link href={`/candidates?communityId=${selectedCommunityId}`} scroll={false} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                View all
              </Link>
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {localCandidates.length ? (
                localCandidates.map((candidate) => (
                  <div key={candidate.id} className="min-w-[20rem] max-w-[20rem] flex-none">
                    <CandidateDirectoryCard candidate={candidate} returnPath={returnPath} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No candidates are listed for this community yet.</div>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">State</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{stateCommunity?.name ?? "State"}</h2>
                <p className="mt-2 text-sm text-slate-600">A lightweight preview of candidates from across the state.</p>
              </div>
              {stateCommunity ? (
                <Link href={`/candidates?communityId=${stateCommunity.id}`} scroll={false} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                  View all
                </Link>
              ) : null}
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {stateCandidates.length ? (
                stateCandidates.map((candidate) => (
                  <div key={candidate.id} className="min-w-[20rem] max-w-[20rem] flex-none">
                    <CandidateDirectoryCard candidate={candidate} returnPath={returnPath} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No candidates are listed for this state yet.</div>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">National</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{nationalCommunity?.name ?? "United States"}</h2>
                <p className="mt-2 text-sm text-slate-600">A curated preview of candidate profiles from across the country.</p>
              </div>
              {nationalCommunity ? (
                <Link href={`/candidates?communityId=${nationalCommunity.id}`} scroll={false} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                  View all
                </Link>
              ) : null}
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
              {nationalCandidates.length ? (
                nationalCandidates.map((candidate) => (
                  <div key={candidate.id} className="min-w-[20rem] max-w-[20rem] flex-none">
                    <CandidateDirectoryCard candidate={candidate} returnPath={returnPath} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">No national candidates are available yet.</div>
              )}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
