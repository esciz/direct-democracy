"use server";

import { isGuestUser } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/auth-session";
import { isFavoriteTargetType } from "@/lib/favorites/types";
import { toggleFavoriteForUser } from "@/lib/server/favorites";

export async function toggleFavoriteAction(input: { targetType: string; targetId: string }) {
  const currentUser = await getCurrentUser();

  if (isGuestUser(currentUser)) {
    return {
      ok: false,
      favorited: false,
      message: "Create an account to save favorites.",
    };
  }

  if (!isFavoriteTargetType(input.targetType) || !input.targetId.trim()) {
    return {
      ok: false,
      favorited: false,
      message: "That item could not be favorited right now.",
    };
  }

  const result = await toggleFavoriteForUser(currentUser.id, input.targetType, input.targetId.trim());

  return {
    ok: true,
    favorited: result.favorited,
  };
}
