"use server";

import { redirect } from "next/navigation";

import { canUserRateTruth } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getPostById } from "@/lib/feed/posts";
import { getEffectivePostContentType } from "@/lib/truth/claim-flags";
import { getStoredTruthRatings, setStoredTruthRatings, TRUTH_RATING_VALUES } from "@/lib/truth/ratings";
import type { TruthRatingSummary, TruthRatingValue } from "@/types/domain";

function withParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export async function submitTruthRating(formData: FormData) {
  const currentUser = await getCurrentUser();
  const entityId = formData.get("entityId");
  const rating = formData.get("rating");
  const returnPath = formData.get("returnPath");
  const fallbackPath = typeof returnPath === "string" ? returnPath : "/posts";

  if (!canUserRateTruth(currentUser)) {
    redirect(withParam(fallbackPath, "truthError", "denied"));
  }

  if (typeof entityId !== "string" || typeof rating !== "string" || !TRUTH_RATING_VALUES.includes(rating as TruthRatingValue)) {
    redirect(withParam(fallbackPath, "truthError", "invalid"));
  }

  if (entityId.startsWith("post_") || entityId.startsWith("post_created_") || entityId.startsWith("post_sponsorship_")) {
    const post = await getPostById(entityId);
    const effectiveContentType = post ? await getEffectivePostContentType(post) : null;

    if (!post || (effectiveContentType !== "statementClaim" && effectiveContentType !== "newsStory")) {
      redirect(withParam(fallbackPath, "truthError", "invalid"));
    }

    if (effectiveContentType === "newsStory" && currentUser.role !== "trustedCitizen") {
      redirect(withParam(fallbackPath, "truthError", "denied"));
    }
  }

  const existing = await getStoredTruthRatings();
  const nextRating: TruthRatingSummary = {
    id: `truth_rating_${Date.now()}`,
    userId: currentUser.id,
    entityId,
    rating: rating as TruthRatingValue,
    createdAt: new Date().toISOString(),
  };

  await setStoredTruthRatings([
    nextRating,
    ...existing.filter((entry) => !(entry.userId === currentUser.id && entry.entityId === entityId)),
  ]);

  redirect(withParam(fallbackPath, "truth", "saved"));
}
