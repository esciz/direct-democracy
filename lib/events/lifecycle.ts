import type { CivicEvent, CivicEventStatus } from "./types";

// Imported Nevada meeting schedules must behave the same on UTC servers and local devices.
export const CIVIC_EVENT_TIME_ZONE = "America/Los_Angeles";
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CIVIC_EVENT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function civicEventDay(value: string | Date): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return dayFormatter.format(date);
}

export function getEventLifecycleStatus(
  event: { startsAt: string | null; endsAt?: string | null; title?: string; sourceStatus?: "scheduled" | "cancelled" | "rescheduled" },
  now = new Date(),
): CivicEventStatus {
  const title = (event.title ?? "").replace(/_/g, " ");
  if (event.sourceStatus === "cancelled" || (event.sourceStatus !== "rescheduled" && /\bcancell?ed\b/i.test(title))) return "cancelled";
  if (event.sourceStatus !== "rescheduled" && /\bpostponed\b/i.test(title)) return "postponed";
  if (event.sourceStatus === "rescheduled" && !event.startsAt) return "postponed";
  if (!event.startsAt) return "undated";
  const day = civicEventDay(event.startsAt);
  const today = civicEventDay(now);
  if (!day || !today) return "undated";
  const end = event.endsAt ? Date.parse(event.endsAt) : Number.NaN;
  // A missing end time does not mean a meeting finishes the moment it starts.
  // Keep it on today's calendar until the local day ends, then archive on read.
  if (Number.isFinite(end) && end >= Date.parse(event.startsAt) && !/^\d{4}-\d{2}-\d{2}$/.test(event.endsAt ?? "")) {
    return end <= now.getTime() ? "completed" : "upcoming";
  }
  return day < today ? "completed" : "upcoming";
}

export function formatCivicEventDate(value: string | null, dateOnly = false): string {
  if (!value) return "Date not published here";
  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const day = civicEventDay(value);
  if (!day) return "Date pending confirmation";
  const date = new Date(onlyDate ? `${value}T12:00:00Z` : value);
  const label = date.toLocaleString("en-US", {
    timeZone: CIVIC_EVENT_TIME_ZONE,
    weekday: "short", month: "short", day: "numeric", year: "numeric",
    ...(!onlyDate && !dateOnly ? { hour: "numeric" as const, minute: "2-digit" as const, timeZoneName: "short" as const } : {}),
  });
  return onlyDate && !dateOnly ? `${label} · Time not published here` : label;
}

export function getEventMinutesStatus(event: Pick<CivicEvent, "sourceProvider" | "status" | "minutesUrl" | "isOfficialMeeting" | "parentOrganizationEvent">) {
  if (event.parentOrganizationEvent) return { label: "Parent organization updates", description: "This PTA or PTO event is listed on a school calendar. Check with the parent organization for membership, attendance details, and any notes it shares." };
  if (!event.isOfficialMeeting) return { label: "Not applicable", description: "This is a community event." };
  if (event.sourceProvider === "public_meeting_source_registry") {
    return { label: "Minutes archive", description: "This is a calendar and archive source. Open a dated meeting to review its records." };
  }
  if (event.status === "cancelled" || event.status === "postponed") {
    return { label: "Schedule changed", description: "The source title marks this meeting as cancelled or postponed. Check the official notice for a replacement date." };
  }
  if (event.minutesUrl) {
    return { label: "Minutes link available", description: "A minutes source is linked. A link alone does not confirm approval, full extraction, or verified vote attribution." };
  }
  if (event.status === "upcoming") {
    return { label: "Minutes after meeting", description: "Minutes may be published after the meeting and approved at a later meeting." };
  }
  if (event.status === "undated") {
    return { label: "Date needs confirmation", description: "A dated meeting and its minutes have not been confirmed here. Check the official source." };
  }
  return { label: "Minutes not linked yet", description: "No minutes link has been imported for this past meeting. This does not mean the body took no action or has not published minutes." };
}

export function readableMeetingSummary(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text || /^[\[{<]/.test(text) || /["'](?:meetingId|dateTime|documentList|compileOutputType)["']\s*:/.test(text)) return null;
  return text;
}

export function civicEventMatchesSearch(event: CivicEvent, query: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = normalize(query).split(" ").filter(Boolean);
  const text = normalize([
    event.title, event.description, event.hostName, event.hostType, event.jurisdiction, event.searchText ?? "",
    event.meetingSummary ?? "", event.summary ?? "", ...event.keyActions,
    ...event.relatedEntityLabels, ...event.relatedIssueLabels, ...event.relatedOfficialIds,
    ...event.relatedCandidateIds, ...event.relatedOrganizationIds, ...event.relatedIssueIds,
  ].join(" "));
  return tokens.every((token) => text.includes(token));
}
