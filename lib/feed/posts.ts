import { getAllComments } from "@/lib/feed/comments";
import { FACTUAL_CLAIM_FLAG_THRESHOLD, getEffectivePostContentType, getPostClaimFlagState, getStoredPostClaimFlags } from "@/lib/truth/claim-flags";
import { getAllTruthRatings, getTruthBadgeFromMeter, getTruthMeter, getTruthRankingSignal, TRUTH_RATING_VALUES } from "@/lib/truth/ratings";
import { cookies } from "next/headers";
import { cache } from "react";

import { getSeedUserById } from "@/lib/auth/mock-users";
import { getCommunityByJurisdictionName } from "@/lib/community/communities";
import { getQuickVoteCardsForUser } from "@/lib/feed/quick-votes";
import { applyPostReactionState } from "@/lib/feed/reactions";
import { getAllCreditBoosts } from "@/lib/engagement/credits";
import { canonicalizeIssueTags } from "@/lib/issues/utils";
import { getSafeReputationSummary } from "@/lib/profile/reputation";
import { getAllPublicProfiles } from "@/lib/server/elections-context";
import { getTrustedCitizenVisibilitySignal } from "@/lib/profile/reputation";
import { getReportedTargetIdsForUser } from "@/lib/server/content-reports";
import { getFollowedUserIds, getLightweightFollowState } from "@/lib/social/follows";
import type {
  AuthUser,
  ContextAttachmentSummary,
  FeedRenderableItem,
  PerspectiveType,
  PostContentType,
  PostSummary,
  TruthRatingValue,
} from "@/types/domain";

const MOCK_POSTS_COOKIE = "dd_mock_posts";
const ONBOARDING_BATCH_SIZE = 5;
const VALID_CONTENT_TYPES: PostContentType[] = [
  "statementClaim",
  "newsStory",
  "opinionPerspective",
  "announcementUpdate",
  "event",
  "questionPoll",
  "interview",
];

function buildTruthPreviewLabel(ratings: Array<{ rating: TruthRatingValue }>) {
  if (!ratings.length) {
    return null;
  }

  const distribution = TRUTH_RATING_VALUES.map((label) => {
    const count = ratings.filter((entry) => entry.rating === label).length;

    return {
      label,
      count,
      percentage: ratings.length ? Math.round((count / ratings.length) * 100) : 0,
    };
  });

  return getTruthBadgeFromMeter({
    entityId: "preview",
    totalRatings: ratings.length,
    viewerRating: null,
    distribution,
  });
}

function buildTruthPreviewDistribution(ratings: Array<{ rating: TruthRatingValue }>) {
  return TRUTH_RATING_VALUES.map((label) => {
    const count = ratings.filter((entry) => entry.rating === label).length;

    return {
      label,
      count,
      percentage: ratings.length ? Math.round((count / ratings.length) * 100) : 0,
    };
  });
}
export type FeedMode = "forYou" | "reliable" | "discussed";
type FeedPostOptions = {
  jurisdictionNames?: string[];
  limit?: number;
  viewerUserId?: string;
};

type ContextualPostOptions = {
  viewerUserId?: string;
  limit?: number;
  attachments?: Array<{
    type: ContextAttachmentSummary["type"];
    id?: string;
    label?: string;
  }>;
  preferredRoles?: PostSummary["authorRole"][];
};

function getPreviewScore(post: PostSummary, mode: FeedMode) {
  const recency = getRecencyBoost(post.createdAt);
  const reactionBalance = post.reactionTotals.up - post.reactionTotals.down;
  const discussionVolume = post.reactionTotals.up + post.reactionTotals.down;
  const roleBoost = getRoleBoost(post);

  if (mode === "reliable") {
    return roleBoost * 1.3 + reactionBalance * 0.03 + recency * 0.7;
  }

  if (mode === "discussed") {
    return discussionVolume * 0.08 + reactionBalance * 0.04 + recency * 0.5;
  }

  return recency + reactionBalance * 0.03 + roleBoost * 0.4;
}

