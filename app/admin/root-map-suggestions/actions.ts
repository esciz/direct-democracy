"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/permissions";
import { reviewRootMapSuggestion } from "@/lib/root-map/suggestions";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewRootMapSuggestionAction(formData: FormData) {
  const reviewer = await requireAdminSession("review.approve");
  const result = await reviewRootMapSuggestion({
    suggestionId: formText(formData, "suggestionId"),
    status: formText(formData, "status"),
    reviewer,
    reviewerNotes: formText(formData, "reviewerNotes"),
  });

  if (!result.ok) redirect("/admin/root-map-suggestions?review=error");
  revalidatePath("/root-striker-lab");
  revalidatePath("/admin/root-map-suggestions");
  redirect("/admin/root-map-suggestions?review=updated");
}
