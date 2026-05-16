import Link from "next/link";

import { HomeGuidedActionCard } from "@/components/domain/home-guided-action-card";
import { HomeVotePreviewPane } from "@/components/domain/home-vote-preview-pane";
import { HomeUpcomingElectionsPane } from "@/components/domain/home-upcoming-elections-pane";
import { SectionHeading } from "@/components/ui/section-heading";
import { canUserVote } from "@/lib/auth/guards";
import type { FavoriteTargetType } from "@/lib/favorites/types";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getAllOrganizations } from "@/lib/organizations/store";
import { getAllPetitions } from "@/lib/petitions/store";
import { getPublicPeopleDirectory } from "@/lib/profile/discovery";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getAllCases } from "@/lib/cases/store";
import { getCommunityById, getDefaultCommunityForUser, seededCommunities } from "@/lib/community/communities";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getFeedDebatePreviews } from "@/lib/debates/store";
import { getDailyVoteExperience } from "@/lib/feed/quick-votes";
import { getContextualPostPreviews, getPerspectiveType } from "@/lib/feed/posts";
import { getFavoritesForUser } from "@/lib/server/favorites";
import { getIssueDirectoryForUser } from "@/lib/server/issues";
import { getCandidateProfiles, getElectionSummaries, getOfficials } from "@/lib/server/elections-context";
import type { AuthUser, CommunitySummary, ElectionSummary } from "@/types/domain";

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

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
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
    milestones.find((milestone) => milestone.date && Date.parse(milestone.date) >= now) ?? {
      label: "Election day",
      date: election.electionDate,
    }
  );
}

function getElectionRelevanceNote(
  election: ElectionSummary,
  defaultCommunity: CommunitySummary,
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

  if (election.jurisdictionName === user.jurisdictionName) {
    return /county/i.test(user.jurisdictionName) ? "This applies to your county" : "This applies to your city";
  }

  if (election.communityId === defaultCommunity.id) {
    return `This applies to ${defaultCommunity.name}`;
  }

  if (/county/i.test(election.jurisdictionName)) {
    return "Countywide election";
  }

  return `Relevant to ${defaultCommunity.name}`;
}

