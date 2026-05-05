import { getAllPolls } from "@/lib/polls/store";
import { getRecentVotesForUser, getStructuredValueText, getUserProfileContent } from "@/lib/profile/details";
import type { CandidateMatchSummary, OfficialActionSummary, VoteQuestionScope } from "@/types/domain";

export type ViewerAlignmentStatus = "aligned" | "against" | "mixed" | "unknown";

export type ViewerActionAlignment = {
  actionId: string;
  status: ViewerAlignmentStatus;
  label: string;
  detail: string | null;
};

export type ViewerAlignmentSummary = {
  alignedCount: number;
  againstCount: number;
  mixedCount: number;
  totalActionCount: number;
  comparedCount: number;
  sparse: boolean;
  summary: string;
  description: string;
  actionAlignmentById: Record<string, ViewerActionAlignment>;
};

const ISSUE_KEYWORDS: Record<string, string[]> = {
  "Housing affordability": ["housing", "rent", "affordability", "zoning", "development", "voucher", "starter homes"],
  "Education funding": ["education", "school", "teacher", "classroom", "district", "literacy", "student", "staffing"],
  "Public safety": ["public safety", "safety", "crime", "sheriff", "emergency"],
  Infrastructure: ["infrastructure", "road", "roads", "traffic", "transit", "street", "maintenance", "sidewalk", "crossing"],
  "Healthcare access": ["healthcare", "health care", "health", "mental health", "prescription", "insulin", "clinic"],
  "Taxes / cost of living": ["tax", "taxes", "cost of living", "prices", "afford", "cost", "budget cap"],
  "Government transparency": [
    "transparency",
    "budget",
    "open records",
    "campaign finance",
    "disclosure",
    "meeting",
    "livestream",
    "archive",
    "accountability",
    "public access",
    "plain-language",
    "plain language",
    "tracker",
    "dashboard",
  ],
  "Environment / land use": [
    "environment",
    "land use",
    "water",
    "drought",
    "wildfire",
    "conservation",
    "public lands",
    "flood",
    "resilience",
    "growth",
  ],
  "Economic development": ["economic", "business", "jobs", "small business", "permitting", "tourism"],
  "Ethics reform": ["ethics", "stock trading", "corruption", "conflict of interest"],
};

type VoteSignal = {
  questionText: string;
  answer: "yes" | "no";
  scope: VoteQuestionScope;
  issues: string[];
  tokens: string[];
};

function normalizeText(value: string) {
  return value.toLowerCase();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !["with", "from", "that", "this", "their", "they", "would", "should"].includes(token));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function getIssueMentions(text: string) {
  const normalized = normalizeText(text);

  return Object.entries(ISSUE_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))
    .map(([label]) => label);
}

function getScopeForJurisdiction(jurisdictionName: string): VoteQuestionScope {
  if (jurisdictionName === "United States" || jurisdictionName.includes("Congressional District")) {
    return "national";
  }

  if (jurisdictionName === "Nevada") {
    return "state";
  }

  return "local";
}

function collectPreferenceIssues(content: Awaited<ReturnType<typeof getUserProfileContent>>, scope: VoteQuestionScope) {
  const scopedEntries =
    scope === "local"
      ? content.localIssues
      : scope === "state"
        ? content.stateIssues
        : content.nationalIssues;

  return unique([
    ...scopedEntries.flatMap((entry) => getIssueMentions(getStructuredValueText(entry))),
    ...content.groupTags.flatMap((entry) => getIssueMentions(getStructuredValueText(entry))),
  ]);
}

function getPollInterestIssues(
  polls: Awaited<ReturnType<typeof getAllPolls>>,
  scope: VoteQuestionScope,
) {
  return unique(
    polls
      .filter((poll) => poll.scope === scope && poll.viewerVote)
      .flatMap((poll) => getIssueMentions(`${poll.question} ${poll.viewerVote ?? ""}`)),
  );
}

function summarizeOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length;
}

function buildVoteSignals(
  recentVotes: Awaited<ReturnType<typeof getRecentVotesForUser>>,
  scope: VoteQuestionScope,
) {
  return recentVotes
    .filter(
      (
        vote,
      ): vote is (typeof recentVotes)[number] & {
        answer: "yes" | "no";
      } => vote.scope === scope && (vote.answer === "yes" || vote.answer === "no"),
    )
    .map<VoteSignal>((vote) => ({
      questionText: vote.questionText,
      answer: vote.answer,
      scope: vote.scope,
      issues: getIssueMentions(vote.questionText),
      tokens: tokenize(vote.questionText),
    }));
}

