"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { syncNevadaElectionsSources, syncNevadaOfficialsSources } from "@/lib/civic-data/import-jobs";
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

export async function syncNevadaOfficialsSourcesAction() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  try {
    await syncNevadaOfficialsSources("manual");
  } catch {
    redirect("/admin/imports?error=sync-all-failed");
  }

  revalidatePath("/admin/data");
  revalidatePath("/admin/sources");
  revalidatePath("/admin/imports");
  revalidatePath("/admin/officials");
  revalidatePath("/imported-officials");
  redirect("/admin/imports?synced=officials");
}

export async function syncNevadaElectionsSourcesAction() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  try {
    await syncNevadaElectionsSources("manual");
  } catch {
    redirect("/admin/imports?error=sync-elections-failed");
  }

  revalidatePath("/admin/data");
  revalidatePath("/admin/sources");
  revalidatePath("/admin/imports");
  revalidatePath("/admin/elections");
  revalidatePath("/admin/candidates");
  revalidatePath("/admin/ballot-measures");
  revalidatePath("/admin/elections/qa");
  revalidatePath("/elections");
  revalidatePath("/candidates");
  revalidatePath("/ballot-measures");
  redirect("/admin/imports?synced=elections");
}
