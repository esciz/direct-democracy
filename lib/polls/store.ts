import { cookies } from "next/headers";
import { cache } from "react";

import { getCommunityById, getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
import { mockPolls, mockPollVotes } from "@/lib/mock-data";
import { getPollPromotionRecord, POLL_PROMOTION_THRESHOLD } from "@/lib/polls/promotions";
import type { AuthUser, ContextAttachmentSummary, PollSummary, PollVoteSummary, VoteQuestionScope } from "@/types/domain";

const MOCK_POLLS_COOKIE = "dd_mock_polls";
const MOCK_POLL_VOTES_COOKIE = "dd_mock_poll_votes";

type ContextualPollOptions = {
  viewerUserId?: string;
  limit?: number;
  attachments?: Array<{
    type: ContextAttachmentSummary["type"];
    id?: string;
    label?: string;
  }>;
};

function isPollSummary(value: unknown): value is PollSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const poll = value as Record<string, unknown>;

  return (
    typeof poll.id === "string" &&
    typeof poll.creatorId === "string" &&
    typeof poll.creatorName === "string" &&
    typeof poll.creatorRole === "string" &&
    typeof poll.question === "string" &&
    typeof poll.scope === "string" &&
    typeof poll.jurisdictionId === "string" &&
    typeof poll.jurisdictionName === "string" &&
    Array.isArray(poll.options) &&
    typeof poll.createdAt === "string"
  );
}

function isPollVoteSummary(value: unknown): value is PollVoteSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const vote = value as Record<string, unknown>;

  return (
    typeof vote.id === "string" &&
    typeof vote.pollId === "string" &&
    typeof vote.userId === "string" &&
    typeof vote.selectedOption === "string" &&
    typeof vote.createdAt === "string"
  );
}

