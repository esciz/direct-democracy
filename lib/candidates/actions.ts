"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getCandidateProfileById } from "@/lib/server/elections-context";
import { getCandidatePromises, getStoredPublicProfilePromises, setStoredPublicProfilePromises } from "@/lib/officials/promises";
import type { CampaignPromiseSummary } from "@/types/domain";

export async function updateCandidatePromises(formData: FormData) {
  const currentUser = await getCurrentUser();
  const candidateId = formData.get("candidateId");

  if (typeof candidateId !== "string") {
    redirect("/elections");
  }

  const candidate = await getCandidateProfileById(candidateId);

  if (!candidate) {
    redirect("/elections");
  }

  const canEdit = currentUser.role === "admin" || (candidate.claimedByUserId && candidate.claimedByUserId === currentUser.id);

  if (!canEdit) {
    redirect(`/candidates/${candidateId}`);
  }

  const nextPromises: CampaignPromiseSummary[] = [];

  for (let index = 0; index < 4; index += 1) {
    const title = formData.get(`promiseTitle${index}`);
    const description = formData.get(`promiseDescription${index}`);
    const category = formData.get(`promiseCategory${index}`);

    if (typeof title !== "string" || !title.trim()) {
      continue;
    }

    nextPromises.push({
      id: `promise_${candidateId}_${index}`,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      category: typeof category === "string" && category.trim() ? category.trim() : null,
      status: null,
      notes: null,
    });
  }

  const stored = await getStoredPublicProfilePromises();
  stored[candidateId] = nextPromises.length ? nextPromises : await getCandidatePromises(candidateId);
  await setStoredPublicProfilePromises(stored);

  redirect(`/candidates/${candidateId}?promises=updated`);
}