function pickDirectVoteSignal(action: OfficialActionSummary, voteSignals: VoteSignal[]) {
  const actionText = `${action.title} ${action.summary} ${action.issueTags.join(" ")}`;
  const actionIssues = unique([...action.issueTags.flatMap(getIssueMentions), ...getIssueMentions(actionText)]);
  const actionTokens = tokenize(actionText);

  const scoredSignals = voteSignals
    .map((signal) => {
      const issueScore = summarizeOverlap(actionIssues, signal.issues) * 3;
      const tokenScore = summarizeOverlap(actionTokens, signal.tokens);
      const score = issueScore + tokenScore;

      return {
        signal,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (!scoredSignals.length) {
    return null;
  }

  const strongestScore = scoredSignals[0].score;
  const strongestSignals = scoredSignals.filter((entry) => entry.score === strongestScore).map((entry) => entry.signal);
  const uniqueAnswers = unique(strongestSignals.map((entry) => entry.answer));

  if (uniqueAnswers.length > 1) {
    return {
      status: "mixed" as const,
      label: "Mixed with your votes",
      detail: "Your recent vote history points in more than one direction on this issue.",
    };
  }

  const [signal] = strongestSignals;
  return signal.answer === "yes"
    ? {
        status: "aligned" as const,
        label: "Aligned with your vote",
        detail: `Tracks with your vote on: ${signal.questionText}`,
      }
    : {
        status: "against" as const,
        label: "Against your vote",
        detail: `Cuts against your vote on: ${signal.questionText}`,
      };
}

function summarizeViewerAlignmentCounts(actionAlignmentById: Record<string, ViewerActionAlignment>) {
  return Object.values(actionAlignmentById).reduce(
    (totals, item) => {
      if (item.status === "aligned") totals.alignedCount += 1;
      else if (item.status === "against") totals.againstCount += 1;
      else if (item.status === "mixed" || item.status === "unknown") totals.mixedCount += 1;

      return totals;
    },
    { alignedCount: 0, againstCount: 0, mixedCount: 0 },
  );
}

export async function getOfficialViewerAlignmentSummary(
  userId: string,
  jurisdictionName: string,
  actions: OfficialActionSummary[],
): Promise<ViewerAlignmentSummary> {
  if (!actions.length) {
    return {
      alignedCount: 0,
      againstCount: 0,
      mixedCount: 0,
      totalActionCount: 0,
      comparedCount: 0,
      sparse: true,
      summary: "No official actions are visible yet.",
      description: "Once actions appear here, we can compare them with your visible votes and issue preferences.",
      actionAlignmentById: {},
    };
  }

  const scope = getScopeForJurisdiction(jurisdictionName);
  const [content, recentVotes, polls] = await Promise.all([
    getUserProfileContent(userId),
    getRecentVotesForUser(userId, 20),
    getAllPolls(userId),
  ]);

  const voteSignals = buildVoteSignals(recentVotes, scope);
  const preferenceIssues = collectPreferenceIssues(content, scope);
  const pollInterestIssues = getPollInterestIssues(polls, scope);
  const actionAlignmentById: Record<string, ViewerActionAlignment> = {};

  for (const action of actions) {
    const directVoteMatch = pickDirectVoteSignal(action, voteSignals);

    if (directVoteMatch) {
      actionAlignmentById[action.id] = {
        actionId: action.id,
        status: directVoteMatch.status,
        label: directVoteMatch.label,
        detail: directVoteMatch.detail,
      };
      continue;
    }

    const actionIssues = unique([
      ...action.issueTags.flatMap(getIssueMentions),
      ...getIssueMentions(`${action.title} ${action.summary} ${action.issueTags.join(" ")}`),
    ]);
    const priorityOverlap = actionIssues.filter((issue) => preferenceIssues.includes(issue));
    const pollOverlap = actionIssues.filter((issue) => pollInterestIssues.includes(issue));

    if (priorityOverlap.length) {
      actionAlignmentById[action.id] = {
        actionId: action.id,
        status: "mixed",
        label: "No clear position from you yet",
        detail: `Touches issues you prioritize: ${priorityOverlap.join(", ")}.`,
      };
      continue;
    }

    if (pollOverlap.length) {
      actionAlignmentById[action.id] = {
        actionId: action.id,
        status: "mixed",
        label: "No clear position from you yet",
        detail: `You have shown lighter interest in related issues: ${pollOverlap.join(", ")}.`,
      };
      continue;
    }

    actionAlignmentById[action.id] = {
      actionId: action.id,
      status: "unknown",
      label: "No clear position from you yet",
      detail: "Vote on more issues to unlock a stronger comparison here.",
    };
  }

  const counts = summarizeViewerAlignmentCounts(actionAlignmentById);
  const comparedCount = counts.alignedCount + counts.againstCount + counts.mixedCount;
  const sparse = voteSignals.length < 2 && counts.alignedCount + counts.againstCount < 2;
  const summary = `Matches your positions on ${counts.alignedCount} action${counts.alignedCount === 1 ? "" : "s"}, cuts against ${counts.againstCount}, with ${counts.mixedCount} mixed or still unclear.`;
  const description = sparse
    ? "Based on your visible issue positions and votes so far. Vote on more issues to strengthen this comparison."
    : "Based on your visible issue positions, vote history, and other direct civic preference signals.";

  return {
    alignedCount: counts.alignedCount,
    againstCount: counts.againstCount,
    mixedCount: counts.mixedCount,
    totalActionCount: actions.length,
    comparedCount,
    sparse,
    summary,
    description,
    actionAlignmentById,
  };
}

export function getCandidateViewerAlignmentSummary(match: CandidateMatchSummary): Omit<ViewerAlignmentSummary, "actionAlignmentById"> {
  const alignedCount = match.breakdown.filter((item) => item.score === 1).length;
  const againstCount = match.breakdown.filter((item) => item.score === -1).length;
  const mixedCount = match.breakdown.filter((item) => item.score === 0).length;
  const sparse = match.comparedIssueCount < 2;

  return {
    alignedCount,
    againstCount,
    mixedCount,
    totalActionCount: match.breakdown.length,
    comparedCount: match.comparedIssueCount,
    sparse,
    summary: `Matches your positions on ${alignedCount} signal${alignedCount === 1 ? "" : "s"}, conflicts on ${againstCount}, with ${mixedCount} mixed or still forming.`,
    description: sparse
      ? "Based on your visible issue priorities and yes/no vote history so far. Vote on more issues to sharpen this comparison."
      : "Based on your visible issue priorities, recent yes/no votes, and the candidate’s promises and platform signals.",
  };
}
