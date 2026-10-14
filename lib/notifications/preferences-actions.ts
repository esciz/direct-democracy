"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { setNotificationPreferences } from "@/lib/notifications/preferences";

export async function updateNotificationPreferencesAction(formData: FormData) {
  const user = await getCurrentUser();

  await setNotificationPreferences(user.id, {
    posts: formData.get("posts") === "on",
    majorActions: formData.get("majorActions") === "on",
  });

  redirect("/notifications?preferences=updated");
}