async function readCookieArray<T>(key: string, guard: (value: unknown) => value is T): Promise<T[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(key)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

async function writeCookieArray<T>(key: string, data: T[]) {
  const cookieStore = await cookies();
  cookieStore.set(key, JSON.stringify(data), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

function mergePollVotes(storedVotes: PollVoteSummary[], seededVotes: PollVoteSummary[]) {
  const merged = new Map<string, PollVoteSummary>();

  for (const vote of seededVotes) {
    merged.set(`${vote.pollId}:${vote.userId}`, vote);
  }

  for (const vote of storedVotes) {
    merged.set(`${vote.pollId}:${vote.userId}`, vote);
  }

  return [...merged.values()];
}

function isPollOpen(poll: Pick<PollSummary, "isActive" | "expiresAt">) {
  return Boolean(poll.isActive) && (!poll.expiresAt || Date.parse(poll.expiresAt) > Date.now());
}

function slugifyContextLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function getNormalizedPollAttachments(poll: PollSummary): ContextAttachmentSummary[] {
  if (poll.attachments?.length) {
    return poll.attachments;
  }

  return [
    {
      type: "community",
      id: poll.jurisdictionId || slugifyContextLabel(poll.jurisdictionName),
      label: poll.jurisdictionName,
      jurisdictionId: poll.jurisdictionId || null,
    },
  ];
}

function matchesContextAttachment(
  poll: PollSummary,
  requested: NonNullable<ContextualPollOptions["attachments"]>[number],
) {
  return getNormalizedPollAttachments(poll).some((attachment) => {
    if (attachment.type !== requested.type) {
      return false;
    }

    if (requested.id && attachment.id === requested.id) {
      return true;
    }

    if (requested.label && attachment.label === requested.label) {
      return true;
    }

    return !requested.id && !requested.label;
  });
}

async function hydratePoll(poll: PollSummary, votes: PollVoteSummary[], viewerId?: string) {
  const relevantVotes = votes.filter((vote) => vote.pollId === poll.id && poll.options.includes(vote.selectedOption));
  const totalVotes = relevantVotes.length;
  const viewerVoteRecord = viewerId ? relevantVotes.find((vote) => vote.userId === viewerId) ?? null : null;
  const viewerVote = viewerVoteRecord?.selectedOption ?? null;
  const promotionRecord = await getPollPromotionRecord(poll.id);
  const pollOpen = isPollOpen(poll);
  const votingPeriodStatus: PollSummary["votingPeriodStatus"] = pollOpen ? "open" : "closed";
  const results = poll.options.map((option) => {
    const voteCount = relevantVotes.filter((vote) => vote.selectedOption === option).length;
    const percentage = totalVotes ? Math.round((voteCount / totalVotes) * 100) : 0;

    return {
      option,
      voteCount,
      percentage,
    };
  });

  return {
    ...poll,
    totalVotes,
    engagementCount: totalVotes,
    results,
    viewerVote,
    previousViewerVote: viewerVote,
    viewerVoteCreatedAt: viewerVoteRecord?.createdAt ?? null,
    votingPeriodStatus,
    canChangeVote: Boolean(viewerId) && Boolean(viewerVote) && pollOpen,
    canVote: Boolean(viewerId) && !viewerVote && pollOpen,
    promotionEligible: totalVotes >= POLL_PROMOTION_THRESHOLD,
    promotedPetitionId: promotionRecord?.petitionId ?? null,
    promotedVoteQuestionId: promotionRecord?.voteQuestionId ?? null,
  };
}

function getJurisdictionNameForScope(user: AuthUser, scope: VoteQuestionScope) {
  if (scope === "national") {
    return {
      jurisdictionId: "united-states",
      jurisdictionName: "United States",
    };
  }

  if (scope === "state") {
    return {
      jurisdictionId: "nevada",
      jurisdictionName: "Nevada",
    };
  }

  const community = getDefaultCommunityForJurisdiction(user.jurisdictionName);
  const derivedJurisdictionId = user.jurisdictionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return {
    jurisdictionId: community?.jurisdictionMatches.includes(user.jurisdictionName) ? community.id : derivedJurisdictionId,
    jurisdictionName: user.jurisdictionName,
  };
}

export async function getStoredPolls() {
  return readCookieArray(MOCK_POLLS_COOKIE, isPollSummary);
}

export async function setStoredPolls(polls: PollSummary[]) {
  await writeCookieArray(MOCK_POLLS_COOKIE, polls.slice(0, 30));
}

export async function getStoredPollVotes() {
  return readCookieArray(MOCK_POLL_VOTES_COOKIE, isPollVoteSummary);
}

export async function setStoredPollVotes(votes: PollVoteSummary[]) {
  await writeCookieArray(MOCK_POLL_VOTES_COOKIE, votes.slice(0, 200));
}

export async function getAllPolls(viewerId?: string) {
  const [storedPolls, storedVotes] = await Promise.all([getStoredPolls(), getStoredPollVotes()]);
  const mergedPolls = [...storedPolls, ...mockPolls].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const mergedVotes = mergePollVotes(storedVotes, mockPollVotes);

  return Promise.all(mergedPolls.map((poll) => hydratePoll(poll, mergedVotes, viewerId)));
}

const getFeedPollPreviewsCached = cache(
  async (viewerId: string | undefined, jurisdictionKey: string, limit: number): Promise<PollSummary[]> => {
    const [storedPolls, storedVotes] = await Promise.all([getStoredPolls(), getStoredPollVotes()]);
    const jurisdictionNames = jurisdictionKey ? jurisdictionKey.split("|").filter(Boolean) : null;
    const allowedJurisdictions = jurisdictionNames ? new Set(jurisdictionNames) : null;
    const mergedPolls = [...storedPolls, ...mockPolls]
      .filter((poll) => (allowedJurisdictions ? allowedJurisdictions.has(poll.jurisdictionName) : true))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const mergedVotes = mergePollVotes(storedVotes, mockPollVotes);
    const voteCountByPoll = new Map<string, number>();
    const voteCountByPollOption = new Map<string, number>();

    for (const vote of mergedVotes) {
      voteCountByPoll.set(vote.pollId, (voteCountByPoll.get(vote.pollId) ?? 0) + 1);
      voteCountByPollOption.set(
        `${vote.pollId}:${vote.selectedOption}`,
        (voteCountByPollOption.get(`${vote.pollId}:${vote.selectedOption}`) ?? 0) + 1,
      );
    }

    const previews = mergedPolls.map((poll) => {
      const totalVotes = voteCountByPoll.get(poll.id) ?? 0;
      const viewerVoteRecord = viewerId ? mergedVotes.find((vote) => vote.pollId === poll.id && vote.userId === viewerId) ?? null : null;
      const viewerVote = viewerVoteRecord?.selectedOption ?? null;
      const pollOpen = isPollOpen(poll);
      const votingPeriodStatus: PollSummary["votingPeriodStatus"] = pollOpen ? "open" : "closed";

      return {
        ...poll,
        totalVotes,
        engagementCount: totalVotes,
        results: poll.options.map((option) => {
          const voteCount = voteCountByPollOption.get(`${poll.id}:${option}`) ?? 0;

          return {
            option,
            voteCount,
            percentage: totalVotes ? Math.round((voteCount / totalVotes) * 100) : 0,
          };
        }),
        viewerVote,
        previousViewerVote: viewerVote,
        viewerVoteCreatedAt: viewerVoteRecord?.createdAt ?? null,
        votingPeriodStatus,
        canChangeVote: Boolean(viewerId) && Boolean(viewerVote) && pollOpen,
        canVote: Boolean(viewerId) && !viewerVote && pollOpen,
        promotionEligible: false,
        promotedPetitionId: null,
        promotedVoteQuestionId: null,
      };
    });

    return limit > 0 ? previews.slice(0, limit) : previews;
  },
);

export async function getFeedPollPreviews(options?: { jurisdictionNames?: string[]; limit?: number; viewerUserId?: string }) {
  const jurisdictionKey = options?.jurisdictionNames?.length ? [...options.jurisdictionNames].sort().join("|") : "";
  return getFeedPollPreviewsCached(options?.viewerUserId, jurisdictionKey, options?.limit ?? -1);
}

export async function getContextualPollPreviews(options: ContextualPollOptions = {}) {
  const polls = await getFeedPollPreviews({ viewerUserId: options.viewerUserId, limit: -1 });
  const filtered = polls.filter((poll) =>
    options.attachments?.length ? options.attachments.some((attachment) => matchesContextAttachment(poll, attachment)) : true,
  );

  return options.limit && options.limit > 0 ? filtered.slice(0, options.limit) : filtered;
}

export async function getPollsForCommunity(viewerId: string, communityId: string, limit = 4) {
  const community = getCommunityById(communityId);

  if (!community) {
    return [];
  }

  const polls = await getAllPolls(viewerId);

  return polls
    .filter((poll) => community.jurisdictionMatches.includes(poll.jurisdictionName))
    .slice(0, limit);
}

export async function getPollsByCreator(creatorId: string, viewerId: string, limit = 4) {
  const polls = await getAllPolls(viewerId);

  return polls.filter((poll) => poll.creatorId === creatorId).slice(0, limit);
}

export async function getPollById(pollId: string, viewerId?: string) {
  const polls = await getAllPolls(viewerId);
  return polls.find((poll) => poll.id === pollId) ?? null;
}

export function buildPollSeed(
  user: AuthUser,
  input: {
    question: string;
    scope: VoteQuestionScope;
    options: string[];
    expiresAt?: string | null;
    attachments?: ContextAttachmentSummary[];
  },
): PollSummary {
  const jurisdiction = getJurisdictionNameForScope(user, input.scope);

  return {
    id: `poll_created_${Date.now()}`,
    creatorId: user.id,
    creatorName: user.name,
    creatorRole: user.role,
    question: input.question,
    scope: input.scope,
    jurisdictionId: jurisdiction.jurisdictionId,
    jurisdictionName: jurisdiction.jurisdictionName,
    attachments: input.attachments?.length ? input.attachments : undefined,
    visibilityScope: input.attachments?.some((attachment) => attachment.type === "community") ? "community" : "crossContext",
    jurisdictionScope: [jurisdiction.jurisdictionId],
    options: input.options,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
    isActive: true,
    totalVotes: 0,
    engagementCount: 0,
    results: input.options.map((option) => ({
      option,
      voteCount: 0,
      percentage: 0,
    })),
    viewerVote: null,
    previousViewerVote: null,
    viewerVoteCreatedAt: null,
    votingPeriodStatus: "open",
    canChangeVote: false,
    canVote: true,
    promotionEligible: false,
    promotedPetitionId: null,
    promotedVoteQuestionId: null,
  };
}
