import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, namesMatch, normalizeName } from "@/lib/public-meetings/shared";
import type {
  CitizenVoteQuestionRecord,
  CommunityMeetingSummary,
  MeetingVotingCardRecord,
  MeetingPolicyArea,
  OfficialMeetingActionRecord,
  OfficialMeetingPolicySummary,
  OfficialMeetingRecordSummary,
  OfficialMeetingTimelineEntry,
  PublicBodyRecord,
  PublicMeetingIngestionReport,
  PublicMeetingItemRecord,
  PublicMeetingManualProviderReport,
  PublicMeetingRecord,
  PublicMeetingSourceSeed,
  VoteChoice,
  VoteRecord,
} from "@/lib/public-meetings/types";
import type { CommunitySummary } from "@/types/domain";

export type PublicMeetingAdminDashboard = {
  seedSources: PublicMeetingSourceSeed[];
  publicBodies: PublicBodyRecord[];
  meetings: PublicMeetingRecord[];
  meetingItems: PublicMeetingItemRecord[];
  voteRecords: VoteRecord[];
  officialActions: OfficialMeetingActionRecord[];
  citizenQuestions: CitizenVoteQuestionRecord[];
  ingestionReport: PublicMeetingIngestionReport | null;
  manualProviderReport: PublicMeetingManualProviderReport[];
  reviewQueues: {
    lowConfidenceItems: PublicMeetingItemRecord[];
    draftQuestions: CitizenVoteQuestionRecord[];
    unmatchedMeetings: PublicMeetingRecord[];
    unmatchedVotes: VoteRecord[];
  };
};

