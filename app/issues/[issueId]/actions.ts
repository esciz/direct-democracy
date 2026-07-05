"use server";

import { redirect } from "next/navigation";

import { isGuestUser } from "@/lib/auth/session";
import { getCreatedPosts, setCreatedPosts } from "@/lib/feed/posts";
import { getCurrentUser } from "@/lib/server/auth-session";
import type { ContextAttachmentSummary, PostSummary } from "@/types/domain";

const ISSUE_VOICE_ROLES = new Set<PostSummary["authorRole"]>(["citizen", "trustedCitizen", "verified_resident"]);

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithStatus(issueId: string, key: "issuePost" | "issuePostError", value: string): never {
  redirect(`/issues/${encodeURIComponent(issueId)}?${key}=${encodeURIComponent(value)}#citizen-voices`);
}

export async function submitIssueCitizenVoice(formData: FormData) {
  const user = await getCurrentUser();
  const issueId = textValue(formData, "issueId");
  const issueText = textValue(formData, "issueText");
  const title = textValue(formData, "title");
  const content = textValue(formData, "content");
  const stance = textValue(formData, "stance");

  if (!issueId || !issueText) {
    redirect("/issues");
  }

  if (isGuestUser(user) || !ISSUE_VOICE_ROLES.has(user.role)) {
    redirectWithStatus(issueId, "issuePostError", "registered-citizens-only");
  }

  if (!title || title.length > 120 || content.length < 20) {
    redirectWithStatus(issueId, "issuePostError", "invalid");
  }

  const normalizedStance =
    stance === "support" || stance === "oppose" || stance === "neutral" || stance === "explain"
      ? stance
      : "explain";
  const attachment: ContextAttachmentSummary = {
    type: "issue",
    id: issueId,
    label: issueText,
    jurisdictionId: user.primaryCommunityId ?? null,
  };
  const now = new Date().toISOString();
  const createdPost: PostSummary = {
    id: `post_created_issue_${Date.now()}`,
    title,
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    authorMediaTier: user.mediaTier ?? null,
    jurisdictionName: user.jurisdictionName,
    content,
    issueTags: [issueText],
    perspectiveType: "perspective",
    attachments: [attachment],
    visibilityScope: "issue",
    jurisdictionScope: user.primaryCommunityId ? [user.primaryCommunityId] : undefined,
    stance: normalizedStance,
    moderationStatus: "published",
    postType: "TEXT",
    contentType: "opinionPerspective",
    createdAt: now,
    promotedLabel: null,
    reactionTotals: {
      up: 0,
      down: 0,
    },
    truthScore: {
      media: null,
      moderators: null,
      citizens: null,
    },
    shareMode: "original",
  };

  const existingPosts = await getCreatedPosts();
  await setCreatedPosts([createdPost, ...existingPosts]);
  redirectWithStatus(issueId, "issuePost", "created");
}
