"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getDraftLegislationDetail, getStoredProposedChanges, getStoredProposedChangeVotes, setStoredProposedChanges, setStoredProposedChangeVotes } from "@/lib/petitions/collaboration";
import type { LegislationChangeVote } from "@/types/domain";

function redirectWithStatus(path: string, key: string, value: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${value}`);
}

export async function submitLegislationSuggestion(formData: FormData) {
  const currentUser = await getCurrentUser();
  const legislationId = formData.get("legislationId");
  const changeText = formData.get("changeText");
  const sectionReference = formData.get("sectionReference");

  if (typeof legislationId !== "string" || typeof changeText !== "string" || changeText.trim().length < 20) {
    redirectWithStatus("/legislation", "collaborationError", "invalid");
  }

  const detail = await getDraftLegislationDetail(legislationId);

  if (!detail || !detail.viewerCanSuggestChanges) {
    redirectWithStatus(`/legislation/${legislationId}`, "collaborationError", "permissions");
  }

  const changes = await getStoredProposedChanges();
  await setStoredProposedChanges([
    {
      id: `proposed_change_${Date.now()}`,
      legislationId,
      userId: currentUser.id,
      userName: currentUser.name,
      changeText: changeText.trim(),
      sectionReference: typeof sectionReference === "string" && sectionReference.trim() ? sectionReference.trim() : null,
      createdAt: new Date().toISOString(),
    },
    ...changes,
  ]);

  redirect(`/legislation/${legislationId}?collaboration=suggestion`);
}

export async function voteOnLegislationSuggestion(formData: FormData) {
  const currentUser = await getCurrentUser();
  const legislationId = formData.get("legislationId");
  const changeId = formData.get("changeId");
  const vote = formData.get("vote");

  if (
    typeof legislationId !== "string" ||
    typeof changeId !== "string" ||
    (vote !== "adopt" && vote !== "reject")
  ) {
    redirectWithStatus("/legislation", "collaborationError", "invalid");
  }

  const detail = await getDraftLegislationDetail(legislationId);

  if (!detail || !detail.viewerHasSignedPetition) {
    redirectWithStatus(`/legislation/${legislationId}`, "collaborationError", "permissions");
  }

  const votes = await getStoredProposedChangeVotes();
  await setStoredProposedChangeVotes([
    {
      id: `change_vote_${Date.now()}`,
      changeId,
      userId: currentUser.id,
      vote: vote as LegislationChangeVote,
      createdAt: new Date().toISOString(),
    },
    ...votes.filter((entry) => !(entry.changeId === changeId && entry.userId === currentUser.id)),
  ]);

  redirect(`/legislation/${legislationId}?collaboration=vote`);
}
