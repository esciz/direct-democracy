import { cookies } from "next/headers";

import { getCommunityById } from "@/lib/community/communities";
import { mockVoteQuestions, mockVoteResponses } from "@/lib/mock-data";
import { getVoteObjectType } from "@/lib/votes/presentation";
import type {
  AuthUser,
  VoteAnswer,
  VoteQuestionCardSummary,
  VotingLibraryFilters,
  VoteQuestionSummary,
  VoteResponseSummary,
} from "@/types/domain";

const QUICK_VOTE_RESPONSES_COOKIE = "dd_quick_vote_responses";
const QUICK_VOTE_QUESTIONS_COOKIE = "dd_quick_vote_questions";
const DAILY_VOTE_ALLOTMENT = 20;

function isVoteResponseSummary(value: unknown): value is VoteResponseSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.id === "string" &&
    typeof response.userId === "string" &&
    typeof response.questionId === "string" &&
    typeof response.answer === "string" &&
    typeof response.createdAt === "string"
  );
}

function isVoteQuestionSummary(value: unknown): value is VoteQuestionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const question = value as Record<string, unknown>;

  return (
    typeof question.id === "string" &&
    typeof question.questionText === "string" &&
    typeof question.category === "string" &&
    typeof question.scope === "string" &&
    typeof question.jurisdictionId === "string" &&
    typeof question.jurisdictionName === "string"
  );
}

function getMergedResponses(seedResponses: VoteResponseSummary[], storedResponses: VoteResponseSummary[]) {
  const merged = new Map<string, VoteResponseSummary>();

  for (const response of seedResponses) {
    merged.set(`${response.questionId}:${response.userId}`, response);
  }

  for (const response of storedResponses) {
    merged.set(`${response.questionId}:${response.userId}`, response);
  }

  return [...merged.values()];
}

function isRelevantQuestion(question: VoteQuestionSummary, user: AuthUser, communityId?: string) {
  const community = communityId ? getCommunityById(communityId) : null;

  if (community) {
    return community.jurisdictionMatches.includes(question.jurisdictionName);
  }

  if (question.scope === "national" || question.jurisdictionName === "Nevada") {
    return true;
  }

  return question.jurisdictionName === user.jurisdictionName;
}

function getCommunityLabel(question: VoteQuestionSummary) {
  if (question.scope === "national") {
    return "National vote";
  }

  if (question.scope === "state") {
    return `${question.jurisdictionName} vote`;
  }

  return `${question.jurisdictionName} vote`;
}

function getScopePriority(question: VoteQuestionSummary, user: AuthUser) {
  if (question.jurisdictionName === user.jurisdictionName) return 3;
  if (question.scope === "local") return 2;
  if (question.scope === "state") return 1;
  return 0;
}

function getStatusPriority(status: VoteQuestionSummary["status"]) {
  if (status === "active") return 3;
  if (status === "proposed") return 2;
  if (status === "enacted" || status === "passed" || status === "failed") return 1;
  return 0;
}

function getObjectPriority(question: VoteQuestionSummary) {
  const objectType = getVoteObjectType(question);

  if (objectType === "representative") return 4;
  if (objectType === "decision") return 3;
  if (objectType === "case") return 2;
  return 1;
}

export async function getStoredVoteResponses(): Promise<VoteResponseSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(QUICK_VOTE_RESPONSES_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isVoteResponseSummary) : [];
  } catch {
    return [];
  }
}

