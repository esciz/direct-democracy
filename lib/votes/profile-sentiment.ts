import { getQuickVoteCardsForUser } from "@/lib/feed/quick-votes";
import { getVoteObjectType } from "@/lib/votes/presentation";
import type { AuthUser, VoteQuestionCardSummary } from "@/types/domain";

export type ProfileSentimentSummary = {
  currentQuestion: VoteQuestionCardSummary;
  supportCount: number;
  mixedCount: number;
  opposeCount: number;
  totalResponses: number;
  supportPercent: number;
  mixedPercent: number;
  opposePercent: number;
  summary: string;
  description: string;
  trendLabel: string | null;
  trendDirection: "up" | "down" | "flat" | null;
  historyWindowLabel: string;
  historyTakeaway: string | null;
  history: Array<{
    weekOf: string;
    label: string;
    supportCount: number;
    mixedCount: number;
    opposeCount: number;
    totalResponses: number;
    supportPercent: number;
    mixedPercent: number;
    opposePercent: number;
    status: VoteQuestionCardSummary["status"];
  }>;
};

function sortRepresentativeQuestions(left: VoteQuestionCardSummary, right: VoteQuestionCardSummary) {
  const leftActive = left.status === "active" ? 1 : 0;
  const rightActive = right.status === "active" ? 1 : 0;

  if (leftActive !== rightActive) {
    return rightActive - leftActive;
  }

  return Date.parse(right.weekOf ?? "1970-01-01") - Date.parse(left.weekOf ?? "1970-01-01");
}

function buildTrend(currentQuestion: VoteQuestionCardSummary, previousQuestion: VoteQuestionCardSummary | null) {
  if (!previousQuestion) {
    return {
      trendLabel: "First tracked week in view.",
      trendDirection: null,
    };
  }

  const delta = currentQuestion.percentages.yes - previousQuestion.percentages.yes;

  if (delta > 0) {
    return {
      trendLabel: `Approval is up ${delta} point${delta === 1 ? "" : "s"} from the previous weekly vote.`,
      trendDirection: "up" as const,
    };
  }

  if (delta < 0) {
    return {
      trendLabel: `Approval is down ${Math.abs(delta)} point${Math.abs(delta) === 1 ? "" : "s"} from the previous weekly vote.`,
      trendDirection: "down" as const,
    };
  }

  return {
    trendLabel: "Approval is steady compared with the previous weekly vote.",
    trendDirection: "flat" as const,
  };
}

function buildHistoryTakeaway(
  history: Array<{
    label: string;
    supportPercent: number;
    mixedPercent: number;
    opposePercent: number;
  }>,
) {
  if (history.length < 2) {
    return null;
  }

  const first = history[0];
  const latest = history.at(-1) ?? history[history.length - 1];
  const supportDelta = latest.supportPercent - first.supportPercent;
  const highestSupport = history.reduce((best, point) => (point.supportPercent > best.supportPercent ? point : best), first);
  const highestMixed = history.reduce((best, point) => (point.mixedPercent > best.mixedPercent ? point : best), first);
  const highestOppose = history.reduce((best, point) => (point.opposePercent > best.opposePercent ? point : best), first);
  const supportRange = highestSupport.supportPercent - history.reduce((best, point) => (point.supportPercent < best.supportPercent ? point : best), first).supportPercent;

  if (supportDelta >= 8) {
    return `Approval is ${supportDelta} points higher than a year ago, with the strongest support landing around ${highestSupport.label}.`;
  }

  if (supportDelta <= -8) {
    return `Approval is ${Math.abs(supportDelta)} points lower than a year ago, and disapproval peaked around ${highestOppose.label}.`;
  }

  if (supportRange >= 20) {
    return `Sentiment has been volatile over the past year, with the sharpest mixed stretch around ${highestMixed.label}.`;
  }

  return `Public sentiment has stayed fairly steady overall, even though support and skepticism traded places across several weekly swings.`;
}

function formatWeekLabel(weekOf: string | null | undefined) {
  if (!weekOf) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${weekOf}T00:00:00.000Z`));
}

export async function getProfileSentimentSummary(user: AuthUser, profileId: string): Promise<ProfileSentimentSummary | null> {
  const questions = (await getQuickVoteCardsForUser(user))
    .filter((question) => getVoteObjectType(question) === "representative" && question.referenceProfileId === profileId)
    .sort(sortRepresentativeQuestions);

  const currentQuestion = questions[0] ?? null;

  if (!currentQuestion) {
    return null;
  }

  const previousQuestion = questions[1] ?? null;
  const trend = buildTrend(currentQuestion, previousQuestion);
  const history = [...questions]
    .sort((left, right) => Date.parse(left.weekOf ?? "1970-01-01") - Date.parse(right.weekOf ?? "1970-01-01"))
    .map((question) => ({
      weekOf: question.weekOf ?? "",
      label: formatWeekLabel(question.weekOf),
      supportCount: question.results.yes,
      mixedCount: question.results.skip,
      opposeCount: question.results.no,
      totalResponses: question.totalResponses,
      supportPercent: question.percentages.yes,
      mixedPercent: question.percentages.skip,
      opposePercent: question.percentages.no,
      status: question.status,
    }));
  const visibleHistory = history.slice(-52);
  const historyWindowLabel = visibleHistory.length >= 48 ? "Past year" : `Past ${visibleHistory.length} weeks`;
  const historyTakeaway = buildHistoryTakeaway(visibleHistory);

  return {
    currentQuestion,
    supportCount: currentQuestion.results.yes,
    mixedCount: currentQuestion.results.skip,
    opposeCount: currentQuestion.results.no,
    totalResponses: currentQuestion.totalResponses,
    supportPercent: currentQuestion.percentages.yes,
    mixedPercent: currentQuestion.percentages.skip,
    opposePercent: currentQuestion.percentages.no,
    summary: `${currentQuestion.percentages.yes}% approve, ${currentQuestion.percentages.no}% disapprove, and ${currentQuestion.percentages.skip}% are mixed this week.`,
    description: "This recurring community vote tracks live sentiment over time, so major actions, debates, and public decisions can move the public read week by week.",
    trendLabel: trend.trendLabel,
    trendDirection: trend.trendDirection,
    historyWindowLabel,
    historyTakeaway,
    history: visibleHistory,
  };
}

export async function getCaseVoteQuestion(user: AuthUser, caseId: string): Promise<VoteQuestionCardSummary | null> {
  const questions = await getQuickVoteCardsForUser(user);

  return questions.find((question) => getVoteObjectType(question) === "case" && question.referenceCaseId === caseId) ?? null;
}
