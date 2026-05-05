import { seedUsers } from "@/lib/auth/mock-users";
import { getAllComments } from "@/lib/feed/comments";
import { getCreatedPosts } from "@/lib/feed/posts";
import { mockPosts } from "@/lib/mock-data";
import { getUserSocialSummary } from "@/lib/social/follows";
import { getEffectivePostContentType } from "@/lib/truth/claim-flags";
import { getAllTruthRatings, getRawTruthMeter } from "@/lib/truth/ratings";
import {
  getAllDebatesForTrust,
  getAllDebateFallacyTagsForTrust,
  getAllDebateTurnsForTrust,
} from "@/lib/debates/store";
import type {
  AuthUser,
  CommentSummary,
  PostSummary,
  ReputationTier,
  TruthRatingValue,
  UserReputationSummary,
} from "@/types/domain";

type UserReputationSignals = UserReputationSummary & {
  trustRank: number;
  influenceRank: number;
  engagementCount: number;
};

const TRUTH_WEIGHTS: Record<TruthRatingValue, number> = {
  Accurate: 1,
  "Mostly True": 0.8,
  "Mixed / Unclear": 0.5,
  Misleading: 0.2,
  False: 0,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getReputationTier(score: number): ReputationTier {
  if (score >= 80) {
    return "Highly Trusted";
  }

  if (score >= 60) {
    return "Trusted";
  }

  if (score >= 40) {
    return "Mixed Reliability";
  }

  return "Low Reliability";
}

export function getSafeReputationSummary(user: AuthUser): {
  tier: ReputationTier;
  label: UserReputationSummary["trustLevel"];
  summary: string;
} {
  if (user.role === "official") {
    return {
      tier: "Trusted",
      label: "Moderate Trust",
      summary: "Public office and verified profile context give this account a stable baseline reputation summary while deeper signal analysis stays hidden.",
    };
  }

  if (user.role === "candidate") {
    return {
      tier: "Trusted",
      label: "Moderate Trust",
      summary: "Campaign participation and verified public-profile context give this account a stable baseline reputation summary while deeper signal analysis stays hidden.",
    };
  }

  if (user.role === "trustedCitizen" && user.verificationState === "voterVerified") {
    return {
      tier: "Trusted",
      label: "Moderate Trust",
      summary: "Trusted Citizen status and voter verification provide a stable baseline reputation summary while the heavier truth and debate calculations remain deferred.",
    };
  }

  if (user.verificationState === "voterVerified") {
    return {
      tier: "Mixed Reliability",
      label: "Mixed",
      summary: "This account is voter-verified, but the richer reputation signals are still hidden while route stability is being restored.",
    };
  }

  return {
    tier: "Mixed Reliability",
    label: "Mixed",
    summary: "Reputation is still forming. A lighter summary is shown here until the full reputation system returns safely.",
  };
}

async function getStatementClaimPosts(posts: PostSummary[], userId: string) {
  const authoredPosts = posts.filter((post) => post.authorId === userId);
  const classifiedPosts = await Promise.all(
    authoredPosts.map(async (post) => ({
      post,
      effectiveContentType: await getEffectivePostContentType(post),
    })),
  );

  return {
    authoredPosts,
    statementPosts: classifiedPosts.filter((entry) => entry.effectiveContentType === "statementClaim").map((entry) => entry.post),
  };
}

async function getAllPostsForReputation(options?: { posts?: PostSummary[] }) {
  if (options?.posts) {
    return options.posts;
  }

  const createdPosts = await getCreatedPosts();
  return [...createdPosts, ...mockPosts];
}

async function getTrustedCitizenReputationSummary(
  userId: string,
  social: Awaited<ReturnType<typeof getUserSocialSummary>>,
  posts: PostSummary[],
) {
  const user = seedUsers.find((entry) => entry.id === userId);

  if (!user || user.role !== "trustedCitizen") {
    return null;
  }

  const [truthRatings, debateTurns, debates, fallacyTags] = await Promise.all([
    getAllTruthRatings(),
    getAllDebateTurnsForTrust(),
    getAllDebatesForTrust(),
    getAllDebateFallacyTagsForTrust(),
  ]);
  const { statementPosts } = await getStatementClaimPosts(posts, userId);
  const postTruthMeters = await Promise.all(statementPosts.map((post) => getRawTruthMeter(post.id)));
  const authoredDebateTurns = debateTurns.filter((turn) => turn.createdByUserId === userId);
  const authoredDebateTurnIds = new Set(authoredDebateTurns.map((turn) => turn.id));
  const debateTruthRatings = truthRatings.filter((rating) => authoredDebateTurnIds.has(rating.entityId));
  const poorDebateTruthCount = debateTruthRatings.filter(
    (rating) => rating.rating === "Misleading" || rating.rating === "False",
  ).length;
  const supportedFallacyCount = fallacyTags.filter((tag) => authoredDebateTurnIds.has(tag.debateTurnId)).length;
  const participatedDebateIds = new Set(authoredDebateTurns.map((turn) => turn.debateId));
  const consensusDebates = debates.filter((debate) => participatedDebateIds.has(debate.id) && debate.agreedStatement).length;
  const constructiveDebateCount = debates.filter(
    (debate) => participatedDebateIds.has(debate.id) && debate.status !== "withdrawn",
  ).length;
  const citedTurnCount = authoredDebateTurns.filter((turn) => (turn.citations?.length ?? 0) > 0).length;

  const truthTotals = postTruthMeters.reduce(
    (accumulator, meter) => {
      for (const item of meter.distribution) {
        accumulator.totalRatings += item.count;
        accumulator.weightedTotal += item.count * TRUTH_WEIGHTS[item.label];
      }

      return accumulator;
    },
    { totalRatings: 0, weightedTotal: 0 },
  );
  const averageTruthWeight = truthTotals.totalRatings ? truthTotals.weightedTotal / truthTotals.totalRatings : 0.5;
  const truthConfidence = Math.min(1, truthTotals.totalRatings / 6);
  const truthScore = clampScore(50 + (averageTruthWeight * 100 - 50) * truthConfidence);

  const debateScore = clampScore(
    50 +
      Math.min(12, authoredDebateTurns.length * 4) +
      Math.min(18, consensusDebates * 9 + Math.max(0, constructiveDebateCount - consensusDebates) * 4) +
      Math.min(8, citedTurnCount * 2) -
      supportedFallacyCount * 7 -
      poorDebateTruthCount * 6,
  );

  const scopedProgress = social.trustedProgressByCommunity;
  const averageFollowerProgress =
    scopedProgress.length > 0
      ? scopedProgress.reduce((total, entry) => total + entry.followerProgressPercent, 0) / scopedProgress.length
      : 50;
  const averageEngagementProgress =
    scopedProgress.length > 0
      ? scopedProgress.reduce((total, entry) => total + entry.engagementProgressPercent, 0) / scopedProgress.length
      : 50;
  const communityTrustScore = clampScore(
    40 +
      (user.verificationState === "voterVerified" ? 10 : 0) +
      averageFollowerProgress * 0.25 +
      averageEngagementProgress * 0.25,
  );

  const reputationScore = clampScore(truthScore * 0.5 + debateScore * 0.3 + communityTrustScore * 0.2);
  const tier = getReputationTier(reputationScore);
  const summary =
    tier === "Highly Trusted"
      ? "Strong truth signals, constructive debate participation, and solid community trust patterns are reinforcing this voice."
      : tier === "Trusted"
        ? "This voice is generally reliable, with positive truth and debate signals outweighing weaker contributions."
        : tier === "Mixed Reliability"
          ? "Some contributions are strong, but debate quality or truth signals are still mixed."
          : "Lower-quality truth or debate patterns are dragging this score down, even though trusted status is still visible.";

  return {
    score: reputationScore,
    tier,
    summary,
    breakdown: {
      truth: truthScore,
      debate: debateScore,
      communityTrust: communityTrustScore,
    },
  };
}

export async function getTrustedCitizenReputationWeight(userId: string) {
  const user = seedUsers.find((entry) => entry.id === userId);

  if (!user || user.role !== "trustedCitizen") {
    return 1;
  }

  const [social, posts] = await Promise.all([
    getUserSocialSummary(userId, user.followerCount),
    getAllPostsForReputation(),
  ]);
  const reputation = await getTrustedCitizenReputationSummary(userId, social, posts);

  if (!reputation) {
    return 1;
  }

  if (reputation.score >= 80) {
    return 1.2;
  }

  if (reputation.score >= 60) {
    return 1.08;
  }

  if (reputation.score >= 40) {
    return 0.95;
  }

  return 0.8;
}

export async function getTrustedCitizenVisibilitySignal(userId: string) {
  const user = seedUsers.find((entry) => entry.id === userId);

  if (!user || user.role !== "trustedCitizen") {
    return 0;
  }

  const [social, posts] = await Promise.all([
    getUserSocialSummary(userId, user.followerCount),
    getAllPostsForReputation(),
  ]);
  const reputation = await getTrustedCitizenReputationSummary(userId, social, posts);

  if (!reputation) {
    return 0;
  }

  return (reputation.score - 50) / 50;
}

export async function getUserReputationSignals(
  userId: string,
  options?: {
    baseFollowerCount?: number;
    posts?: PostSummary[];
    comments?: CommentSummary[];
  },
): Promise<UserReputationSignals> {
  const user = seedUsers.find((entry) => entry.id === userId);
  const [posts, comments, social] = await Promise.all([
    getAllPostsForReputation(options),
    options?.comments ? Promise.resolve(options.comments) : getAllComments(),
    getUserSocialSummary(userId, options?.baseFollowerCount ?? user?.followerCount ?? 0),
  ]);
  const { authoredPosts, statementPosts } = await getStatementClaimPosts(posts, userId);
  const truthMeters = await Promise.all(statementPosts.map((post) => getRawTruthMeter(post.id)));
  const totals = truthMeters.reduce(
    (accumulator, meter) => {
      for (const item of meter.distribution) {
        accumulator.totalRatings += item.count;
        accumulator.weightedTotal += item.count * TRUTH_WEIGHTS[item.label];

        if (item.label === "Accurate" || item.label === "Mostly True") {
          accumulator.positive += item.count;
        }

        if (item.label === "Misleading" || item.label === "False") {
          accumulator.negative += item.count;
        }

        if (item.label === "Mixed / Unclear") {
          accumulator.mixed += item.count;
        }
      }

      return accumulator;
    },
    { totalRatings: 0, weightedTotal: 0, positive: 0, negative: 0, mixed: 0 },
  );

  const averageTruth = totals.totalRatings ? totals.weightedTotal / totals.totalRatings : 0.65;
  const positiveShare = totals.totalRatings ? totals.positive / totals.totalRatings : 0;
  const negativeShare = totals.totalRatings ? totals.negative / totals.totalRatings : 0;
  const mixedShare = totals.totalRatings ? totals.mixed / totals.totalRatings : 0;

  let trustLevel: UserReputationSummary["trustLevel"] = "Moderate Trust";
  let trustRank = 3;
  let trustSummary = "Based on community accuracy ratings of statement and claim posts.";

  if (totals.totalRatings >= 2 && positiveShare >= 0.7 && negativeShare < 0.15 && averageTruth >= 0.78) {
    trustLevel = "High Trust";
    trustRank = 4;
    trustSummary = "Statement and claim posts are consistently rated as accurate by trusted community reviewers.";
  } else if (totals.totalRatings >= 2 && negativeShare >= 0.45) {
    trustLevel = "Low Trust";
    trustRank = 1;
    trustSummary = "Statement and claim posts have drawn a noticeable share of misleading or false ratings.";
  } else if (totals.totalRatings >= 2 && (mixedShare >= 0.3 || Math.abs(positiveShare - negativeShare) < 0.2)) {
    trustLevel = "Mixed";
    trustRank = 2;
    trustSummary = "Statement and claim posts draw mixed or contested accuracy ratings from trusted reviewers.";
  } else if (totals.totalRatings < 2 && totals.negative > 0) {
    trustLevel = "Mixed";
    trustRank = 2;
    trustSummary = "Early statement ratings are mixed, so this trust view is still forming.";
  }

  const commentCount = comments.filter((comment) => comment.userId === userId).length;
  const reactionCount = authoredPosts.reduce((total, post) => total + post.reactionTotals.up + post.reactionTotals.down, 0);
  const engagementCount = reactionCount + commentCount * 2;
  const followerCount = social.followerCount;

  let influenceLevel: UserReputationSummary["influenceLevel"] = "Emerging";
  let influenceRank = 1;
  let influenceSummary = "Based on follower support and engagement with public contributions.";

  if (followerCount >= 10000 || (followerCount >= 5000 && engagementCount >= 40) || engagementCount >= 90) {
    influenceLevel = "High Influence";
    influenceRank = 3;
    influenceSummary = "Strong follower support and sustained engagement give this voice broad visibility.";
  } else if (followerCount >= 2000 || engagementCount >= 25) {
    influenceLevel = "Moderate Influence";
    influenceRank = 2;
    influenceSummary = "This voice has a visible audience and regular engagement around their posts.";
  }

  const trustedCitizenReputation = await getTrustedCitizenReputationSummary(userId, social, posts);

  return {
    trustLevel,
    influenceLevel,
    trustSummary,
    influenceSummary,
    trustedCitizenReputation,
    trustRank,
    influenceRank,
    engagementCount,
  };
}

export async function getUserReputationSummary(
  userId: string,
  options?: {
    baseFollowerCount?: number;
    posts?: PostSummary[];
    comments?: CommentSummary[];
  },
): Promise<UserReputationSummary> {
  const { trustLevel, influenceLevel, trustSummary, influenceSummary, trustedCitizenReputation } =
    await getUserReputationSignals(userId, options);

  return {
    trustLevel,
    influenceLevel,
    trustSummary,
    influenceSummary,
    trustedCitizenReputation,
  };
}
