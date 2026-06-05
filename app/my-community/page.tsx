import Link from "next/link";

import { CommunityHero } from "@/components/domain/community-hero";
import { CommunitySelector } from "@/components/domain/community-selector";
import { HomeUpcomingElectionsPane } from "@/components/domain/home-upcoming-elections-pane";
import { SectionHeading } from "@/components/ui/section-heading";
import type { FavoriteTargetType } from "@/lib/favorites/types";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getAllOrganizations } from "@/lib/organizations/store";
import { getAllPetitions } from "@/lib/petitions/store";
import { getPublicPeopleDirectory } from "@/lib/profile/discovery";
import { getOfficials } from "@/lib/officials/store";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getAllCases } from "@/lib/cases/store";
import { getCommunityById, getDefaultCommunityForUser, seededCommunities } from "@/lib/community/communities";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getCommunityHero } from "@/lib/community/place-data";
import { getFeedDebatePreviews } from "@/lib/debates/store";
import { getContextualPostPreviews, getPerspectiveType } from "@/lib/feed/posts";
import { getFavoritesForUser } from "@/lib/server/favorites";
import { getIssueDirectoryForUser } from "@/lib/server/issues";
import { getCandidateProfiles, getElectionSummaries } from "@/lib/server/elections-context";
import { formatDateUtc } from "@/lib/dates";
import type { AuthUser, CommunitySummary, ElectionSummary } from "@/types/domain";

type MyCommunityPageProps = {
  searchParams?: Promise<{
    communityId?: string;
  }>;
};

type HomeFavoriteItem = {
  id: string;
  label: string;
  title: string;
  summary: string;
  href: string;
};

type TrendingItem = {
  id: string;
  label: string;
  title: string;
  summary: string;
  href: string;
  ctaLabel: string;
};

