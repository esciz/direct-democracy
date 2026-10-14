"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createPrivateBetaFeedback } from "@/lib/private-beta/feedback";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitPrivateBetaFeedbackAction(formData: FormData) {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/auth?next=%2Ffeedback");
  }

  const result = createPrivateBetaFeedback({
    user,
    category: formText(formData, "category"),
    severity: formText(formData, "severity"),
    pageUrl: formText(formData, "pageUrl"),
    summary: formText(formData, "summary"),
    details: formText(formData, "details"),
    expectedBehavior: formText(formData, "expectedBehavior"),
    actualBehavior: formText(formData, "actualBehavior"),
    contactOk: formData.get("contactOk") === "on",
    contactEmail: formText(formData, "contactEmail"),
  });

  if (!result.ok) {
    redirect("/feedback?feedback=invalid");
  }

  revalidatePath("/feedback");
  revalidatePath("/admin/private-beta-feedback");
  redirect("/feedback?feedback=submitted");
}
