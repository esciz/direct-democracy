"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createPerspectiveSuggestion } from "@/lib/perspectives/suggestions";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitPerspectiveSuggestion(formData: FormData) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/auth?next=%2Fchallenge-my-view%23contribute");

  const result = await createPerspectiveSuggestion({
    user,
    category: formText(formData, "category"),
    statement: formText(formData, "statement"),
    context: formText(formData, "context"),
    caseFor: formText(formData, "caseFor"),
    caseAgainst: formText(formData, "caseAgainst"),
    sharedGround: formText(formData, "sharedGround"),
    evidenceToTest: formText(formData, "evidenceToTest"),
    affectedPeople: formText(formData, "affectedPeople"),
    policyPaths: formText(formData, "policyPaths"),
    sourceUrls: formText(formData, "sourceUrls"),
  });

  if (!result.ok) redirect(`/challenge-my-view?contribution=error&reason=${result.reason}#contribute`);
  revalidatePath("/challenge-my-view");
  revalidatePath("/admin/perspective-suggestions");
  redirect("/challenge-my-view?contribution=submitted#contribute");
}
