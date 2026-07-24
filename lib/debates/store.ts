import { cookies } from "next/headers";
import { cache } from "react";

import { seedUsers } from "@/lib/auth/mock-users";
import { getCommunityById } from "@/lib/community/communities";
import { DEBATE_FALLACY_TYPES } from "@/lib/debates/fallacies";
import { getCanonicalIssueText } from "@/lib/issues/utils";
import { getUserProfileContent } from "@/lib/profile/details";
import { getTrustedCitizenReputationWeight } from "@/lib/profile/reputation";
import { getAllTruthRatings, TRUTH_RATING_VALUES } from "@/lib/truth/ratings";
import type {
  AuthUser,
  CitationSourceType,
  DebateCommunityVoteOption,
  DebateCommunityVoteSummary,
  DebateCurrentTurnSummary,
  DebateDetail,
  DebateDraftSummary,
  DebateFallacyReviewSummary,
  DebateFallacyReviewPosition,
  DebateFallacyTagSummary,
  DebateFollowSummary,
  DebateMode,
  DebateOutcomeType,
  DebateParticipantSummary,
  DebateSide,
  DebateStartState,
  DebateStatus,
  DebateSummary,
  DebateTurnReactionType,
  DebateTurnSummary,
  DebateTurnType,
  TruthRatingValue,
} from "@/types/domain";

export type DebateFeedPreview = {
  id: string;
  title: string;
  issueText: string;
  description: string;
  jurisdictionName: string;
  createdAt: string;
  participantCount: number;
};

export type PhaseOneDebateSummary = {
  id: string;
  title: string;
  description: string;
  issueText: string | null;
  createdAt: string;
  sideAName: string;
  sideBName: string;
  statementCount: number;
};

export type PhaseOneDebateDetail = PhaseOneDebateSummary & {
  statements: Array<{
    id: string;
    debateId: string;
    content: string;
    side: DebateSide;
    turnType: DebateTurnType;
    turnNumber: number;
    createdAt: string;
    createdByUserId: string;
    createdByUserName: string;
    supportCount: number;
    opposeCount: number;
    viewerReaction: DebateTurnReactionType | null;
  }>;
};

const DEBATE_TURNS_COOKIE = "dd_debate_turns";
const DEBATE_DRAFTS_COOKIE = "dd_debate_drafts";
const DEBATE_DRAFT_VOTES_COOKIE = "dd_debate_draft_votes";
const DEBATE_REACTIONS_COOKIE = "dd_debate_turn_reactions";
const DEBATE_FALLACY_TAGS_COOKIE = "dd_debate_fallacy_tags";
const DEBATE_FALLACY_REVIEWS_COOKIE = "dd_debate_fallacy_reviews";
const DEBATE_OVERRIDES_COOKIE = "dd_debate_overrides";
const DEBATES_COOKIE = "dd_debates";
const DEBATE_PARTICIPANTS_COOKIE = "dd_debate_participants";
const DEBATE_FOLLOWS_COOKIE = "dd_debate_follows";
const DEBATE_REMOVED_FOLLOWS_COOKIE = "dd_removed_debate_follows";
const DEBATE_COMMUNITY_VOTES_COOKIE = "dd_debate_community_votes";

type DebateRecord = {
  id: string;
  title: string;
  description: string;
  issueId: string;
  issueText: string;
  jurisdictionName: string;
  mode: DebateMode;
  startState: DebateStartState;
  sideAName: string;
  sideBName: string;
  sideAGroupTag?: string | null;
  sideBGroupTag?: string | null;
  createdByUserId: string;
  challengedUserId?: string | null;
  status: DebateStatus;
  outcomeType?: DebateOutcomeType | null;
  agreedStatement?: string | null;
  createdAt: string;
  closedAt?: string | null;
  numberOfRounds: number;
  draftWindowHours?: number | null;
  votingWindowHours?: number | null;
};

type DebateTurnRecord = {
  id: string;
  debateId: string;
  side: DebateSide;
  turnType: DebateTurnType;
  statementText: string;
  videoAttachmentUrl?: string | null;
  citations?: Array<{
    id: string;
    debateTurnId: string;
    title: string;
    sourceName: string;
    sourceType?: CitationSourceType | null;
    url: string;
    note?: string | null;
    createdAt: string;
  }>;
  createdByUserId: string;
  createdAt: string;
};

type DebateParticipantRecord = DebateParticipantSummary;

type DebateDraftRecord = {
  id: string;
  debateId: string;
  side: DebateSide;
  turnType: DebateTurnType;
  statementText: string;
  createdByUserId: string;
  createdAt: string;
};

type DebateDraftVoteRecord = {
  id: string;
  draftId: string;
  userId: string;
  createdAt: string;
};

type DebateReactionRecord = {
  id: string;
  turnId: string;
  userId: string;
  reaction: DebateTurnReactionType;
  createdAt: string;
};

type DebateFallacyTagRecord = DebateFallacyTagSummary;
type DebateFallacyReviewRecord = DebateFallacyReviewSummary;

type DebateOverrideRecord = {
  debateId: string;
  status: DebateStatus;
  outcomeType?: DebateOutcomeType | null;
  agreedStatement?: string | null;
  closedAt?: string | null;
};

type DebateFollowRecord = DebateFollowSummary;
type DebateCommunityVoteRecord = DebateCommunityVoteSummary;

const seededDebates: DebateRecord[] = [
  {
    id: "debate_carson_teacher_support",
    title: "Should Carson City front-load teacher retention support this budget cycle?",
    description: "A structured local debate on whether Carson City should prioritize teacher retention support immediately or phase it in more gradually.",
    issueId: "curated_issue_carson_teachers",
    issueText: "Teacher retention and classroom support in Carson City",
    jurisdictionName: "Carson City, Nevada",
    mode: "individual",
    startState: "active",
    sideAName: "Front-load teacher support",
    sideBName: "Phase support in gradually",
    createdByUserId: "user_trusted_citizen_marco_silva",
    challengedUserId: "user_trusted_citizen_nora_patel",
    status: "open",
    createdAt: "2026-04-01T15:00:00.000Z",
    numberOfRounds: 1,
  },
  {
    id: "debate_nevada_cost_groups",
    title: "What should come first on cost of living in Nevada: volunteer mutual-aid gaps or direct family affordability relief?",
    description: "A group-mode debate testing whether cost-of-living response should begin with volunteer-grounded mutual aid insights or with family affordability priorities.",
    issueId: "curated_issue_nevada_cost",
    issueText: "Cost of living and household affordability across Nevada",
    jurisdictionName: "Nevada",
    mode: "group",
    startState: "active",
    sideAName: "Volunteer organizers",
    sideBName: "Parents and caregivers",
    sideAGroupTag: "Volunteer",
    sideBGroupTag: "Parent",
    createdByUserId: "user_trusted_citizen_hannah_cho",
    status: "open",
    createdAt: "2026-04-03T00:00:00.000Z",
    numberOfRounds: 1,
    draftWindowHours: 24,
    votingWindowHours: 48,
  },
  {
    id: "debate_national_housing_agreement",
    title: "Can housing affordability policy focus on supply and tenant stability at the same time?",
    description: "A national debate that concluded with a shared statement combining faster housing supply and renter stability goals.",
    issueId: "curated_issue_national_housing",
    issueText: "National housing affordability and cost pressure",
    jurisdictionName: "United States",
    mode: "individual",
    startState: "active",
    sideAName: "Build more housing faster",
    sideBName: "Protect renters first",
    createdByUserId: "user_trusted_citizen_nora_patel",
    challengedUserId: "user_trusted_citizen_hannah_cho",
    status: "agreed",
    outcomeType: "resolved_by_agreement",
    agreedStatement: "Both sides agreed that housing affordability improves most when faster permitting is paired with renter protections and local infrastructure planning.",
    createdAt: "2026-03-27T14:00:00.000Z",
    closedAt: "2026-03-30T18:00:00.000Z",
    numberOfRounds: 1,
  },
];

const seededParticipants: DebateParticipantRecord[] = [
  {
    debateId: "debate_carson_teacher_support",
    userId: "user_trusted_citizen_marco_silva",
    userName: "Marco Silva",
    side: "A",
    role: "lead",
  },
  {
    debateId: "debate_carson_teacher_support",
    userId: "user_trusted_citizen_nora_patel",
    userName: "Nora Patel",
    side: "B",
    role: "lead",
  },
  {
    debateId: "debate_nevada_cost_groups",
    userId: "user_trusted_citizen_hannah_cho",
    userName: "Hannah Cho",
    side: "A",
    role: "lead",
  },
  {
    debateId: "debate_nevada_cost_groups",
    userId: "user_trusted_citizen_marco_silva",
    userName: "Marco Silva",
    side: "B",
    role: "lead",
  },
  {
    debateId: "debate_national_housing_agreement",
    userId: "user_trusted_citizen_nora_patel",
    userName: "Nora Patel",
    side: "A",
    role: "lead",
  },
  {
    debateId: "debate_national_housing_agreement",
    userId: "user_trusted_citizen_hannah_cho",
    userName: "Hannah Cho",
    side: "B",
    role: "lead",
  },
];

