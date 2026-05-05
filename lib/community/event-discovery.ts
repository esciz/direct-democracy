import { seedUsers } from "@/lib/auth/mock-users";
import { getAllEventAttendance } from "@/lib/community/event-participation";
import { getAllCommunityEvents } from "@/lib/community/events";
import { getCommunityById } from "@/lib/community/communities";
import { getUserProfileContent } from "@/lib/profile/details";
import type { AuthUser, CommunityEventType, EventDiscoverySummary, VoteQuestionScope } from "@/types/domain";

export type EventBrowseDistance = "nearby" | "regional" | "all";
export type EventBrowseDate = "today" | "week" | "later" | "all";
export type EventBrowseType = "all" | "civic" | "rally" | "meeting" | "social" | "cultural";
export type EventBrowseSort = "recommended" | "soonest" | "attending" | "trending";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function eventMatchesScope(scope: VoteQuestionScope | "all", jurisdictionName: string, userJurisdictionName: string) {
  if (scope === "all") return true;
  if (scope === "local") return jurisdictionName === userJurisdictionName;
  if (scope === "state") return jurisdictionName === "Nevada";
  return jurisdictionName === "United States";
}

function getDistanceMiles(userJurisdictionName: string, eventJurisdictionName: string) {
  if (eventJurisdictionName === userJurisdictionName) {
    return 6;
  }

  if (eventJurisdictionName === "Nevada" || userJurisdictionName === "Nevada") {
    return 65;
  }

  if (eventJurisdictionName === "United States") {
    return 450;
  }

  return 120;
}

function getDistanceLabel(distanceMiles: number) {
  if (distanceMiles <= 10) {
    return "Near you";
  }

  if (distanceMiles <= 75) {
    return "Regional";
  }

  if (distanceMiles <= 150) {
    return "Statewide";
  }

  return "National";
}

function getInterestTerms(content: Awaited<ReturnType<typeof getUserProfileContent>>) {
  return new Set(
    [
      ...content.localIssues.map((entry) => entry.value),
      ...content.stateIssues.map((entry) => entry.value),
      ...content.nationalIssues.map((entry) => entry.value),
      ...content.groupTags.map((entry) => entry.value),
    ].flatMap((value) => tokenize(value)),
  );
}

function matchesInterest(interestTerms: Set<string>, event: { title: string; description: string; issueLabel?: string | null }) {
  if (!interestTerms.size) {
    return false;
  }

  const haystack = new Set(tokenize(`${event.title} ${event.description} ${event.issueLabel ?? ""}`));
  return [...interestTerms].some((token) => haystack.has(token));
}

function matchesType(filter: EventBrowseType, eventType: CommunityEventType) {
  if (filter === "all") return true;
  if (filter === "rally") return eventType === "demonstration" || eventType === "rally";
  if (filter === "meeting") return eventType === "civicMeeting" || eventType === "publicHearing" || eventType === "interview";
  if (filter === "social") return eventType === "communityEvent";
  if (filter === "cultural") return eventType === "culturalSocialEvent";
  return ["civicMeeting", "publicHearing", "demonstration", "rally", "interview"].includes(eventType);
}

function matchesDate(filter: EventBrowseDate, startsAt: number) {
  if (filter === "all") return true;

  const now = Date.now();
  const diff = startsAt - now;
  const oneDay = 24 * 60 * 60 * 1000;

  if (filter === "today") {
    return diff <= oneDay && diff >= -oneDay;
  }

  if (filter === "week") {
    return diff > 0 && diff <= 7 * oneDay;
  }

  return diff > 7 * oneDay;
}

function matchesDistance(filter: EventBrowseDistance, distanceMiles: number) {
  if (filter === "all") return true;
  if (filter === "nearby") return distanceMiles <= 15;
  return distanceMiles <= 100;
}

function getMomentumLabel(attendanceCount: number): EventDiscoverySummary["momentumLabel"] {
  if (attendanceCount >= 10) {
    return "High attendance";
  }

  if (attendanceCount >= 4) {
    return "Rising";
  }

  return null;
}

