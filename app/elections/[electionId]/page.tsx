import { notFound } from "next/navigation";

import { BallotInitiativeCard } from "@/components/domain/ballot-initiative-card";
import { CandidateMatchBreakdown } from "@/components/domain/candidate-match-breakdown";
import { CandidateMatchCard } from "@/components/domain/candidate-match-card";
import { CandidateComparisonCard } from "@/components/domain/candidate-comparison-card";
import { PostCard } from "@/components/domain/post-card";
import { SummaryBriefPanel } from "@/components/domain/summary-brief-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { isGuestUser } from "@/lib/auth/session";
import { getDefaultSeedUser } from "@/lib/auth/mock-users";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCandidateMatchSummary } from "@/lib/candidates/matching";
import { formatDateUtc } from "@/lib/dates";
import { voteInCampusElection } from "@/lib/elections/campus-voting-actions";
import { canUserVoteInCampusElection, getCampusElectionVoteState } from "@/lib/elections/campus-voting";
import { getCandidateProfileById, getCandidateProfiles, getElectionById } from "@/lib/server/elections-context";

type ElectionDetailPageProps = {
  params: Promise<{
    electionId: string;
  }>;
  searchParams?: Promise<{
    campusVote?: string;
  }>;
};

type ElectionCandidateCard = {
  candidate: NonNullable<Awaited<ReturnType<typeof getCandidateProfileById>>>;
  campaign: NonNullable<Awaited<ReturnType<typeof getElectionById>>>["candidates"][number];
  match: Awaited<ReturnType<typeof getCandidateMatchSummary>>;
};

type ImportedElectionCandidate = NonNullable<NonNullable<Awaited<ReturnType<typeof getElectionById>>>["importedCandidates"]>[number];