function isPostSummary(value: unknown): value is PostSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const post = value as Record<string, unknown>;

  return (
    typeof post.id === "string" &&
    typeof post.authorName === "string" &&
    typeof post.authorRole === "string" &&
    typeof post.jurisdictionName === "string" &&
    typeof post.content === "string" &&
    typeof post.postType === "string" &&
    typeof post.contentType === "string" &&
    VALID_CONTENT_TYPES.includes(post.contentType as PostContentType) &&
    typeof post.createdAt === "string"
  );
}

function slugifyContextLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mapSharedEntityToAttachmentType(entityType: string): ContextAttachmentSummary["type"] | null {
  switch (entityType) {
    case "issue":
      return "issue";
    case "case":
      return "case";
    case "officialProfile":
      return "official";
    case "candidateProfile":
      return "candidate";
    case "petition":
      return "petition";
    case "election":
      return "election";
    case "organization":
      return "coalition";
    case "event":
      return "event";
    default:
      return null;
  }
}

export function getPerspectiveType(post: PostSummary): PerspectiveType {
  if (post.perspectiveType) {
    return post.perspectiveType;
  }

  if (post.authorRole === "official") {
    return "official_update";
  }

  if (post.authorRole === "candidate") {
    return "candidate_statement";
  }

  if (post.authorRole === "media") {
    return "media_summary";
  }

  return "perspective";
}

