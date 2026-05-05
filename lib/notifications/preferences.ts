import { cookies } from "next/headers";

import type { NotificationPreferenceSummary } from "@/types/domain";

const NOTIFICATION_PREFERENCES_COOKIE = "dd_notification_preferences";

const defaultPreferences: NotificationPreferenceSummary = {
  posts: true,
  majorActions: true,
};

function isNotificationPreferenceSummary(value: unknown): value is NotificationPreferenceSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const preferences = value as Record<string, unknown>;
  return typeof preferences.posts === "boolean" && typeof preferences.majorActions === "boolean";
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferenceSummary> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(NOTIFICATION_PREFERENCES_COOKIE)?.value;

  if (!raw) {
    return defaultPreferences;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entry = parsed?.[userId];
    return isNotificationPreferenceSummary(entry) ? entry : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}

export async function setNotificationPreferences(userId: string, preferences: NotificationPreferenceSummary) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(NOTIFICATION_PREFERENCES_COOKIE)?.value;
  let parsed: Record<string, NotificationPreferenceSummary> = {};

  if (raw) {
    try {
      const candidate = JSON.parse(raw);
      if (candidate && typeof candidate === "object") {
        parsed = candidate as Record<string, NotificationPreferenceSummary>;
      }
    } catch {}
  }

  parsed[userId] = preferences;

  cookieStore.set(NOTIFICATION_PREFERENCES_COOKIE, JSON.stringify(parsed), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
