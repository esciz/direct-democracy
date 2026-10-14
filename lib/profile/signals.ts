import type {
  CandidateProfileDetail,
  CivicCredibilityLabel,
  OfficialProfileDetail,
  ProfileSignalsSummary,
  PublicCitizenProfileSummary,
  PublicProfileInterviewsSummary,
  TruthRecordLabel,
  UserReputationSummary,
} from "@/types/domain";
import { buildPublicReliabilityScore, summarizeOfficialActionAlignment } from "@/lib/profile/accountability";
import {
  getKeywordLeaningScore,
  getLeaningLabel,
  getPartyLeaningScore,
  inferIdeologicalLeaningLabel as inferIdeologicalLeaningLabelFromIdeology,
} from "@/lib/profile/ideology";

export const inferIdeologicalLeaningLabel = inferIdeologicalLeaningLabelFromIdeology;

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function buildIdeologicalLeaning(partyText: string | null | undefined, sourceTexts: string[], summary: string): ProfileSignalsSummary["ideologicalLeaning"] {
  const score = getPartyLeaningScore(partyText) + getKeywordLeaningScore(sourceTexts);
  return {
    label: getLeaningLabel(score),
    summary,
    score: Number(score.toFixed(1)),
  };
}

function getCredibilityLabel(score: number): CivicCredibilityLabel {
  if (score >= 78) return "High";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Mixed";
  return "Still Forming";
}

function getTruthRecordLabel(score: number | null): TruthRecordLabel {
  if (score === null) return "Limited Ratings";
  if (score >= 78) return "Mostly Accurate";
  if (score >= 50) return "Mixed";
  return "Often Challenged";
}

function mapTrustLevelToTruthScore(reputation?: UserReputationSummary | null) {
  if (!reputation) return null;
  if (reputation.trustedCitizenReputation) return reputation.trustedCitizenReputation.breakdown.truth;
  if (reputation.trustLevel === "High Trust") return 82;
  if (reputation.trustLevel === "Moderate Trust") return 64;
  if (reputation.trustLevel === "Mixed") return 45;
  return 28;
}

function buildCredibilitySummary(score: number, summary: string): ProfileSignalsSummary["civicCredibility"] {
  return {
    label: getCredibilityLabel(score),
    summary,
    score: Math.round(score),
  };
}

function buildTruthRecordSummary(score: number | null, summary: string): ProfileSignalsSummary["truthRecord"] {
  return {
    label: getTruthRecordLabel(score),
    summary,
    score: score === null ? null : Math.round(score),
  };
}

export function buildCitizenProfileSignals(
  citizen: PublicCitizenProfileSummary,
  reputation: UserReputationSummary,
): ProfileSignalsSummary {
  const issueTexts = [
    ...citizen.topIssuesByScope.local,
    ...citizen.topIssuesByScope.state,
    ...citizen.topIssuesByScope.national,
    ...citizen.groupTags,
    ...citizen.publicEndorsements.map((endorsement) => `${endorsement.officeSought} ${endorsement.jurisdictionName}`),
  ];
  const leaning = buildIdeologicalLeaning(
    citizen.background.politicalAffiliation ?? null,
    issueTexts,
    "Based on public issue priorities, endorsements, and other visible in-app activity.",
  );
  const truthScore = mapTrustLevelToTruthScore(reputation);
  const reliabilityBase = reputation.trustedCitizenReputation
    ? Math.round(
        reputation.trustedCitizenReputation.breakdown.debate * 0.45 +
          reputation.trustedCitizenReputation.breakdown.communityTrust * 0.55,
      )
    : 52;

  return {
    ideologicalLeaning: leaning,
    civicCredibility: buildCredibilitySummary(
      reliabilityBase,
      "Based on visible follow-through, community trust, and how constructively this person participates in public civic activity on the platform.",
    ),
    truthRecord: buildTruthRecordSummary(
      truthScore,
      "A lightweight summary of how this person’s statement and claim posts have been rated so far.",
    ),
    transparencyNote:
      "These signals summarize ideological leaning, public reliability, and truth-rating patterns using visible platform activity. They are directional civic cues, not a final judgment about the person.",
  };
}