export async function getStoredVoteQuestions(): Promise<VoteQuestionSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(QUICK_VOTE_QUESTIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isVoteQuestionSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredVoteResponses(responses: VoteResponseSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(QUICK_VOTE_RESPONSES_COOKIE, JSON.stringify(responses.slice(0, 60)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function setStoredVoteQuestions(questions: VoteQuestionSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(QUICK_VOTE_QUESTIONS_COOKIE, JSON.stringify(questions.slice(0, 80)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getAllVoteQuestions() {
  const merged = new Map<string, VoteQuestionSummary>();

  for (const question of mockVoteQuestions) {
    merged.set(question.id, question);
  }

  for (const question of await getStoredVoteQuestions()) {
    merged.set(question.id, question);
  }

  return [...merged.values()];
}

export async function getQuickVoteCardsForUser(user: AuthUser, communityId?: string): Promise<VoteQuestionCardSummary[]> {
  const responses = getMergedResponses(mockVoteResponses, await getStoredVoteResponses());
  const questions = await getAllVoteQuestions();

  return questions
    .filter((question) => isRelevantQuestion(question, user, communityId))
    .map((question) => {
      const questionResponses = responses.filter((response) => response.questionId === question.id);
      const results: Record<VoteAnswer, number> = {
        yes: questionResponses.filter((response) => response.answer === "yes").length,
        no: questionResponses.filter((response) => response.answer === "no").length,
        skip: questionResponses.filter((response) => response.answer === "skip").length,
      };
      const totalResponses = questionResponses.length;
      const percentages: Record<VoteAnswer, number> = {
        yes: totalResponses ? Math.round((results.yes / totalResponses) * 100) : 0,
        no: totalResponses ? Math.round((results.no / totalResponses) * 100) : 0,
        skip: totalResponses ? Math.round((results.skip / totalResponses) * 100) : 0,
      };
      const userResponse = questionResponses.find((response) => response.userId === user.id);
      const votingPeriodStatus: VoteQuestionCardSummary["votingPeriodStatus"] = question.status === "active" ? "open" : "closed";
      const canChangeVote = getVoteObjectType(question) === "representative" && votingPeriodStatus === "open";

      return {
        ...question,
        totalResponses,
        results,
        percentages,
        userAnswer: userResponse?.answer ?? null,
        previousUserVote: null,
        voteUpdatedAt: userResponse?.createdAt ?? null,
        votingPeriodStatus,
        canChangeVote,
        communityLabel: getCommunityLabel(question),
      };
    })
    .sort((left, right) => {
      const statusDelta = getStatusPriority(right.status) - getStatusPriority(left.status);
      if (statusDelta) return statusDelta;

      const objectDelta = getObjectPriority(right) - getObjectPriority(left);
      if (objectDelta) return objectDelta;

      const scopeDelta = getScopePriority(right, user) - getScopePriority(left, user);
      if (scopeDelta) return scopeDelta;

      return Date.parse(right.weekOf ?? "1970-01-01") - Date.parse(left.weekOf ?? "1970-01-01");
    });
}

export async function getDailyVoteExperience(user: AuthUser, communityId?: string) {
  const relevantQuestions = (await getQuickVoteCardsForUser(user, communityId)).slice(0, DAILY_VOTE_ALLOTMENT);
  const answeredCount = relevantQuestions.filter((question) => question.userAnswer).length;
  const currentQuestionIndex = relevantQuestions.findIndex((question) => !question.userAnswer);
  const currentQuestion =
    currentQuestionIndex >= 0
      ? {
          ...relevantQuestions[currentQuestionIndex],
          onboardingPosition: currentQuestionIndex + 1,
          onboardingTotal: relevantQuestions.length,
        }
      : null;

  return {
    currentQuestion,
    progress: {
      answered: answeredCount,
      total: relevantQuestions.length,
      current: currentQuestionIndex >= 0 ? currentQuestionIndex + 1 : relevantQuestions.length,
    },
    pulseQuestions: relevantQuestions.filter((question) => question.userAnswer).slice(-3).reverse(),
    remainingQuestions: relevantQuestions.filter((question) => !question.userAnswer).length,
    dailyQuestions: relevantQuestions,
  };
}

export async function getVotingLibrary(user: AuthUser, filters: VotingLibraryFilters = {}) {
  const questions = await getQuickVoteCardsForUser(user);
  const normalizedSearch = filters.search?.trim().toLowerCase() ?? "";

  return questions.filter((question) => {
    const matchesScope = !filters.scope || filters.scope === "all" ? true : question.scope === filters.scope;
    const matchesCategory = !filters.category || filters.category === "all" ? true : question.category === filters.category;
    const matchesObjectType =
      !filters.objectType || filters.objectType === "all" ? true : getVoteObjectType(question) === filters.objectType;
    const matchesSearch = normalizedSearch
      ? question.questionText.toLowerCase().includes(normalizedSearch) ||
        question.jurisdictionName.toLowerCase().includes(normalizedSearch) ||
        question.shortTitle?.toLowerCase().includes(normalizedSearch) ||
        question.subjectName?.toLowerCase().includes(normalizedSearch) ||
        question.relatedIssueLabel?.toLowerCase().includes(normalizedSearch)
      : true;

    return matchesScope && matchesCategory && matchesObjectType && matchesSearch;
  });
}
