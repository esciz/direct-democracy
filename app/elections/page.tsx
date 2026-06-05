import Link from "next/link";

import { ElectionCard } from "@/components/domain/election-card";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { PageIntro } from "@/components/ui/page-intro";
import { getPublicImportedElections } from "@/lib/civic-data/public";
import {
  getCitiesForCounty,
  getCitiesForState,
  getCommunityById,
  getCountiesForState,
  getDefaultCommunityForUser,
} from "@/lib/community/communities";
import { getCurrentUser } from "@/lib/server/auth-session";
import { formatDateUtc } from "@/lib/dates";
import { getCandidateProfiles, getElectionSummaries } from "@/lib/server/elections-context";
import type { BallotInitiativeSummary, CommunitySummary, ElectionSummary } from "@/types/domain";

type ElectionsPageProps = {
  searchParams?: Promise<{
    view?: string;
    state?: string;
    county?: string;
    city?: string;
  }>;
};

type StateTile = {
  code: string;
  name: string;
  row: number;
  col: number;
  communityId?: string;
};

const US_STATE_TILES: StateTile[] = [
  { code: "WA", name: "Washington", row: 1, col: 1 },
  { code: "MT", name: "Montana", row: 1, col: 3 },
  { code: "ND", name: "North Dakota", row: 1, col: 5 },
  { code: "MN", name: "Minnesota", row: 1, col: 7 },
  { code: "WI", name: "Wisconsin", row: 1, col: 8 },
  { code: "MI", name: "Michigan", row: 1, col: 9 },
  { code: "VT", name: "Vermont", row: 1, col: 11 },
  { code: "ME", name: "Maine", row: 1, col: 12 },
  { code: "OR", name: "Oregon", row: 2, col: 1 },
  { code: "ID", name: "Idaho", row: 2, col: 2 },
  { code: "WY", name: "Wyoming", row: 2, col: 3 },
  { code: "SD", name: "South Dakota", row: 2, col: 5 },
  { code: "IA", name: "Iowa", row: 2, col: 7 },
  { code: "IL", name: "Illinois", row: 2, col: 8 },
  { code: "IN", name: "Indiana", row: 2, col: 9 },
  { code: "OH", name: "Ohio", row: 2, col: 10 },
  { code: "NH", name: "New Hampshire", row: 2, col: 11 },
  { code: "CA", name: "California", row: 3, col: 1 },
  { code: "NV", name: "Nevada", row: 3, col: 2, communityId: "nevada" },
  { code: "UT", name: "Utah", row: 3, col: 3 },
  { code: "CO", name: "Colorado", row: 3, col: 4 },
  { code: "NE", name: "Nebraska", row: 3, col: 5 },
  { code: "MO", name: "Missouri", row: 3, col: 7 },
  { code: "KY", name: "Kentucky", row: 3, col: 8 },
  { code: "WV", name: "West Virginia", row: 3, col: 9 },
  { code: "PA", name: "Pennsylvania", row: 3, col: 10 },
  { code: "NY", name: "New York", row: 3, col: 11 },
  { code: "MA", name: "Massachusetts", row: 3, col: 12 },
  { code: "AZ", name: "Arizona", row: 4, col: 2 },
  { code: "NM", name: "New Mexico", row: 4, col: 3 },
  { code: "KS", name: "Kansas", row: 4, col: 5 },
  { code: "AR", name: "Arkansas", row: 4, col: 7 },
  { code: "TN", name: "Tennessee", row: 4, col: 8 },
  { code: "VA", name: "Virginia", row: 4, col: 9 },
  { code: "NC", name: "North Carolina", row: 4, col: 10 },
  { code: "SC", name: "South Carolina", row: 4, col: 11 },
  { code: "OK", name: "Oklahoma", row: 5, col: 5 },
  { code: "LA", name: "Louisiana", row: 5, col: 7 },
  { code: "MS", name: "Mississippi", row: 5, col: 8 },
  { code: "AL", name: "Alabama", row: 5, col: 9 },
  { code: "GA", name: "Georgia", row: 5, col: 10 },
  { code: "FL", name: "Florida", row: 6, col: 11 },
  { code: "AK", name: "Alaska", row: 7, col: 1 },
  { code: "HI", name: "Hawaii", row: 7, col: 3 },
  { code: "TX", name: "Texas", row: 6, col: 5 },
  { code: "NJ", name: "New Jersey", row: 4, col: 12 },
  { code: "MD", name: "Maryland", row: 4, col: 12 },
  { code: "DE", name: "Delaware", row: 5, col: 12 },
  { code: "CT", name: "Connecticut", row: 4, col: 11 },
  { code: "RI", name: "Rhode Island", row: 4, col: 12 },
];

