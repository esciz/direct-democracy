"use server";

import { isGuestUser } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/auth-session";
import { isFavoriteTargetType, isIssueFollowStance } from "@/lib/favorites/types";
import { setIssueFollowStanceForUser, toggleFavoriteForUser } from "@/lib/server/favorites";

export async function toggleFavoriteAction(input: { targetType: string; targetId: string }) {
  const currentUser = await getCurrentUser();

  if (isGuestUser(currentUser)) {
    return {
      ok: false,
      favorited: false,
      message: input.targetType === "issue" ? "Create an account to follow issues." : "Create an account to save civic items.",
    };
  }

  if (!isFavoriteTargetType(input.targetType) || !input.targetId.trim()) {
    return {
      ok: false,
      favorited: false,
      message: input.targetType === "issue" ? "That issue could not be followed right now." : "That item could not be saved right now.",
    };
  }

  const result = await toggleFavoriteForUser(currentUser.id, input.targetType, input.targetId.trim());

  return {
    ok: true,
    favorited: result.favorited,
  };
}

export async function setIssueFollowAction(input: { targetId: string; stance: string | null }) {
  const currentUser = await getCurrentUser();

  if (isGuestUser(currentUser)) {
    return {
      ok: false,
      stance: null,
      message: "Create an account to follow issues.",
    };
  }

  const targetId = input.targetId.trim();
  const stance = input.stance === null ? null : isIssueFollowStance(input.stance) ? input.stance : undefined;

  if (!targetId || stance === undefined) {
    return {
      ok: false,
      stance: null,
      message: "That issue follow setting could not be saved.",
    };
  }

  const result = await setIssueFollowStanceForUser(currentUser.id, targetId, stance);

  return {
    ok: true,
    stance: result.stance,
  };
}
