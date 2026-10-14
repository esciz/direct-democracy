"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getOfficialById } from "@/lib/officials/store";
import { getOfficialPromises, getStoredPublicProfilePromises, setStoredPublicProfilePromises } from "@/lib/officials/promises";
import type { CampaignPromiseSummary, PromiseStatus } from "@/types/domain";

const PROMISE_STATUSES: PromiseStatus[] = ["Achieved", "In Progress", "Reversed"];

export async function updateOfficialPromises(formData: FormData) {
  const currentUser = await getCurrentUser();
  const officialId = formData.get("officialId");

  if (typeof officialId !== "string") {
    redirect("/officials");
  }

  const official = await getOfficialById(officialId);

  if (!official) {
    redirect("/officials");
  }

  const canEdit = currentUser.role === "admin" || (official.linkedUserId && official.linkedUserId === currentUser.id);

  if (!canEdit) {
    redirect(`/officials/${officialId}`);
  }

  const nextPromises: CampaignPromiseSummary[] = [];

  for (let index = 0; index < 4; index += 1) {
    const title = formData.get(`promiseTitle${index}`);
    const description = formData.get(`promiseDescription${index}`);
    const status = formData.get(`promiseStatus${index}`);
    const notes = formData.get(`promiseNotes${index}`);

    if (typeof title !== "string" || !title.trim()) {
      continue;
    }

    nextPromises.push({
      id: `promise_${officialId}_${index}`,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      category: null,
      status: typeof status === "string" && PROMISE_STATUSES.includes(status as PromiseStatus) ? (status as PromiseStatus) : "In Progress",
      notes: typeof notes === "string" ? notes.trim() : "",
    });
  }

  const stored = await getStoredPublicProfilePromises();
  stored[officialId] = nextPromises.length ? nextPromises : await getOfficialPromises(officialId);
  await setStoredPublicProfilePromises(stored);

  redirect(`/officials/${officialId}?promises=updated`);
}
