"use server";

import { redirect } from "next/navigation";

import { canUserCreatePublicPost } from "@/lib/server/auth-guards";
import { getCurrentFeedViewer, getCurrentUser } from "@/lib/server/auth-session";
import { BOOST_COST, getAllCreditBoosts, getCreditBalance, getStoredCreditBoosts, setStoredCreditBoosts } from "@/lib/engagement/credits";
import { getCreatedPosts, setCreatedPosts } from "@/lib/feed/posts";
import { getStoredPostReactions, setStoredPostReactions } from "@/lib/feed/reactions";
import { createFolloweeNotificationsForPost } from "@/lib/notifications/store";
import { ensureIssueReferenceForUser } from "@/lib/server/issues";
import type { ContextAttachmentSummary, CreditBoostSummary, PerspectiveType, PostContentType, PostSummary, PostType } from "@/types/domain";

const VALID_POST_TYPES: PostType[] = ["TEXT", "IMAGE", "VIDEO", "AUDIO"];
const VALID_CONTENT_TYPES: PostContentType[] = [
  "statementClaim",
  "newsStory",
  "opinionPerspective",
  "announcementUpdate",
  "event",
  "questionPoll",
];
const VALID_ATTACHMENT_TYPES: ContextAttachmentSummary["type"][] = [
  "community",
  "issue",
  "case",
  "official",
  "candidate",
  "petition",
  "legislation",
  "election",
  "coalition",
  "event",
];
const VALID_PERSPECTIVE_TYPES: PerspectiveType[] = [
  "perspective",
  "official_update",
  "candidate_statement",
  "media_summary",
  "coalition_update",
  "petition_update",
];

function isValidMediaUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeAttachmentLabel(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function inferDefaultPerspectiveType(role: PostSummary["authorRole"]): PerspectiveType {
  if (role === "official") {
    return "official_update";
  }

  if (role === "candidate") {
    return "candidate_statement";
  }

  if (role === "media") {
    return "media_summary";
  }

  return "perspective";
}

export async function createMockPost(formData: FormData) {
  const user = await getCurrentUser();

  if (!(await canUserCreatePublicPost(user))) {
    redirect("/posts?denied=create-post");
  }

  const title = formData.get("title");
  const content = formData.get("content");
  const postType = formData.get("postType");
  const contentType = formData.get("contentType");
  const mediaUrl = formData.get("mediaUrl");
  const promotedLabel = formData.get("promotedLabel");
  const issueTag = formData.get("issueTag");
  const shareMode = formData.get("shareMode");
  const shareEntityType = formData.get("shareEntityType");
  const shareEntityId = formData.get("shareEntityId");
  const shareTitle = formData.get("shareTitle");
  const shareHref = formData.get("shareHref");
  const shareSummary = formData.get("shareSummary");
  const shareIssueTag = formData.get("shareIssueTag");
  const attachmentType = formData.get("attachmentType");
  const attachmentId = formData.get("attachmentId");
  const attachmentLabel = formData.get("attachmentLabel");
  const attachmentJurisdictionId = formData.get("attachmentJurisdictionId");
  const perspectiveType = formData.get("perspectiveType");
  const stance = formData.get("stance");

  if (typeof title === "string" && title.trim().length > 120) {
    redirect("/posts/create?error=title");
  }

  const nextPostType =
    typeof postType === "string" && VALID_POST_TYPES.includes(postType as PostType) ? (postType as PostType) : "TEXT";
  const nextContentType =
    typeof contentType === "string" && VALID_CONTENT_TYPES.includes(contentType as PostContentType)
      ? (contentType as PostContentType)
      : null;
  const nextPromotedLabel =
    user.role === "media" && (promotedLabel === "Sponsored" || promotedLabel === "Promoted") ? promotedLabel : null;
  const sanitizedMediaUrl = typeof mediaUrl === "string" && mediaUrl.trim() ? mediaUrl.trim() : undefined;
  const sanitizedContent = typeof content === "string" ? content.trim() : "";
  const sanitizedIssueTag = typeof issueTag === "string" ? issueTag.trim() : "";
  const sanitizedShareIssueTag = typeof shareIssueTag === "string" ? shareIssueTag.trim() : "";
  const linkedIssue = sanitizedIssueTag
    ? await ensureIssueReferenceForUser(user, sanitizedIssueTag)
    : sanitizedShareIssueTag
      ? await ensureIssueReferenceForUser(user, sanitizedShareIssueTag)
      : null;
  const normalizedAttachmentType =
    typeof attachmentType === "string" && VALID_ATTACHMENT_TYPES.includes(attachmentType as ContextAttachmentSummary["type"])
      ? (attachmentType as ContextAttachmentSummary["type"])
      : null;
  const normalizedAttachmentLabel = normalizeAttachmentLabel(attachmentLabel);
  const normalizedAttachmentId = normalizeAttachmentLabel(attachmentId) || normalizedAttachmentLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const normalizedAttachmentJurisdictionId = normalizeAttachmentLabel(attachmentJurisdictionId) || null;
  const normalizedPerspectiveType =
    typeof perspectiveType === "string" && VALID_PERSPECTIVE_TYPES.includes(perspectiveType as PerspectiveType)
      ? (perspectiveType as PerspectiveType)
      : inferDefaultPerspectiveType(user.role);
  const linkedSharedItem =
    shareMode === "post" &&
    typeof shareEntityType === "string" &&
    typeof shareEntityId === "string" &&
    typeof shareTitle === "string" &&
    typeof shareHref === "string" &&
    shareEntityType.trim() &&
    shareEntityId.trim() &&
    shareTitle.trim() &&
    shareHref.trim()
      ? {
          entityType: shareEntityType.trim(),
          entityId: shareEntityId.trim(),
          title: shareTitle.trim(),
          href: shareHref.trim(),
          summary: typeof shareSummary === "string" && shareSummary.trim() ? shareSummary.trim() : null,
        }
      : null;

  if (!nextContentType) {
    redirect("/posts/create?error=contentType");
  }

  if (!normalizedAttachmentType || !normalizedAttachmentLabel || !normalizedAttachmentId) {
    redirect("/posts/create?error=attachment");
  }

  if (user.role === "media" && nextContentType !== "newsStory") {
    redirect("/posts/create?error=contentType");
  }

  if (user.role !== "media" && nextContentType === "newsStory") {
    redirect("/posts/create?error=contentType");
  }

  if (nextPostType === "TEXT" && sanitizedContent.length < 10) {
    redirect("/posts/create?error=content");
  }

  if (nextPostType !== "TEXT" && (!sanitizedMediaUrl || !isValidMediaUrl(sanitizedMediaUrl))) {
    redirect("/posts/create?error=mediaUrl");
  }

  const attachments: ContextAttachmentSummary[] = [
    {
      type: normalizedAttachmentType,
      id: normalizedAttachmentId,
      label: normalizedAttachmentLabel,
      jurisdictionId: normalizedAttachmentJurisdictionId,
    },
  ];

  if (linkedIssue) {
    attachments.push({
      type: "issue",
      id: linkedIssue.id,
      label: linkedIssue.issueText,
      jurisdictionId: normalizedAttachmentJurisdictionId,
    });
  }

  if (linkedSharedItem) {
    const sharedType =
      linkedSharedItem.entityType === "officialProfile"
        ? "official"
        : linkedSharedItem.entityType === "candidateProfile"
          ? "candidate"
          : linkedSharedItem.entityType === "organization"
            ? "coalition"
            : linkedSharedItem.entityType === "issue"
              ? "issue"
              : linkedSharedItem.entityType === "case"
                ? "case"
                : linkedSharedItem.entityType === "petition"
                  ? "petition"
                  : linkedSharedItem.entityType === "election"
                    ? "election"
                    : linkedSharedItem.entityType === "event"
                      ? "event"
                      : null;

    if (sharedType) {
      attachments.push({
        type: sharedType,
        id: linkedSharedItem.entityId,
        label: linkedSharedItem.title,
        jurisdictionId: normalizedAttachmentJurisdictionId,
      });
    }
  }

  const createdPost: PostSummary = {
    id: `post_created_${Date.now()}`,
    title: typeof title === "string" && title.trim() ? title.trim() : undefined,
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    authorMediaTier: user.mediaTier ?? null,
    jurisdictionName: user.jurisdictionName,
    content: sanitizedContent,
    issueTags: linkedIssue ? [linkedIssue.issueText] : undefined,
    perspectiveType: normalizedPerspectiveType,
    attachments,
    visibilityScope:
      normalizedAttachmentType === "community"
        ? "community"
        : normalizedAttachmentType === "election"
          ? "election"
          : normalizedAttachmentType === "petition" || normalizedAttachmentType === "legislation"
            ? "petition"
            : normalizedAttachmentType === "coalition"
              ? "coalition"
              : normalizedAttachmentType === "official" || normalizedAttachmentType === "candidate"
                ? "profile"
                : normalizedAttachmentType === "issue" || normalizedAttachmentType === "case"
                  ? "issue"
                  : "crossContext",
    jurisdictionScope: normalizedAttachmentJurisdictionId ? [normalizedAttachmentJurisdictionId] : undefined,
    stance: stance === "support" || stance === "oppose" || stance === "neutral" || stance === "explain" ? stance : null,
    moderationStatus: "published",
    postType: nextPostType,
    contentType: nextContentType,
    mediaUrl: sanitizedMediaUrl,
    createdAt: new Date().toISOString(),
    promotedLabel: nextPromotedLabel,
    reactionTotals: {
      up: 0,
      down: 0,
    },
    truthScore: {
      media: null,
      moderators: null,
      citizens: null,
    },
    shareMode: linkedSharedItem ? "post" : "original",
    sharedItem: linkedSharedItem,
  };

  const existingPosts = await getCreatedPosts();
  await setCreatedPosts([createdPost, ...existingPosts]);
  await createFolloweeNotificationsForPost(user.id, user.name, createdPost.id, createdPost.title);

  redirect("/posts");
}

export async function reactToFeedPost(postId: string, reaction: "up" | "down") {
  const user = await getCurrentFeedViewer();

  const post = (await getCreatedPosts()).find((entry) => entry.id === postId);

  if (!post) {
    return {
      ok: false,
      message: "That post preview is no longer available.",
    };
  }

  const storedReactions = await getStoredPostReactions();
  const existingReaction = storedReactions.find((entry) => entry.postId === postId && entry.userId === user.id);
  let nextViewerReaction: "up" | "down" | null = reaction;
  const nextReactions = storedReactions.filter((entry) => !(entry.postId === postId && entry.userId === user.id));

  if (existingReaction?.reaction !== reaction) {
    nextReactions.unshift({
      id: `post_reaction_${Date.now()}`,
      postId,
      userId: user.id,
      reaction,
      createdAt: new Date().toISOString(),
    });
  } else {
    nextViewerReaction = null;
  }

  await setStoredPostReactions(nextReactions);

  const scopedReactions = nextReactions.filter((entry) => entry.postId === postId);
  const upCount = scopedReactions.filter((entry) => entry.reaction === "up").length;
  const downCount = scopedReactions.filter((entry) => entry.reaction === "down").length;

  return {
    ok: true,
    viewerReaction: nextViewerReaction,
    counts: {
      up: Math.max(0, post.reactionTotals.up + upCount),
      down: Math.max(0, post.reactionTotals.down + downCount),
    },
  };
}

export async function boostFeedPost(postId: string) {
  const user = await getCurrentFeedViewer();
  const post = (await getCreatedPosts()).find((entry) => entry.id === postId);

  if (!post) {
    return {
      ok: false,
      message: "That post preview is no longer available.",
    };
  }

  const [balance, allBoosts, storedBoosts] = await Promise.all([
    getCreditBalance(user.id),
    getAllCreditBoosts(),
    getStoredCreditBoosts(),
  ]);

  if (allBoosts.some((boost) => boost.userId === user.id && boost.targetType === "post" && boost.targetId === postId)) {
    return {
      ok: true,
      viewerHasBoosted: true,
      boostCount: allBoosts.filter((boost) => boost.targetType === "post" && boost.targetId === postId).length,
    };
  }

  if (balance < BOOST_COST) {
    return {
      ok: false,
      message: "You need more civic credits before boosting this post.",
    };
  }

  const nextBoost: CreditBoostSummary = {
    id: `boost_post_${Date.now()}`,
    userId: user.id,
    targetType: "post",
    targetId: postId,
    createdAt: new Date().toISOString(),
    creditsSpent: BOOST_COST,
  };

  await setStoredCreditBoosts([nextBoost, ...storedBoosts]);

  return {
    ok: true,
    viewerHasBoosted: true,
    boostCount: allBoosts.filter((boost) => boost.targetType === "post" && boost.targetId === postId).length + 1,
  };
}
