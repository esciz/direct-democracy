"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/permissions";
import { reviewPerspectiveSuggestion } from "@/lib/perspectives/suggestions";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewPerspectiveSuggestionAction(formData: FormData) {
  const reviewer = await requireAdminSession("review.approve");
  const result = await reviewPerspectiveSuggestion({
    suggestionId: formText(formData, "suggestionId"),
    status: formText(formData, "status"),
    reviewer,
    reviewerNotes: formText(formData, "reviewerNotes"),
  });

  if (!result.ok) redirect("/admin/perspective-suggestions?review=error");
  revalidatePath("/challenge-my-view");
  revalidatePath("/admin/perspective-suggestions");
  redirect("/admin/perspective-suggestions?review=updated");
}