async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const filePath = absolutePublicMeetingPath(relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function getPublicMeetingAdminDashboard(): Promise<PublicMeetingAdminDashboard> {
  const [seedSources, publicBodies, meetings, meetingItems, voteRecords, officialActions, citizenQuestions, ingestionReport, manualProviderReport] = await Promise.all([
    readJsonFile<PublicMeetingSourceSeed[]>(PUBLIC_MEETING_PATHS.seedSources, []),
    readJsonFile<PublicBodyRecord[]>(PUBLIC_MEETING_PATHS.bodies, []),
    readJsonFile<PublicMeetingRecord[]>(PUBLIC_MEETING_PATHS.meetings, []),
    readJsonFile<PublicMeetingItemRecord[]>(PUBLIC_MEETING_PATHS.meetingItems, []),
    readJsonFile<VoteRecord[]>(PUBLIC_MEETING_PATHS.voteRecords, []),
    readJsonFile<OfficialMeetingActionRecord[]>(PUBLIC_MEETING_PATHS.officialActions, []),
    readJsonFile<CitizenVoteQuestionRecord[]>(PUBLIC_MEETING_PATHS.citizenQuestions, []),
    readJsonFile<PublicMeetingIngestionReport | null>(PUBLIC_MEETING_PATHS.ingestionReport, null),
    readJsonFile<PublicMeetingManualProviderReport[]>(PUBLIC_MEETING_PATHS.manualProviderReport, []),
  ]);
  const itemIds = new Set(meetingItems.map((item) => item.id));
  const meetingIds = new Set(meetings.map((meeting) => meeting.id));

  return {
    seedSources,
    publicBodies,
    meetings,
    meetingItems,
    voteRecords,
    officialActions,
    citizenQuestions,
    ingestionReport,
    manualProviderReport,
    reviewQueues: {
      lowConfidenceItems: meetingItems.filter((item) => item.confidence_score < 0.65),
      draftQuestions: citizenQuestions.filter((question) => question.status === "draft"),
      unmatchedMeetings: meetings.filter((meeting) => !meetingIds.has(meeting.id) || meeting.public_body_id === "body-unmatched"),
      unmatchedVotes: voteRecords.filter((vote) => !itemIds.has(vote.meeting_item_id) || !vote.official_id),
    },
  };
}

function voteCountSeed(): Record<VoteChoice, number> {
  return { yes: 0, no: 0, abstain: 0, absent: 0, recused: 0, unknown: 0 };
}

function sortNullableDatesDesc(left: string | null, right: string | null) {
  const leftTime = left ? Date.parse(left) : 0;
  const rightTime = right ? Date.parse(right) : 0;
  return rightTime - leftTime;
}

function makeTimelineEntry(
  vote: VoteRecord,
  item: PublicMeetingItemRecord,
  meeting: PublicMeetingRecord | null,
  body: PublicBodyRecord | null,
): OfficialMeetingTimelineEntry {
  return {
    id: vote.id,
    meeting_date: meeting?.meeting_date ?? null,
    public_body_name: body?.name ?? "Public body pending",
    item_title: item.title,
    policy_area: item.policy_area,
    vote: vote.vote,
    result: vote.result,
    source_url: vote.source_url ?? item.source_url ?? meeting?.source_urls[0] ?? null,
    confidence_score: vote.confidence_score,
  };
}

export async function getOfficialMeetingRecordSummary(
  officialName: string,
  jurisdictionName?: string | null,
): Promise<OfficialMeetingRecordSummary> {
  const dashboard = await getPublicMeetingAdminDashboard();
  const itemsById = new Map(dashboard.meetingItems.map((item) => [item.id, item]));
  const meetingsById = new Map(dashboard.meetings.map((meeting) => [meeting.id, meeting]));
  const bodiesById = new Map(dashboard.publicBodies.map((body) => [body.id, body]));
  const normalizedJurisdiction = normalizeName(jurisdictionName);
  const matchedVotes = dashboard.voteRecords.filter((vote) => {
    if (!namesMatch(officialName, vote.official_name)) return false;
    if (!normalizedJurisdiction) return true;
    const item = itemsById.get(vote.meeting_item_id);
    const meeting = item ? meetingsById.get(item.meeting_id) : null;
    const body = meeting ? bodiesById.get(meeting.public_body_id) : null;
    return !body || normalizeName(`${body.name} ${body.jurisdiction}`).includes(normalizedJurisdiction) || normalizedJurisdiction.includes(normalizeName(body.jurisdiction));
  });
  const timeline = matchedVotes
    .map((vote) => {
      const item = itemsById.get(vote.meeting_item_id);
      if (!item) return null;
      const meeting = meetingsById.get(item.meeting_id) ?? null;
      const body = meeting ? bodiesById.get(meeting.public_body_id) ?? null : null;
      return makeTimelineEntry(vote, item, meeting, body);
    })
    .filter((entry): entry is OfficialMeetingTimelineEntry => Boolean(entry))
    .sort((left, right) => sortNullableDatesDesc(left.meeting_date, right.meeting_date));
  const policyBuckets = new Map<MeetingPolicyArea, Record<VoteChoice, number>>();
  for (const entry of timeline) {
    const bucket = policyBuckets.get(entry.policy_area) ?? voteCountSeed();
    bucket[entry.vote] += 1;
    policyBuckets.set(entry.policy_area, bucket);
  }
  const byPolicyArea: OfficialMeetingPolicySummary[] = [...policyBuckets.entries()]
    .map(([policyArea, counts]) => ({
      policy_area: policyArea,
      ...counts,
      total: counts.yes + counts.no + counts.abstain + counts.absent + counts.recused + counts.unknown,
    }))
    .sort((left, right) => right.total - left.total);
  const matchedItemIds = new Set(matchedVotes.map((vote) => vote.meeting_item_id));
  const matchedQuestionCount = dashboard.citizenQuestions.filter((question) => matchedItemIds.has(question.meeting_item_id)).length;
  const lastUpdatedAt = dashboard.ingestionReport?.generated_at ?? null;

  return {
    official_name: officialName,
    matched_vote_count: matchedVotes.length,
    matched_question_count: matchedQuestionCount,
    by_policy_area: byPolicyArea,
    recent_notable_votes: timeline.slice(0, 5),
    source_backed_timeline: timeline.slice(0, 12),
    citizen_alignment_percent: null,
    last_updated_at: lastUpdatedAt,
  };
}

function bodyMatchesCommunity(body: PublicBodyRecord, community: CommunitySummary) {
  const haystack = normalizeName(`${body.name} ${body.jurisdiction}`);
  const needles = [
    community.name,
    community.primaryJurisdictionName,
    ...community.jurisdictionMatches,
  ].map(normalizeName).filter(Boolean);
  return needles.some((needle) => haystack.includes(needle) || needle.includes(haystack));
}

export async function getCommunityMeetingSummary(community: CommunitySummary): Promise<CommunityMeetingSummary> {
  const dashboard = await getPublicMeetingAdminDashboard();
  const meetingVotingCards = await readJsonFile<MeetingVotingCardRecord[]>(PUBLIC_MEETING_PATHS.meetingVotingCards, []);
  const matchingBodies = dashboard.publicBodies.filter((body) => bodyMatchesCommunity(body, community));
  const matchingBodyIds = new Set(matchingBodies.map((body) => body.id));
  const matchingMeetings = dashboard.meetings.filter((meeting) => matchingBodyIds.has(meeting.public_body_id));
  const matchingMeetingIds = new Set(matchingMeetings.map((meeting) => meeting.id));
  const matchingItems = dashboard.meetingItems.filter((item) => matchingMeetingIds.has(item.meeting_id));
  const itemById = new Map(dashboard.meetingItems.map((item) => [item.id, item]));
  const meetingById = new Map(dashboard.meetings.map((meeting) => [meeting.id, meeting]));
  const bodyById = new Map(dashboard.publicBodies.map((body) => [body.id, body]));
  const now = Date.now();
  const upcomingMeetings = matchingMeetings
    .filter((meeting) => {
      const time = meeting.meeting_date ? Date.parse(meeting.meeting_date) : Number.NaN;
      return Number.isFinite(time) && time >= now;
    })
    .sort((left, right) => (Date.parse(left.meeting_date ?? "") || 0) - (Date.parse(right.meeting_date ?? "") || 0))
    .slice(0, 5)
    .map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      public_body_name: bodyById.get(meeting.public_body_id)?.name ?? "Public body pending",
      meeting_date: meeting.meeting_date,
      agenda_url: meeting.agenda_url ?? meeting.source_urls[0] ?? null,
    }));
  const recentDecisions = dashboard.voteRecords
    .map((vote) => {
      const item = itemById.get(vote.meeting_item_id);
      if (!item || !matchingMeetingIds.has(item.meeting_id)) return null;
      const meeting = meetingById.get(item.meeting_id) ?? null;
      const body = meeting ? bodyById.get(meeting.public_body_id) ?? null : null;
      return {
        id: vote.id,
        title: item.title,
        public_body_name: body?.name ?? "Public body pending",
        meeting_date: meeting?.meeting_date ?? null,
        result: vote.result,
        source_url: vote.source_url ?? item.source_url ?? meeting?.source_urls[0] ?? null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => sortNullableDatesDesc(left.meeting_date, right.meeting_date))
    .slice(0, 6);
  const matchingItemIds = new Set(matchingItems.map((item) => item.id));
  const openQuestions = meetingVotingCards
    .filter((card) => matchingItemIds.has(card.topic_item_id))
    .filter((card) => card.review_status === "approved" || card.review_status === "ready")
    .slice(0, 6);
  const recentlyApprovedSpending = matchingItems
    .filter((item) => item.fiscal_impact_summary)
    .sort((left, right) => {
      const leftMeeting = meetingById.get(left.meeting_id);
      const rightMeeting = meetingById.get(right.meeting_id);
      return sortNullableDatesDesc(leftMeeting?.meeting_date ?? null, rightMeeting?.meeting_date ?? null);
    })
    .slice(0, 5);
  const publicCommentOpportunities = upcomingMeetings.filter((meeting) => meeting.agenda_url).map((meeting) => ({ ...meeting }));

  return {
    community_name: community.name,
    matching_public_body_count: matchingBodies.length,
    upcoming_meetings: upcomingMeetings,
    recent_decisions: recentDecisions,
    open_questions: openQuestions,
    recently_approved_spending: recentlyApprovedSpending,
    public_comment_opportunities: publicCommentOpportunities,
    last_updated_at: dashboard.ingestionReport?.generated_at ?? null,
  };
}