export function getNormalizedPostAttachments(post: PostSummary): ContextAttachmentSummary[] {
  if (post.attachments?.length) {
    return post.attachments;
  }

  const attachments: ContextAttachmentSummary[] = [];
  const community = getCommunityByJurisdictionName(post.jurisdictionName);

  attachments.push({
    type: "community",
    id: community?.id ?? slugifyContextLabel(post.jurisdictionName),
    label: post.jurisdictionName,
    jurisdictionId: community?.id ?? slugifyContextLabel(post.jurisdictionName),
  });

  for (const issueTag of post.issueTags ?? []) {
    attachments.push({
      type: "issue",
      id: slugifyContextLabel(issueTag),
      label: issueTag,
      jurisdictionId: community?.id ?? null,
    });
  }

  if (post.authorRole === "official" && post.authorId) {
    attachments.push({
      type: "official",
      id: post.authorId,
      label: post.authorName,
      jurisdictionId: community?.id ?? null,
    });
  }

  if (post.authorRole === "candidate" && post.authorId) {
    attachments.push({
      type: "candidate",
      id: post.authorId,
      label: post.authorName,
      jurisdictionId: community?.id ?? null,
    });
  }

  if (post.sharedItem) {
    const mappedType = mapSharedEntityToAttachmentType(post.sharedItem.entityType);

    if (mappedType) {
      attachments.push({
        type: mappedType,
        id: post.sharedItem.entityId,
        label: post.sharedItem.title,
        jurisdictionId: community?.id ?? null,
      });
    }
  }

  const seen = new Set<string>();
  return attachments.filter((attachment) => {
    const key = `${attachment.type}:${attachment.id}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function matchesContextAttachment(
  post: PostSummary,
  requested: NonNullable<ContextualPostOptions["attachments"]>[number],
) {
  const normalizedAttachments = getNormalizedPostAttachments(post);

  return normalizedAttachments.some((attachment) => {
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

export const getCreatedPosts = cache(async (): Promise<PostSummary[]> => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MOCK_POSTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPostSummary) : [];
  } catch {
    return [];
  }
});

const getAllBasePosts = cache(async (): Promise<PostSummary[]> => {
  return getCreatedPosts();
});

function getRoleBoost(post: PostSummary) {
  if (post.authorRole === "official") {
    return 1.1;
  }

  if (post.authorRole === "trustedCitizen") {
    return 0.9;
  }

  if (post.authorRole === "candidate") {
    return 0.7;
  }

  if (post.authorRole === "media") {
    return 0.35;
  }

  return 0;
}

function getRecencyBoost(createdAt: string) {
  const ageHours = Math.max((Date.now() - Date.parse(createdAt)) / (1000 * 60 * 60), 1);
  return Math.max(0, 1.5 - Math.min(ageHours / 48, 1.5));
}

function diversifyPosts<T extends PostSummary & { __score: number }>(posts: T[]) {
  const buckets = new Map<PostContentType, T[]>();

  for (const post of posts) {
    const existing = buckets.get(post.contentType) ?? [];
    existing.push(post);
    buckets.set(post.contentType, existing);
  }

  const orderedTypes = [...buckets.entries()]
    .sort((a, b) => (b[1][0]?.__score ?? 0) - (a[1][0]?.__score ?? 0))
    .map(([type]) => type);
  const result: T[] = [];

  while (orderedTypes.some((type) => (buckets.get(type)?.length ?? 0) > 0)) {
    for (const type of orderedTypes) {
      const bucket = buckets.get(type);

      if (bucket?.length) {
        result.push(bucket.shift()!);
      }
    }
  }

  return result;
}

function getAuthorRoleTrustBoost(post: PostSummary) {
  if (post.authorRole === "official" || post.authorRole === "trustedCitizen") {
    return 0.9;
  }

  if (post.authorRole === "candidate") {
    return 0.45;
  }

  if (post.authorRole === "media") {
    return 0.3;
  }

  return 0;
}

function getFollowBoost(isFollowedAuthor: boolean) {
  return isFollowedAuthor ? 1.35 : 0;
}

function mapSafeReputationToCredibilityLabel(authorId: string | undefined) {
  const seededUser = authorId ? getSeedUserById(authorId) : null;

  if (!seededUser) {
    return {
      label: null,
      summary: null,
    };
  }

  const reputation = getSafeReputationSummary(seededUser);
  const label =
    reputation.tier === "Highly Trusted"
      ? "High Credibility"
      : reputation.tier === "Trusted"
        ? "Solid Credibility"
        : reputation.tier === "Mixed Reliability"
          ? "Mixed Credibility"
          : "Emerging Credibility";

  return {
    label,
    summary: reputation.summary,
  };
}

async function buildPostAuthorPreview(
  post: PostSummary,
  viewerUserId?: string,
  publicProfileByClaimedUserId?: Map<string, Awaited<ReturnType<typeof getAllPublicProfiles>>[number]>,
) {
  const { label, summary } = mapSafeReputationToCredibilityLabel(post.authorId);
  const publicProfile = post.authorId ? publicProfileByClaimedUserId?.get(post.authorId) ?? null : null;
  const followState =
    post.authorId && viewerUserId
      ? await getLightweightFollowState(viewerUserId, post.authorId, getSeedUserById(post.authorId)?.followerCount ?? 0)
      : null;

  const authorProfileHref =
    post.authorRole === "media" && post.authorId
      ? `/media/${post.authorId}`
      : publicProfile?.profileType === "candidate" || publicProfile?.profileType === "incumbentCandidate"
        ? `/candidates/${publicProfile.id}`
        : publicProfile?.profileType === "official"
          ? `/officials/${publicProfile.id}`
          : post.authorId
            ? `/citizens/${post.authorId}`
            : null;

  return {
    authorProfileHref,
    authorCredibilityLabel: label,
    authorCredibilitySummary: summary,
    authorViewerCanFollow: followState?.viewerCanFollow ?? false,
    authorViewerIsFollowing: followState?.viewerIsFollowing ?? false,
  };
}

async function enrichPostsWithAuthorPreview(posts: PostSummary[], viewerUserId?: string) {
  const publicProfiles = await getAllPublicProfiles().catch(() => []);
  const publicProfileByClaimedUserId = new Map(
    publicProfiles
      .filter((profile) => profile.claimedByUserId)
      .map((profile) => [profile.claimedByUserId as string, profile] as const),
  );

  return Promise.all(
    posts.map(async (post) => ({
      ...post,
      ...(await buildPostAuthorPreview(post, viewerUserId, publicProfileByClaimedUserId)),
    })),
  );
}

const getFeedPostsCached = cache(
  async (mode: FeedMode, viewerUserId: string | undefined, jurisdictionKey: string, limit: number): Promise<PostSummary[]> => {
  const createdPosts = await getCreatedPosts();
  const jurisdictionNames = jurisdictionKey ? jurisdictionKey.split("|").filter(Boolean) : null;
  const allowedJurisdictions = jurisdictionNames ? new Set(jurisdictionNames) : null;
  const posts = await applyPostReactionState(
    createdPosts.filter((post) => (allowedJurisdictions ? allowedJurisdictions.has(post.jurisdictionName) : true)),
    viewerUserId,
  );
  const [comments, truthRatings, followedUserIds] = await Promise.all([
    getAllComments(),
    getAllTruthRatings(),
    viewerUserId ? getFollowedUserIds(viewerUserId) : Promise.resolve([]),
  ]);
  const followedUsers = new Set(followedUserIds);
  const commentCountByPost = new Map<string, number>();
  const truthRatingCountByEntity = new Map<string, number>();

  for (const comment of comments) {
    commentCountByPost.set(comment.postId, (commentCountByPost.get(comment.postId) ?? 0) + 1);
  }

  for (const rating of truthRatings) {
    truthRatingCountByEntity.set(rating.entityId, (truthRatingCountByEntity.get(rating.entityId) ?? 0) + 1);
  }

  const effectiveContentTypeEntries = await Promise.all(
    posts.map(async (post) => [post.id, await getEffectivePostContentType(post)] as const),
  );
  const effectiveContentTypeByPost = new Map(effectiveContentTypeEntries);
  const truthEligiblePosts = posts.filter((post) => {
    const effectiveContentType = effectiveContentTypeByPost.get(post.id);
    return effectiveContentType === "statementClaim" || effectiveContentType === "newsStory";
  });
  const truthMeterEntries = await Promise.all(
    truthEligiblePosts.map(async (post) => [post.id, await getTruthMeter(post.id)] as const),
  );
  const truthMeterByPost = new Map(truthMeterEntries);
  const authorIds = [...new Set(posts.map((post) => post.authorId).filter(Boolean))] as string[];
  const authorClaimSignals = new Map<string, number>();

  for (const authorId of authorIds) {
    const claimPosts = posts.filter(
      (post) => post.authorId === authorId && effectiveContentTypeByPost.get(post.id) === "statementClaim",
    );

    if (!claimPosts.length) {
      authorClaimSignals.set(authorId, 0.1);
      continue;
    }

    const aggregateSignal = claimPosts.reduce(
      (total, post) => total + getTruthRankingSignal(truthMeterByPost.get(post.id) ?? { entityId: post.id, totalRatings: 0, viewerRating: null, distribution: [] }),
      0,
    );
    authorClaimSignals.set(authorId, aggregateSignal / claimPosts.length);
  }

  const reputationEntries = await Promise.all(
    authorIds.map(async (authorId) => [authorId, await getTrustedCitizenVisibilitySignal(authorId)] as const),
  );
  const reputationByAuthor = new Map(reputationEntries);

  const rankedPosts = await Promise.all(
    posts.map(async (post) => {
      const effectiveContentType = effectiveContentTypeByPost.get(post.id) ?? post.contentType;
      const postCommentCount = commentCountByPost.get(post.id) ?? 0;
      const truthMeter =
        effectiveContentType === "statementClaim" || effectiveContentType === "newsStory"
          ? truthMeterByPost.get(post.id) ?? {
              entityId: post.id,
              totalRatings: 0,
              viewerRating: null,
              distribution: [],
            }
          : {
              entityId: post.id,
              totalRatings: 0,
              viewerRating: null,
              distribution: [],
            };
      const reactionBalance = post.reactionTotals.up - post.reactionTotals.down;
      const discussionVolume =
        post.reactionTotals.up +
        post.reactionTotals.down +
        postCommentCount * 2 +
        (truthRatingCountByEntity.get(post.id) ?? 0);
      const truthSignal =
        effectiveContentType === "statementClaim" || effectiveContentType === "newsStory"
          ? getTruthRankingSignal(truthMeter as Awaited<ReturnType<typeof getTruthMeter>>)
          : 0;
      const authorTrustSignal = post.authorId ? (authorClaimSignals.get(post.authorId) ?? 0) : 0;
      const trustedCitizenReputationSignal = post.authorId ? (reputationByAuthor.get(post.authorId) ?? 0) : 0;
      const authorRoleTrustBoost = getAuthorRoleTrustBoost(post);
      const viewerFollowsAuthor = Boolean(post.authorId && followedUsers.has(post.authorId));
      const followBoost = getFollowBoost(viewerFollowsAuthor);
      const mediaDampener = post.authorRole === "media" ? 0.35 : 0;
      const forYouScore =
        reactionBalance * 0.05 +
        discussionVolume * 0.08 +
        truthSignal * 1.2 +
        authorTrustSignal * 1.1 +
        trustedCitizenReputationSignal * 0.9 +
        followBoost +
        getRoleBoost(post) +
        getRecencyBoost(post.createdAt) -
        mediaDampener;
      const reliableScore =
        truthSignal * 2.4 +
        authorTrustSignal * 2 +
        trustedCitizenReputationSignal * 1.1 +
        authorRoleTrustBoost +
        followBoost * 0.8 +
        discussionVolume * 0.04 +
        reactionBalance * 0.03 +
        getRecencyBoost(post.createdAt) * 0.6 -
        mediaDampener * 0.5;
      const discussedScore =
        discussionVolume * 0.13 +
        reactionBalance * 0.08 +
        followBoost * 0.5 +
        getRecencyBoost(post.createdAt) +
        truthSignal * 0.25 +
        authorTrustSignal * 0.2 +
        trustedCitizenReputationSignal * 0.1 -
        mediaDampener * 0.4;

      return {
        ...post,
        issueTags: canonicalizeIssueTags(post.issueTags ?? []),
        contentType: effectiveContentType,
        viewerFollowsAuthor,
        __score: forYouScore,
        __discussion: discussionVolume,
        __truth: truthSignal,
        __reliable: reliableScore,
      };
    }),
  );

  const sorted =
    mode === "reliable"
      ? diversifyPosts(
          [...rankedPosts].sort(
            (a, b) => b.__reliable - a.__reliable || b.__truth - a.__truth || Date.parse(b.createdAt) - Date.parse(a.createdAt),
          ),
        )
      : mode === "discussed"
        ? diversifyPosts(
            [...rankedPosts].sort(
              (a, b) => b.__discussion - a.__discussion || b.__score - a.__score || Date.parse(b.createdAt) - Date.parse(a.createdAt),
            ),
          )
        : diversifyPosts([...rankedPosts].sort((a, b) => b.__score - a.__score || Date.parse(b.createdAt) - Date.parse(a.createdAt)));

  const cleaned = sorted.map(({ __score: _score, __discussion: _discussion, __truth: _truth, __reliable: _reliable, ...post }) => post);
  const limited = limit > 0 ? cleaned.slice(0, limit) : cleaned;
  return enrichPostsWithAuthorPreview(limited, viewerUserId);
});

export async function getFeedPosts(
  mode: FeedMode = "forYou",
  viewerUserId?: string,
  options: FeedPostOptions = {},
): Promise<PostSummary[]> {
  const jurisdictionKey = options.jurisdictionNames?.length ? [...options.jurisdictionNames].sort().join("|") : "";
  return getFeedPostsCached(mode, viewerUserId, jurisdictionKey, options.limit ?? -1);
}

const getFeedPostPreviewsCached = cache(
  async (mode: FeedMode, viewerUserId: string | undefined, jurisdictionKey: string, limit: number): Promise<PostSummary[]> => {
    const createdPosts = await getCreatedPosts();
    const jurisdictionNames = jurisdictionKey ? jurisdictionKey.split("|").filter(Boolean) : null;
    const allowedJurisdictions = jurisdictionNames ? new Set(jurisdictionNames) : null;
    const previewPosts = await applyPostReactionState(
      createdPosts.filter((post) => (allowedJurisdictions ? allowedJurisdictions.has(post.jurisdictionName) : true)),
      viewerUserId,
    );
    const boosts = await getAllCreditBoosts();
    const boostCountByPost = new Map<string, number>();

    for (const boost of boosts) {
      if (boost.targetType !== "post") {
        continue;
      }

      boostCountByPost.set(boost.targetId, (boostCountByPost.get(boost.targetId) ?? 0) + 1);
    }

    const ranked = previewPosts
      .map((post) => ({
        ...post,
        issueTags: canonicalizeIssueTags(post.issueTags ?? []),
        boostCount: boostCountByPost.get(post.id) ?? 0,
        viewerHasBoosted: Boolean(viewerUserId && boosts.some((boost) => boost.targetType === "post" && boost.targetId === post.id && boost.userId === viewerUserId)),
      }))
      .slice()
      .sort(
        (a, b) =>
          getPreviewScore(b, mode) - getPreviewScore(a, mode) || Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );

    const limitedPosts = limit > 0 ? ranked.slice(0, limit) : ranked;
    const [truthRatings, storedClaimFlags, reportedPostIds, effectiveContentEntries] = await Promise.all([
      getAllTruthRatings(),
      getStoredPostClaimFlags(),
      viewerUserId ? getReportedTargetIdsForUser(viewerUserId, "post") : Promise.resolve(new Set<string>()),
      Promise.all(limitedPosts.map(async (post) => [post.id, await getEffectivePostContentType(post)] as const)),
    ]);
    const effectiveContentTypeByPost = new Map(effectiveContentEntries);
    const truthRatingsByEntity = new Map<string, Array<{ rating: TruthRatingValue }>>();
    const claimFlagsByPost = new Map<string, number>();
    const viewerClaimFlags = new Set<string>();
    const commentCountByPost = new Map<string, number>();

    for (const rating of truthRatings) {
      const existing = truthRatingsByEntity.get(rating.entityId) ?? [];
      existing.push({ rating: rating.rating });
      truthRatingsByEntity.set(rating.entityId, existing);
    }

    for (const flag of storedClaimFlags) {
      claimFlagsByPost.set(flag.postId, (claimFlagsByPost.get(flag.postId) ?? 0) + 1);

      if (viewerUserId && flag.userId === viewerUserId) {
        viewerClaimFlags.add(flag.postId);
      }
    }

    const allComments = await getAllComments();
    for (const comment of allComments) {
      commentCountByPost.set(comment.postId, (commentCountByPost.get(comment.postId) ?? 0) + 1);
    }

    const hydratedPosts = limitedPosts.map((post) => {
      const effectiveContentType = effectiveContentTypeByPost.get(post.id) ?? post.contentType;
      const truthEligible = effectiveContentType === "statementClaim" || effectiveContentType === "newsStory";
      const postTruthRatings = truthRatingsByEntity.get(post.id) ?? [];
      const truthDistribution = truthEligible ? buildTruthPreviewDistribution(postTruthRatings) : undefined;
      const claimFlagCount = claimFlagsByPost.get(post.id) ?? 0;

      return {
        ...post,
        contentType: effectiveContentType,
        commentCount: commentCountByPost.get(post.id) ?? 0,
        truthEligible,
        truthRatingCount: postTruthRatings.length,
        truthDistribution,
        truthPreviewLabel: truthEligible ? buildTruthPreviewLabel(postTruthRatings) : null,
        claimFlagCount,
        viewerHasClaimFlagged: viewerClaimFlags.has(post.id),
        claimFlagThresholdReached: claimFlagCount >= FACTUAL_CLAIM_FLAG_THRESHOLD,
        viewerHasReportedContent: reportedPostIds.has(post.id),
      };
    });

    return enrichPostsWithAuthorPreview(hydratedPosts, viewerUserId);
  },
);

export async function getFeedPostPreviews(mode: FeedMode = "forYou", options: FeedPostOptions = {}): Promise<PostSummary[]> {
  const jurisdictionKey = options.jurisdictionNames?.length ? [...options.jurisdictionNames].sort().join("|") : "";
  return getFeedPostPreviewsCached(mode, options.viewerUserId, jurisdictionKey, options.limit ?? -1);
}

export async function getContextualPostPreviews(options: ContextualPostOptions = {}): Promise<PostSummary[]> {
  const posts = await getFeedPostPreviews("forYou", {
    viewerUserId: options.viewerUserId,
    limit: -1,
  });

  const filtered = posts.filter((post) => {
    if (options.preferredRoles?.length && !options.preferredRoles.includes(post.authorRole)) {
      return false;
    }

    if (!options.attachments?.length) {
      return true;
    }

    return options.attachments.some((attachment) => matchesContextAttachment(post, attachment));
  });

  return options.limit && options.limit > 0 ? filtered.slice(0, options.limit) : filtered;
}

export async function getPostById(postId: string, viewerUserId?: string): Promise<PostSummary | null> {
  const post = (await getAllBasePosts()).find((entry) => entry.id === postId);

  if (!post) {
    return null;
  }

  const reactedPosts = await applyPostReactionState([post], viewerUserId);
  const reactedPost = reactedPosts[0] ?? post;
  const [claimFlagState, reportedPostIds] = await Promise.all([
    getPostClaimFlagState(postId, viewerUserId),
    viewerUserId ? getReportedTargetIdsForUser(viewerUserId, "post") : Promise.resolve(new Set<string>()),
  ]);

  const enrichedPost = {
    ...reactedPost,
    claimFlagCount: claimFlagState.count,
    viewerHasClaimFlagged: claimFlagState.viewerHasFlagged,
    claimFlagThresholdReached: claimFlagState.thresholdReached,
    viewerHasReportedContent: reportedPostIds.has(postId),
  };

  const [hydratedPost] = await enrichPostsWithAuthorPreview([enrichedPost], viewerUserId);
  return hydratedPost ?? enrichedPost;
}

function interleaveFeedItems(posts: PostSummary[], voteQuestions: Awaited<ReturnType<typeof getQuickVoteCardsForUser>>): FeedRenderableItem[] {
  const items: FeedRenderableItem[] = [];

  posts.forEach((post, index) => {
    items.push({
      id: `feed-post-${post.id}`,
      itemType: "post",
      post,
    });

    if (voteQuestions[index] && (index + 1) % 4 === 0) {
      items.push({
        id: `feed-vote-${voteQuestions[index].id}`,
        itemType: "voteQuestion",
        question: voteQuestions[index],
      });
    }
  });

  if (!items.some((item) => item.itemType === "voteQuestion")) {
    voteQuestions.slice(0, 2).forEach((question) => {
      items.push({
        id: `feed-vote-${question.id}`,
        itemType: "voteQuestion",
        question,
      });
    });
  }

  return items;
}

export async function getFeedExperience(user: AuthUser) {
  const posts = await getFeedPosts("forYou", user.id);
  const voteQuestions = await getQuickVoteCardsForUser(user);
  const onboardingBatch = voteQuestions.slice(0, ONBOARDING_BATCH_SIZE);
  const answeredInBatch = onboardingBatch.filter((question) => question.userAnswer).length;
  const remainingOnboardingQuestions = onboardingBatch.filter((question) => !question.userAnswer);
  const topVoteQuestions = remainingOnboardingQuestions.map((question, index) => ({
    ...question,
    onboardingPosition: answeredInBatch + index + 1,
    onboardingTotal: onboardingBatch.length,
  }));
  const mixedVoteQuestions = remainingOnboardingQuestions.length === 0 ? voteQuestions.slice(ONBOARDING_BATCH_SIZE, ONBOARDING_BATCH_SIZE + 2) : [];
  const answeredCount = voteQuestions.filter((question) => question.userAnswer).length;

  return {
    topVoteQuestions,
    feedItems: interleaveFeedItems(posts, mixedVoteQuestions),
    answeredQuickVotes: answeredCount,
    onboardingProgress: {
      answered: answeredInBatch,
      total: onboardingBatch.length,
    },
  };
}

export async function setCreatedPosts(posts: PostSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(MOCK_POSTS_COOKIE, JSON.stringify(posts.slice(0, 12)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
