"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/permissions";
import { createPrivateBetaInvite, updatePrivateBetaInvite } from "@/lib/private-beta/invites";

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createPrivateBetaInviteAction(formData: FormData) {
  const admin = await requireAdminSession("dataops.view");
  const result = createPrivateBetaInvite({
    admin,
    testerName: formText(formData, "testerName"),
    testerEmail: formText(formData, "testerEmail"),
    relationship: formText(formData, "relationship"),
    priority: formText(formData, "priority"),
    notes: formText(formData, "notes"),
  });

  if (!result.ok) {
    redirect(`/admin/private-beta?invite=${result.reason}`);
  }

  revalidatePath("/admin/private-beta");
  redirect("/admin/private-beta?invite=created");
}

export async function updatePrivateBetaInviteAction(formData: FormData) {
  const admin = await requireAdminSession("dataops.view");
  const result = updatePrivateBetaInvite({
    admin,
    inviteId: formText(formData, "inviteId"),
    status: formText(formData, "status"),
    notes: formText(formData, "notes"),
  });

  if (!result.ok) {
    redirect(`/admin/private-beta?invite=${result.reason}`);
  }

  revalidatePath("/admin/private-beta");
  redirect("/admin/private-beta?invite=updated");
}
