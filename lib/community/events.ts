import { cookies } from "next/headers";
import { cache } from "react";

import { getCommunityById } from "@/lib/community/communities";
import { getAllEventAttendance } from "@/lib/community/event-participation";
import type { CommunityEventSummary, CommunityEventType } from "@/types/domain";

const COMMUNITY_EVENTS_COOKIE = "dd_community_events";

function isEventType(value: string): value is CommunityEventType {
  return [
    "civicMeeting",
    "publicHearing",
    "demonstration",
    "rally",
    "communityEvent",
    "culturalSocialEvent",
    "interview",
  ].includes(value);
}

function isCommunityEvent(value: unknown): value is CommunityEventSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.id === "string" &&
    typeof event.title === "string" &&
    typeof event.description === "string" &&
    typeof event.purpose === "string" &&
    typeof event.jurisdictionName === "string" &&
    typeof event.startsAt === "string" &&
    typeof event.eventType === "string" &&
    isEventType(event.eventType) &&
    (event.format === "virtual" || event.format === "inPerson") &&
    typeof event.sponsorName === "string" &&
    (event.sponsorType === "trustedCitizen" ||
      event.sponsorType === "official" ||
      event.sponsorType === "candidate" ||
      event.sponsorType === "community")
  );
}

function matchesCommunity(jurisdictionName: string, communityId: string) {
  const community = getCommunityById(communityId);

  if (!community) {
    return false;
  }

  return community.jurisdictionMatches.includes(jurisdictionName);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
}

export async function getStoredCommunityEvents() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COMMUNITY_EVENTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCommunityEvent) : [];
  } catch {
    return [];
  }
}

export async function setStoredCommunityEvents(events: CommunityEventSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(COMMUNITY_EVENTS_COOKIE, JSON.stringify(events.slice(0, 100)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export const getAllCommunityEvents = cache(async () => {
  const storedEvents = await getStoredCommunityEvents();
  const merged = new Map<string, CommunityEventSummary>();

  for (const event of storedEvents) {
    merged.set(event.id, event);
  }

  return [...merged.values()].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
});

export async function getCommunityEvents(communityId: string, issueLabel?: string) {
  const issueTokens = issueLabel ? new Set(tokenize(issueLabel)) : null;
  const events = await getAllCommunityEvents();

  return events
    .filter((event) => matchesCommunity(event.jurisdictionName, communityId))
    .filter((event) => {
      if (!issueTokens) {
        return true;
      }

      const haystack = `${event.title} ${event.description} ${event.issueLabel ?? ""}`;
      const eventTokens = new Set(tokenize(haystack));
      return [...issueTokens].some((token) => eventTokens.has(token));
    });
}

export async function getIssueRelatedEventCount(communityId: string, issueLabel: string) {
  const events = await getCommunityEvents(communityId, issueLabel);
  return events.length;
}

export function getCommunityEventTypeLabel(eventType: CommunityEventType) {
  switch (eventType) {
    case "civicMeeting":
      return "Civic Meeting";
    case "publicHearing":
      return "Public Hearing";
    case "demonstration":
      return "Demonstration";
    case "rally":
      return "Rally";
    case "communityEvent":
      return "Community Event";
    case "culturalSocialEvent":
      return "Cultural / Social Event";
    case "interview":
      return "Interview";
    default:
      return "Event";
  }
}

export async function getCommunityEventById(eventId: string) {
  const events = await getAllCommunityEvents();
  return events.find((event) => event.id === eventId) ?? null;
}

export type FeedEventPreview = {
  id: string;
  title: string;
  eventType: CommunityEventType;
  jurisdictionName: string;
  startsAt: string;
  locationLabel: string | null;
  attendingCount: number;
};

const getFeedEventPreviewsCached = cache(
  async (jurisdictionKey: string, limit: number): Promise<FeedEventPreview[]> => {
    const jurisdictionNames = jurisdictionKey ? jurisdictionKey.split("|").filter(Boolean) : null;
    const allowedJurisdictions = jurisdictionNames ? new Set(jurisdictionNames) : null;
    const [events, attendance] = await Promise.all([getAllCommunityEvents(), getAllEventAttendance()]);
    const attendingCountByEvent = new Map<string, number>();

    for (const entry of attendance) {
      if (entry.status !== "attending" && entry.status !== "confirmed") {
        continue;
      }

      attendingCountByEvent.set(entry.eventId, (attendingCountByEvent.get(entry.eventId) ?? 0) + 1);
    }

    const previews = events
      .filter((event) => (allowedJurisdictions ? allowedJurisdictions.has(event.jurisdictionName) : true))
      .map((event) => ({
        id: event.id,
        title: event.title,
        eventType: event.eventType,
        jurisdictionName: event.jurisdictionName,
        startsAt: event.startsAt,
        locationLabel: event.locationLabel ?? null,
        attendingCount: attendingCountByEvent.get(event.id) ?? 0,
      }))
      .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));

    return limit > 0 ? previews.slice(0, limit) : previews;
  },
);

export async function getFeedEventPreviews(options?: { jurisdictionNames?: string[]; limit?: number }) {
  const jurisdictionKey = options?.jurisdictionNames?.length ? [...options.jurisdictionNames].sort().join("|") : "";
  return getFeedEventPreviewsCached(jurisdictionKey, options?.limit ?? -1);
}

export function getEventStatementsEnabled(eventType: CommunityEventType) {
  return eventType === "demonstration" || eventType === "rally" || eventType === "publicHearing";
}

export function getEventActiveWindow(event: CommunityEventSummary) {
  const startsAt = Date.parse(event.startsAt);
  const endsAt = event.endsAt ? Date.parse(event.endsAt) : startsAt + 2 * 60 * 60 * 1000;

  return {
    startsAt,
    endsAt,
    postingClosesAt: endsAt + 24 * 60 * 60 * 1000,
  };
}