function getRecommendedScore(event: EventDiscoverySummary) {
  const now = Date.now();
  const startsAt = Date.parse(event.startsAt);
  const hoursUntil = Math.max((startsAt - now) / (60 * 60 * 1000), 0);
  const timeScore = hoursUntil <= 24 ? 40 : hoursUntil <= 72 ? 28 : hoursUntil <= 168 ? 18 : 8;
  const distanceScore = event.distanceMiles <= 10 ? 28 : event.distanceMiles <= 75 ? 18 : event.distanceMiles <= 150 ? 10 : 4;
  const attendanceScore = Math.min(event.attendanceCount * 4, 20);
  const confirmedScore = Math.min(event.confirmedCount * 3, 12);
  const interestScore = event.interestMatch ? 14 : 0;
  const momentumScore = event.momentumLabel === "High attendance" ? 8 : event.momentumLabel === "Rising" ? 5 : 0;

  return timeScore + distanceScore + attendanceScore + confirmedScore + interestScore + momentumScore;
}

export async function getDiscoverableEventsForUser(
  user: AuthUser,
  options: {
    communityId?: string;
    scope?: VoteQuestionScope | "all";
    distance?: EventBrowseDistance;
    date?: EventBrowseDate;
    type?: EventBrowseType;
    sort?: EventBrowseSort;
    limit?: number;
  } = {},
) {
  const scope = options.scope ?? "all";
  const distance = options.distance ?? "all";
  const date = options.date ?? "all";
  const type = options.type ?? "all";
  const sort = options.sort ?? "recommended";
  const [events, attendance, profileContent] = await Promise.all([
    getAllCommunityEvents(),
    getAllEventAttendance(),
    getUserProfileContent(user.id),
  ]);
  const community = options.communityId ? getCommunityById(options.communityId) : null;
  const interestTerms = getInterestTerms(profileContent);
  const attendanceByEvent = new Map<string, typeof attendance>();

  for (const entry of attendance) {
    const existing = attendanceByEvent.get(entry.eventId) ?? [];
    existing.push(entry);
    attendanceByEvent.set(entry.eventId, existing);
  }

  const mapped: EventDiscoverySummary[] = events
    .filter((event) => (community ? community.jurisdictionMatches.includes(event.jurisdictionName) : true))
    .filter((event) => eventMatchesScope(scope, event.jurisdictionName, user.jurisdictionName))
    .map((event) => {
      const eventAttendance = attendanceByEvent.get(event.id) ?? [];
      const attendingCount = eventAttendance.filter((entry) => entry.status === "attending" || entry.status === "confirmed").length;
      const confirmedCount = eventAttendance.filter((entry) => entry.status === "confirmed" || entry.confirmedAt).length;
      const distanceMiles = getDistanceMiles(user.jurisdictionName, event.jurisdictionName);
      return {
        ...event,
        attendanceCount: attendingCount,
        maybeCount: eventAttendance.filter((entry) => entry.status === "maybe").length,
        confirmedCount,
        distanceMiles,
        distanceLabel: getDistanceLabel(distanceMiles),
        viewerStatus: eventAttendance.find((entry) => entry.userId === user.id)?.status ?? null,
        interestMatch: matchesInterest(interestTerms, event),
        momentumLabel: getMomentumLabel(attendingCount),
      };
    })
    .filter((event) => matchesDistance(distance, event.distanceMiles))
    .filter((event) => matchesDate(date, Date.parse(event.startsAt)))
    .filter((event) => matchesType(type, event.eventType));

  const sorted = [...mapped].sort((a, b) => {
    if (sort === "soonest") {
      return Date.parse(a.startsAt) - Date.parse(b.startsAt);
    }

    if (sort === "attending") {
      return b.attendanceCount - a.attendanceCount || Date.parse(a.startsAt) - Date.parse(b.startsAt);
    }

    if (sort === "trending") {
      const trendA = (a.attendanceCount * 2 + a.confirmedCount) / Math.max(1, (Date.parse(a.startsAt) - Date.now()) / (24 * 60 * 60 * 1000) + 1);
      const trendB = (b.attendanceCount * 2 + b.confirmedCount) / Math.max(1, (Date.parse(b.startsAt) - Date.now()) / (24 * 60 * 60 * 1000) + 1);
      return trendB - trendA || Date.parse(a.startsAt) - Date.parse(b.startsAt);
    }

    return getRecommendedScore(b) - getRecommendedScore(a) || Date.parse(a.startsAt) - Date.parse(b.startsAt);
  });

  return typeof options.limit === "number" ? sorted.slice(0, options.limit) : sorted;
}

export function getRelevantUserIdsForEventNotifications(jurisdictionName: string) {
  return seedUsers
    .filter((user) => user.isVerifiedVoter && (user.jurisdictionName === jurisdictionName || jurisdictionName === "Nevada" || jurisdictionName === "United States"))
    .map((user) => user.id);
}