function getImportedRaceGroups(candidates: ImportedElectionCandidate[]) {
  const groups = new Map<string, ImportedElectionCandidate[]>();

  for (const candidate of candidates) {
    const raceLabel = [candidate.officeTitle ?? "Office needs review", candidate.districtName].filter(Boolean).join(" · ");
    const key = `${raceLabel}|${candidate.jurisdictionName}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  return [...groups.entries()].map(([key, raceCandidates]) => ({
    key,
    raceLabel: key.split("|")[0],
    jurisdictionName: key.split("|")[1],
    candidates: raceCandidates,
  }));
}

function withSectionTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 1800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

export default async function ElectionDetailPage({ params, searchParams }: ElectionDetailPageProps) {
  const { electionId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const election = await getElectionById(electionId);

  if (!election) {
    notFound();
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Election Comparison"
        title={election.title}
        description={`${election.jurisdictionName} · ${formatDateUtc(election.electionDate)} · ${election.electionType}`}
        meta={
          <>
            {election.sourceLabel ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Imported Nevada beta data
              </span>
            ) : null}
            {election.sourceLabel ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Source: {election.sourceLabel}
              </span>
            ) : null}
            {election.isCommunityVoteOnly && election.authorityLabel ? (
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                {election.authorityLabel}
              </span>
            ) : null}
          </>
        }
      />

      <ElectionDetailBody election={election} resolvedSearchParams={resolvedSearchParams} />
    </div>
  );
}

async function ElectionDetailBody({
  election,
  resolvedSearchParams,
}: {
  election: NonNullable<Awaited<ReturnType<typeof getElectionById>>>;
  resolvedSearchParams: Awaited<ElectionDetailPageProps["searchParams"]>;
}) {
  const importedRaceGroups = getImportedRaceGroups(election.importedCandidates ?? []);
  const hasImportedCandidates = Boolean(election.importedCandidates?.length);
  const currentUser = await withSectionTimeout(getCurrentUser(), "election current user", 1200).catch((error) => {
    console.error(`[election-detail] current user fallback for ${election.id}`, error);
    return getDefaultSeedUser();
  });
  const candidates = await withSectionTimeout(getCandidateProfiles(), "election candidate profiles", 1600).catch((error) => {
    console.error(`[election-detail] candidate profile fallback for ${election.id}`, error);
    return [];
  });
  const campusVoteState = election.isCommunityVoteOnly
    ? await withSectionTimeout(getCampusElectionVoteState(election.id, currentUser.id), "election campus vote state", 1400).catch((error) => {
        console.error(`[election-detail] campus vote state fallback for ${election.id}`, error);
        return null;
      })
    : null;
  const canVoteInCampusCommunityElection = election.isCommunityVoteOnly
    ? await withSectionTimeout(canUserVoteInCampusElection(election), "election campus voting permissions", 1400).catch((error) => {
        console.error(`[election-detail] campus voting permission fallback for ${election.id}`, error);
        return false;
      })
    : false;

  const candidateCards = hasImportedCandidates
    ? []
    : await withSectionTimeout(
        Promise.all(
          election.candidates.map(async (campaign) => {
        const candidate = candidates.find((profile) => profile.id === campaign.publicProfileId);

        if (!candidate) {
          return null;
        }

        const candidateDetail = await withSectionTimeout(
          getCandidateProfileById(candidate.id),
          `candidate detail ${candidate.id}`,
          1200,
        ).catch((error) => {
          console.error(`[election-detail] candidate detail fallback for ${candidate.id}`, error);
          return null;
        });
        if (!candidateDetail) {
          return null;
        }

        const match = await withSectionTimeout(
          getCandidateMatchSummary(currentUser, candidateDetail, campaign),
          `candidate match ${campaign.id}`,
          1600,
        ).catch((error) => {
          console.error(`[election-detail] candidate match fallback for ${campaign.id}`, error);
          return null;
        });

        if (!match) {
          return null;
        }

        return {
          candidate: candidateDetail,
          campaign,
          match,
        };
          }),
        ),
        "election candidate card assembly",
        2400,
      ).catch((error) => {
        console.error(`[election-detail] candidate card fallback for ${election.id}`, error);
        return [];
      });

  const validCandidateCards = candidateCards.reduce<ElectionCandidateCard[]>((cards, entry) => {
    if (entry) {
      cards.push(entry);
    }

    return cards;
  }, []);
  const topMatch = validCandidateCards[0]?.match;
  const topCampaign = validCandidateCards[0]?.campaign;
  const electionBriefBullets = [
    validCandidateCards[0]
      ? `${validCandidateCards[0].candidate.name} is currently the closest platform match for your visible issue signals.`
      : election.importedCandidates?.[0]
        ? `${election.importedCandidates.length} imported candidate record${election.importedCandidates.length === 1 ? "" : "s"} are linked to this election.`
        : null,
    election.ballotInitiatives[0]
      ? `${election.ballotInitiatives.length} ballot measure${election.ballotInitiatives.length === 1 ? "" : "s"} share this ballot, including ${election.ballotInitiatives[0].title}.`
      : null,
    election.isCommunityVoteOnly
      ? "Campus community voting is open as a public sentiment layer and does not replace official results."
      : `${election.candidates.length + (election.importedCandidates?.length ?? 0)} candidate record${election.candidates.length + (election.importedCandidates?.length ?? 0) === 1 ? "" : "s"} are currently visible for side-by-side comparison.`,
  ].filter((value): value is string => Boolean(value));
  const electionBriefSummary = topMatch && topCampaign
    ? `${election.title} is most useful right now as a comparison page: the strongest current alignment is ${topMatch.matchPercentage}% with ${topCampaign.officeSought.toLowerCase()} messaging, while ballot context and side-by-side differences are already visible below. ${election.ballotInitiatives.length ? "The ballot also carries related measures that may shape the same civic priorities." : "The clearest next step is to compare the leading candidate matches in more detail."}`
    : `${election.title} currently has ${election.candidates.length + (election.importedCandidates?.length ?? 0)} visible candidate record${election.candidates.length + (election.importedCandidates?.length ?? 0) === 1 ? "" : "s"} and ${election.ballotInitiatives.length} ballot measure${election.ballotInitiatives.length === 1 ? "" : "s"} connected to this election. Use this page to compare candidates first, then drill into the most relevant race or measure below.`;

  return (
    <>
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Election date", formatDateUtc(election.electionDate)],
            ["Jurisdiction", election.jurisdictionName],
            ["Type", election.electionType],
            ["Offices on ballot", election.officeTitle],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
        {election.sourceLabel ? <p className="mt-4 text-xs text-slate-500">Source: {election.sourceLabel}</p> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Offices on ballot</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{election.officeTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Candidate records shown below are limited to imported Nevada beta data that is already linked to this election.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {(election.importedCandidates?.length ?? 0) + election.candidates.length} candidate records
            </span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {election.ballotInitiatives.length} ballot questions
            </span>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Deadlines and official sources</p>
          <div className="mt-4 space-y-3">
            {(election.deadlineNotes?.length ? election.deadlineNotes : ["Deadline notes are not normalized for this election yet."]).map((note) => (
              <p key={note} className="rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {note}
              </p>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(election.sourceLinks?.length
              ? election.sourceLinks
              : election.sourceUrl
                ? [{ label: election.sourceLabel ?? "Official source", url: election.sourceUrl }]
                : []
            ).map((sourceLink) => (
              <a
                key={`${sourceLink.label}-${sourceLink.url}`}
                href={sourceLink.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                {sourceLink.label}
              </a>
            ))}
          </div>
        </article>
      </section>

      <SummaryBriefPanel
        eyebrow="Election Brief"
        title="What matters most in this election"
        summary={electionBriefSummary}
        bullets={electionBriefBullets}
        signalChips={[
          `${election.candidates.length + (election.importedCandidates?.length ?? 0)} candidate${election.candidates.length + (election.importedCandidates?.length ?? 0) === 1 ? "" : "s"}`,
          `${election.ballotInitiatives.length} ballot measure${election.ballotInitiatives.length === 1 ? "" : "s"}`,
          election.isCommunityVoteOnly ? "Live campus sentiment" : election.electionType,
        ]}
        actionLabel={validCandidateCards[0] ? "Compare candidates" : election.ballotInitiatives[0] ? "Open ballot measure" : undefined}
        actionHref={validCandidateCards[0] ? `#candidate-comparison` : election.ballotInitiatives[0] ? `/initiatives/${election.ballotInitiatives[0].id}` : undefined}
        actionLinks={[
          ...(validCandidateCards.length ? [{ label: "Compare candidates", href: "#candidate-comparison" }] : []),
          ...(election.ballotInitiatives[0] ? [{ label: "Open ballot measure", href: `/initiatives/${election.ballotInitiatives[0].id}` }] : []),
        ]}
      />

      {election.importedCandidates?.length ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Imported Candidates</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Candidates linked to this election</h2>
            <p className="mt-2 text-sm text-slate-600">Imported Nevada beta records from official source data.</p>
          </div>
          <div className="mt-5 space-y-4">
            {importedRaceGroups.map((group) => (
              <article key={group.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-ink">{group.raceLabel}</h3>
                    <p className="mt-1 text-sm text-slate-600">{group.jurisdictionName}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Imported Nevada beta data</span>
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {group.candidates.map((candidate) => (
                    <div key={candidate.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <a href={`/candidates/${candidate.id}`} className="font-semibold text-ink hover:text-civic-700">
                            {candidate.ballotName ?? candidate.fullName}
                          </a>
                          <p className="mt-1 text-xs text-slate-500">{candidate.partyText ?? "No party listed"} · {candidate.filingStatus ?? candidate.status}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{candidate.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        {candidate.websiteUrl ? (
                          <a href={candidate.websiteUrl} className="rounded-full bg-white px-3 py-1 text-civic-700">
                            Website
                          </a>
                        ) : null}
                        {candidate.email ? (
                          <a href={`mailto:${candidate.email}`} className="rounded-full bg-white px-3 py-1 text-civic-700">
                            Email
                          </a>
                        ) : null}
                        {candidate.phone ? (
                          <a href={`tel:${candidate.phone}`} className="rounded-full bg-white px-3 py-1 text-civic-700">
                            Phone
                          </a>
                        ) : null}
                        <a href={`/candidates/${candidate.id}`} className="rounded-full bg-white px-3 py-1 text-civic-700">
                          Profile
                        </a>
                        <a href={candidate.sourceUrl ?? `/candidates/${candidate.id}`} className="rounded-full bg-white px-3 py-1 text-slate-700">
                          Source
                        </a>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">Source: {candidate.sourceLabel ?? "Imported Nevada beta data"}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {election.importedRecordsNeedingReview?.length ? (
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Imported Nevada records needing review</p>
          <div className="mt-4 grid gap-3">
            {election.importedRecordsNeedingReview.map((record) => (
              <article key={`${record.recordType}-${record.id}`} className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">{record.title}</p>
                <p className="mt-1">{record.reason}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex items-end justify-between gap-4">
          <PageIntro
            eyebrow="Perspectives"
            title="Candidate statements and election context"
            description="This election page surfaces campaign statements and civic perspectives tied directly to the people on this ballot, rather than a separate social feed."
          />
        </div>
        <div className="mt-5 grid gap-4">
          {validCandidateCards.flatMap((entry) => entry.candidate.recentPosts).slice(0, 3).length ? (
            validCandidateCards
              .flatMap((entry) => entry.candidate.recentPosts)
              .slice(0, 3)
              .map((post) => (
                <PostCard key={post.id} post={post} viewerRole={currentUser.role} viewerUserId={currentUser.id} returnPath={`/elections/${election.id}`} />
              ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
              No candidate statements or tied civic briefs are surfaced for this election yet.
            </div>
          )}
        </div>
      </section>

      {resolvedSearchParams?.campusVote ? (
        <section
          className={
            resolvedSearchParams.campusVote === "success"
              ? "rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card"
              : "rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card"
          }
        >
          {resolvedSearchParams.campusVote === "success" && "Your campus community vote was saved. These totals are community-facing only and are not official election results."}
          {resolvedSearchParams.campusVote === "denied" && "Campus community voting is limited to campus-linked verified users for this MVP."}
          {resolvedSearchParams.campusVote === "already" && "You already selected this candidate in the campus community vote."}
        </section>
      ) : null}

      {election.isCommunityVoteOnly ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-6 shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-700">Campus community vote</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Not official election results</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
            This is a campus community signal designed to surface student sentiment, candidate promises, endorsements, debates, and events in one place.
          </p>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {election.candidates.map((campaign) => {
              const voteSummary = campusVoteState?.candidateTotals.find((entry) => entry.candidateCampaignId === campaign.id);

              return (
                <div key={`campus-vote-${campaign.id}`} className="rounded-3xl bg-white p-5 ring-1 ring-orange-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{campaign.officeSought}</p>
                      <h3 className="mt-2 text-lg font-semibold text-ink">
                        {candidates.find((candidate) => candidate.id === campaign.publicProfileId)?.name ?? campaign.publicProfileId}
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {voteSummary?.percentage ?? 0}%
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {voteSummary?.count ?? 0} campus vote{voteSummary?.count === 1 ? "" : "s"}
                  </p>
                  <div className="mt-4 h-2.5 rounded-full bg-slate-200">
                    <div className="h-2.5 rounded-full bg-civic-500" style={{ width: `${voteSummary?.percentage ?? 0}%` }} />
                  </div>
                  {canVoteInCampusCommunityElection ? (
                    <form action={voteInCampusElection} className="mt-4">
                      <input type="hidden" name="electionId" value={election.id} />
                      <input type="hidden" name="candidateCampaignId" value={campaign.id} />
                      <input type="hidden" name="returnPath" value={`/elections/${election.id}`} />
                      <button
                        type="submit"
                        className={
                          campusVoteState?.viewerVote === campaign.id
                            ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                            : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                        }
                      >
                        {campusVoteState?.viewerVote === campaign.id ? "Your campus vote" : "Cast campus vote"}
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {!hasImportedCandidates ? (
        <section id="candidate-comparison" className="space-y-4">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Matches your views</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">How each candidate lines up with you</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Based on your activity and selected issues. This uses your saved priorities and recent yes or no answers, then compares them to
              each candidate&apos;s campaign promises and stated issue positions.
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
              How this is calculated: +1 alignment, 0 unknown, -1 disagreement.
            </p>
          </div>
          {validCandidateCards.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {validCandidateCards.map(({ candidate, campaign, match }) => (
                <CandidateMatchCard key={`match-${campaign.id}`} candidateId={candidate.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/75 p-6 text-sm text-slate-600 shadow-card">
              Candidate comparison is not available yet for this election.
            </div>
          )}
        </section>
      ) : null}

      {!hasImportedCandidates && validCandidateCards.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {validCandidateCards.map(({ candidate, campaign, match }) => (
            <CandidateComparisonCard
              key={campaign.id}
              candidate={candidate}
              campaign={campaign}
              match={match}
              guestMode={isGuestUser(currentUser)}
            />
          ))}
        </div>
      ) : null}
      <section className="space-y-4">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Ballot initiatives</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Measures on the same ballot</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Local and state initiatives appear here with community sentiment, related issues, and links to fuller context.
          </p>
        </div>
        {election.ballotInitiatives.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {election.ballotInitiatives.map((initiative) => (
              <BallotInitiativeCard key={initiative.id} initiative={initiative} />
            ))}
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/75 p-6 text-sm text-slate-600 shadow-card">
            No ballot measures are tied to this election yet.
          </div>
        )}
      </section>
      {!hasImportedCandidates ? (
        <details className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Detailed comparison</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Issue-by-issue breakdown</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Open for the full alignment breakdown once you have scanned the main candidate comparison cards.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Open</span>
          </summary>
          <div className="mt-5 space-y-4">
            {validCandidateCards.length ? (
              validCandidateCards.map(({ match, campaign }) => <CandidateMatchBreakdown key={`breakdown-${campaign.id}`} match={match} />)
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">
                Issue-by-issue comparison is not available yet.
              </div>
            )}
          </div>
        </details>
      ) : null}
      {!hasImportedCandidates && (!election.candidates.length || !validCandidateCards.length) ? (
        <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/75 p-6 text-sm text-slate-600 shadow-card">
          Participation context is limited right now because candidate records for this election are incomplete.
        </section>
      ) : null}
    </>
  );
}
