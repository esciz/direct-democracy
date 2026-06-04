"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { syncCivicSource } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export async function manualSyncSourceAction(formData: FormData) {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const sourceSlug = String(formData.get("sourceSlug") ?? "");

  if (!sourceSlug) {
    redirect("/admin/sources?error=missing-source");
  }

  try {
    await syncCivicSource(sourceSlug, "manual");
  } catch {
    redirect(`/admin/sources?error=sync-failed&source=${encodeURIComponent(sourceSlug)}`);
  }

  revalidatePath("/admin/data");
  revalidatePath("/admin/sources");
  revalidatePath("/admin/imports");
  redirect(`/admin/sources?synced=${encodeURIComponent(sourceSlug)}`);
}

