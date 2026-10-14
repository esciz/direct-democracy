"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createRootMapSuggestion } from "@/lib/root-map/suggestions";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitRootMapSuggestion(formData: FormData) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/auth?next=%2Froot-striker-lab");

  const result = await createRootMapSuggestion({
    user,
    type: formText(formData, "type"),
    title: formText(formData, "title"),
    explanation: formText(formData, "explanation"),
    fromNodeId: formText(formData, "fromNodeId"),
    toNodeId: formText(formData, "toNodeId"),
    proposedRelationship: formText(formData, "proposedRelationship"),
    sourceUrls: formText(formData, "sourceUrls"),
  });

  if (!result.ok) redirect(`/root-striker-lab?suggestion=error&reason=${result.reason}`);
  revalidatePath("/root-striker-lab");
  revalidatePath("/admin/root-map-suggestions");
  redirect("/root-striker-lab?suggestion=submitted");
}
