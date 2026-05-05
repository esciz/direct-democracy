import { cookies } from "next/headers";

import type { PostClaimFlagState, PostContentType, PostFactualClaimFlagSummary, PostSummary } from "@/types/domain";

const FACTUAL_CLAIM_FLAGS_COOKIE = "dd_post_claim_flags";
export const FACTUAL_CLAIM_FLAG_THRESHOLD = 2;

function isPostFactualClaimFlagSummary(value: unknown): value is PostFactualClaimFlagSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const flag = value as Record<string, unknown>;

  return (
    typeof flag.id === "string" &&
    typeof flag.postId === "string" &&
    typeof flag.userId === "string" &&
    typeof flag.createdAt === "string"
  );
}

export async function getStoredPostClaimFlags(): Promise<PostFactualClaimFlagSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FACTUAL_CLAIM_FLAGS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPostFactualClaimFlagSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredPostClaimFlags(flags: PostFactualClaimFlagSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(FACTUAL_CLAIM_FLAGS_COOKIE, JSON.stringify(flags.slice(0, 300)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getPostClaimFlagState(postId: string, viewerUserId?: string): Promise<PostClaimFlagState> {
  const flags = (await getStoredPostClaimFlags()).filter((flag) => flag.postId === postId);

  return {
    postId,
    count: flags.length,
    viewerHasFlagged: viewerUserId ? flags.some((flag) => flag.userId === viewerUserId) : false,
    thresholdReached: flags.length >= FACTUAL_CLAIM_FLAG_THRESHOLD,
  };
}

export async function getEffectivePostContentType(post: PostSummary): Promise<PostContentType> {
  if (post.contentType === "statementClaim") {
    return "statementClaim";
  }

  const flagState = await getPostClaimFlagState(post.id);
  return flagState.thresholdReached ? "statementClaim" : post.contentType;
}
