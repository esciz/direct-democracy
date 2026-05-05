"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/server/auth-session";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/store";

export async function markNotificationReadAction(formData: FormData) {
  const user = await getCurrentUser();
  const notificationId = formData.get("notificationId");

  if (typeof notificationId !== "string") {
    return;
  }

  await markNotificationRead(notificationId, user.id);
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const user = await getCurrentUser();

  await markAllNotificationsRead(user.id);
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
}
