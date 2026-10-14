import "server-only";

import { cache } from "react";

import { canUserCreateDebate } from "@/lib/auth/guards";
import { seedUsers } from "@/lib/auth/mock-users";
import { getAllDebatesForTrust } from "@/lib/debates/store";
import { getCanonicalIssueText, valuesMatchIssueText } from "@/lib/issues/utils";
import { getUserProfileContent } from "@/lib/profile/details";
import { getSafeReputationSummary, getTrustedCitizenReputationWeight } from "@/lib/profile/reputation";
import { inferIdeologicalLeaningLabel } from "@/lib/profile/signals";
import type { AuthUser, DebateRecommendationSummary, PublicProfileType } from "@/types/domain";

type ScoredRecommendation = {
  recommendation: DebateRecommendationSummary;
  score: number;
};

function getPublicProfileType(role: AuthUser["role"]): PublicProfileType | null {
  if (role === "citizen" || role === "trustedCitizen" || role === "candidate" || role === "official") {
    return role;
  }

  return null;
}

function getIssueValues(content: Awaited<ReturnType<typeof getUserProfileContent>>) {
  return [...content.localIssues, ...content.stateIssues, ...content.nationalIssues]
    .map((entry) => getCanonicalIssueText(entry.value))
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index);
}

function getJurisdictionMatchScore(a: string, b: string) {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();

  if (left === right) {
    return 18;
  }

  if (left.includes(right) || right.includes(left)) {
    return 14;
  }

  const leftState = left.split(",").at(-1)?.trim();
  const rightState = right.split(",").at(-1)?.trim();

  if (leftState && rightState && leftState === rightState) {
    return 10;
  }

  if (left === "united states" || right === "united states") {
    return 4;
  }

  return 0;
}

function getIdeologyDifferenceScore(viewer: ReturnType<typeof inferIdeologicalLeaningLabel>, opponent: ReturnType<typeof inferIdeologicalLeaningLabel>) {
  const order = ["Left", "Lean Left", "Center", "Lean Right", "Right"] as const;

  if (!viewer || !opponent) {
    return 0;
  }

  return Math.abs(order.indexOf(viewer) - order.indexOf(opponent)) * 5;
}

function getRolePriorityBonus(user: AuthUser) {
  switch (user.role) {
    case "trustedCitizen":
      return 16;
    case "official":
      return 14;
    case "candidate":
      return 12;
    case "citizen":
      return user.isVerifiedVoter ? 6 : 0;
    default:
      return 0;
  }
}

function buildNewDebateHref({
  issueText,
  opponent,
  title,
  description,
  reasonLabel,
}: {
  issueText: string;
  opponent: AuthUser;
  title: string;
  description: string;
  reasonLabel: string;
}) {
  const params = new URLSearchParams({
    issueText,
    invitedUserId: opponent.id,
    title,
    description,
    recommended: "1",
    recommendedUserName: opponent.name,
    recommendedReason: reasonLabel,
  });

  return `/debates/new?${params.toString()}`;
}

