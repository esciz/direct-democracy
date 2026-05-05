"use server";

import { redirect } from "next/navigation";

import { canUserCommentOnPosts } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { MAX_COMMENTS_PER_USER_PER_POST, getCommentAuthor, getCommentCountForUserOnPost, getStoredComments, setStoredComments } from "@/lib/feed/comments";
import type { CommentSummary } from "@/types/domain";

function withParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function isValidMediaUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function addPostComment(formData: FormData) {
  const currentUser = await getCurrentUser();
  const postId = formData.get("postId");
  const content = formData.get("content");
  const mediaUrl = formData.get("mediaUrl");
  const returnPath = formData.get("returnPath");
  const fallbackPath = typeof returnPath === "string" ? returnPath : "/posts";

  if (!(canUserCommentOnPosts(currentUser))) {
    redirect(withParam(fallbackPath, "commentError", "denied"));
  }

  if (typeof postId !== "string" || typeof content !== "string") {
    redirect(withParam(fallbackPath, "commentError", "invalid"));
  }

  const trimmed = content.trim();
  const sanitizedMediaUrl = typeof mediaUrl === "string" && mediaUrl.trim() ? mediaUrl.trim() : undefined;

  if (!trimmed && !sanitizedMediaUrl) {
    redirect(withParam(fallbackPath, "commentError", "empty"));
  }

  if (!sanitizedMediaUrl && trimmed.length < 8) {
    redirect(withParam(fallbackPath, "commentError", "short"));
  }

  if (trimmed.length > 280) {
    redirect(withParam(fallbackPath, "commentError", "long"));
  }

  if (sanitizedMediaUrl && !isValidMediaUrl(sanitizedMediaUrl)) {
    redirect(withParam(fallbackPath, "commentError", "media"));
  }

  const existingCount = await getCommentCountForUserOnPost(currentUser.id, postId);

  if (existingCount >= MAX_COMMENTS_PER_USER_PER_POST) {
    redirect(withParam(fallbackPath, "commentError", "limit"));
  }

  const author = getCommentAuthor(currentUser.id);

  if (!author) {
    redirect(withParam(fallbackPath, "commentError", "denied"));
  }

  const existingComments = await getStoredComments();
  const nextComment: CommentSummary = {
    id: `comment_created_${Date.now()}`,
    postId,
    userId: currentUser.id,
    authorName: author.authorName,
    authorRole: author.authorRole,
    content: trimmed,
    mediaType: sanitizedMediaUrl ? "IMAGE" : undefined,
    mediaUrl: sanitizedMediaUrl,
    createdAt: new Date().toISOString(),
  };

  await setStoredComments([nextComment, ...existingComments]);

  redirect(withParam(fallbackPath, "comment", "success"));
}