function getUpcomingElectionsForUser(
  elections: ElectionSummary[],
  defaultCommunity: CommunitySummary,
  user: AuthUser,
  studentCampus: CommunitySummary | null,
) {
  const jurisdictionMatches = new Set<string>([
    "United States",
    "Nevada",
    user.jurisdictionName,
    defaultCommunity.primaryJurisdictionName,
    ...defaultCommunity.jurisdictionMatches,
    ...(studentCampus ? [studentCampus.primaryJurisdictionName, ...studentCampus.jurisdictionMatches] : []),
  ]);
  const communityMatches = new Set<string>([
    defaultCommunity.id,
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
  defaultCommunity: CommunitySummary,
  user: AuthUser,
  studentCampus: CommunitySummary | null,
) {
  return elections.map((election) => {
    const milestone = getNextElectionMilestone(election);
    const keyRaceSummary = election.candidates.length
      ? `${election.candidates.length} candidate${election.candidates.length === 1 ? "" : "s"} are already visible for side-by-side comparison.`
      : `${election.officeTitle} and the items on this ballot are the key things to watch here.`;
    const ballotMeasureNames = election.ballotInitiatives.slice(0, 3).map((initiative) => initiative.title);

    return {
      id: election.id,
      title: election.title,
      jurisdictionLabel: election.jurisdictionName,
      levelLabel: getElectionLevelLabel(election),
      dateLabel: formatDateLabel(election.electionDate),
      countdownLabel: `${milestone.label} · ${formatDaysAway(milestone.date ?? election.electionDate)}`,
      milestoneLabel: milestone.label,
      relevanceNote: getElectionRelevanceNote(election, defaultCommunity, user, studentCampus),
      summary:
        election.ballotSummary ??
        "Open this election to compare candidates, review ballot items, and stay ahead of the next important deadline.",
      keyRacesSummary: keyRaceSummary,
      ballotMeasuresSummary: ballotMeasureNames.length
        ? ballotMeasureNames.join(" · ")
        : "No ballot measures are highlighted for this election yet.",
      href: `/elections/${election.id}`,
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

export default async function HomePage() {
  const user = await getCurrentUser();
  const defaultCommunity = getDefaultCommunityForUser(user);
  const studentCampus =
    user.studentVerified && user.studentCampusCommunityId ? (getCommunityById(user.studentCampusCommunityId) ?? null) : null;

  const [
    elections,
    favoriteRecords,
    dailyVotes,
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
    getElectionSummaries(),
    getFavoritesForUser(user.id),
    getDailyVoteExperience(user).catch(() => ({
      currentQuestion: null,
      progress: { answered: 0, total: 0, current: 0 },
      pulseQuestions: [],
      remainingQuestions: 0,
      dailyQuestions: [],
    })),
    getTopIssuesForUser(user, "all", defaultCommunity.id),
    getDiscoverableEventsForUser(user, { scope: "all", limit: 8 }),
    getContextualPostPreviews({
      viewerUserId: user.id,
      limit: 3,
      attachments: [
        { type: "community", id: defaultCommunity.id, label: defaultCommunity.name },
        ...(studentCampus ? [{ type: "community" as const, id: studentCampus.id, label: studentCampus.name }] : []),
      ],
      preferredRoles: ["trustedCitizen", "official", "candidate", "media"],
    }),
    getFeedDebatePreviews({ jurisdictionNames: defaultCommunity.jurisdictionMatches, limit: 3 }),
    getAllPetitions(),
    getIssueDirectoryForUser(user, { communityId: defaultCommunity.id }),
    getPublicPeopleDirectory(user),
    getCandidateProfiles(),
    getOfficials(),
    getAllCases(),
    getAllOrganizations(user),
  ]);

  const upcomingElections = getUpcomingElectionsForUser(elections, defaultCommunity, user, studentCampus);
  const upcomingElectionItems = buildUpcomingElectionItems(upcomingElections, defaultCommunity, user, studentCampus);
  const canVoteNow = canUserVote(user);
  const votePreviewQuestions = dailyVotes.dailyQuestions.slice(0, 3);

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
            href: community.communityType === "campus" ? `/campuses/${community.id}` : `/my-community?communityId=${community.id}`,
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
            summary: `${official.officeTitle} · ${official.jurisdictionName}`,
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
            summary: `${formatDateLabel(event.startsAt)} · ${event.distanceLabel}`,
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
            summary: `${election.jurisdictionName} · ${formatDateLabel(election.electionDate)}`,
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
    petitions.find((petition) => defaultCommunity.jurisdictionMatches.includes(petition.jurisdictionName)) ?? petitions[0] ?? null;

  const trendingItems: TrendingItem[] = [
    topIssues[0]
      ? {
          id: `issue-${topIssues[0].id}`,
          label: "Trending issue",
          title: topIssues[0].issueText,
          summary: `${topIssues[0].upvoteCount} people are elevating this across your civic view.`,
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
          summary: `${formatDateLabel(events[0].startsAt)} · ${events[0].distanceLabel} · ${clipText(events[0].description, 90)}`,
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
      <HomeGuidedActionCard
        communityName={defaultCommunity.name}
        communityHref={`/my-community?communityId=${defaultCommunity.id}`}
        primaryElectionHref={upcomingElectionItems[0]?.href ?? "/elections"}
        primaryIssueHref={topIssues[0] ? `/issues/${slugifyIssueText(topIssues[0].issueText)}` : "/issues"}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)] xl:items-start">
      <div className="space-y-6">
      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading
          eyebrow="Active Votes"
          title="Verified voters create change by voting regularly"
          description="Start with the next available vote and keep your civic signal current. Home stays simple; Vote is still where the full queue lives."
        />
        <div className="mt-6">
          <HomeVotePreviewPane questions={votePreviewQuestions} canVote={canVoteNow} />
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <SectionHeading
          eyebrow="Upcoming Elections"
          title="Upcoming Elections"
          description="The next election or deadline across the jurisdictions that apply to you."
        />
        <div className="mt-6">
          <HomeUpcomingElectionsPane elections={upcomingElectionItems} />
        </div>
      </section>
      </div>
      <div className="space-y-6">
      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Favorites"
            title="Saved civic items"
            description="Keep the communities, issues, officials, petitions, and civic items you care about close at hand."
          />
          <Link href="/explore?favorites=1" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
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
          title="What your community is talking about"
          description="A quick civic read across the local, county, state, and national layers that matter to you right now."
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
            <div className="pt-2">
              <Link
                href="/explore"
                className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
              >
                Explore More
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
            Nothing major is trending in your area yet.
          </div>
        )}
      </section>
      </div>
      </div>
    </div>
  );
}