const getRecommendedDebatesCached = cache(async (userId: string, limit: number): Promise<DebateRecommendationSummary[]> => {
  const viewer = seedUsers.find((entry) => entry.id === userId);

  if (!viewer || viewer.isAnonymousPublic) {
    return [];
  }

  const [viewerContent, debates] = await Promise.all([getUserProfileContent(userId), getAllDebatesForTrust()]);
  const viewerIssues = getIssueValues(viewerContent);

  if (!viewerIssues.length) {
    return [];
  }

  const viewerLeaning = inferIdeologicalLeaningLabel({
    sourceTexts: [...viewerIssues, viewer.bio ?? ""],
  });

  const debateRecommendations: Array<ScoredRecommendation | null> = debates
    .filter((debate) => debate.status === "open" && debate.createdByUserId !== userId)
    .map((debate) => {
      const issueText = getCanonicalIssueText(debate.issueText);

      if (!viewerIssues.some((issue) => valuesMatchIssueText(issueText, issue))) {
        return null;
      }

      const creator = seedUsers.find((entry) => entry.id === debate.createdByUserId) ?? null;
      const jurisdictionScore = getJurisdictionMatchScore(viewer.jurisdictionName, debate.jurisdictionName);

      if (!jurisdictionScore && debate.jurisdictionName !== "United States") {
        return null;
      }

      const category =
        creator?.role === "candidate" || creator?.role === "official"
          ? "publicResponse"
          : jurisdictionScore >= 14
            ? "localIssue"
            : "trendingIssue";
      const reasonLabel =
        category === "publicResponse"
          ? "Public response opportunity"
          : category === "localIssue"
            ? "Active in your community"
            : "Issue already drawing debate";
      const reasonDescription =
        category === "publicResponse"
          ? `${creator?.name ?? "A public figure"} is already publicly arguing this issue. Add a structured response instead of a drive-by reaction.`
          : category === "localIssue"
            ? `This issue is active where you live, and there is already a live debate worth following or joining.`
            : `This issue is already drawing competing views on the platform. Enter through a structured debate instead of scattered comment threads.`;

      return {
        recommendation: {
          id: `debate_recommendation_existing_${debate.id}_${userId}`,
          category,
          title: debate.title,
          description: debate.description,
          issueText,
          jurisdictionName: debate.jurisdictionName,
          href: `/debates/${debate.id}`,
          callToActionLabel: "Open debate",
          reasonLabel,
          reasonDescription,
          createdAt: debate.createdAt,
          sourceDebateId: debate.id,
          opponentUserId: creator?.id ?? null,
          opponentName: creator?.name ?? null,
          opponentRole: creator ? getPublicProfileType(creator.role) : null,
          opponentCredibilityLabel: creator ? getSafeReputationSummary(creator).tier : null,
                rewardHint: canUserCreateDebate(viewer)
            ? "Follow strong debates now, then join or complete structured debates to build a stronger civic record."
            : "Open the debate now. Stronger participation unlocks after verification and higher-trust progression.",
        } satisfies DebateRecommendationSummary,
        score: 60 + jurisdictionScore + getRolePriorityBonus(creator ?? viewer),
      };
    });

  const opponentCandidates: Array<ScoredRecommendation | null> = canUserCreateDebate(viewer)
    ? await Promise.all(
        seedUsers
          .filter(
            (entry) =>
              entry.id !== userId &&
              !entry.isAnonymousPublic &&
              (entry.role === "trustedCitizen" || entry.role === "candidate" || entry.role === "official"),
          )
          .map(async (opponent): Promise<ScoredRecommendation | null> => {
            const content = await getUserProfileContent(opponent.id);
            const opponentIssues = getIssueValues(content);
            const sharedIssue = viewerIssues.find((issue) => opponentIssues.some((candidateIssue) => valuesMatchIssueText(issue, candidateIssue)));

            if (!sharedIssue) {
              return null;
            }

            const jurisdictionScore = getJurisdictionMatchScore(viewer.jurisdictionName, opponent.jurisdictionName);

            if (!jurisdictionScore && opponent.jurisdictionName !== "United States") {
              return null;
            }

            const opponentLeaning = inferIdeologicalLeaningLabel({
              sourceTexts: [...opponentIssues, opponent.bio ?? ""],
            });
            const disagreementScore = getIdeologyDifferenceScore(viewerLeaning, opponentLeaning);

            if (!disagreementScore && opponent.role === "trustedCitizen" && jurisdictionScore < 10) {
              return null;
            }

            const reputationWeight = opponent.role === "trustedCitizen" ? await getTrustedCitizenReputationWeight(opponent.id) : 1;
            const category =
              opponent.role === "candidate" || opponent.role === "official"
                ? "publicResponse"
                : jurisdictionScore >= 14
                  ? "trustedVoice"
                  : "issueDifference";
            const reasonLabel =
              category === "publicResponse"
                ? "Respond to a public stance"
                : category === "trustedVoice"
                  ? "Trusted voice, different view"
                  : "Shared issue, different angle";
            const reasonDescription =
              category === "publicResponse"
                ? `${opponent.name} has public standing on this issue. A structured debate is a better response than reactive posting.`
                : category === "trustedVoice"
                  ? `You and ${opponent.name} care about ${sharedIssue}, but your public signals suggest different instincts worth clarifying in public.`
                  : `You and ${opponent.name} both surface ${sharedIssue}, and the platform sees a meaningful difference in how you frame it.`;

            return {
              recommendation: {
                id: `debate_recommendation_new_${userId}_${opponent.id}_${sharedIssue.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
                category,
                title: `Start a structured debate on ${sharedIssue}`,
                description: `Open a clear, issue-based debate with ${opponent.name} and add your own framing before the debate begins.`,
                issueText: sharedIssue,
                jurisdictionName: jurisdictionScore >= 14 ? viewer.jurisdictionName : opponent.jurisdictionName,
                href: buildNewDebateHref({
                  issueText: sharedIssue,
                  opponent,
                  title: `${sharedIssue}: a structured civic debate`,
                  description: `A recommended debate on ${sharedIssue} between people with different public priorities and enough civic context to make the exchange useful.`,
                  reasonLabel,
                }),
                callToActionLabel: "Start debate",
                reasonLabel,
                reasonDescription,
                createdAt: new Date().toISOString(),
                sourceDebateId: null,
                opponentUserId: opponent.id,
                opponentName: opponent.name,
                opponentRole: getPublicProfileType(opponent.role),
                opponentCredibilityLabel: getSafeReputationSummary(opponent).tier,
                rewardHint: "Starting and completing structured debates now adds more visible civic participation to your record.",
              } satisfies DebateRecommendationSummary,
              score:
                45 +
                jurisdictionScore +
                disagreementScore +
                getRolePriorityBonus(opponent) +
                Math.round(reputationWeight * 6),
            };
          }),
      )
    : [];

  const scoredRecommendations = [...debateRecommendations, ...opponentCandidates].filter(
    (entry): entry is ScoredRecommendation => entry !== null,
  );

  return scoredRecommendations
    .sort((a, b) => b.score - a.score || Date.parse(b.recommendation.createdAt) - Date.parse(a.recommendation.createdAt))
    .map((entry) => entry.recommendation)
    .filter((recommendation, index, recommendations) => recommendations.findIndex((entry) => entry.id === recommendation.id) === index)
    .slice(0, limit);
});

export async function getRecommendedDebatesForUser(userId: string, options?: { limit?: number }) {
  return getRecommendedDebatesCached(userId, options?.limit ?? 3);
}
