"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/permissions";
import { updatePrivateBetaFeedbackReview } from "@/lib/private-beta/feedback";

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function updatePrivateBetaFeedbackAction(formData: FormData) {
  const reviewer = await requireAdminSession("review.approve");
  const result = updatePrivateBetaFeedbackReview({
    feedbackId: formText(formData, "feedbackId"),
    status: formText(formData, "status"),
    reviewer,
    reviewerNotes: formText(formData, "reviewerNotes"),
    publicReleaseNote: formText(formData, "publicReleaseNote"),
  });

  if (!result.ok) {
    redirect("/admin/private-beta-feedback?feedback=invalid");
  }

  revalidatePath("/admin/private-beta-feedback");
  redirect("/admin/private-beta-feedback?feedback=updated");
}
