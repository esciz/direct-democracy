"use server";

import { redirect } from "next/navigation";

import { isGuestUser } from "@/lib/auth/session";
import { getCommunityEventById } from "@/lib/community/events";
import { getCurrentUser } from "@/lib/server/auth-session";
import {
  canUserConfirmAttendance,
  canUserCreateEventPost,
  canUserSubmitEventSentiment,
  canUserSubmitEventStatement,
  createEventPostRecord,
  getAllEventAttendance,
  getAllEventStatements,
  saveEventSentiment,
  setStoredEventAttendance,
  setStoredEventStatements,
} from "@/lib/community/event-participation";
import {
  createNotifications,
  createEventPostActivityNotifications,
  createFolloweeEventNotifications,
  createTrendingEventNotifications,
} from "@/lib/notifications/store";
import { getFollowerUserIds } from "@/lib/social/follows";
import type { EventAttendanceSummary, EventStatementPosition, EventStatementSummary } from "@/types/domain";

function withParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function sanitizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeOptionalUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function updateEventRsvp(formData: FormData) {
  const user = await getCurrentUser();
  const eventId = sanitizeText(formData.get("eventId"));
  const status = formData.get("status");
  const returnPath = sanitizeText(formData.get("returnPath")) || `/events/${eventId}`;

  if (isGuestUser(user)) {
    redirect(withParam(returnPath, "eventError", "invalid"));
  }

  if (!eventId || (status !== "attending" && status !== "maybe")) {
    redirect(withParam(returnPath, "eventError", "invalid"));
  }

  const all = await getAllEventAttendance();
  const nextEntry: EventAttendanceSummary = {
    id: `event_rsvp_${Date.now()}`,
    userId: user.id,
    eventId,
    status,
    confirmedAt: null,
    createdAt: new Date().toISOString(),
  };

  const nextAttendance = [
    nextEntry,
    ...all.filter((entry) => !(entry.eventId === eventId && entry.userId === user.id)),
  ];

  await setStoredEventAttendance(nextAttendance);

  const event = await getCommunityEventById(eventId);

  if (event && status === "attending") {
    const followerIds = await getFollowerUserIds(user.id);
    await createFolloweeEventNotifications({
      userIds: followerIds,
      eventId,
      eventTitle: event.title,
      userName: user.name,
    });

    const attendingCount = nextAttendance.filter(
      (entry) => entry.eventId === eventId && (entry.status === "attending" || entry.status === "confirmed"),
    ).length;

    if (attendingCount === 3 || attendingCount === 6 || attendingCount === 10) {
      await createTrendingEventNotifications({
        userIds: nextAttendance
          .filter((entry) => entry.eventId === eventId)
          .map((entry) => entry.userId)
          .filter((id) => id !== user.id),
        eventId,
        eventTitle: event.title,
        attendingCount,
      });
    }

    const hoursUntilStart = (Date.parse(event.startsAt) - Date.now()) / (60 * 60 * 1000);

    if (hoursUntilStart <= 24 && hoursUntilStart > 2) {
      await createNotifications([
        {
          userId: user.id,
          type: "eventReminder",
          title: `Event reminder: ${event.title}`,
          body: "This event starts within the next 24 hours.",
          entityId: event.id,
          contextEntityId: "24h",
        },
      ]);
    }

    if (hoursUntilStart <= 2 && hoursUntilStart > 0) {
      await createNotifications([
        {
          userId: user.id,
          type: "eventReminder",
          title: `Starting soon: ${event.title}`,
          body: "This event starts within the next 2 hours.",
          entityId: event.id,
          contextEntityId: "2h",
        },
      ]);
    }
  }

  redirect(withParam(returnPath, "event", "rsvp-saved"));
}

export async function confirmEventAttendance(formData: FormData) {
  const user = await getCurrentUser();
  const eventId = sanitizeText(formData.get("eventId"));
  const returnPath = sanitizeText(formData.get("returnPath")) || `/events/${eventId}`;

  if (!(await canUserConfirmAttendance(eventId, user.id))) {
    redirect(withParam(returnPath, "eventError", "attendance"));
  }

  const all = await getAllEventAttendance();
  await setStoredEventAttendance(
    all.map((entry) =>
      entry.eventId === eventId && entry.userId === user.id
        ? {
            ...entry,
            status: "confirmed",
            confirmedAt: new Date().toISOString(),
          }
        : entry,
    ),
  );

  const event = await getCommunityEventById(eventId);

  if (event) {
    await createNotifications([
      {
        userId: user.id,
        type: "eventLive",
        title: `Event live now: ${event.title}`,
        body: "Your attendance was confirmed while this event is active.",
        entityId: event.id,
        contextEntityId: "live",
      },
    ]);
  }

  redirect(withParam(returnPath, "event", "attendance-confirmed"));
}

export async function createEventPost(formData: FormData) {
  const user = await getCurrentUser();
  const eventId = sanitizeText(formData.get("eventId"));
  const returnPath = sanitizeText(formData.get("returnPath")) || `/events/${eventId}`;
  const content = sanitizeText(formData.get("content"));
  const mediaUrl = sanitizeOptionalUrl(formData.get("mediaUrl"));

  if (!(await canUserCreateEventPost(eventId, user.id))) {
    redirect(withParam(returnPath, "eventError", "posting"));
  }

  if (content.length < 8) {
    redirect(withParam(returnPath, "eventError", "content"));
  }

  await createEventPostRecord(eventId, content, mediaUrl);
  const [event, attendance] = await Promise.all([getCommunityEventById(eventId), getAllEventAttendance()]);

  if (event) {
    await createEventPostActivityNotifications({
      userIds: attendance.filter((entry) => entry.eventId === eventId).map((entry) => entry.userId).filter((id) => id !== user.id),
      eventId,
      eventTitle: event.title,
    });
  }

  redirect(withParam(returnPath, "event", "post-created"));
}

export async function submitEventStatement(formData: FormData) {
  const user = await getCurrentUser();
  const eventId = sanitizeText(formData.get("eventId"));
  const returnPath = sanitizeText(formData.get("returnPath")) || `/events/${eventId}`;
  const position = formData.get("position");

  if (
    !(await canUserSubmitEventStatement(eventId, user.id)) ||
    (position !== "support" && position !== "dissent" && position !== "neutral")
  ) {
    redirect(withParam(returnPath, "eventError", "statement"));
  }

  const all = await getAllEventStatements();
  const nextEntry: EventStatementSummary = {
    id: `event_statement_${Date.now()}`,
    userId: user.id,
    eventId,
    position: position as EventStatementPosition,
    createdAt: new Date().toISOString(),
  };

  await setStoredEventStatements([
    nextEntry,
    ...all.filter((entry) => !(entry.eventId === eventId && entry.userId === user.id)),
  ]);

  redirect(withParam(returnPath, "event", "statement-saved"));
}

export async function submitEventSentiment(formData: FormData) {
  const user = await getCurrentUser();
  const eventId = sanitizeText(formData.get("eventId"));
  const returnPath = sanitizeText(formData.get("returnPath")) || `/events/${eventId}`;
  const value = formData.get("value");

  if (
    !(await canUserSubmitEventSentiment(eventId, user.id)) ||
    (value !== "support" && value !== "dissent" && value !== "neutral")
  ) {
    redirect(withParam(returnPath, "eventError", "sentiment"));
  }

  await saveEventSentiment(eventId, user.id, value);
  redirect(withParam(returnPath, "event", "sentiment-saved"));
}