function formatLongDate(isoDate: string) {
  return formatDateUtc(isoDate, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(isoDate: string) {
  return formatDateUtc(isoDate, {
    month: "short",
    day: "numeric",
  });
}

function getCountdownLabel(isoDate: string) {
  const ms = Date.parse(isoDate) - Date.now();
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));

  if (days === 0) return "Today";
  if (days === 1) return "1 day away";
  if (days < 30) return `${days} days away`;

  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} away`;
}

function getElectionCategory(election: ElectionSummary) {
  const office = `${election.officeTitle} ${election.title}`.toLowerCase();

  if (election.isCommunityVoteOnly || office.includes("student")) return "Student Elections";
  if (office.includes("school")) return "Schools";
  if (office.includes("judge") || office.includes("justice") || office.includes("court")) return "Judges";

  if (
    office.includes("governor") ||
    office.includes("president") ||
    office.includes("mayor") ||
    office.includes("sheriff") ||
    office.includes("leader")
  ) {
    return "Leaders";
  }

  return "Legislators";
}

function getJurisdictionSetForCommunity(community: CommunitySummary | null) {
  if (!community) {
    return null;
  }

  return new Set<string>([community.primaryJurisdictionName, ...community.jurisdictionMatches]);
}

function getFilteredElections(
  elections: ElectionSummary[],
  filters: {
    stateCommunity?: CommunitySummary | null;
    countyCommunity?: CommunitySummary | null;
    cityCommunity?: CommunitySummary | null;
  },
) {
  const target = filters.cityCommunity ?? filters.countyCommunity ?? filters.stateCommunity ?? null;
  const jurisdictionSet = getJurisdictionSetForCommunity(target);

  if (!jurisdictionSet) {
    return elections;
  }

  return elections.filter((election) => jurisdictionSet.has(election.jurisdictionName));
}

type BallotQuestionPreview = {
  initiative: BallotInitiativeSummary;
  electionDate: string;
  electionStatus: ElectionSummary["electionStatus"];
};

function groupElectionCategories(elections: ElectionSummary[]) {
  const categories = new Map<string, ElectionSummary[]>();

  for (const election of elections) {
    const category = getElectionCategory(election);
    categories.set(category, [...(categories.get(category) ?? []), election]);
  }

  return categories;
}

function collectBallotQuestions(elections: ElectionSummary[]) {
  return elections.flatMap((election) =>
    election.ballotInitiatives.map((initiative) => ({
      initiative,
      electionDate: election.electionDate,
      electionStatus: election.electionStatus,
    })),
  );
}

function getStateMapHref(tile: StateTile) {
  return tile.communityId ? `/elections?view=all&state=${tile.communityId}` : `/elections?view=all&state=${tile.code.toLowerCase()}`;
}

function CompactElectionPreview({ election, communityId }: { election: ElectionSummary; communityId: string }) {
  const endorseCandidatesHref = `/candidates?communityId=${encodeURIComponent(communityId)}&sort=race`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{election.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatShortDate(election.electionDate)} · {getCountdownLabel(election.electionDate)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <FavoriteToggleControl targetType="election" targetId={election.id} />
          <Link href={`/elections/${election.id}`} className="text-xs font-semibold text-civic-700 hover:text-civic-800">
            View
          </Link>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {election.candidates.length} candidate{election.candidates.length === 1 ? "" : "s"}
        </span>
        {election.sourceLabel ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Imported Nevada beta data
          </span>
        ) : null}
        <Link
          href={endorseCandidatesHref}
          className="rounded-full border border-civic-200 bg-white px-3 py-1 text-xs font-semibold text-civic-700 transition hover:border-civic-500"
        >
          Endorse Candidates
        </Link>
      </div>
    </div>
  );
}

function CompactBallotQuestionPreview({ preview }: { preview: BallotQuestionPreview }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">Ballot Question</p>
          <p className="mt-2 text-sm font-semibold text-ink">{preview.initiative.title}</p>
          <p className="mt-2 text-sm text-slate-600">{preview.initiative.summary}</p>
        </div>
        <Link href={`/initiatives/${preview.initiative.id}`} className="text-xs font-semibold text-civic-700 hover:text-civic-800">
          View
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {preview.initiative.jurisdictionName}
        </span>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
          {formatShortDate(preview.electionDate)} · {getCountdownLabel(preview.electionDate)}
        </span>
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
          {preview.electionStatus}
        </span>
      </div>
    </div>
  );
}

export default async function ElectionsPage({ searchParams }: ElectionsPageProps) {
  const currentUser = await getCurrentUser();
  const importedElections = await getPublicImportedElections();
  const params = searchParams ? await searchParams : undefined;
  const view = params?.view === "all" ? "all" : "my";

  const stateCommunity =
    view === "all" && params?.state && getCommunityById(params.state)?.scope === "state" ? getCommunityById(params.state) ?? null : null;
  const countyCommunity =
    view === "all" && params?.county ? getCommunityById(params.county) ?? null : null;
  const cityCommunity =
    view === "all" && params?.city ? getCommunityById(params.city) ?? null : null;

  if (view === "all") {
    const elections = await getElectionSummaries(currentUser.id);
    const filteredElections = getFilteredElections(elections, {
      stateCommunity,
      countyCommunity,
      cityCommunity,
    });
    const categories = groupElectionCategories(filteredElections);
    const ballotQuestions = collectBallotQuestions(filteredElections);
    const counties = stateCommunity ? getCountiesForState(stateCommunity.id) : [];
    const cities = countyCommunity
      ? getCitiesForCounty(countyCommunity.id)
      : stateCommunity
        ? getCitiesForState(stateCommunity.id)
        : [];

    const hierarchy = [
      { label: "USA", href: "/elections?view=all", active: !stateCommunity && !countyCommunity && !cityCommunity },
      ...(stateCommunity ? [{ label: stateCommunity.name, href: `/elections?view=all&state=${stateCommunity.id}`, active: !countyCommunity && !cityCommunity }] : []),
      ...(countyCommunity
        ? [{ label: countyCommunity.name, href: `/elections?view=all&state=${stateCommunity?.id ?? "nevada"}&county=${countyCommunity.id}`, active: !cityCommunity }]
        : []),
      ...(cityCommunity
        ? [
            {
              label: cityCommunity.name,
              href: `/elections?view=all&state=${stateCommunity?.id ?? "nevada"}&county=${countyCommunity?.id ?? ""}&city=${cityCommunity.id}`,
              active: true,
            },
          ]
        : []),
    ];

    return (
      <div className="space-y-8 py-8">
        <PageIntro
          eyebrow="Elections"
          title="Find the next election that affects you"
          description="Start with a simple map drill-down, open one race or ballot question at a time, and only go deeper when you want the full comparison."
          actions={
            <Link
              href="/elections"
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Back to My Jurisdictions
            </Link>
          }
        />

        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Start here</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Use elections like a guided lookup, not a giant dashboard</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">1. Choose the place you care about first.</div>
                <div className="rounded-2xl bg-civic-50/70 p-4 text-sm leading-6 text-slate-700">2. Read one race or ballot question summary before comparing everything.</div>
                <div className="rounded-2xl bg-amber-50/80 p-4 text-sm leading-6 text-slate-700">3. Open the full detail page only when you want the deeper record.</div>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Best first moves</p>
              <div className="mt-4 space-y-2">
                {["Pick your state", "Open the next race", "Check ballot questions", "Compare candidates only if needed"].map((step) => (
                  <div key={step} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {hierarchy.map((entry) => (
              <Link
                key={entry.href}
                href={entry.href}
                scroll={false}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  entry.active ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-civic-500 hover:text-civic-700"
                }`}
              >
                {entry.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">USA map</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Choose a state</h2>
              <p className="mt-2 text-sm text-slate-600">Use the map to drill down into statewide, county, and city election previews.</p>
            </div>
            <div className="rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              {cityCommunity?.name ?? countyCommunity?.name ?? stateCommunity?.name ?? "United States"}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <div
              className="grid min-w-[760px] gap-2"
              style={{
                gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                gridTemplateRows: "repeat(8, minmax(0, 1fr))",
              }}
            >
              {US_STATE_TILES.map((state) => {
                const active = stateCommunity?.id === state.communityId;
                return (
                  <Link
                    key={state.code}
                    href={getStateMapHref(state)}
                    scroll={false}
                    title={state.name}
                    className={`flex h-12 items-center justify-center rounded-2xl border text-xs font-semibold transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : state.communityId
                          ? "border-civic-200 bg-civic-50 text-civic-800 hover:border-civic-400 hover:bg-civic-100"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                    style={{
                      gridColumn: `${state.col} / span 1`,
                      gridRow: `${state.row} / span 1`,
                    }}
                  >
                    {state.code}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {stateCommunity ? (
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Drill down</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {countyCommunity ? "County communities" : "Counties"}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {countyCommunity
                    ? "Move one step deeper into local city election previews."
                    : "Use counties as the next drill-down layer for statewide election browsing."}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(countyCommunity ? cities : counties).map((community) => (
                <Link
                  key={community.id}
                  href={
                    countyCommunity
                      ? `/elections?view=all&state=${stateCommunity.id}&county=${countyCommunity.id}&city=${community.id}`
                      : `/elections?view=all&state=${stateCommunity.id}&county=${community.id}`
                  }
                  scroll={false}
                  className="rounded-3xl border border-slate-200 bg-white p-4 transition hover:border-civic-500 hover:shadow-card"
                >
                  <p className="text-sm font-semibold text-ink">{community.name}</p>
                  <p className="mt-2 text-sm text-slate-600">{community.descriptor}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Active and upcoming races</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {cityCommunity?.name ?? countyCommunity?.name ?? stateCommunity?.name ?? "USA"} election previews
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Preview race categories and ballot questions, then open the detail page when you want the full candidate comparison or measure detail.
            </p>
          </div>

          {ballotQuestions.length ? (
            <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Ballot Questions</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">
                    {ballotQuestions.length} question{ballotQuestions.length === 1 ? "" : "s"} on the ballot
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Preview the measures tied to this drill-down level without loading full legal text here.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {ballotQuestions.map((preview) => (
                  <CompactBallotQuestionPreview key={preview.initiative.id} preview={preview} />
                ))}
              </div>
            </section>
          ) : null}

          {filteredElections.length ? (
            Array.from(categories.entries()).map(([category, items]) => (
              <section key={category} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{category}</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">
                      {items.length} race{items.length === 1 ? "" : "s"}
                    </h3>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {items.map((election) => (
                    <CompactElectionPreview key={election.id} election={election} communityId={defaultCommunity.id} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600 shadow-card">
              No election previews are available for this drill-down level yet. Nevada currently has the most complete state → county → city seeded path.
            </section>
          )}
        </section>
      </div>
    );
  }

  const [elections, candidates] = await Promise.all([getElectionSummaries(currentUser.id), getCandidateProfiles()]);
  const defaultCommunity = getDefaultCommunityForUser(currentUser);
  const jurisdictionNames = new Set<string>([
    defaultCommunity.primaryJurisdictionName,
    ...defaultCommunity.jurisdictionMatches,
    currentUser.jurisdictionName,
    "Nevada",
    "United States",
  ]);
  const myJurisdictionElections = elections.filter((election) => jurisdictionNames.has(election.jurisdictionName));
  const myJurisdictionBallotQuestions = collectBallotQuestions(myJurisdictionElections);
  const initiativeCount = myJurisdictionElections.reduce((total, election) => total + election.ballotInitiatives.length, 0);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Elections"
        title="The next races and ballot questions around you"
        description="Start with the election summaries most relevant to your jurisdictions, then open deeper candidate comparisons and ballot details only when you need them."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {myJurisdictionElections.length} relevant elections
            </span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {candidates.length} public candidate profiles
            </span>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              {initiativeCount} ballot initiative{initiativeCount === 1 ? "" : "s"}
            </span>
          </>
        }
        actions={
          <Link
            href="/elections?view=all"
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            View Outside My Jurisdictions
          </Link>
        }
      />
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Imported Nevada data</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Election records from official sources</h2>
          </div>
          <Link href="/ballot-measures" className="text-sm font-semibold text-civic-700 hover:text-civic-900">
            Ballot measures
          </Link>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {importedElections.length > 0 ? (
            importedElections.slice(0, 6).map((election) => (
              <article key={election.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{election.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {election.officeTitle} · {election.jurisdiction.name}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{election.status}</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Imported Nevada beta data</span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {formatLongDate(election.electionDate.toISOString())} · {election.candidateCount} candidates · {election.ballotMeasureCount} measures · Source:{" "}
                  {election.source?.name ?? "No source"}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600 lg:col-span-2">No imported elections are available yet.</div>
          )}
        </div>
      </section>
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Start here</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">A beginner-safe way to use election pages</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">See the next election that touches your life.</div>
              <div className="rounded-2xl bg-civic-50/70 p-4 text-sm leading-6 text-slate-700">Read the race summary before trying to compare every candidate.</div>
              <div className="rounded-2xl bg-amber-50/80 p-4 text-sm leading-6 text-slate-700">Use ballot question previews as a quick entry into what is on the line.</div>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Participation ladder</p>
            <div className="mt-4 space-y-2">
              {["Open one election summary", "Read one ballot question", "Compare candidates", "Follow the race", "Go deeper into the full election record"].map((step) => (
                <div key={step} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="space-y-6">
        {myJurisdictionBallotQuestions.length ? (
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Ballot Questions</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Measures in my jurisdictions</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Lightweight previews of ballot measures that sit alongside your active and upcoming races.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {myJurisdictionBallotQuestions.map((preview) => (
                <CompactBallotQuestionPreview key={preview.initiative.id} preview={preview} />
              ))}
            </div>
          </section>
        ) : null}
        {myJurisdictionElections.map((election) => (
          <ElectionCard key={election.id} election={election} candidates={candidates} viewer={currentUser} />
        ))}
      </div>
    </div>
  );
}
