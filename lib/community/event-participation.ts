import { cookies } from "next/headers";
import { cache } from "react";

import { getCommunityEventById, getEventStatementsEnabled } from "@/lib/community/events";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCreatedPosts, setCreatedPosts } from "@/lib/feed/posts";
import type { EventAttendanceSummary, EventSentimentSummary, EventSentimentValue, EventStatementPosition, EventStatementSummary, PostSummary } from "@/types/domain";

const EVENT_ATTENDANCE_COOKIE = "dd_event_attendance";
const EVENT_STATEMENTS_COOKIE = "dd_event_statements";

function isAttendance(value: unknown): value is EventAttendanceSummary {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.userId === "string" &&
    typeof entry.eventId === "string" &&
    (entry.status === "attending" || entry.status === "maybe" || entry.status === "confirmed") &&
    typeof entry.createdAt === "string"
  );
}

function isStatement(value: unknown): value is EventStatementSummary {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.userId === "string" &&
    typeof entry.eventId === "string" &&
    (entry.position === "support" || entry.position === "dissent" || entry.position === "neutral") &&
    typeof entry.createdAt === "string"
  );
}

async function readCookieArray<T>(key: string, guard: (value: unknown) => value is T): Promise<T[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(key)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

async function writeCookieArray<T>(key: string, values: T[]) {
  const cookieStore = await cookies();
  cookieStore.set(key, JSON.stringify(values), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

const seededAttendance: EventAttendanceSummary[] = [
  {
    id: "event_attend_interview_nora",
    userId: "user_trusted_citizen_nora_patel",
    eventId: "event_interview_nora_sofia_water",
    status: "confirmed",
    confirmedAt: "2026-04-08T19:58:00.000Z",
    createdAt: "2026-04-03T18:30:00.000Z",
  },
  {
    id: "event_attend_interview_sofia",
    userId: "user_candidate_sofia_bennett",
    eventId: "event_interview_nora_sofia_water",
    status: "confirmed",
    confirmedAt: "2026-04-08T19:59:00.000Z",
    createdAt: "2026-04-03T18:32:00.000Z",
  },
  {
    id: "event_attend_interview_alicia",
    userId: "user_citizen_alicia_hart",
    eventId: "event_interview_nora_sofia_water",
    status: "attending",
    confirmedAt: null,
    createdAt: "2026-04-07T15:20:00.000Z",
  },
  {
    id: "event_attend_interview_hannah",
    userId: "user_trusted_citizen_hannah_cho",
    eventId: "event_interview_hannah_david_growth",
    status: "attending",
    confirmedAt: null,
    createdAt: "2026-04-06T18:10:00.000Z",
  },
  {
    id: "event_attend_interview_david",
    userId: "user_official_david_park",
    eventId: "event_interview_hannah_david_growth",
    status: "attending",
    confirmedAt: null,
    createdAt: "2026-04-06T18:11:00.000Z",
  },
  {
    id: "event_attend_interview_miles",
    userId: "user_citizen_miles_reed",
    eventId: "event_interview_hannah_david_growth",
    status: "maybe",
    confirmedAt: null,
    createdAt: "2026-04-09T16:00:00.000Z",
  },
  {
    id: "event_attend_1",
    userId: "user_citizen_alicia_hart",
    eventId: "event_carson_teacher_rally",
    status: "confirmed",
    confirmedAt: "2026-04-07T16:20:00.000Z",
    createdAt: "2026-04-07T14:00:00.000Z",
  },
  {
    id: "event_attend_2",
    userId: "user_trusted_citizen_marco_silva",
    eventId: "event_carson_teacher_rally",
    status: "confirmed",
    confirmedAt: "2026-04-07T16:15:00.000Z",
    createdAt: "2026-04-07T14:10:00.000Z",
  },
  {
    id: "event_attend_3",
    userId: "user_citizen_miles_reed",
    eventId: "event_washoe_growth_meeting",
    status: "maybe",
    confirmedAt: null,
    createdAt: "2026-04-02T13:00:00.000Z",
  },
];

const seededStatements: EventStatementSummary[] = [
  {
    id: "event_statement_1",
    userId: "user_citizen_alicia_hart",
    eventId: "event_carson_teacher_rally",
    position: "support",
    createdAt: "2026-04-07T17:10:00.000Z",
  },
  {
    id: "event_statement_2",
    userId: "user_trusted_citizen_marco_silva",
    eventId: "event_carson_teacher_rally",
    position: "support",
    createdAt: "2026-04-07T17:20:00.000Z",
  },
];

export async function getStoredEventAttendance() {
  return readCookieArray(EVENT_ATTENDANCE_COOKIE, isAttendance);
}

export async function setStoredEventAttendance(entries: EventAttendanceSummary[]) {
  await writeCookieArray(EVENT_ATTENDANCE_COOKIE, entries.slice(0, 500));
}

export async function getStoredEventStatements() {
  return readCookieArray(EVENT_STATEMENTS_COOKIE, isStatement);
}

export async function setStoredEventStatements(entries: EventStatementSummary[]) {
  await writeCookieArray(EVENT_STATEMENTS_COOKIE, entries.slice(0, 500));
}

export const getAllEventAttendance = cache(async () => {
  const merged = new Map<string, EventAttendanceSummary>();
  for (const entry of seededAttendance) merged.set(`${entry.eventId}:${entry.userId}`, entry);
  for (const entry of await getStoredEventAttendance()) merged.set(`${entry.eventId}:${entry.userId}`, entry);
  return [...merged.values()];
});

export const getAllEventStatements = cache(async () => {
  const merged = new Map<string, EventStatementSummary>();
  for (const entry of seededStatements) merged.set(`${entry.eventId}:${entry.userId}`, entry);
  for (const entry of await getStoredEventStatements()) merged.set(`${entry.eventId}:${entry.userId}`, entry);
  return [...merged.values()];
});

export async function getStoredEventSentiments() {
  return getStoredEventStatements();
}

export const getAllEventSentiments = cache(async () => getAllEventStatements());

export async function getEventAttendanceState(eventId: string, userId: string) {
  const entries = await getAllEventAttendance();
  const viewer = entries.find((entry) => entry.eventId === eventId && entry.userId === userId) ?? null;
  const eventEntries = entries.filter((entry) => entry.eventId === eventId);

  return {
    viewerStatus: viewer?.status ?? null,
    viewerConfirmedAt: viewer?.confirmedAt ?? null,
    attendingCount: eventEntries.filter((entry) => entry.status === "attending" || entry.status === "confirmed").length,
    maybeCount: eventEntries.filter((entry) => entry.status === "maybe").length,
    confirmedCount: eventEntries.filter((entry) => entry.status === "confirmed" || entry.confirmedAt).length,
  };
}

export async function canUserConfirmAttendance(eventId: string, userId: string) {
  const event = await getCommunityEventById(eventId);
  const attendance = await getAllEventAttendance();
  const entry = attendance.find((item) => item.eventId === eventId && item.userId === userId);

  return Boolean(event && entry && entry.status === "attending");
}

export async function canUserCreateEventPost(eventId: string, userId: string) {
  const attendance = await getAllEventAttendance();
  const entry = attendance.find((item) => item.eventId === eventId && item.userId === userId);

  return Boolean(entry && (entry.status === "confirmed" || entry.confirmedAt));
}

export async function canUserSubmitEventStatement(eventId: string, userId: string) {
  const event = await getCommunityEventById(eventId);
  const attendance = await getAllEventAttendance();
  const entry = attendance.find((item) => item.eventId === eventId && item.userId === userId);

  return Boolean(event && getEventStatementsEnabled(event.eventType) && entry?.confirmedAt);
}

export async function canUserSubmitEventSentiment(eventId: string, userId: string) {
  return canUserSubmitEventStatement(eventId, userId);
}

export async function getEventPosts(eventId: string) {
  const posts = await getCreatedPosts();
  return posts
    .filter((post) => post.eventId === eventId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getEventPhotobook(eventId: string) {
  const posts = await getEventPosts(eventId);
  return posts.filter((post) => post.mediaUrl);
}

export async function getEventStatementSummary(eventId: string, viewerUserId: string) {
  const event = await getCommunityEventById(eventId);
  const statements = (await getAllEventStatements()).filter((entry) => entry.eventId === eventId);
  const viewer = statements.find((entry) => entry.userId === viewerUserId) ?? null;
  const countFor = (position: EventStatementPosition) => statements.filter((entry) => entry.position === position).length;

  return {
    enabled: Boolean(event && getEventStatementsEnabled(event.eventType)),
    viewerPosition: viewer?.position ?? null,
    supportCount: countFor("support"),
    dissentCount: countFor("dissent"),
    neutralCount: countFor("neutral"),
    totalCount: statements.length,
  };
}

export async function getEventSentimentSummary(eventId: string, viewerUserId: string) {
  const summary = await getEventStatementSummary(eventId, viewerUserId);

  return {
    enabled: summary.enabled,
    viewerValue: summary.viewerPosition,
    supportCount: summary.supportCount,
    dissentCount: summary.dissentCount,
    neutralCount: summary.neutralCount,
    totalCount: summary.totalCount,
  };
}

export async function setStoredEventSentiments(entries: EventSentimentSummary[]) {
  await setStoredEventStatements(entries);
}

export async function createEventPostRecord(eventId: string, content: string, mediaUrl: string | null) {
  const user = await getCurrentUser();
  const event = await getCommunityEventById(eventId);

  if (!event) {
    return null;
  }

  const derivedCommunityId =
    user.primaryCommunityId ?? event.jurisdictionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const existing = await getCreatedPosts();
  const nextPost: PostSummary = {
    id: `event_post_${Date.now()}`,
    title: event.title,
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    jurisdictionName: event.jurisdictionName,
    content,
    perspectiveType: "perspective",
    attachments: [
      {
        type: "event",
        id: event.id,
        label: event.title,
        jurisdictionId: derivedCommunityId,
      },
      {
        type: "community",
        id: derivedCommunityId,
        label: event.jurisdictionName,
        jurisdictionId: derivedCommunityId,
      },
    ],
    visibilityScope: "community",
    jurisdictionScope: [derivedCommunityId],
    stance: "explain",
    moderationStatus: "published",
    postType: mediaUrl ? "IMAGE" : "TEXT",
    contentType: "event",
    mediaUrl: mediaUrl ?? undefined,
    createdAt: new Date().toISOString(),
    reactionTotals: { up: 0, down: 0 },
    truthScore: { media: null, moderators: null, citizens: null },
    eventId,
    eventTitle: event.title,
    isEventPost: true,
  };

  await setCreatedPosts([nextPost, ...existing]);
  return nextPost;
}

export async function saveEventSentiment(eventId: string, userId: string, value: EventSentimentValue) {
  const all = await getAllEventSentiments();
  const nextEntry: EventSentimentSummary = {
    id: `event_sentiment_${Date.now()}`,
    userId,
    eventId,
    position: value,
    createdAt: new Date().toISOString(),
  };

  await setStoredEventSentiments([
    nextEntry,
    ...all.filter((entry) => !(entry.eventId === eventId && entry.userId === userId)),
  ]);
}
