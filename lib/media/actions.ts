"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { MEDIA_BIAS_VALUES, getStoredMediaBiasRatings, setStoredMediaBiasRatings } from "@/lib/media/store";
import type { MediaBiasRatingSummary, MediaBiasRatingValue } from "@/types/domain";

function withParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export async function submitMediaBiasRating(formData: FormData) {
  const user = await getCurrentUser();
  const mediaUserId = formData.get("mediaUserId");
  const rating = formData.get("rating");
  const returnPath = formData.get("returnPath");
  const fallbackPath = typeof returnPath === "string" ? returnPath : "/feed";

  if (!user.isVerifiedVoter) {
    redirect(withParam(fallbackPath, "mediaBiasError", "denied"));
  }

  if (
    typeof mediaUserId !== "string" ||
    typeof rating !== "string" ||
    !MEDIA_BIAS_VALUES.includes(rating as MediaBiasRatingValue)
  ) {
    redirect(withParam(fallbackPath, "mediaBiasError", "invalid"));
  }

  const nextRating: MediaBiasRatingSummary = {
    id: `media_bias_${Date.now()}`,
    userId: user.id,
    mediaUserId,
    rating: rating as MediaBiasRatingValue,
    createdAt: new Date().toISOString(),
  };

  const existing = await getStoredMediaBiasRatings();
  await setStoredMediaBiasRatings([
    nextRating,
    ...existing.filter((entry) => !(entry.userId === user.id && entry.mediaUserId === mediaUserId)),
  ]);

  redirect(withParam(fallbackPath, "mediaBias", "saved"));
}