function formatElectionDate(value: string) {
  return formatDateUtc(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDaysAway(targetDate: string) {
  const target = Date.parse(targetDate);
  const today = Date.now();
  const diff = target - today;
  const dayCount = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

  if (dayCount === 0) return "Today";
  if (dayCount === 1) return "1 day away";
  return `${dayCount} days away`;
}

function clipText(value: string | null | undefined, max = 140) {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function getElectionLevelLabel(election: ElectionSummary) {
  const jurisdiction = election.jurisdictionName.toLowerCase();
  const title = `${election.title} ${election.officeTitle}`.toLowerCase();

  if (election.isCommunityVoteOnly || title.includes("campus")) return "Campus";
  if (title.includes("school")) return "School board";
  if (jurisdiction === "united states") return "Federal";
  if (jurisdiction === "nevada") return "State";
  if (jurisdiction.includes("county")) return "County";
  return "Local";
}

function getNextElectionMilestone(election: ElectionSummary) {
  const now = Date.now();
  const milestones = [
    { label: "Registration deadline", date: election.registrationDeadline ?? null },
    { label: "Mail ballot deadline", date: election.mailBallotDeadline ?? null },
    { label: "Early voting starts", date: election.earlyVotingStartsAt ?? null },
    { label: "Election day", date: election.electionDate },
    { label: "Polls close", date: election.pollsCloseAt ?? null },
  ];

  return (
    milestones.find((milestone) => {
      const timestamp = milestone.date ? Date.parse(milestone.date) : Number.NaN;
      return Number.isFinite(timestamp) && timestamp >= now;
    }) ?? {
      label: "Election day",
      date: election.electionDate,
    }
  );
}

function getElectionRelevanceNote(
  election: ElectionSummary,
  currentCommunity: CommunitySummary,
  user: AuthUser,
  studentCampus: CommunitySummary | null,
) {
  if (studentCampus && election.communityId === studentCampus.id) {
    return "Your campus community";
  }

  if (/school board/i.test(`${election.title} ${election.officeTitle}`)) {
    return "Your school district";
  }

  if (election.jurisdictionName === "United States") {
    return "National election";
  }

  if (election.jurisdictionName === "Nevada") {
    return "Statewide election";
  }

  if (election.jurisdictionName === user.jurisdictionName || election.communityId === currentCommunity.id) {
    return /county/i.test(currentCommunity.name) ? "This applies to your county" : "This applies to your city";
  }

  if (/county/i.test(election.jurisdictionName)) {
    return "Countywide election";
  }

  return `Relevant to ${currentCommunity.name}`;
}

function getUpcomingElectionsForUser(
  elections: ElectionSummary[],
  currentCommunity: CommunitySummary,
  user: AuthUser,
  studentCampus: CommunitySummary | null,
) {
  const jurisdictionMatches = new Set<string>([
    "United States",
    "Nevada",
    user.jurisdictionName,
    currentCommunity.primaryJurisdictionName,
    ...currentCommunity.jurisdictionMatches,
    ...(studentCampus ? [studentCampus.primaryJurisdictionName, ...studentCampus.jurisdictionMatches] : []),
  ]);
  const communityMatches = new Set<string>([
    currentCommunity.id,
    "nevada",
    "united-states",
    ...(studentCampus ? [studentCampus.id] : []),
  ]);

  return elections
    .filter((election) => {
      const milestone = getNextElectionMilestone(election);
      const nextDate = milestone.date ? Date.parse(milestone.date) : Number.NaN;

      if (!Number.isFinite(nextDate) || nextDate < Date.now()) {
        return false;
      }

      return jurisdictionMatches.has(election.jurisdictionName) || (election.communityId ? communityMatches.has(election.communityId) : false);
    })
    .sort((left, right) => {
      const leftDate = Date.parse(getNextElectionMilestone(left).date ?? left.electionDate);
      const rightDate = Date.parse(getNextElectionMilestone(right).date ?? right.electionDate);
      return leftDate - rightDate;
    })
    .slice(0, 5);
}

function buildUpcomingElectionItems(
  elections: ElectionSummary[],
  currentCommunity: CommunitySummary,
  user: AuthUser,
  studentCampus: CommunitySummary | null,
) {
  return elections.map((election) => {
    const milestone = getNextElectionMilestone(election);
    const candidates = Array.isArray(election.candidates) ? election.candidates : [];
    const importedCandidates = Array.isArray(election.importedCandidates) ? election.importedCandidates : [];
    const ballotInitiatives = Array.isArray(election.ballotInitiatives) ? election.ballotInitiatives : [];
    const candidateCount = candidates.length + importedCandidates.length;
    const keyRaceSummary = candidateCount
      ? `${candidateCount} candidate record${candidateCount === 1 ? "" : "s"} are already visible from imported Nevada beta data and profile records.`
      : `${election.officeTitle} and the items on this ballot are the key things to watch here.`;
    const ballotMeasureNames = ballotInitiatives.slice(0, 3).map((initiative) => initiative.title).filter(Boolean);

    return {
      id: election.id,
      title: election.title,
      jurisdictionLabel: election.jurisdictionName,
      levelLabel: getElectionLevelLabel(election),
      dateLabel: formatElectionDate(election.electionDate),
      countdownLabel: `${milestone.label} · ${formatDaysAway(milestone.date ?? election.electionDate)}`,
      milestoneLabel: milestone.label,
      relevanceNote: getElectionRelevanceNote(election, currentCommunity, user, studentCampus),
      summary:
        election.ballotSummary ??
        "Open this election to compare candidates, review ballot items, and stay ahead of the next important deadline.",
      keyRacesSummary: keyRaceSummary,
      ballotMeasuresSummary: ballotMeasureNames.length
        ? ballotMeasureNames.join(" · ")
        : "No ballot measures are highlighted for this election yet.",
      href: `/elections/${election.id}`,
      sourceLabel: election.sourceLabel ?? null,
    };
  });
}

function getFavoriteLabel(targetType: FavoriteTargetType) {
  switch (targetType) {
    case "community":
      return "Community";
    case "issue":
      return "Saved issue";
    case "candidate":
      return "Followed candidate";
    case "official":
      return "Followed official";
    case "petition":
      return "Saved petition";
    case "election":
      return "Saved election";
    case "organization":
      return "Coalition / group";
    case "event":
      return "Saved event";
    case "person":
      return "Citizen";
    case "case":
      return "Public-interest case";
  }
}

async function loadCommunityDataset<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error(`[my-community] ${label} loader failed`, error);
    return fallback;
  }
}

export default async function MyCommunityPage({ searchParams }: MyCommunityPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const selectedCommunityId = params?.communityId ?? getDefaultCommunityForUser(user).id;
  const currentCommunity = getCommunityById(selectedCommunityId) ?? getDefaultCommunityForUser(user);
  const studentCampus =
    user.studentVerified && user.studentCampusCommunityId ? (getCommunityById(user.studentCampusCommunityId) ?? null) : null;

  const [
    elections,
    favoriteRecords,
    topIssues,
    events,
    previewPosts,
    previewDebates,
    petitions,
    issueDirectory,
    people,
    candidates,
    officials,
    cases,
    organizations,
  ] = await Promise.all([
    loadCommunityDataset("elections", getElectionSummaries(), []),
    loadCommunityDataset("favorites", getFavoritesForUser(user.id), []),
    loadCommunityDataset("top issues", getTopIssuesForUser(user, "all", selectedCommunityId), []),
    loadCommunityDataset("events", getDiscoverableEventsForUser(user, { communityId: selectedCommunityId, scope: "all", limit: 8 }), []),
    loadCommunityDataset(
      "posts",
      getContextualPostPreviews({
        viewerUserId: user.id,
        limit: 3,
        attachments: [{ type: "community", id: selectedCommunityId, label: currentCommunity.name }],
        preferredRoles: ["trustedCitizen", "official", "candidate", "media"],
      }),
      [],
    ),
    loadCommunityDataset("debates", getFeedDebatePreviews({ jurisdictionNames: currentCommunity.jurisdictionMatches, limit: 3 }), []),
    loadCommunityDataset("petitions", getAllPetitions(), []),
    loadCommunityDataset("issue directory", getIssueDirectoryForUser(user, { communityId: selectedCommunityId }), []),
    loadCommunityDataset("people", getPublicPeopleDirectory(user), []),
    loadCommunityDataset("candidates", getCandidateProfiles(), []),
    loadCommunityDataset("officials", getOfficials(), []),
    loadCommunityDataset("cases", getAllCases(), []),
    loadCommunityDataset("organizations", getAllOrganizations(user), []),
  ]);

  const upcomingElections = getUpcomingElectionsForUser(elections, currentCommunity, user, studentCampus);
  const upcomingElectionItems = buildUpcomingElectionItems(upcomingElections, currentCommunity, user, studentCampus);

  const favoriteItems = favoriteRecords
    .map((record): HomeFavoriteItem | null => {
      switch (record.targetType) {
        case "community": {
          const community = seededCommunities.find((entry) => entry.id === record.targetId);
          if (!community) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: community.name,
            summary: community.descriptor,
            href: `/my-community?communityId=${community.id}`,
          };
        }
        case "issue": {
          const issue = issueDirectory.find((entry) => entry.id === record.targetId);
          if (!issue) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: issue.issueText,
            summary: `${issue.jurisdictionName} · ${issue.upvoteCount} people elevating this issue`,
            href: `/issues/${slugifyIssueText(issue.issueText)}`,
          };
        }
        case "person": {
          const person = people.find((entry) => entry.id === record.targetId);
          if (!person) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: person.name,
            summary: `${person.jurisdictionName} · ${clipText(person.bio, 90) || "Public citizen profile"}`,
            href: `/citizens/${person.id}`,
          };
        }
        case "candidate": {
          const candidate = candidates.find((entry) => entry.id === record.targetId);
          if (!candidate) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: candidate.name,
            summary: `${candidate.partyText ?? "Candidate"} · ${candidate.jurisdictionName}`,
            href: `/candidates/${candidate.id}`,
          };
        }
        case "official": {
          const official = officials.find((entry) => entry.id === record.targetId);
          if (!official) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: official.name,
            summary: `${official.officeTitle ?? "Official"} · ${official.jurisdictionName}`,
            href: `/officials/${official.id}`,
          };
        }
        case "petition": {
          const petition = petitions.find((entry) => entry.id === record.targetId);
          if (!petition) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: petition.title,
            summary: `${petition.signatureCount} signatures · ${petition.jurisdictionName}`,
            href: `/petitions/${petition.id}`,
          };
        }
        case "case": {
          const caseItem = cases.find((entry) => entry.id === record.targetId);
          if (!caseItem) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: caseItem.title,
            summary: `${caseItem.jurisdictionName} · ${clipText(caseItem.summary, 90)}`,
            href: `/cases/${caseItem.id}`,
          };
        }
        case "event": {
          const event = events.find((entry) => entry.id === record.targetId);
          if (!event) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: event.title,
            summary: `${formatElectionDate(event.startsAt)} · ${event.distanceLabel}`,
            href: `/events/${event.id}`,
          };
        }
        case "election": {
          const election = elections.find((entry) => entry.id === record.targetId);
          if (!election) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: election.title,
            summary: `${election.jurisdictionName} · ${formatElectionDate(election.electionDate)}`,
            href: `/elections/${election.id}`,
          };
        }
        case "organization": {
          const organization = organizations.find((entry) => entry.id === record.targetId);
          if (!organization) return null;
          return {
            id: `${record.targetType}-${record.targetId}`,
            label: getFavoriteLabel(record.targetType),
            title: organization.name,
            summary: `${organization.jurisdictionName} · ${clipText(organization.description, 90)}`,
            href: `/organizations/${organization.id}`,
          };
        }
      }
    })
    .filter((item): item is HomeFavoriteItem => item !== null)
    .slice(0, 5);

  const relevantPetition =
    petitions.find((petition) => currentCommunity.jurisdictionMatches.includes(petition.jurisdictionName)) ?? petitions[0] ?? null;

  const trendingItems: TrendingItem[] = [
    topIssues[0]
      ? {
          id: `issue-${topIssues[0].id}`,
          label: "Trending issue",
          title: topIssues[0].issueText,
          summary: `${topIssues[0].upvoteCount} people are elevating this across ${currentCommunity.name}.`,
          href: `/issues/${slugifyIssueText(topIssues[0].issueText)}`,
          ctaLabel: "View",
        }
      : null,
    relevantPetition
      ? {
          id: `petition-${relevantPetition.id}`,
          label: "Active petition",
          title: relevantPetition.title,
          summary: `${relevantPetition.signatureCount} signatures and building momentum in ${relevantPetition.jurisdictionName}.`,
          href: `/petitions/${relevantPetition.id}`,
          ctaLabel: "View",
        }
      : null,
    events[0]
      ? {
          id: `event-${events[0].id}`,
          label: "Upcoming civic meeting",
          title: events[0].title,
          summary: `${formatElectionDate(events[0].startsAt)} · ${events[0].distanceLabel} · ${clipText(events[0].description, 90)}`,
          href: `/events/${events[0].id}`,
          ctaLabel: "View",
        }
      : null,
    previewPosts[0]
      ? {
          id: `post-${previewPosts[0].id}`,
          label:
            getPerspectiveType(previewPosts[0]) === "official_update"
              ? "Official update"
              : getPerspectiveType(previewPosts[0]) === "candidate_statement"
                ? "Candidate statement"
                : getPerspectiveType(previewPosts[0]) === "media_summary"
                  ? "Media summary"
                  : "Perspective",
          title: previewPosts[0].title ?? previewPosts[0].authorName,
          summary: clipText(previewPosts[0].content, 110),
          href: `/posts/${previewPosts[0].id}`,
          ctaLabel: "View",
        }
      : null,
    previewDebates[0]
      ? {
          id: `debate-${previewDebates[0].id}`,
          label: "Trusted debate",
          title: previewDebates[0].title,
          summary: clipText(previewDebates[0].description, 110),
          href: `/debates/${previewDebates[0].id}`,
          ctaLabel: "View",
        }
      : null,
  ].filter((item): item is TrendingItem => item !== null).slice(0, 5);

  return (
    <div className="space-y-8 py-8">
      <CommunityHero community={getCommunityHero(selectedCommunityId)} />

      <CommunitySelector
        currentCommunity={currentCommunity}
        followedCommunities={[]}
        suggestedCommunities={[]}
        followedIds={[]}
        returnPath="/my-community"
      />

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Upcoming Elections"
            title="Upcoming Elections"
            description="The next election, deadline, or ballot moment tied to your local, county, state, campus, and national civic life."
          />
          <Link
            href={`/representatives?community=${selectedCommunityId === "unr" || selectedCommunityId === "asun" ? "campus" : selectedCommunityId}`}
            className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
          >
            Who represents me?
          </Link>
        </div>
        <div className="mt-6">
          <HomeUpcomingElectionsPane elections={upcomingElectionItems} />
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Favorites"
            title="Saved civic items"
            description="A short list of the communities, issues, officials, candidates, petitions, and civic items you want to keep close."
          />
          <Link
            href={`/explore?communityId=${selectedCommunityId}`}
            className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
          >
            View all
          </Link>
        </div>

        {favoriteItems.length ? (
          <div className="mt-6 space-y-3">
            {favoriteItems.map((item) => (
              <article key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{item.label}</p>
                    <h3 className="mt-2 text-base font-semibold text-slate-50">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.summary}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                  >
                    View
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
            Save communities, issues, officials, or petitions to see them here.
          </div>
        )}
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading
          eyebrow="Summary & Trending"
          title="Summary & Trending"
          description="A quick civic read so you can see what matters nearby without falling into a full feed."
        />

        {trendingItems.length ? (
          <div className="mt-6 space-y-3">
            {trendingItems.map((item) => (
              <article key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{item.label}</p>
                    <h3 className="mt-2 text-base font-semibold text-slate-50">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.summary}</p>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                  >
                    {item.ctaLabel}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
            Nothing major is trending in your area yet.
          </div>
        )}
      </section>
    </div>
  );
}