const seededTurns: DebateTurnRecord[] = [
  {
    id: "debate_turn_carson_open_a",
    debateId: "debate_carson_teacher_support",
    side: "A",
    turnType: "opening",
    statementText: "Carson City should front-load teacher retention support now because waiting another budget cycle means more vacancies, larger class disruptions, and higher backfill costs later.",
    createdByUserId: "user_trusted_citizen_marco_silva",
    createdAt: "2026-04-01T15:30:00.000Z",
  },
  {
    id: "debate_turn_carson_open_b",
    debateId: "debate_carson_teacher_support",
    side: "B",
    turnType: "opening",
    statementText: "The city should phase in support gradually so it does not promise staffing commitments before it has stable revenue and clear accountability on how schools will use the money.",
    createdByUserId: "user_trusted_citizen_nora_patel",
    createdAt: "2026-04-01T18:00:00.000Z",
  },
  {
    id: "debate_turn_carson_response_a",
    debateId: "debate_carson_teacher_support",
    side: "A",
    turnType: "response",
    statementText: "A gradual phase-in sounds careful, but it underestimates how expensive churn already is. Immediate retention support is itself a budget discipline tool.",
    createdByUserId: "user_trusted_citizen_marco_silva",
    createdAt: "2026-04-02T09:00:00.000Z",
  },
  {
    id: "debate_turn_carson_response_b",
    debateId: "debate_carson_teacher_support",
    side: "B",
    turnType: "response",
    statementText: "Retention support should come with measurable staffing outcomes first. Front-loading without guardrails risks burning trust if vacancies do not improve quickly.",
    createdByUserId: "user_trusted_citizen_nora_patel",
    createdAt: "2026-04-02T12:30:00.000Z",
  },
  {
    id: "debate_turn_housing_open_a",
    debateId: "debate_national_housing_agreement",
    side: "A",
    turnType: "opening",
    statementText: "National housing policy needs a faster path to building because shortage is the pressure underneath rents, home prices, and displacement.",
    createdByUserId: "user_trusted_citizen_nora_patel",
    createdAt: "2026-03-27T16:00:00.000Z",
  },
  {
    id: "debate_turn_housing_open_b",
    debateId: "debate_national_housing_agreement",
    side: "B",
    turnType: "opening",
    statementText: "Supply matters, but renters need immediate stability or they will not be around long enough to benefit from long-term construction gains.",
    createdByUserId: "user_trusted_citizen_hannah_cho",
    createdAt: "2026-03-27T19:00:00.000Z",
  },
  {
    id: "debate_turn_housing_response_a",
    debateId: "debate_national_housing_agreement",
    side: "A",
    turnType: "response",
    statementText: "Short-term protections work best when paired with faster approvals, or else markets stay constrained and price pressure continues.",
    createdByUserId: "user_trusted_citizen_nora_patel",
    createdAt: "2026-03-28T10:00:00.000Z",
  },
  {
    id: "debate_turn_housing_response_b",
    debateId: "debate_national_housing_agreement",
    side: "B",
    turnType: "response",
    statementText: "The sequencing has to protect current tenants now while also expanding supply, because families cannot absorb another year of instability.",
    createdByUserId: "user_trusted_citizen_hannah_cho",
    createdAt: "2026-03-28T13:00:00.000Z",
  },
  {
    id: "debate_turn_housing_close_a",
    debateId: "debate_national_housing_agreement",
    side: "A",
    turnType: "closing",
    statementText: "Faster building plus tenant stability is more durable than treating those goals as opposites.",
    createdByUserId: "user_trusted_citizen_nora_patel",
    createdAt: "2026-03-29T10:00:00.000Z",
  },
  {
    id: "debate_turn_housing_close_b",
    debateId: "debate_national_housing_agreement",
    side: "B",
    turnType: "closing",
    statementText: "The strongest path is paired reform: build more, protect renters, and keep local infrastructure in view.",
    createdByUserId: "user_trusted_citizen_hannah_cho",
    createdAt: "2026-03-29T13:00:00.000Z",
  },
];

const seededDrafts: DebateDraftRecord[] = [
  {
    id: "debate_draft_nevada_cost_hannah",
    debateId: "debate_nevada_cost_groups",
    side: "A",
    turnType: "opening",
    statementText: "Volunteer networks see affordability stress first. The debate should start with what communities are already patching on the ground before the state acts.",
    createdByUserId: "user_trusted_citizen_hannah_cho",
    createdAt: "2026-04-03T10:00:00.000Z",
  },
  {
    id: "debate_draft_nevada_cost_marco",
    debateId: "debate_nevada_cost_groups",
    side: "A",
    turnType: "opening",
    statementText: "Volunteers are catching food, rent, and transportation gaps that public programs miss. That makes community-organized relief the clearest opening lens for this debate.",
    createdByUserId: "user_trusted_citizen_marco_silva",
    createdAt: "2026-04-03T13:30:00.000Z",
  },
];

const seededDraftVotes: DebateDraftVoteRecord[] = [
  {
    id: "debate_draft_vote_1",
    draftId: "debate_draft_nevada_cost_hannah",
    userId: "user_trusted_citizen_marco_silva",
    createdAt: "2026-04-04T08:00:00.000Z",
  },
  {
    id: "debate_draft_vote_2",
    draftId: "debate_draft_nevada_cost_marco",
    userId: "user_trusted_citizen_hannah_cho",
    createdAt: "2026-04-04T08:10:00.000Z",
  },
];

const seededReactions: DebateReactionRecord[] = [
  {
    id: "debate_reaction_1",
    turnId: "debate_turn_carson_open_a",
    userId: "user_citizen_alicia_hart",
    reaction: "support",
    createdAt: "2026-04-01T20:00:00.000Z",
  },
  {
    id: "debate_reaction_2",
    turnId: "debate_turn_carson_open_a",
    userId: "user_citizen_tiana_moore",
    reaction: "support",
    createdAt: "2026-04-01T20:20:00.000Z",
  },
  {
    id: "debate_reaction_3",
    turnId: "debate_turn_carson_open_b",
    userId: "user_citizen_miles_reed",
    reaction: "support",
    createdAt: "2026-04-01T21:00:00.000Z",
  },
  {
    id: "debate_reaction_4",
    turnId: "debate_turn_housing_response_b",
    userId: "user_citizen_tiana_moore",
    reaction: "support",
    createdAt: "2026-03-28T14:00:00.000Z",
  },
];

const seededFallacyTags: DebateFallacyTagRecord[] = [
  {
    id: "debate_fallacy_1",
    debateTurnId: "debate_turn_carson_response_b",
    userId: "user_trusted_citizen_hannah_cho",
    fallacyType: "False Dichotomy",
    createdAt: "2026-04-02T16:00:00.000Z",
  },
  {
    id: "debate_fallacy_2",
    debateTurnId: "debate_turn_housing_response_b",
    userId: "user_trusted_citizen_marco_silva",
    fallacyType: "Appeal to Emotion",
    createdAt: "2026-03-28T13:00:00.000Z",
  },
  {
    id: "debate_fallacy_3",
    debateTurnId: "debate_turn_housing_response_b",
    userId: "user_trusted_citizen_nora_patel",
    fallacyType: "Appeal to Emotion",
    createdAt: "2026-03-28T13:20:00.000Z",
  },
];

const seededFallacyReviews: DebateFallacyReviewRecord[] = [
  {
    id: "debate_fallacy_review_1",
    debateTurnId: "debate_turn_carson_response_b",
    fallacyType: "False Dichotomy",
    userId: "user_trusted_citizen_marco_silva",
    position: "agree",
    createdAt: "2026-04-02T18:00:00.000Z",
  },
  {
    id: "debate_fallacy_review_2",
    debateTurnId: "debate_turn_housing_response_b",
    fallacyType: "Appeal to Emotion",
    userId: "user_trusted_citizen_hannah_cho",
    position: "disagree",
    createdAt: "2026-03-28T15:00:00.000Z",
  },
];

const seededDebateFollows: DebateFollowRecord[] = [
  {
    id: "debate_follow_1",
    userId: "user_citizen_alicia_hart",
    debateId: "debate_carson_teacher_support",
    createdAt: "2026-04-02T08:00:00.000Z",
  },
  {
    id: "debate_follow_2",
    userId: "user_citizen_tiana_moore",
    debateId: "debate_nevada_cost_groups",
    createdAt: "2026-04-03T09:00:00.000Z",
  },
  {
    id: "debate_follow_3",
    userId: "user_trusted_citizen_marco_silva",
    debateId: "debate_nevada_cost_groups",
    createdAt: "2026-04-03T09:05:00.000Z",
  },
];

