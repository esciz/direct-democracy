import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import type { CommentSummary, UserRole } from "@/types/domain";

const POST_COMMENTS_COOKIE = "dd_post_comments";
const MAX_COMMENTS_PER_USER_PER_POST = 3;

const seededComments: CommentSummary[] = [
  {
    id: "comment_seed_1",
    postId: "post_1",
    userId: "user_trusted_citizen_marco_silva",
    authorName: "Marco Silva",
    authorRole: "trustedCitizen",
    content: "A plain-language budget summary before the session would make this much easier for parents and school staff to follow.",
    createdAt: "2026-03-29T17:05:00.000Z",
  },
  {
    id: "comment_seed_2",
    postId: "post_4",
    userId: "user_official_elena_ramirez",
    authorName: "Mayor Elena Ramirez",
    authorRole: "official",
    content: "Publishing classroom supply and staffing gaps side by side would help families understand where the real bottlenecks are.",
    createdAt: "2026-03-28T20:00:00.000Z",
  },
  {
    id: "comment_seed_3",
    postId: "post_8",
    userId: "user_trusted_citizen_hannah_cho",
    authorName: "Hannah Cho",
    authorRole: "trustedCitizen",
    content: "The key for trust is making the disclosure view readable without requiring people to click through multiple systems.",
    createdAt: "2026-03-27T19:00:00.000Z",
  },
  {
    id: "comment_seed_4",
    postId: "post_15",
    userId: "user_candidate_owen_castillo",
    authorName: "Owen Castillo",
    authorRole: "candidate",
    content: "Water planning is one of those issues where short recaps and public visuals really do help people stay engaged.",
    createdAt: "2026-03-26T16:00:00.000Z",
  },
  {
    id: "comment_seed_5",
    postId: "post_16",
    userId: "user_trusted_citizen_nora_patel",
    authorName: "Nora Patel",
    authorRole: "trustedCitizen",
    content: "This is the right issue mix for national discussion, but voters will still want more detail on what lowers monthly costs first.",
    createdAt: "2026-03-30T15:00:00.000Z",
  },
  {
    id: "comment_seed_6",
    postId: "post_17",
    userId: "user_candidate_sofia_bennett",
    authorName: "Sofia Bennett",
    authorRole: "candidate",
    content: "Healthcare affordability shows up in nearly every Nevada listening session now, regardless of party or region.",
    createdAt: "2026-03-30T13:40:00.000Z",
  },
  {
    id: "comment_seed_7",
    postId: "post_18",
    userId: "user_official_david_park",
    authorName: "David Park",
    authorRole: "official",
    content: "Energy reliability matters, but people also need to see the tradeoffs around siting, water use, and transmission timing.",
    createdAt: "2026-03-30T12:40:00.000Z",
  },
  {
    id: "comment_seed_8",
    postId: "post_1",
    userId: "user_trusted_citizen_hannah_cho",
    authorName: "Hannah Cho",
    authorRole: "trustedCitizen",
    content: "Budget season mood, but the agenda packet still matters more than the meme.",
    mediaType: "IMAGE",
    mediaUrl: "https://placehold.co/960x960/png?text=Budget+meeting+meme",
    createdAt: "2026-03-30T18:20:00.000Z",
  },
];

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
