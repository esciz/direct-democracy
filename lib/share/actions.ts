"use server";

import { redirect } from "next/navigation";

import { getCreatedPosts, setCreatedPosts } from "@/lib/feed/posts";
import { createFolloweeNotificationsForPost } from "@/lib/notifications/store";
import { canUserCreatePublicPost } from "@/lib/server/auth-guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { ensureIssueReferenceForUser } from "@/lib/server/issues";
import type { ContextAttachmentSummary, PostSummary } from "@/types/domain";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createRepost(formData: FormData) {
  const user = await getCurrentUser();

  if (!(await canUserCreatePublicPost(user))) {
    redirect("/get-started?step=account");
  }

  const entityType = readText(formData, "entityType");
  const entityId = readText(formData, "entityId");
  const title = readText(formData, "title");
  const href = readText(formData, "href");
  const summary = readText(formData, "summary");
  const issueTag = readText(formData, "issueTag");
  const returnPath = readText(formData, "returnPath") || href || "/feed";

  if (!entityType || !entityId || !title || !href) {
    redirect(returnPath);
  }

  const linkedIssue = issueTag ? await ensureIssueReferenceForUser(user, issueTag) : null;
  const sharedAttachmentType: ContextAttachmentSummary["type"] | null =
    entityType === "issue"
      ? "issue"
      : entityType === "case"
        ? "case"
        : entityType === "officialProfile"
          ? "official"
          : entityType === "candidateProfile"
            ? "candidate"
            : entityType === "petition"
              ? "petition"
              : entityType === "election"
                ? "election"
                : entityType === "organization"
                  ? "coalition"
                  : entityType === "event"
                    ? "event"
                    : null;
  const attachments: ContextAttachmentSummary[] = [
    {
      type: "community",
      id: user.primaryCommunityId ?? user.jurisdictionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      label: user.jurisdictionName,
      jurisdictionId: user.primaryCommunityId ?? null,
    },
  ];

  if (sharedAttachmentType) {
    attachments.push({
      type: sharedAttachmentType,
      id: entityId,
      label: title,
      jurisdictionId: user.primaryCommunityId ?? null,
    });
  }

  if (linkedIssue) {
    attachments.push({
      type: "issue",
      id: linkedIssue.id,
      label: linkedIssue.issueText,
      jurisdictionId: user.primaryCommunityId ?? null,
    });
  }

  const createdPost: PostSummary = {
    id: `post_repost_${Date.now()}`,
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    authorMediaTier: user.mediaTier ?? null,
    jurisdictionName: user.jurisdictionName,
    content: "",
    issueTags: linkedIssue ? [linkedIssue.issueText] : undefined,
    perspectiveType: "perspective",
    attachments,
    visibilityScope: "crossContext",
    jurisdictionScope: user.primaryCommunityId ? [user.primaryCommunityId] : undefined,
    stance: "explain",
    moderationStatus: "published",
    postType: "TEXT",
    contentType: "announcementUpdate",
    createdAt: new Date().toISOString(),
    reactionTotals: {
      up: 0,
      down: 0,
    },
    truthScore: {
      media: null,
      moderators: null,
      citizens: null,
    },
    shareMode: "repost",
    sharedItem: {
      entityType,
      entityId,
      title,
      href,
      summary: summary || null,
    },
  };

  const existingPosts = await getCreatedPosts();
  await setCreatedPosts([createdPost, ...existingPosts]);
  await createFolloweeNotificationsForPost(user.id, user.name, createdPost.id, title);

  redirect(returnPath);
}
