import { redirect } from "next/navigation";

import { HomeGuidedActionCard } from "@/components/domain/home-guided-action-card";
import {
  HomeTakeActionCard,
  type HomeTakeActionIssue,
  type HomeTakeActionMeeting,
  type HomeTakeActionPetition,
  type HomeTakeActionPoll,
  type HomeTakeActionSignal,
} from "@/components/domain/home-take-action-card";
import { canUserVote } from "@/lib/auth/guards";
import { slugifyIssueText } from "@/lib/issues/utils";
import { getAllPetitions } from "@/lib/petitions/store";
import { getFeedPollPreviews } from "@/lib/polls/store";
import { getCurrentSessionUser, getCurrentUser } from "@/lib/server/auth-session";
import { getDefaultCommunityForUser } from "@/lib/community/communities";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getFeedDebatePreviews } from "@/lib/debates/store";
import { getDailyVoteExperience } from "@/lib/feed/quick-votes";
import { getContextualPostPreviews, getPerspectiveType } from "@/lib/feed/posts";
import { getFavoritesForUser } from "@/lib/server/favorites";
import { getIssueDirectoryForUser } from "@/lib/server/issues";
import { getElectionSummaries } from "@/lib/server/elections-context";
import { getCommunityMeetingSummary } from "@/lib/public-meetings/public";
import { formatDateUtc } from "@/lib/dates";
import type { AuthUser, CommunitySummary, ElectionSummary } from "@/types/domain";

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "Date pending";
  }

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

  if (election.isCommunityVoteOnly) return "Community";
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
) {
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
) {
  const jurisdictionMatches = new Set<string>([
    "United States",
    "Nevada",
    user.jurisdictionName,
    defaultCommunity.primaryJurisdictionName,
    ...defaultCommunity.jurisdictionMatches,
  ]);
  const communityMatches = new Set<string>([
    defaultCommunity.id,
    "nevada",
    "united-states",
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
) {
  return elections.map((election) => {
    const milestone = getNextElectionMilestone(election);
    const candidateCount = election.candidates.length + (election.importedCandidates?.length ?? 0);
    const keyRaceSummary = candidateCount
      ? `${candidateCount} candidate record${candidateCount === 1 ? "" : "s"} are already visible from imported Nevada beta data and profile records.`
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
      relevanceNote: getElectionRelevanceNote(election, defaultCommunity, user),
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

export default async function HomePage() {
  const currentSessionUser = await getCurrentSessionUser();

  if (!currentSessionUser) {
    redirect("/auth");
  }

  const user = await getCurrentUser();
  const defaultCommunity = getDefaultCommunityForUser(user);

  const [
    elections,
    favoriteRecords,
    dailyVotes,
    events,
    previewPosts,
    previewDebates,
    petitions,
    issueDirectory,
    polls,
    meetingSummary,
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
    getDiscoverableEventsForUser(user, { scope: "all", limit: 8 }),
    getContextualPostPreviews({
      viewerUserId: user.id,
      limit: 3,
      attachments: [
        { type: "community", id: defaultCommunity.id, label: defaultCommunity.name },
      ],
      preferredRoles: ["trustedCitizen", "official", "candidate", "media"],
    }),
    getFeedDebatePreviews({ jurisdictionNames: defaultCommunity.jurisdictionMatches, limit: 3 }),
    getAllPetitions(),
    getIssueDirectoryForUser(user, { communityId: defaultCommunity.id }),
    getFeedPollPreviews({ jurisdictionNames: defaultCommunity.jurisdictionMatches, limit: 4, viewerUserId: user.id }),
    getCommunityMeetingSummary(defaultCommunity).catch(() => ({
      community_name: defaultCommunity.name,
      matching_public_body_count: 0,
      upcoming_meetings: [],
      recent_decisions: [],
      open_questions: [],
      recently_approved_spending: [],
      public_cases: [],
      public_comment_opportunities: [],
      last_updated_at: null,
    })),
  ]);

  const upcomingElections = getUpcomingElectionsForUser(elections, defaultCommunity, user);
  const upcomingElectionItems = buildUpcomingElectionItems(upcomingElections, defaultCommunity, user);
  const canVoteNow = canUserVote(user);
  const votePreviewQuestions = dailyVotes.dailyQuestions.slice(0, 3);
  const generatedIssues = issueDirectory.filter((issue) => issue.sourceBacked && (issue.sourceCount ?? 0) > 0);

  const activeIssues: HomeTakeActionIssue[] = generatedIssues.map((issue) => ({
    id: issue.id,
    title: issue.issueText,
    summary: issue.whyThisMatters ?? "Generated from reviewed civic records linked to this issue.",
    meta: `${issue.sourceCount ?? 0} source${issue.sourceCount === 1 ? "" : "s"} · ${issue.linkedMeetingsCount ?? 0} meeting${issue.linkedMeetingsCount === 1 ? "" : "s"}`,
    href: `/issues/${slugifyIssueText(issue.issueText)}`,
  }));

  const savedIssues: HomeTakeActionIssue[] = favoriteRecords
    .filter((record) => record.targetType === "issue")
    .map((record) => generatedIssues.find((entry) => entry.id === record.targetId))
    .filter((issue): issue is NonNullable<typeof issue> => Boolean(issue))
    .map((issue) => ({
      id: issue.id,
      title: issue.issueText,
      summary: issue.whyThisMatters ?? "Generated from reviewed civic records linked to this issue.",
      meta: `${issue.sourceCount ?? 0} source${issue.sourceCount === 1 ? "" : "s"} · ${issue.linkedMeetingsCount ?? 0} meeting${issue.linkedMeetingsCount === 1 ? "" : "s"}`,
      href: `/issues/${slugifyIssueText(issue.issueText)}`,
    }));

  const relevantPetition =
    petitions.find((petition) => defaultCommunity.jurisdictionMatches.includes(petition.jurisdictionName)) ?? petitions[0] ?? null;

  const meetingItems: HomeTakeActionMeeting[] = [
    ...meetingSummary.upcoming_meetings.slice(0, 4).map((meeting) => ({
      id: `upcoming-${meeting.id}`,
      title: meeting.title,
      summary: meeting.major_topics?.length
        ? meeting.major_topics.slice(0, 2).join(" · ")
        : "Agenda topics will appear as source parsing improves.",
      meta: `${formatDateLabel(meeting.meeting_date)} · ${meeting.public_body_name}`,
      href: `/events/${meeting.id}`,
      status: "upcoming" as const,
    })),
    ...events.slice(0, 2).map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      summary: clipText(event.description, 120) || "Upcoming civic event discovered from public meeting data.",
      meta: `${formatDateLabel(event.startsAt)} · ${event.distanceLabel}`,
      href: `/events/${event.id}`,
      status: "upcoming" as const,
    })),
    ...meetingSummary.recent_decisions.slice(0, 4).map((decision) => ({
      id: `decision-${decision.id}`,
      title: decision.title,
      summary: decision.result ? `Result: ${decision.result}` : "Reviewed meeting action from public source material.",
      meta: `${formatDateLabel(decision.meeting_date)} · ${decision.public_body_name}`,
      href: decision.source_url ?? "/events",
      status: "past" as const,
    })),
  ];

  const signalItems: HomeTakeActionSignal[] = [
    ...previewPosts.map((post) => {
      const perspective = getPerspectiveType(post);

      return {
        id: `post-${post.id}`,
        label:
          perspective === "official_update"
            ? "Official update"
            : perspective === "candidate_statement"
              ? "Candidate statement"
              : perspective === "media_summary"
                ? "News / media"
                : "Community voice",
        title: post.title ?? post.authorName,
        summary: `${post.authorName}: ${clipText(post.content, 130)}`,
        href: `/posts/${post.id}`,
        opposingPoint:
          post.stance === "support"
            ? "Look for opposition or tradeoff comments before treating this as community consensus."
            : post.stance === "oppose"
              ? "Look for support or implementation comments before treating this as settled opposition."
              : null,
      };
    }),
    ...previewDebates.map((debate) => ({
      id: `debate-${debate.id}`,
      label: "Structured debate",
      title: debate.title,
      summary: clipText(debate.description, 130),
      href: `/debates/${debate.id}`,
      opposingPoint: "This item is structured around at least two sides, so open it to compare competing arguments.",
    })),
  ].slice(0, 6);

  const pollItems: HomeTakeActionPoll[] = polls.slice(0, 4).map((poll) => ({
    id: `poll-${poll.id}`,
    title: poll.question,
    summary: `${poll.totalVotes} response${poll.totalVotes === 1 ? "" : "s"} so far. ${poll.viewerVote ? `You answered: ${poll.viewerVote}.` : "You have not answered yet."}`,
    meta: `${poll.jurisdictionName} · ${poll.votingPeriodStatus ?? "open"}`,
    href: `/polls`,
  }));

  const petitionItems: HomeTakeActionPetition[] = [
    ...(relevantPetition ? [relevantPetition] : []),
    ...petitions.filter((petition) => petition.id !== relevantPetition?.id && defaultCommunity.jurisdictionMatches.includes(petition.jurisdictionName)),
  ].slice(0, 4).map((petition) => ({
    id: `petition-${petition.id}`,
    title: petition.title,
    summary: clipText(petition.summary, 130),
    meta: `${petition.signatureCount} signatures · ${petition.jurisdictionName}`,
    href: `/petitions/${petition.id}`,
  }));

  return (
    <div className="space-y-6 py-8">
      <HomeGuidedActionCard
        communityName={defaultCommunity.name}
        communityHref={`/my-community?communityId=${defaultCommunity.id}`}
        primaryElectionHref={upcomingElectionItems[0]?.href ?? "/elections"}
        primaryIssueHref={generatedIssues[0] ? `/issues/${slugifyIssueText(generatedIssues[0].issueText)}` : "/issues"}
      />
      <HomeTakeActionCard
        communityName={defaultCommunity.name}
        voteQuestions={votePreviewQuestions}
        canVote={canVoteNow}
        activeIssues={activeIssues}
        savedIssues={savedIssues}
        meetings={meetingItems}
        signals={signalItems}
        polls={pollItems}
        petitions={petitionItems}
      />
    </div>
  );
}