const seededDebateCommunityVotes: DebateCommunityVoteRecord[] = [
  {
    id: "debate_vote_housing_1",
    debateId: "debate_national_housing_agreement",
    userId: "user_citizen_alicia_hart",
    vote: "noClearWinner",
    createdAt: "2026-03-31T10:00:00.000Z",
  },
  {
    id: "debate_vote_housing_2",
    debateId: "debate_national_housing_agreement",
    userId: "user_citizen_miles_reed",
    vote: "A",
    createdAt: "2026-03-31T11:00:00.000Z",
  },
  {
    id: "debate_vote_housing_3",
    debateId: "debate_national_housing_agreement",
    userId: "user_citizen_tiana_moore",
    vote: "B",
    createdAt: "2026-03-31T11:20:00.000Z",
  },
];

function isRecordObject(value: unknown) {
  return Boolean(value) && typeof value === "object";
}

function isDebateRecord(value: unknown): value is DebateRecord {
  if (!isRecordObject(value)) return false;
  const debate = value as Record<string, unknown>;
  return (
    typeof debate.id === "string" &&
    typeof debate.title === "string" &&
    typeof debate.description === "string" &&
    typeof debate.issueId === "string" &&
    typeof debate.issueText === "string" &&
    typeof debate.jurisdictionName === "string" &&
    (debate.mode === "individual" || debate.mode === "group") &&
    (debate.startState === "pendingChallenge" || debate.startState === "seekingParticipants" || debate.startState === "active") &&
    typeof debate.sideAName === "string" &&
    typeof debate.sideBName === "string" &&
    typeof debate.createdByUserId === "string" &&
    typeof debate.status === "string" &&
    typeof debate.createdAt === "string"
  );
}

function isDebateParticipantRecord(value: unknown): value is DebateParticipantRecord {
  if (!isRecordObject(value)) return false;
  const participant = value as Record<string, unknown>;
  return (
    typeof participant.debateId === "string" &&
    typeof participant.userId === "string" &&
    typeof participant.userName === "string" &&
    (participant.side === "A" || participant.side === "B") &&
    (participant.role === "lead" || participant.role === "member")
  );
}

function isDebateTurnRecord(value: unknown): value is DebateTurnRecord {
  if (!isRecordObject(value)) return false;
  const turn = value as Record<string, unknown>;
  const citationsValid =
    turn.citations === undefined ||
    turn.citations === null ||
    (Array.isArray(turn.citations) &&
      turn.citations.every((citation) => {
        if (!isRecordObject(citation)) return false;
        const record = citation as Record<string, unknown>;
        return (
          typeof record.id === "string" &&
          typeof record.debateTurnId === "string" &&
          typeof record.title === "string" &&
          typeof record.sourceName === "string" &&
          (typeof record.sourceType === "string" || record.sourceType === null || record.sourceType === undefined) &&
          typeof record.url === "string" &&
          (typeof record.note === "string" || record.note === null || record.note === undefined) &&
          typeof record.createdAt === "string"
        );
      }));
  return (
    typeof turn.id === "string" &&
    typeof turn.debateId === "string" &&
    (turn.side === "A" || turn.side === "B") &&
    (turn.turnType === "opening" || turn.turnType === "response" || turn.turnType === "closing") &&
    typeof turn.statementText === "string" &&
    (typeof turn.videoAttachmentUrl === "string" || turn.videoAttachmentUrl === null || turn.videoAttachmentUrl === undefined) &&
    citationsValid &&
    typeof turn.createdByUserId === "string" &&
    typeof turn.createdAt === "string"
  );
}

function isDebateDraftRecord(value: unknown): value is DebateDraftRecord {
  return isDebateTurnRecord(value);
}

function isDebateDraftVoteRecord(value: unknown): value is DebateDraftVoteRecord {
  if (!isRecordObject(value)) return false;
  const vote = value as Record<string, unknown>;
  return typeof vote.id === "string" && typeof vote.draftId === "string" && typeof vote.userId === "string" && typeof vote.createdAt === "string";
}

function isDebateReactionRecord(value: unknown): value is DebateReactionRecord {
  if (!isRecordObject(value)) return false;
  const reaction = value as Record<string, unknown>;
  return (
    typeof reaction.id === "string" &&
    typeof reaction.turnId === "string" &&
    typeof reaction.userId === "string" &&
    (reaction.reaction === "support" || reaction.reaction === "oppose") &&
    typeof reaction.createdAt === "string"
  );
}

function isDebateFallacyTagRecord(value: unknown): value is DebateFallacyTagRecord {
  if (!isRecordObject(value)) return false;
  const tag = value as Record<string, unknown>;
  return (
    typeof tag.id === "string" &&
    typeof tag.debateTurnId === "string" &&
    typeof tag.userId === "string" &&
    typeof tag.fallacyType === "string" &&
    typeof tag.createdAt === "string"
  );
}

function isDebateFallacyReviewRecord(value: unknown): value is DebateFallacyReviewRecord {
  if (!isRecordObject(value)) return false;
  const review = value as Record<string, unknown>;
  return (
    typeof review.id === "string" &&
    typeof review.debateTurnId === "string" &&
    typeof review.fallacyType === "string" &&
    typeof review.userId === "string" &&
    (review.position === "agree" || review.position === "disagree") &&
    typeof review.createdAt === "string"
  );
}

function isDebateOverrideRecord(value: unknown): value is DebateOverrideRecord {
  if (!isRecordObject(value)) return false;
  const debate = value as Record<string, unknown>;
  return typeof debate.debateId === "string" && typeof debate.status === "string";
}

function isDebateFollowRecord(value: unknown): value is DebateFollowRecord {
  if (!isRecordObject(value)) return false;
  const follow = value as Record<string, unknown>;
  return typeof follow.id === "string" && typeof follow.userId === "string" && typeof follow.debateId === "string" && typeof follow.createdAt === "string";
}

function isDebateCommunityVoteRecord(value: unknown): value is DebateCommunityVoteRecord {
  if (!isRecordObject(value)) return false;
  const vote = value as Record<string, unknown>;
  return (
    typeof vote.id === "string" &&
    typeof vote.userId === "string" &&
    typeof vote.debateId === "string" &&
    (vote.vote === "A" || vote.vote === "B" || vote.vote === "noClearWinner") &&
    typeof vote.createdAt === "string"
  );
}

