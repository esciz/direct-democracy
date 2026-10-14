"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getStoredOfficialActionReactions, setStoredOfficialActionReactions } from "@/lib/officials/action-store";
import type { OfficialActionReactionSummary, OfficialActionReactionType } from "@/types/domain";

function redirectWithStatus(path: string, status: string, error = false) {
  const key = error ? "officialActionError" : "officialActionReaction";
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${status}`);
}

export async function reactToOfficialAction(formData: FormData) {
  const user = await getCurrentUser();
  const actionIdValue = formData.get("actionId");
  const reactionValue = formData.get("reaction");
  const returnPathValue = formData.get("returnPath");
  const safeReturnPath = typeof returnPathValue === "string" ? returnPathValue : "/officials";

  if (typeof actionIdValue !== "string" || (reactionValue !== "support" && reactionValue !== "oppose")) {
    redirectWithStatus(safeReturnPath, "invalid", true);
  }

  if (!user.isVerifiedVoter) {
    redirectWithStatus(safeReturnPath, "denied", true);
  }

  const actionId = actionIdValue as string;
  const reaction = reactionValue as OfficialActionReactionType;

  const existing = await getStoredOfficialActionReactions();
  const nextReaction: OfficialActionReactionSummary = {
    id: `official_action_reaction_${Date.now()}`,
    actionId,
    userId: user.id,
    reaction,
    createdAt: new Date().toISOString(),
  };
  const filtered = existing.filter((entry) => !(entry.actionId === actionId && entry.userId === user.id));

  await setStoredOfficialActionReactions([nextReaction, ...filtered]);
  redirectWithStatus(safeReturnPath, reaction);
}
