"use server";

import { redirect } from "next/navigation";

import { canUserFlagFactualClaim } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getPostById } from "@/lib/feed/posts";
import { FACTUAL_CLAIM_FLAG_THRESHOLD, getPostClaimFlagState, getStoredPostClaimFlags, setStoredPostClaimFlags } from "@/lib/truth/claim-flags";
import { getEffectivePostContentType } from "@/lib/truth/claim-flags";
import type { PostFactualClaimFlagSummary } from "@/types/domain";

function withParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export async function flagPostAsFactualClaim(formData: FormData) {
  const currentUser = await getCurrentUser();
  const postId = formData.get("postId");
  const returnPath = formData.get("returnPath");
  const fallbackPath = typeof returnPath === "string" ? returnPath : "/posts";

  if (!canUserFlagFactualClaim(currentUser)) {
    redirect(withParam(fallbackPath, "claimFlagError", "denied"));
  }

  if (typeof postId !== "string") {
    redirect(withParam(fallbackPath, "claimFlagError", "invalid"));
  }

  const post = await getPostById(postId);
  const effectiveContentType = post ? await getEffectivePostContentType(post) : null;

  if (!post || effectiveContentType === "statementClaim") {
    redirect(withParam(fallbackPath, "claimFlagError", "invalid"));
  }

  const existing = await getStoredPostClaimFlags();
  const alreadyFlagged = existing.some((flag) => flag.postId === postId && flag.userId === currentUser.id);

  if (alreadyFlagged) {
    redirect(withParam(fallbackPath, "claimFlag", "already"));
  }

  const nextFlag: PostFactualClaimFlagSummary = {
    id: `post_claim_flag_${Date.now()}`,
    postId,
    userId: currentUser.id,
    createdAt: new Date().toISOString(),
  };

  await setStoredPostClaimFlags([nextFlag, ...existing]);
  const flagState = await getPostClaimFlagState(postId, currentUser.id);

  redirect(withParam(fallbackPath, "claimFlag", flagState.count >= FACTUAL_CLAIM_FLAG_THRESHOLD ? "reclassified" : "saved"));
}