async function readCookieArray<T>(key: string, guard: (value: unknown) => value is T): Promise<T[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(key)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

async function writeCookieArray<T>(key: string, values: T[]) {
  const cookieStore = await cookies();
  cookieStore.set(key, JSON.stringify(values), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getStoredDebates() {
  return readCookieArray(DEBATES_COOKIE, isDebateRecord);
}

export async function setStoredDebates(debates: DebateRecord[]) {
  await writeCookieArray(DEBATES_COOKIE, debates.slice(0, 80));
}

export async function getStoredDebateParticipants() {
  return readCookieArray(DEBATE_PARTICIPANTS_COOKIE, isDebateParticipantRecord);
}

export async function setStoredDebateParticipants(participants: DebateParticipantRecord[]) {
  await writeCookieArray(DEBATE_PARTICIPANTS_COOKIE, participants.slice(0, 200));
}

export async function getStoredDebateFollows() {
  return readCookieArray(DEBATE_FOLLOWS_COOKIE, isDebateFollowRecord);
}

export async function setStoredDebateFollows(follows: DebateFollowRecord[]) {
  await writeCookieArray(DEBATE_FOLLOWS_COOKIE, follows.slice(0, 300));
}

export async function getRemovedDebateFollowKeys() {
  return readCookieArray(
    DEBATE_REMOVED_FOLLOWS_COOKIE,
    (value): value is string => typeof value === "string",
  );
}

export async function getStoredDebateCommunityVotes() {
  return readCookieArray(DEBATE_COMMUNITY_VOTES_COOKIE, isDebateCommunityVoteRecord);
}

export async function setStoredDebateCommunityVotes(votes: DebateCommunityVoteRecord[]) {
  await writeCookieArray(DEBATE_COMMUNITY_VOTES_COOKIE, votes.slice(0, 500));
}

export async function setRemovedDebateFollowKeys(keys: string[]) {
  await writeCookieArray(DEBATE_REMOVED_FOLLOWS_COOKIE, keys.slice(0, 300));
}

export async function getStoredDebateTurns() {
  return readCookieArray(DEBATE_TURNS_COOKIE, isDebateTurnRecord);
}

export async function setStoredDebateTurns(turns: DebateTurnRecord[]) {
  await writeCookieArray(DEBATE_TURNS_COOKIE, turns.slice(0, 200));
}

export async function getStoredDebateDrafts() {
  return readCookieArray(DEBATE_DRAFTS_COOKIE, isDebateDraftRecord);
}

export async function setStoredDebateDrafts(drafts: DebateDraftRecord[]) {
  await writeCookieArray(DEBATE_DRAFTS_COOKIE, drafts.slice(0, 300));
}

export async function getStoredDebateDraftVotes() {
  return readCookieArray(DEBATE_DRAFT_VOTES_COOKIE, isDebateDraftVoteRecord);
}

export async function setStoredDebateDraftVotes(votes: DebateDraftVoteRecord[]) {
  await writeCookieArray(DEBATE_DRAFT_VOTES_COOKIE, votes.slice(0, 500));
}

export async function getStoredDebateReactions() {
  return readCookieArray(DEBATE_REACTIONS_COOKIE, isDebateReactionRecord);
}

export async function setStoredDebateReactions(reactions: DebateReactionRecord[]) {
  await writeCookieArray(DEBATE_REACTIONS_COOKIE, reactions.slice(0, 600));
}

export async function getStoredDebateFallacyTags() {
  return readCookieArray(DEBATE_FALLACY_TAGS_COOKIE, isDebateFallacyTagRecord);
}

export async function setStoredDebateFallacyTags(tags: DebateFallacyTagRecord[]) {
  await writeCookieArray(DEBATE_FALLACY_TAGS_COOKIE, tags.slice(0, 600));
}

export async function getStoredDebateFallacyReviews() {
  return readCookieArray(DEBATE_FALLACY_REVIEWS_COOKIE, isDebateFallacyReviewRecord);
}

export async function setStoredDebateFallacyReviews(reviews: DebateFallacyReviewRecord[]) {
  await writeCookieArray(DEBATE_FALLACY_REVIEWS_COOKIE, reviews.slice(0, 600));
}

export async function getStoredDebateOverrides() {
  return readCookieArray(DEBATE_OVERRIDES_COOKIE, isDebateOverrideRecord);
}

export async function setStoredDebateOverrides(overrides: DebateOverrideRecord[]) {
  await writeCookieArray(DEBATE_OVERRIDES_COOKIE, overrides.slice(0, 80));
}

function getSequence(numberOfRounds: number) {
  const sequence: Array<{ side: DebateSide; turnType: DebateTurnType }> = [
    { side: "A", turnType: "opening" },
    { side: "B", turnType: "opening" },
    { side: "A", turnType: "response" },
    { side: "B", turnType: "response" },
  ];

  if (numberOfRounds > 1) {
    sequence.push({ side: "A", turnType: "response" }, { side: "B", turnType: "response" });
  }

  sequence.push({ side: "A", turnType: "closing" }, { side: "B", turnType: "closing" });
  return sequence;
}

function getTurnLabel(sideName: string, turnType: DebateTurnType) {
  return `${turnType[0].toUpperCase()}${turnType.slice(1)} · ${sideName}`;
}

function getUserName(userId: string) {
  return seedUsers.find((user) => user.id === userId)?.name ?? "Trusted Citizen";
}

function toPhaseOneIssueText(issueText: string) {
  return issueText.trim() ? issueText : null;
}

async function getAllDebates() {
  const storedDebates = await getStoredDebates();
  const overrides = await getStoredDebateOverrides();
  const overrideMap = new Map(overrides.map((override) => [override.debateId, override]));
  const merged = new Map<string, DebateRecord>();
  for (const debate of storedDebates) merged.set(debate.id, debate);

  return [...merged.values()].map((debate) => {
    const override = overrideMap.get(debate.id);
    return override
      ? {
          ...debate,
          status: override.status,
          outcomeType: override.outcomeType ?? debate.outcomeType ?? null,
          agreedStatement: override.agreedStatement ?? debate.agreedStatement ?? null,
          closedAt: override.closedAt ?? debate.closedAt ?? null,
        }
      : debate;
  });
}

export async function getAllDebatesForTrust() {
  return getAllDebates();
}

async function getAllDebateParticipants() {
  const merged = new Map<string, DebateParticipantRecord>();
  for (const participant of await getStoredDebateParticipants()) merged.set(`${participant.debateId}:${participant.userId}`, participant);
  return [...merged.values()];
}

const getFeedDebatePreviewsCached = cache(
  async (jurisdictionKey: string, limit: number): Promise<DebateFeedPreview[]> => {
    const jurisdictionNames = jurisdictionKey ? jurisdictionKey.split("|").filter(Boolean) : null;
    const allowedJurisdictions = jurisdictionNames ? new Set(jurisdictionNames) : null;
    const [debates, participants] = await Promise.all([getAllDebates(), getAllDebateParticipants()]);
    const participantCountByDebate = new Map<string, number>();

    for (const participant of participants) {
      participantCountByDebate.set(
        participant.debateId,
        (participantCountByDebate.get(participant.debateId) ?? 0) + 1,
      );
    }

    const previews = debates
      .filter((debate) => (allowedJurisdictions ? allowedJurisdictions.has(debate.jurisdictionName) : true))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((debate) => ({
        id: debate.id,
        title: debate.title,
        issueText: debate.issueText,
        description: debate.description,
        jurisdictionName: debate.jurisdictionName,
        createdAt: debate.createdAt,
        participantCount: participantCountByDebate.get(debate.id) ?? 0,
      }));

    return limit > 0 ? previews.slice(0, limit) : previews;
  },
);

export async function getFeedDebatePreviews(options?: { jurisdictionNames?: string[]; limit?: number }) {
  const jurisdictionKey = options?.jurisdictionNames?.length ? [...options.jurisdictionNames].sort().join("|") : "";
  return getFeedDebatePreviewsCached(jurisdictionKey, options?.limit ?? -1);
}

async function getAllDebateFollows() {
  const merged = new Map<string, DebateFollowRecord>();

  for (const follow of await getStoredDebateFollows()) merged.set(`${follow.debateId}:${follow.userId}`, follow);
  return [...merged.values()];
}

async function getAllDebateCommunityVotes() {
  const merged = new Map<string, DebateCommunityVoteRecord>();
  for (const vote of await getStoredDebateCommunityVotes()) merged.set(`${vote.debateId}:${vote.userId}`, vote);
  return [...merged.values()];
}

export async function getAllDebateTurnsForTrust() {
  const merged = new Map<string, DebateTurnRecord>();
  for (const turn of await getStoredDebateTurns()) merged.set(turn.id, turn);
  return [...merged.values()];
}

async function getAllDebateDrafts() {
  const merged = new Map<string, DebateDraftRecord>();
  for (const draft of await getStoredDebateDrafts()) merged.set(draft.id, draft);
  return [...merged.values()];
}

async function getAllDebateDraftVotes() {
  const merged = new Map<string, DebateDraftVoteRecord>();
  for (const vote of await getStoredDebateDraftVotes()) merged.set(`${vote.draftId}:${vote.userId}`, vote);
  return [...merged.values()];
}

export async function getAllDebateReactionsForTrust() {
  const merged = new Map<string, DebateReactionRecord>();
  for (const reaction of await getStoredDebateReactions()) merged.set(`${reaction.turnId}:${reaction.userId}`, reaction);
  return [...merged.values()];
}

async function getAllDebateFallacyTags() {
  const merged = new Map<string, DebateFallacyTagRecord>();
  for (const tag of await getStoredDebateFallacyTags()) merged.set(`${tag.debateTurnId}:${tag.userId}:${tag.fallacyType}`, tag);
  return [...merged.values()];
}

export async function getAllDebateFallacyTagsForTrust() {
  return getAllDebateFallacyTags();
}

async function getAllDebateFallacyReviews() {
  const merged = new Map<string, DebateFallacyReviewRecord>();
  for (const review of await getStoredDebateFallacyReviews()) merged.set(`${review.debateTurnId}:${review.fallacyType}:${review.userId}`, review);
  return [...merged.values()];
}

async function getGroupTagsForUser(userId: string) {
  const content = await getUserProfileContent(userId);
  return new Set([
    ...content.groupTags.map((entry) => entry.value.toLowerCase()),
    ...content.identityTags.map((entry) => entry.value.toLowerCase()),
  ]);
}

function matchesCommunity(jurisdictionName: string, communityId?: string) {
  if (!communityId) return true;
  const community = getCommunityById(communityId);
  if (!community) return true;
  return community.jurisdictionMatches.includes(jurisdictionName);
}

function getFallacyStatus({
  tagCount,
  agreeCount,
  disagreeCount,
}: {
  tagCount: number;
  agreeCount: number;
  disagreeCount: number;
}) {
  const supportSignal = tagCount + agreeCount;

  if (disagreeCount >= supportSignal) {
    return "Rejected" as const;
  }

  if (supportSignal >= 3 && supportSignal > disagreeCount) {
    return "Supported" as const;
  }

  return "Contested" as const;
}

function getPoliticalAffiliationBucket(value: string | null | undefined) {
  if (value === "Democrat") return "Democrat" as const;
  if (value === "Republican") return "Republican" as const;
  if (value === "Independent") return "Independent / Nonpartisan" as const;
  return "Other / Prefer not to say" as const;
}

function getSentimentPercent(supportCount: number, opposeCount: number) {
  const total = supportCount + opposeCount;
  if (!total) return 0;
  return Math.round((supportCount / total) * 100);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getDebateVoteWindowClose(closedAt: string | null | undefined) {
  if (!closedAt) {
    return null;
  }

  return new Date(Date.parse(closedAt) + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function getCommunityVotePercentage(count: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((count / total) * 100);
}

function tokenizeDebateText(value: string) {
  return value
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 4 && !["would", "their", "there", "about", "should", "because", "while", "where", "those", "these"].includes(token));
}

function getTokenOverlapPercent(left: string, right: string) {
  const leftTokens = new Set(tokenizeDebateText(left));
  const rightTokens = new Set(tokenizeDebateText(right));
  const combined = new Set([...leftTokens, ...rightTokens]).size;

  if (!combined) {
    return 0;
  }

  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return Math.round((overlap / combined) * 100);
}

function getAcknowledgmentBonus(text: string) {
  const normalized = text.toLowerCase();
  const patterns = [
    /valid point/,
    /fair point/,
    /i agree/,
    /we agree/,
    /the other side is right/,
    /important point/,
    /there is merit/,
    /worth acknowledging/,
  ];

  return patterns.some((pattern) => pattern.test(normalized)) ? 20 : 0;
}

function getNetSupportPercent(supportCount: number, opposeCount: number) {
  const total = supportCount + opposeCount;

  if (!total) {
    return 0;
  }

  return Math.round(((supportCount - opposeCount) / total) * 100);
}

function getWeightedReactionTotalsForTurnIds(
  reactions: Array<{ turnId: string; userId: string; reaction: DebateTurnReactionType }>,
  turnIds: Set<string>,
  weightByUserId: Map<string, number>,
) {
  const scoped = reactions.filter((entry) => turnIds.has(entry.turnId));

  const supportCount = scoped
    .filter((entry) => entry.reaction === "support")
    .reduce((total, reaction) => total + (weightByUserId.get(reaction.userId) ?? 1), 0);
  const opposeCount = scoped
    .filter((entry) => entry.reaction === "oppose")
    .reduce((total, reaction) => total + (weightByUserId.get(reaction.userId) ?? 1), 0);

  return {
    supportCount,
    opposeCount,
  };
}

async function buildTurnSummary(turn: DebateTurnRecord, viewerUserId: string | undefined): Promise<DebateTurnSummary> {
  const [reactions, tags, reviews] = await Promise.all([
    getAllDebateReactionsForTrust().then((entries) => entries.filter((entry) => entry.turnId === turn.id)),
    getAllDebateFallacyTags().then((entries) => entries.filter((entry) => entry.debateTurnId === turn.id)),
    getAllDebateFallacyReviews().then((entries) => entries.filter((entry) => entry.debateTurnId === turn.id)),
  ]);
  return {
    ...turn,
    citations: turn.citations ?? [],
    createdByUserName: getUserName(turn.createdByUserId),
    supportCount: reactions.filter((entry) => entry.reaction === "support").length,
    opposeCount: reactions.filter((entry) => entry.reaction === "oppose").length,
    viewerReaction: viewerUserId ? reactions.find((entry) => entry.userId === viewerUserId)?.reaction ?? null : null,
    fallacyTags: DEBATE_FALLACY_TYPES.map((type) => {
      const matchingTags = tags.filter((entry) => entry.fallacyType === type);
      const matchingReviews = reviews.filter((entry) => entry.fallacyType === type);
      const agreeCount = matchingReviews.filter((entry) => entry.position === "agree").length;
      const disagreeCount = matchingReviews.filter((entry) => entry.position === "disagree").length;

      return {
        type,
        count: matchingTags.length,
        viewerTagged: viewerUserId ? matchingTags.some((entry) => entry.userId === viewerUserId) : false,
        agreeCount,
        disagreeCount,
        viewerReview: viewerUserId ? matchingReviews.find((entry) => entry.userId === viewerUserId)?.position ?? null : null,
        status: getFallacyStatus({
          tagCount: matchingTags.length,
          agreeCount,
          disagreeCount,
        }),
      };
    }).filter((entry) => entry.count > 0),
    totalFallacyTagCount: tags.length,
  };
}

async function buildDraftSummary(draft: DebateDraftRecord, viewerUserId: string | undefined): Promise<DebateDraftSummary> {
  const votes = (await getAllDebateDraftVotes()).filter((entry) => entry.draftId === draft.id);
  return {
    ...draft,
    createdByUserName: getUserName(draft.createdByUserId),
    voteCount: votes.length,
    viewerHasVoted: viewerUserId ? votes.some((entry) => entry.userId === viewerUserId) : false,
  };
}

async function getCurrentTurnSummary(debate: DebateRecord, turns: DebateTurnRecord[], drafts: DebateDraftRecord[], votes: DebateDraftVoteRecord[]): Promise<DebateCurrentTurnSummary | null> {
  if (debate.startState !== "active") {
    return null;
  }

  const sequence = getSequence(debate.numberOfRounds);
  if (turns.length >= sequence.length || debate.status !== "open") {
    return null;
  }

  const currentSlot = sequence[turns.length];
  const sideName = currentSlot.side === "A" ? debate.sideAName : debate.sideBName;
  const currentDrafts = drafts.filter((entry) => entry.debateId === debate.id && entry.side === currentSlot.side && entry.turnType === currentSlot.turnType);
  const voteCount = votes.filter((vote) => currentDrafts.some((draft) => draft.id === vote.draftId)).length;

  if (debate.mode === "individual") {
    return {
      side: currentSlot.side,
      sideName,
      turnType: currentSlot.turnType,
      label: getTurnLabel(sideName, currentSlot.turnType),
      phase: "awaitingStatement",
      draftOpensAt: null,
      draftClosesAt: null,
      votingClosesAt: null,
      eligibleGroupTag: null,
      draftCount: 0,
      voteCount: 0,
    };
  }

  const startAt = turns.length ? turns[turns.length - 1]?.createdAt ?? debate.createdAt : debate.createdAt;
  const startMs = Date.parse(startAt);
  const draftClosesAt = new Date(startMs + (debate.draftWindowHours ?? 24) * 60 * 60 * 1000).toISOString();
  const votingClosesAt = new Date(Date.parse(draftClosesAt) + (debate.votingWindowHours ?? 24) * 60 * 60 * 1000).toISOString();
  const now = Date.now();
  const phase =
    now < Date.parse(draftClosesAt)
      ? "drafting"
      : now < Date.parse(votingClosesAt)
        ? "voting"
        : "readyToFinalize";

  return {
    side: currentSlot.side,
    sideName,
    turnType: currentSlot.turnType,
    label: getTurnLabel(sideName, currentSlot.turnType),
    phase,
    draftOpensAt: startAt,
    draftClosesAt,
    votingClosesAt,
    eligibleGroupTag: currentSlot.side === "A" ? debate.sideAGroupTag ?? null : debate.sideBGroupTag ?? null,
    draftCount: currentDrafts.length,
    voteCount,
  };
}

async function buildDebateSummary(debate: DebateRecord, viewerUserId?: string): Promise<DebateSummary> {
  const [turns, drafts, votes, follows] = await Promise.all([
    getAllDebateTurnsForTrust(),
    getAllDebateDrafts(),
    getAllDebateDraftVotes(),
    getAllDebateFollows(),
  ]);
  const debateTurns = turns.filter((entry) => entry.debateId === debate.id).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const createdByUserName = getUserName(debate.createdByUserId);
  const challengedUserName = debate.challengedUserId ? getUserName(debate.challengedUserId) : null;
  const debateFollows = follows.filter((entry) => entry.debateId === debate.id);
  return {
    ...debate,
    issueText: getCanonicalIssueText(debate.issueText),
    createdByUserName,
    challengedUserName,
    turnCount: debateTurns.length,
    currentTurn: await getCurrentTurnSummary(debate, debateTurns, drafts, votes),
    followerCount: debateFollows.length,
    viewerIsFollowing: viewerUserId ? debateFollows.some((entry) => entry.userId === viewerUserId) : false,
  };
}

function getParticipantSideForViewer(participants: DebateParticipantRecord[], viewerUserId: string) {
  return participants.find((participant) => participant.userId === viewerUserId)?.side ?? null;
}

export async function getDebatesForUser(user: AuthUser, options?: { communityId?: string; issueId?: string; status?: "open" | "completed" | "all" }) {
  const debates = await getAllDebates();
  const filtered = debates.filter((debate) => matchesCommunity(debate.jurisdictionName, options?.communityId)).filter((debate) => (options?.issueId ? debate.issueId === options.issueId : true));
  const summaries = await Promise.all(filtered.map((debate) => buildDebateSummary(debate, user.id)));
  const normalized = summaries.filter((debate) => {
    if (options?.status === "open") return debate.status === "open";
    if (options?.status === "completed") return debate.status !== "open";
    return true;
  });
  return normalized.sort((a, b) => {
    if (a.status === "open" && b.status !== "open") return -1;
    if (a.status !== "open" && b.status === "open") return 1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export async function getPhaseOneDebates() {
  const [debates, turns] = await Promise.all([getAllDebates(), getAllDebateTurnsForTrust()]);
  const statementCountByDebate = new Map<string, number>();

  for (const turn of turns) {
    statementCountByDebate.set(turn.debateId, (statementCountByDebate.get(turn.debateId) ?? 0) + 1);
  }

  return debates
    .filter((debate) => debate.mode === "individual")
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map(
      (debate): PhaseOneDebateSummary => ({
        id: debate.id,
        title: debate.title,
        description: debate.description,
        issueText: toPhaseOneIssueText(getCanonicalIssueText(debate.issueText)),
        createdAt: debate.createdAt,
        sideAName: debate.sideAName,
        sideBName: debate.sideBName,
        statementCount: statementCountByDebate.get(debate.id) ?? 0,
      }),
    );
}

export async function getPhaseOneDebateDetail(debateId: string, viewerUserId?: string): Promise<PhaseOneDebateDetail | null> {
  const [debate, turns, reactions] = await Promise.all([getDebateRecord(debateId), getDebateTurnsForDebate(debateId), getAllDebateReactionsForTrust()]);

  if (!debate) {
    return null;
  }

  const reactionMap = new Map<string, DebateReactionRecord[]>();

  for (const reaction of reactions.filter((entry) => turns.some((turn) => turn.id === entry.turnId))) {
    reactionMap.set(reaction.turnId, [...(reactionMap.get(reaction.turnId) ?? []), reaction]);
  }

  return {
    id: debate.id,
    title: debate.title,
    description: debate.description,
    issueText: toPhaseOneIssueText(getCanonicalIssueText(debate.issueText)),
    createdAt: debate.createdAt,
    sideAName: debate.sideAName,
    sideBName: debate.sideBName,
    statementCount: turns.length,
    statements: turns.map((turn, index) => {
      const turnReactions = reactionMap.get(turn.id) ?? [];

      return {
        id: turn.id,
        debateId: turn.debateId,
        content: turn.statementText,
        side: turn.side,
        turnType: turn.turnType,
        turnNumber: index + 1,
        createdAt: turn.createdAt,
        createdByUserId: turn.createdByUserId,
        createdByUserName: getUserName(turn.createdByUserId),
        supportCount: turnReactions.filter((entry) => entry.reaction === "support").length,
        opposeCount: turnReactions.filter((entry) => entry.reaction === "oppose").length,
        viewerReaction: viewerUserId ? turnReactions.find((entry) => entry.userId === viewerUserId)?.reaction ?? null : null,
      };
    }),
  };
}

export async function getDebateDetail(debateId: string, user: AuthUser): Promise<DebateDetail | null> {
  const [debates, turns, drafts, votes, reactions, truthRatings, participants, fallacyTags, debateCommunityVotes] = await Promise.all([
    getAllDebates(),
    getAllDebateTurnsForTrust(),
    getAllDebateDrafts(),
    getAllDebateDraftVotes(),
    getAllDebateReactionsForTrust(),
    getAllTruthRatings(),
    getAllDebateParticipants(),
    getAllDebateFallacyTags(),
    getAllDebateCommunityVotes(),
  ]);
  const debate = debates.find((entry) => entry.id === debateId);
  if (!debate) return null;

  const debateTurns = turns.filter((entry) => entry.debateId === debate.id).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const debateDrafts = drafts.filter((entry) => entry.debateId === debate.id);
  const debateVotes = votes.filter((entry) => debateDrafts.some((draft) => draft.id === entry.draftId));
  const debateParticipants = participants.filter((entry) => entry.debateId === debate.id);
  const currentTurn = await getCurrentTurnSummary(debate, debateTurns, debateDrafts, debateVotes);
  const viewerGroupTags = await getGroupTagsForUser(user.id);
  const viewerParticipantSide = getParticipantSideForViewer(debateParticipants, user.id);
  const currentSideTag = currentTurn?.eligibleGroupTag?.toLowerCase() ?? null;
  const viewerMatchesCurrentGroupSide = Boolean(currentSideTag && viewerGroupTags.has(currentSideTag));
  const hasBothGroupSides =
    debate.mode === "group" ? debateParticipants.some((entry) => entry.side === "A") && debateParticipants.some((entry) => entry.side === "B") : true;
  const viewerCanParticipate =
    user.role === "trustedCitizen" &&
    debate.startState === "active" &&
    (debate.mode === "individual" ? Boolean(viewerParticipantSide) : viewerMatchesCurrentGroupSide);
  const viewerCanSubmitTurn =
    debate.startState === "active" && debate.mode === "individual" && currentTurn?.phase === "awaitingStatement" && viewerParticipantSide === currentTurn.side;
  const viewerCanSubmitDraft =
    debate.startState === "active" && debate.mode === "group" && currentTurn?.phase === "drafting" && viewerMatchesCurrentGroupSide && user.role === "trustedCitizen";
  const viewerCanVoteOnDrafts =
    debate.startState === "active" && debate.mode === "group" && currentTurn?.phase === "voting" && viewerMatchesCurrentGroupSide && user.role === "trustedCitizen";
  const currentDraftSummaries = currentTurn
    ? await Promise.all(
        debateDrafts
          .filter((entry) => entry.side === currentTurn.side && entry.turnType === currentTurn.turnType)
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
          .map((draft) => buildDraftSummary(draft, user.id)),
      )
    : [];
  const turnSummaries = await Promise.all(debateTurns.map((turn) => buildTurnSummary(turn, user.id)));
  const turnIds = new Set(turnSummaries.map((turn) => turn.id));
  const fallaciesForDebate = fallacyTags.filter((tag) => turnIds.has(tag.debateTurnId));
  const truthForDebate = truthRatings.filter((rating) => turnIds.has(rating.entityId));
  const reactionsForDebate = reactions.filter((entry) => turnIds.has(entry.turnId));
  const truthTotals = TRUTH_RATING_VALUES.map((label) => ({
    label,
    count: truthForDebate.filter((rating) => rating.rating === label).length,
  }));
  const leadingTruth = truthTotals.sort((a, b) => b.count - a.count)[0];
  const turnSideMap = new Map(turnSummaries.map((turn) => [turn.id, turn.side]));
  const uniqueReactionUserIds = [...new Set(reactionsForDebate.map((entry) => entry.userId))];
  const reactionWeightEntries = await Promise.all(
    uniqueReactionUserIds.map(async (userId) => {
      const ratingUser = seedUsers.find((entry) => entry.id === userId);
      const weight = ratingUser?.role === "trustedCitizen" ? await getTrustedCitizenReputationWeight(userId) : 1;
      return [userId, weight] as const;
    }),
  );
  const reactionWeightByUserId = new Map(reactionWeightEntries);
  const summarizeFallaciesForSide = (side: DebateSide) =>
    DEBATE_FALLACY_TYPES.map((type) => ({
      type,
      count: fallaciesForDebate.filter((tag) => tag.fallacyType === type && turnSideMap.get(tag.debateTurnId) === side).length,
    }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  const sideSentiment = (side: DebateSide) => {
    const sideTurnIds = new Set(turnSummaries.filter((turn) => turn.side === side).map((turn) => turn.id));
    const { supportCount, opposeCount } = getWeightedReactionTotalsForTurnIds(
      reactionsForDebate,
      sideTurnIds,
      reactionWeightByUserId,
    );

    return {
      supportCount: Math.round(supportCount * 10) / 10,
      opposeCount: Math.round(opposeCount * 10) / 10,
      communitySentimentPercent: getSentimentPercent(supportCount, opposeCount),
    };
  };
  const sideACommunity = sideSentiment("A");
  const sideBCommunity = sideSentiment("B");
  const winnerSide =
    sideACommunity.communitySentimentPercent === sideBCommunity.communitySentimentPercent
      ? null
      : sideACommunity.communitySentimentPercent > sideBCommunity.communitySentimentPercent
        ? "A"
        : "B";
  const edgeLabel =
    winnerSide === null
      ? "Even community edge"
      : winnerSide === "A"
        ? `${debate.sideAName} holds the community edge`
        : `${debate.sideBName} holds the community edge`;
  const profileEntries = await Promise.all(
    uniqueReactionUserIds.map(async (userId) => [userId, (await getUserProfileContent(userId)).background.politicalAffiliation || null] as const),
  );
  const affiliationByUser = new Map(profileEntries);
  const affiliationBuckets = [
    "Democrat",
    "Republican",
    "Independent / Nonpartisan",
    "Other / Prefer not to say",
  ] as const;
  const politicalAffiliationSentiment = affiliationBuckets.map((label) => {
    const bucketUserIds = new Set(
      uniqueReactionUserIds.filter((userId) => getPoliticalAffiliationBucket(affiliationByUser.get(userId)) === label),
    );
    const bucketReactions = reactionsForDebate.filter((entry) => bucketUserIds.has(entry.userId));
    const summarizeBucketSide = (side: DebateSide) => {
      const sideTurnIds = new Set(turnSummaries.filter((turn) => turn.side === side).map((turn) => turn.id));
      const { supportCount, opposeCount } = getWeightedReactionTotalsForTurnIds(
        bucketReactions,
        sideTurnIds,
        reactionWeightByUserId,
      );

      return {
        supportCount: Math.round(supportCount * 10) / 10,
        opposeCount: Math.round(opposeCount * 10) / 10,
        sentimentPercent: getSentimentPercent(supportCount, opposeCount),
      };
    };

    return {
      label,
      sideA: summarizeBucketSide("A"),
      sideB: summarizeBucketSide("B"),
    };
  });
  const supportedFallacyTags = turnSummaries.flatMap((turn) =>
    turn.fallacyTags
      .filter((tag) => tag.status === "Supported")
      .map((tag) => ({
        side: turn.side,
        type: tag.type,
        count: tag.count,
      })),
  );
  const totalSupportedFallacyCount = supportedFallacyTags.reduce((total, tag) => total + tag.count, 0);
  const supportedFallacyCountForSide = (side: DebateSide) =>
    supportedFallacyTags.filter((tag) => tag.side === side).reduce((total, tag) => total + tag.count, 0);
  const openingTurns = turnSummaries.filter((turn) => turn.turnType === "opening");
  const closingTurns = turnSummaries.filter((turn) => turn.turnType === "closing");
  const sideAOpening = openingTurns.filter((turn) => turn.side === "A");
  const sideBOpening = openingTurns.filter((turn) => turn.side === "B");
  const sideAClosing = closingTurns.filter((turn) => turn.side === "A");
  const sideBClosing = closingTurns.filter((turn) => turn.side === "B");
  const summarizeTurns = (entries: DebateTurnSummary[]) => {
    const sideTurnIds = new Set(entries.map((turn) => turn.id));
    const { supportCount, opposeCount } = getWeightedReactionTotalsForTurnIds(
      reactionsForDebate,
      sideTurnIds,
      reactionWeightByUserId,
    );
    return getSentimentPercent(supportCount, opposeCount);
  };
  const summarizeNetSupport = (entries: DebateTurnSummary[]) => {
    const sideTurnIds = new Set(entries.map((turn) => turn.id));
    const { supportCount, opposeCount } = getWeightedReactionTotalsForTurnIds(
      reactionsForDebate,
      sideTurnIds,
      reactionWeightByUserId,
    );
    return getNetSupportPercent(supportCount, opposeCount);
  };
  const latestTurnForSide = (side: DebateSide) =>
    [...turnSummaries].reverse().find((turn) => turn.side === side) ?? null;
  const sideAOpeningTurn = sideAOpening[0] ?? latestTurnForSide("A");
  const sideBOpeningTurn = sideBOpening[0] ?? latestTurnForSide("B");
  const sideAClosingTurn = sideAClosing[sideAClosing.length - 1] ?? latestTurnForSide("A");
  const sideBClosingTurn = sideBClosing[sideBClosing.length - 1] ?? latestTurnForSide("B");
  const sideAOpeningPercent = summarizeNetSupport(sideAOpeningTurn ? [sideAOpeningTurn] : []);
  const sideBOpeningPercent = summarizeNetSupport(sideBOpeningTurn ? [sideBOpeningTurn] : []);
  const sideAClosingPercent = summarizeNetSupport(sideAClosingTurn ? [sideAClosingTurn] : []);
  const sideBClosingPercent = summarizeNetSupport(sideBClosingTurn ? [sideBClosingTurn] : []);
  const sideAPersuasionDelta = Math.max(0, sideAClosingPercent - sideAOpeningPercent);
  const sideBPersuasionDelta = Math.max(0, sideBClosingPercent - sideBOpeningPercent);

  const sideAOpeningText = sideAOpeningTurn?.statementText ?? "";
  const sideBOpeningText = sideBOpeningTurn?.statementText ?? "";
  const sideAClosingText = sideAClosingTurn?.statementText ?? "";
  const sideBClosingText = sideBClosingTurn?.statementText ?? "";
  const openingAlignment = getTokenOverlapPercent(sideAOpeningText, sideBOpeningText);
  const closingAlignment = getTokenOverlapPercent(sideAClosingText, sideBClosingText);
  const convergenceGain = Math.max(0, closingAlignment - openingAlignment);
  const sideAAcknowledgmentBonus = getAcknowledgmentBonus(turnSummaries.filter((turn) => turn.side === "A").map((turn) => turn.statementText).join(" "));
  const sideBAcknowledgmentBonus = getAcknowledgmentBonus(turnSummaries.filter((turn) => turn.side === "B").map((turn) => turn.statementText).join(" "));
  const agreedStatementBonus = debate.agreedStatement ? 40 : 0;
  const sideAConsensusScore = clampScore(agreedStatementBonus + closingAlignment * 0.4 + convergenceGain * 0.6 + sideAAcknowledgmentBonus);
  const sideBConsensusScore = clampScore(agreedStatementBonus + closingAlignment * 0.4 + convergenceGain * 0.6 + sideBAcknowledgmentBonus);

  const sideAPersuasionScore = clampScore(50 + sideAPersuasionDelta);
  const sideBPersuasionScore = clampScore(50 + sideBPersuasionDelta);

  const completedVotes = debateCommunityVotes.filter((entry) => entry.debateId === debate.id);
  const voteClosesAt = getDebateVoteWindowClose(debate.closedAt ?? null);
  const voteIsOpen = Boolean(voteClosesAt && Date.now() <= Date.parse(voteClosesAt));
  const viewerCommunityVote = completedVotes.find((entry) => entry.userId === user.id)?.vote ?? null;
  const communityVoteTotal = completedVotes.length;
  const sideAVoteCount = completedVotes.filter((entry) => entry.vote === "A").length;
  const sideBVoteCount = completedVotes.filter((entry) => entry.vote === "B").length;
  const noClearWinnerCount = completedVotes.filter((entry) => entry.vote === "noClearWinner").length;
  const decisiveVoteTotal = sideAVoteCount + sideBVoteCount;
  const decisiveConfidence = Math.min(1, communityVoteTotal / 5);
  const rawSideACommunityVoteScore = decisiveVoteTotal ? getCommunityVotePercentage(sideAVoteCount, decisiveVoteTotal) : 50;
  const rawSideBCommunityVoteScore = decisiveVoteTotal ? getCommunityVotePercentage(sideBVoteCount, decisiveVoteTotal) : 50;
  const sideACommunityVoteScore = clampScore(50 + (rawSideACommunityVoteScore - 50) * decisiveConfidence);
  const sideBCommunityVoteScore = clampScore(50 + (rawSideBCommunityVoteScore - 50) * decisiveConfidence);
  const communityVoteWinner =
    communityVoteTotal === 0
      ? null
      : sideAVoteCount > sideBVoteCount && sideAVoteCount > noClearWinnerCount
        ? "A"
        : sideBVoteCount > sideAVoteCount && sideBVoteCount > noClearWinnerCount
          ? "B"
          : noClearWinnerCount > sideAVoteCount && noClearWinnerCount > sideBVoteCount
          ? "noClearWinner"
            : null;
  const sideTruthStats = (side: DebateSide) => {
    const sideTurnIds = new Set(turnSummaries.filter((turn) => turn.side === side).map((turn) => turn.id));
    const sideTruthRatings = truthForDebate.filter((rating) => sideTurnIds.has(rating.entityId));
    const poorTruthCount = sideTruthRatings.filter((rating) => rating.rating === "Misleading" || rating.rating === "False").length;
    const poorTruthPercent = sideTruthRatings.length ? Math.round((poorTruthCount / sideTruthRatings.length) * 100) : 0;

    return {
      ratingCount: sideTruthRatings.length,
      poorTruthPercent,
    };
  };
  const sideATruthStats = sideTruthStats("A");
  const sideBTruthStats = sideTruthStats("B");
  const sideAIntegrityScore = clampScore(100 - sideATruthStats.poorTruthPercent * 0.6 - supportedFallacyCountForSide("A") * 10);
  const sideBIntegrityScore = clampScore(100 - sideBTruthStats.poorTruthPercent * 0.6 - supportedFallacyCountForSide("B") * 10);

  const sideACompositeScore = clampScore(
    sideAConsensusScore * 0.4 + sideAPersuasionScore * 0.2 + sideACommunityVoteScore * 0.2 + sideAIntegrityScore * 0.2,
  );
  const sideBCompositeScore = clampScore(
    sideBConsensusScore * 0.4 + sideBPersuasionScore * 0.2 + sideBCommunityVoteScore * 0.2 + sideBIntegrityScore * 0.2,
  );
  const consensusAverage = Math.round((sideAConsensusScore + sideBConsensusScore) / 2);
  const consensusLevel = consensusAverage >= 70 ? "High consensus" : consensusAverage >= 45 ? "Moderate consensus" : "Low consensus";
  const lowParticipation =
    reactionsForDebate.length < 4 || communityVoteTotal < 5 || truthForDebate.length < 2;
  const tooCloseToCall = Math.abs(sideACompositeScore - sideBCompositeScore) < 3;
  const compositeWinner =
    debate.outcomeType === "withdrawn" || lowParticipation || tooCloseToCall || debate.agreedStatement
      ? null
      : sideACompositeScore > sideBCompositeScore
        ? "A"
        : sideBCompositeScore > sideACompositeScore
          ? "B"
          : null;
  const compositeOutcomeLabel =
    debate.outcomeType === "withdrawn"
      ? "Closed by withdrawal"
      : debate.agreedStatement
        ? "Shared outcome"
        : lowParticipation
          ? "Low-participation result"
          : tooCloseToCall
            ? "Too close to call"
            : compositeWinner === "A"
              ? "Side A edge"
              : "Side B edge";
  const highestIntegritySide =
    sideAIntegrityScore === sideBIntegrityScore ? null : sideAIntegrityScore > sideBIntegrityScore ? "A" : "B";

  const agreementHighlights = [
    debate.agreedStatement,
    closingAlignment >= 12 ? "Both sides repeatedly returned to overlapping policy priorities." : null,
    Math.abs(sideACommunity.communitySentimentPercent - sideBCommunity.communitySentimentPercent) <= 10
      ? "Community sentiment stayed relatively close across both sides."
      : null,
  ].filter((entry): entry is string => Boolean(entry));
  const keyThemes = [
    sideAOpeningTurn ? `${debate.sideAName} centered ${debate.issueText.toLowerCase()} around immediate priorities.` : null,
    sideBOpeningTurn ? `${debate.sideBName} framed the issue through a different practical tradeoff.` : null,
    closingTurns[0] ? "Closing statements clarified where compromise was possible and where disagreement held." : null,
  ].filter((entry): entry is string => Boolean(entry));
  const strongestEvidenceSummaries = [
    sideAClosingTurn ? `${debate.sideAName}: ${sideAClosingTurn.statementText}` : null,
    sideBClosingTurn ? `${debate.sideBName}: ${sideBClosingTurn.statementText}` : null,
  ].filter((entry): entry is string => Boolean(entry));
  const aiAnalysis = {
    summary: debate.agreedStatement
      ? "Informational AI summary: this debate moved toward a partially shared framing rather than a pure winner-take-all result."
      : "Informational AI summary: this debate surfaced a clear contrast in priorities while still showing where public sentiment and truth signals converged.",
    agreementHighlights: agreementHighlights.length ? agreementHighlights : ["No major shared statement was reached, but the debate still surfaced partial overlap in public concerns."],
    keyThemes,
    strongestEvidenceSummaries,
    label: "Informational only · not authoritative",
  };

  return {
    ...(await buildDebateSummary(debate, user.id)),
    participants: debateParticipants,
    turns: turnSummaries,
    numberOfRounds: debate.numberOfRounds,
    draftWindowHours: debate.draftWindowHours ?? null,
    votingWindowHours: debate.votingWindowHours ?? null,
    viewerCanParticipate,
    viewerCanSubmitTurn: Boolean(viewerCanSubmitTurn),
    viewerCanSubmitDraft: Boolean(viewerCanSubmitDraft),
    viewerCanVoteOnDrafts: Boolean(viewerCanVoteOnDrafts),
    viewerSide: debate.mode === "individual" ? viewerParticipantSide : currentTurn?.side ?? null,
    currentDrafts: currentDraftSummaries,
    sentimentSummary: {
      supportCount: reactionsForDebate.filter((entry) => entry.reaction === "support").length,
      opposeCount: reactionsForDebate.filter((entry) => entry.reaction === "oppose").length,
    },
    truthSummary: {
      ratingCount: truthForDebate.length,
      leadingLabel: leadingTruth?.count ? (leadingTruth.label as TruthRatingValue) : null,
    },
    aiAnalysis,
    communityOutcome: {
      winnerSide,
      edgeLabel,
      sideA: sideACommunity,
      sideB: sideBCommunity,
    },
    advancedOutcome: {
      lowParticipation,
      tooCloseToCall,
      consensusLevel,
      compositeWinner,
      compositeOutcomeLabel,
      highestIntegritySide,
      sideA: {
        consensusScore: sideAConsensusScore,
        persuasionScore: sideAPersuasionScore,
        communityVoteScore: sideACommunityVoteScore,
        integrityScore: sideAIntegrityScore,
        compositeScore: sideACompositeScore,
        convergenceScore: convergenceGain,
        agreedStatementBonus,
        acknowledgmentBonus: sideAAcknowledgmentBonus,
      },
      sideB: {
        consensusScore: sideBConsensusScore,
        persuasionScore: sideBPersuasionScore,
        communityVoteScore: sideBCommunityVoteScore,
        integrityScore: sideBIntegrityScore,
        compositeScore: sideBCompositeScore,
        convergenceScore: convergenceGain,
        agreedStatementBonus,
        acknowledgmentBonus: sideBAcknowledgmentBonus,
      },
      communityVote: {
        isOpen: voteIsOpen,
        closesAt: voteClosesAt,
        totalVotes: communityVoteTotal,
        viewerVote: viewerCommunityVote,
        winner: communityVoteWinner,
        sideA: {
          count: sideAVoteCount,
          percentage: getCommunityVotePercentage(sideAVoteCount, communityVoteTotal),
        },
        sideB: {
          count: sideBVoteCount,
          percentage: getCommunityVotePercentage(sideBVoteCount, communityVoteTotal),
        },
        noClearWinner: {
          count: noClearWinnerCount,
          percentage: getCommunityVotePercentage(noClearWinnerCount, communityVoteTotal),
        },
      },
    },
    politicalAffiliationSentiment,
    fallacySummary: {
      totalTagCount: fallaciesForDebate.length,
      supportedTagCount: totalSupportedFallacyCount,
      sideA: summarizeFallaciesForSide("A"),
      sideB: summarizeFallaciesForSide("B"),
    },
  };
}

export async function getDebateRecord(debateId: string) {
  return (await getAllDebates()).find((entry) => entry.id === debateId) ?? null;
}

export async function getDebateParticipants(debateId: string) {
  return (await getAllDebateParticipants()).filter((entry) => entry.debateId === debateId);
}

export async function getDebateFollowState(userId: string, debateId: string) {
  const follows = await getAllDebateFollows();
  return {
    viewerIsFollowing: follows.some((entry) => entry.userId === userId && entry.debateId === debateId),
    followerCount: follows.filter((entry) => entry.debateId === debateId).length,
  };
}

export async function getDebateFollowerUserIds(debateId: string) {
  const follows = await getAllDebateFollows();
  return follows.filter((entry) => entry.debateId === debateId).map((entry) => entry.userId);
}

export async function getActiveDebateCountForUser(userId: string) {
  const [debates, participants] = await Promise.all([getAllDebates(), getAllDebateParticipants()]);
  return debates.filter((debate) => debate.status === "open" && (debate.createdByUserId === userId || participants.some((entry) => entry.debateId === debate.id && entry.userId === userId))).length;
}

export async function hasSimilarActiveDebate(issueId: string, mode: DebateMode, sideAName: string, sideBName: string) {
  const debates = await getAllDebates();
  const normalizedA = sideAName.trim().toLowerCase();
  const normalizedB = sideBName.trim().toLowerCase();
  return debates.some(
    (debate) =>
      debate.status === "open" &&
      debate.issueId === issueId &&
      debate.mode === mode &&
      debate.sideAName.trim().toLowerCase() === normalizedA &&
      debate.sideBName.trim().toLowerCase() === normalizedB,
  );
}

export async function getDebateTurnsForDebate(debateId: string) {
  return (await getAllDebateTurnsForTrust())
    .filter((entry) => entry.debateId === debateId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function getDebateDraftsForDebate(debateId: string) {
  return (await getAllDebateDrafts()).filter((entry) => entry.debateId === debateId);
}

export async function getDebateDraftVotesForDebate(debateId: string) {
  const drafts = await getDebateDraftsForDebate(debateId);
  const draftIds = new Set(drafts.map((draft) => draft.id));
  return (await getAllDebateDraftVotes()).filter((entry) => draftIds.has(entry.draftId));
}

export async function canUserParticipateForCurrentTurn(user: AuthUser, debateId: string) {
  const detail = await getDebateDetail(debateId, user);
  if (!detail || !detail.currentTurn) {
    return { allowed: false as const, detail };
  }

  return {
    allowed: detail.viewerCanSubmitTurn || detail.viewerCanSubmitDraft || detail.viewerCanVoteOnDrafts,
    detail,
  };
}
