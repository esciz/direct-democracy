import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import type { CommentSummary, UserRole } from "@/types/domain";

const POST_COMMENTS_COOKIE = "dd_post_comments";
const MAX_COMMENTS_PER_USER_PER_POST = 3;

const seededComments: CommentSummary[] = [];

function isUserRole(value: unknown): value is UserRole {
  return ["citizen", "trustedCitizen", "candidate", "official", "moderator", "admin"].includes(String(value));
}

function isCommentSummary(value: unknown): value is CommentSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const comment = value as Record<string, unknown>;

  return (
    typeof comment.id === "string" &&
    typeof comment.postId === "string" &&
    typeof comment.userId === "string" &&
    typeof comment.authorName === "string" &&
    isUserRole(comment.authorRole) &&
    typeof comment.content === "string" &&
    (typeof comment.mediaType === "undefined" || comment.mediaType === "IMAGE") &&
    (typeof comment.mediaUrl === "undefined" || typeof comment.mediaUrl === "string") &&
    typeof comment.createdAt === "string"
  );
}

export async function getStoredComments(): Promise<CommentSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(POST_COMMENTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCommentSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredComments(comments: CommentSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(POST_COMMENTS_COOKIE, JSON.stringify(comments.slice(0, 300)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getAllComments(): Promise<CommentSummary[]> {
  const stored = await getStoredComments();
  const merged = new Map<string, CommentSummary>();

  for (const comment of seededComments) {
    merged.set(comment.id, comment);
  }

  for (const comment of stored) {
    merged.set(comment.id, comment);
  }

  return [...merged.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function getCommentsForPost(postId: string) {
  const comments = await getAllComments();
  return comments.filter((comment) => comment.postId === postId);
}

export function getCommentAuthor(userId: string) {
  const user = seedUsers.find((entry) => entry.id === userId);

  if (!user) {
    return null;
  }

  return {
    authorName: user.name,
    authorRole: user.role,
  };
}

export async function getCommentCountForUserOnPost(userId: string, postId: string) {
  const comments = await getAllComments();
  return comments.filter((comment) => comment.userId === userId && comment.postId === postId).length;
}

export { MAX_COMMENTS_PER_USER_PER_POST };
