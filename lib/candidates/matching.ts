import { PREDEFINED_ISSUE_OPTIONS } from "@/lib/profile/options";
import { getRecentVotesForUser, getStructuredValueText, getUserProfileContent } from "@/lib/profile/details";
import { getAllPolls } from "@/lib/polls/store";
import type {
  AuthUser,
  CandidateCampaignSummary,
  CandidateMatchBreakdownItem,
  CandidateMatchSummary,
  CandidateProfileDetail,
  VoteQuestionScope,
} from "@/types/domain";

const ISSUE_KEYWORDS: Record<string, string[]> = {
  "Housing affordability": ["housing", "rent", "affordability", "zoning", "development"],
  "Education funding": ["education", "school", "teacher", "classroom", "district", "literacy", "student"],
  "Public safety": ["public safety", "safety", "crime", "sheriff", "emergency"],
  Infrastructure: ["infrastructure", "road", "roads", "traffic", "transit", "street", "maintenance"],
  "Healthcare access": ["healthcare", "health care", "health", "mental health"],
  "Taxes / cost of living": ["tax", "taxes", "cost of living", "prices", "afford"],
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
  ],
  "Economic development": ["economic", "business", "jobs", "small business", "permitting", "tourism"],
};

function normalizeText(value: string) {
  return value.toLowerCase();
}

function inferScopeFromCampaign(campaign: CandidateCampaignSummary): VoteQuestionScope {
  if (campaign.jurisdictionName === "United States") {
    return "national";
  }

  if (campaign.jurisdictionName === "Nevada") {
    return "state";
  }

  return "local";
}

function getIssueMentions(text: string) {
  const normalized = normalizeText(text);
  return Object.entries(ISSUE_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))
    .map(([label]) => label);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function getPollOptionStance(option: string | null) {
  if (!option) {
    return 0;
  }

  const normalized = normalizeText(option);

  if (normalized.includes("yes") || normalized.includes("support") || normalized.includes("agree")) {
    return 1;
  }

  if (normalized.includes("no") || normalized.includes("oppose") || normalized.includes("disagree")) {
    return -1;
  }

  return 0;
}

function getCandidateIssueSignals(candidate: CandidateProfileDetail, campaign: CandidateCampaignSummary) {
  const textSignals = [
    candidate.bio ?? "",
    ...candidate.campaignPromises.flatMap((promise) => [promise.title, promise.description, promise.category ?? ""]),
  ];

  return unique(textSignals.flatMap(getIssueMentions));
}

async function getUserIssueSignals(user: AuthUser, scope: VoteQuestionScope) {
  const [content, recentVotes, polls] = await Promise.all([
    getUserProfileContent(user.id),
    getRecentVotesForUser(user.id, 12),
    getAllPolls(user.id),
  ]);
  const scopedIssueEntries =
    scope === "local" ? content.localIssues : scope === "state" ? content.stateIssues : content.nationalIssues;

  const prioritized = unique(scopedIssueEntries.flatMap((entry) => getIssueMentions(getStructuredValueText(entry))));
  const voteSignals = recentVotes
    .filter((vote) => vote.scope === scope)
    .flatMap((vote) => {
      const mentions = getIssueMentions(vote.questionText);

      return mentions.map((issue) => ({
        issue,
        stance: vote.answer === "no" ? -1 : vote.answer === "yes" ? 1 : 0,
        }));
    });

  const pollSignals = polls
    .filter((poll) => poll.scope === scope && poll.viewerVote)
    .flatMap((poll) =>
      getIssueMentions(poll.question).map((issue) => ({
        issue,
        stance: getPollOptionStance(poll.viewerVote),
      })),
    );

  return { prioritized, voteSignals: [...voteSignals, ...pollSignals] };
}

function getCandidateEvidence(candidate: CandidateProfileDetail, issue: string) {
  const matchingPromise = candidate.campaignPromises.find((promise) =>
    getIssueMentions([promise.title, promise.description, promise.category ?? ""].join(" ")).includes(issue),
  );

  if (matchingPromise) {
    return matchingPromise.title;
  }

  if (candidate.bio && getIssueMentions(candidate.bio).includes(issue)) {
    return "Mentioned in candidate bio";
  }

  return null;
}

export async function getCandidateMatchSummary(user: AuthUser, candidate: CandidateProfileDetail, campaign: CandidateCampaignSummary) {
  const scope = inferScopeFromCampaign(campaign);
  const { prioritized, voteSignals } = await getUserIssueSignals(user, scope);
  const candidateIssues = getCandidateIssueSignals(candidate, campaign);
  const issueUniverse = unique([...PREDEFINED_ISSUE_OPTIONS[scope], ...prioritized, ...candidateIssues]);

  const breakdown = issueUniverse.flatMap((issue) => {
    const userVoteSignal = voteSignals.find((entry) => entry.issue === issue)?.stance ?? 0;
    const userPrioritized = prioritized.includes(issue);
    const userSignal = userVoteSignal !== 0 ? userVoteSignal : userPrioritized ? 1 : 0;
    const candidateSupports = candidateIssues.includes(issue) ? 1 : 0;

    if (!userSignal && !candidateSupports) {
      return [];
    }

    const score: -1 | 0 | 1 = userSignal === 0 || candidateSupports === 0 ? 0 : userSignal === candidateSupports ? 1 : -1;

    const item: CandidateMatchBreakdownItem = {
      issue,
      userStance: userSignal === 0 ? "unknown" : userSignal === -1 ? "disagreed" : userPrioritized ? "prioritized" : "aligned",
      candidateStance: candidateSupports ? "supports" : "unknown",
      score,
      candidateEvidence: candidateSupports ? getCandidateEvidence(candidate, issue) : null,
    };

    return [item];
  });

  const scored = breakdown.filter((item) => item.score !== 0);
  const maxPoints = scored.length;
  const rawScore = scored.reduce((sum, item) => sum + item.score, 0);
  const matchPercentage = maxPoints ? Math.round(((rawScore + maxPoints) / (maxPoints * 2)) * 100) : 50;

  return {
    candidateId: candidate.id,
    campaignId: campaign.id,
    candidateName: candidate.name,
    matchPercentage,
    alignedIssues: breakdown.filter((item) => item.score === 1).map((item) => item.issue).slice(0, 3),
    differingIssues: breakdown.filter((item) => item.score === -1).map((item) => item.issue).slice(0, 3),
    comparedIssueCount: scored.length,
    breakdown,
  } satisfies CandidateMatchSummary;
}