export function buildCandidateProfileSignals(
  candidate: CandidateProfileDetail,
  interviews: PublicProfileInterviewsSummary,
  reputation?: UserReputationSummary | null,
): ProfileSignalsSummary {
  const issueTexts = [
    candidate.bio ?? "",
    ...candidate.campaignPromises.flatMap((promise) => [promise.title, promise.description, promise.category ?? ""]),
    ...candidate.recentPosts.flatMap((post) => [post.title ?? "", post.content]),
    ...candidate.campaigns.flatMap((campaign) => [campaign.officeSought, campaign.pollingSummary ?? "", ...(campaign.topDonorCategories ?? [])]),
  ];
  const leaning = buildIdeologicalLeaning(
    candidate.partyText ?? null,
    issueTexts,
    "Based on campaign promises, recent post themes, office goals, and other visible in-app platform activity.",
  );
  const truthScore = mapTrustLevelToTruthScore(reputation);
  const responsivenessBonus = interviews.responsiveness.completedCount * 6 + interviews.responsiveness.acceptedCount * 3;
  const promiseSignal = Math.min(18, candidate.campaignPromises.length * 4);
  const postingSignal = Math.min(12, candidate.recentPosts.length * 2);
  const communitySignal = reputation?.trustedCitizenReputation
    ? Math.round(reputation.trustedCitizenReputation.breakdown.communityTrust * 0.2)
    : 0;
  const reliabilityBase = buildPublicReliabilityScore({
    promiseCount: candidate.campaignPromises.length,
    promiseStatuses: candidate.campaignPromises.map((promise) => promise.status),
    responsivenessCompletedCount: interviews.responsiveness.completedCount,
    responsivenessAcceptedCount: interviews.responsiveness.acceptedCount,
    baseScore: 42 + promiseSignal + postingSignal + responsivenessBonus + communitySignal,
  });

  return {
    ideologicalLeaning: leaning,
    civicCredibility: buildCredibilitySummary(
      reliabilityBase,
      "Public Reliability combines campaign promises, platform commitments, visible campaign activity, and interview responsiveness into one summary of how reliably this candidate carries stated commitments into public action.",
    ),
    truthRecord: buildTruthRecordSummary(
      truthScore,
      "A lightweight summary of how this candidate’s statement and claim posts have been rated so far.",
    ),
    transparencyNote:
      "These signals summarize ideological leaning, Public Reliability, and truth-rating patterns using visible campaign promises, platform commitments, posts, and interview participation.",
  };
}

export function buildOfficialProfileSignals(
  official: OfficialProfileDetail,
  interviews: PublicProfileInterviewsSummary,
  reputation?: UserReputationSummary | null,
): ProfileSignalsSummary {
  const issueTexts = [
    official.bio ?? "",
    official.platformSummary ?? "",
    ...official.campaignPromises.flatMap((promise) => [promise.title, promise.description, promise.category ?? ""]),
    ...official.officialActions.flatMap((action) => [action.title, action.summary, ...action.issueTags]),
    ...official.recentPosts.flatMap((post) => [post.title ?? "", post.content]),
  ];
  const leaning = buildIdeologicalLeaning(
    official.party ?? null,
    issueTexts,
    "Based on public office actions, campaign promises, recent posts, and other visible in-app activity.",
  );
  const officialTruthScore = average(
    [official.truthScore?.media, official.truthScore?.moderators, official.truthScore?.citizens].filter(
      (value): value is number => typeof value === "number",
    ),
  );
  const truthScore = officialTruthScore ?? mapTrustLevelToTruthScore(reputation);
  const followThroughScore = typeof official.followThroughScore === "number" ? official.followThroughScore : 55;
  const actionAlignment = summarizeOfficialActionAlignment(official.officialActions);
  const reliabilityBase = buildPublicReliabilityScore({
    promiseCount: official.campaignPromises.length,
    promiseStatuses: official.campaignPromises.map((promise) => promise.status),
    alignedCount: actionAlignment.alignedCount,
    mixedCount: actionAlignment.mixedCount,
    againstCount: actionAlignment.againstCount,
    responsivenessCompletedCount: interviews.responsiveness.completedCount,
    responsivenessAcceptedCount: interviews.responsiveness.acceptedCount,
    baseScore: followThroughScore,
  });

  return {
    ideologicalLeaning: leaning,
    civicCredibility: buildCredibilitySummary(
      reliabilityBase,
      "Public Reliability combines campaign promises, platform commitments, visible official actions, and interview responsiveness into one summary of how reliably this official carries stated commitments into public action.",
    ),
    truthRecord: buildTruthRecordSummary(
      truthScore,
      "A lightweight summary of how this official’s statement and claim activity has been rated so far.",
    ),
    transparencyNote:
      "These signals summarize ideological leaning, Public Reliability, and truth-rating patterns using visible promises, platform commitments, actions, posts, and interview responsiveness.",
  };
}
