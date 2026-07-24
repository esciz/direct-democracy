import "server-only";

import { cache } from "react";

import { getAllEventAttendance } from "@/lib/community/event-participation";
import { getAllCommunityEvents } from "@/lib/community/events";
import { getCommunityById, getCommunityByJurisdictionName, seededCommunities } from "@/lib/community/communities";
import { getPublicMeetingAdminDashboard } from "@/lib/public-meetings/public";
import type { PublicBodyLevel, PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord, PublicMeetingSourceSeed, VoteRecord } from "@/lib/public-meetings/types";
import type { CivicEvent, CivicEventHostType, CivicEventKind, CivicEventStatus, CivicEventType } from "@/lib/events/types";
import type { AuthUser, CommunityEventSummary, CommunitySummary, VoteQuestionScope } from "@/types/domain";

export type CivicEventBrowseStatus = "upcoming" | "completed" | "all";
export type CivicEventBrowseSource = "all" | "official" | "community";
export type CivicEventBrowseType = "all" | CivicEventType;
export type CivicEventBrowseSort = "recommended" | "soonest" | "recent" | "official-first";
export type CivicEventBrowseMode = "all" | "virtual" | "in_person" | "hybrid";

type SeededCivicEventInput = Omit<
  CivicEvent,
  "status" | "communityId" | "attendanceCount" | "confirmedCount" | "distanceLabel" | "momentumLabel" | "viewerStatus" | "actionsTaken"
> & {
  actionsTaken?: CivicEvent["actionsTaken"];
};

const SEEDED_CIVIC_EVENTS: SeededCivicEventInput[] = [
  {
    id: "seed-event-nevada-2026-primary-election-day",
    title: "Nevada 2026 primary election day",
    description: "Seeded, source-linked statewide election date for the 2026 Nevada primary election.",
    eventType: "election_deadline",
    civicEventKind: "election_deadline",
    startsAt: "2026-06-09T07:00:00-07:00",
    endsAt: "2026-06-09T19:00:00-07:00",
    locationName: "Nevada polling places and vote centers",
    address: null,
    virtualUrl: null,
    eventMode: "in_person",
    sourceUrl: "https://www.nvsos.gov/elections/election-information/2026-election-information",
    agendaUrl: null,
    minutesUrl: null,
    videoUrl: null,
    packetUrl: null,
    hostName: "Nevada Secretary of State",
    hostType: "state",
    jurisdiction: "Nevada",
    relatedOfficialIds: [],
    relatedCandidateIds: [],
    relatedOrganizationIds: [],
    relatedIssueIds: [],
    relatedCaseIds: [],
    relatedIssueLabels: ["Elections", "Voting access"],
    relatedEntityLabels: ["Nevada Secretary of State"],
    isOfficialMeeting: true,
    createdFromMeetingRecord: false,
    sourceProvider: "seeded_source_backed",
    sourceProviderLabel: "Seeded source-backed event",
    lastFetchedAt: null,
    meetingRecordId: null,
    communityEventId: null,
    meetingSummary: null,
    keyActions: [],
    voteResults: [],
    sourceDocumentCount: 1,
    summary: "Statewide primary election date included so completed election events are visible in the civic calendar.",
  },
  {
    id: "seed-event-reno-city-council-canvass",
    title: "Reno City Council special meeting: canvass of the vote",
    description: "Seeded Reno public meeting entry linked to the City of Reno public calendar.",
    eventType: "official_meeting",
    civicEventKind: "city_council_meeting",
    startsAt: "2026-06-18T10:00:00-07:00",
    endsAt: "2026-06-18T12:00:00-07:00",
    locationName: "Reno City Hall",
    address: "1 E First St, Reno, NV",
    virtualUrl: "https://www.reno.gov/services/watch-and-learn",
    eventMode: "hybrid",
    sourceUrl: "https://www.reno.gov/community/city-of-reno-calendar",
    agendaUrl: "https://www.reno.gov/government/city-council",
    minutesUrl: null,
    videoUrl: "https://www.reno.gov/services/watch-and-learn",
    packetUrl: null,
    hostName: "Reno City Council",
    hostType: "city",
    jurisdiction: "Reno, Nevada",
    relatedOfficialIds: [],
    relatedCandidateIds: [],
    relatedOrganizationIds: [],
    relatedIssueIds: [],
    relatedCaseIds: [],
    relatedIssueLabels: ["Elections", "Government transparency"],
    relatedEntityLabels: ["Reno City Council"],
    isOfficialMeeting: true,
    createdFromMeetingRecord: false,
    sourceProvider: "seeded_source_backed",
    sourceProviderLabel: "Seeded source-backed meeting",
    lastFetchedAt: null,
    meetingRecordId: null,
    communityEventId: null,
    meetingSummary: null,
    keyActions: [],
    voteResults: [],
    sourceDocumentCount: 3,
    summary: "Public meeting source entry for a vote-canvass meeting.",
  },
  {
    id: "seed-event-carson-board-public-access",
    title: "Carson City Board of Supervisors public meeting access review",
    description: "Demo-safe Carson City meeting card linked to the official agendas, minutes, records, and video source.",
    eventType: "official_meeting",
    civicEventKind: "city_council_meeting",
    startsAt: "2026-07-02T08:30:00-07:00",
    endsAt: "2026-07-02T11:30:00-07:00",
    locationName: "Carson City Community Center",
    address: "851 E William St, Carson City, NV",
    virtualUrl: "https://www.carsoncity.gov/government/city-meetings",
    eventMode: "hybrid",
    sourceUrl: "https://www.carsoncity.gov/government/city-meetings",
    agendaUrl: "https://www.carsoncity.gov/government/city-meetings",
    minutesUrl: "https://www.carsoncity.gov/government/city-meetings",
    videoUrl: "https://www.carsoncity.gov/government/city-meetings",
    packetUrl: "https://www.carsoncity.gov/government/city-meetings",
    hostName: "Carson City Board of Supervisors",
    hostType: "city",
    jurisdiction: "Carson City, Nevada",
    relatedOfficialIds: [],
    relatedCandidateIds: [],
    relatedOrganizationIds: [],
    relatedIssueIds: ["government-transparency"],
    relatedCaseIds: [],
    relatedIssueLabels: ["Government transparency", "Public meetings"],
    relatedEntityLabels: ["Carson City Board of Supervisors"],
    isOfficialMeeting: true,
    createdFromMeetingRecord: false,
    sourceProvider: "seeded_source_backed",
    sourceProviderLabel: "Seeded source-backed meeting",
    lastFetchedAt: null,
    meetingRecordId: null,
    communityEventId: null,
    meetingSummary: null,
    keyActions: [],
    voteResults: [],
    sourceDocumentCount: 5,
    summary: "Upcoming official-meeting demo event with agenda and archive source links.",
  },
  {
    id: "seed-event-washoe-voter-deadline",
    title: "Washoe County general election readiness deadline",
    description: "Seeded election-deadline reminder linked to Washoe County and Nevada election information sources.",
    eventType: "election_deadline",
    civicEventKind: "election_deadline",
    startsAt: "2026-10-20T17:00:00-07:00",
    endsAt: "2026-10-20T17:00:00-07:00",
    locationName: "Washoe County Registrar of Voters",
    address: null,
    virtualUrl: "https://www.washoecounty.gov/voters/",
    eventMode: "hybrid",
    sourceUrl: "https://www.washoecounty.gov/voters/",
    agendaUrl: null,
    minutesUrl: null,
    videoUrl: null,
    packetUrl: null,
    hostName: "Washoe County Registrar of Voters",
    hostType: "county",
    jurisdiction: "Washoe County, Nevada",
    relatedOfficialIds: [],
    relatedCandidateIds: [],
    relatedOrganizationIds: [],
    relatedIssueIds: [],
    relatedCaseIds: [],
    relatedIssueLabels: ["Elections", "Voting access"],
    relatedEntityLabels: ["Washoe County Registrar of Voters"],
    isOfficialMeeting: true,
    createdFromMeetingRecord: false,
    sourceProvider: "seeded_source_backed",
    sourceProviderLabel: "Seeded source-backed deadline",
    lastFetchedAt: null,
    meetingRecordId: null,
    communityEventId: null,
    meetingSummary: null,
    keyActions: [],
    voteResults: [],
    sourceDocumentCount: 1,
    summary: "Election readiness deadline card for filtering and demo calendar coverage.",
  },
  {
    id: "seed-event-nevada-2026-general-election-day",
    title: "Nevada 2026 general election day",
    description: "Seeded, source-linked statewide election date for the 2026 Nevada general election.",
    eventType: "election_deadline",
    civicEventKind: "election_deadline",
    startsAt: "2026-11-03T07:00:00-08:00",
    endsAt: "2026-11-03T19:00:00-08:00",
    locationName: "Nevada polling places and vote centers",
    address: null,
    virtualUrl: null,
    eventMode: "in_person",
    sourceUrl: "https://www.nvsos.gov/elections/election-information/2026-election-information",
    agendaUrl: null,
    minutesUrl: null,
    videoUrl: null,
    packetUrl: null,
    hostName: "Nevada Secretary of State",
    hostType: "state",
    jurisdiction: "Nevada",
    relatedOfficialIds: [],
    relatedCandidateIds: [],
    relatedOrganizationIds: [],
    relatedIssueIds: [],
    relatedCaseIds: [],
    relatedIssueLabels: ["Elections", "Voting access"],
    relatedEntityLabels: ["Nevada Secretary of State"],
    isOfficialMeeting: true,
    createdFromMeetingRecord: false,
    sourceProvider: "seeded_source_backed",
    sourceProviderLabel: "Seeded source-backed event",
    lastFetchedAt: null,
    meetingRecordId: null,
    communityEventId: null,
    meetingSummary: null,
    keyActions: [],
    voteResults: [],
    sourceDocumentCount: 1,
    summary: "Statewide general election date included so future election dates appear beside meetings and forums.",
  },
];

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bnv\b/g, "nevada")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeJurisdiction(value: string | null | undefined) {
  return normalize(value).replace(/\bcounty nevada\b/g, "county").replace(/\bcity nevada\b/g, "city");
}

function eventMatchesCommunity(
  event: Pick<CivicEvent, "jurisdiction" | "communityId" | "hostType" | "locationName" | "address" | "meetingSummary">,
  community: CommunitySummary | null,
) {
  if (!community) return true;
  if (event.communityId === community.id) return true;
  const eventJurisdiction = normalizeJurisdiction(event.jurisdiction);
  const needles = [community.name, community.primaryJurisdictionName, ...community.jurisdictionMatches].map(normalizeJurisdiction).filter(Boolean);
  if (needles.some((needle) => eventJurisdiction.includes(needle) || needle.includes(eventJurisdiction))) return true;

  if (event.hostType === "state") {
    const locationText = normalizeJurisdiction([event.locationName, event.address, event.meetingSummary].filter(Boolean).join(" "));
    return needles.some((needle) => locationText.includes(needle));
  }

  return false;
}

function getCommunityIdForJurisdiction(jurisdiction: string) {
  const exact = getCommunityByJurisdictionName(jurisdiction);
  if (exact) return exact.id;
  const normalizedJurisdiction = normalizeJurisdiction(jurisdiction);
  return (
    seededCommunities.find((community) =>
      [community.name, community.primaryJurisdictionName, ...community.jurisdictionMatches]
        .map(normalizeJurisdiction)
        .some((needle) => normalizedJurisdiction.includes(needle) || needle.includes(normalizedJurisdiction)),
    )?.id ?? null
  );
}

function bodyHostType(level: PublicBodyLevel): CivicEventHostType {
  return level;
}

function inferMeetingKind(bodyName: string, meetingType?: string | null): CivicEventKind {
  const value = normalize(`${bodyName} ${meetingType ?? ""}`);
  if (value.includes("planning")) return "planning_commission_meeting";
  if (value.includes("school") || value.includes("trustee")) return "school_board_meeting";
  if (value.includes("county") || value.includes("commission")) return "county_commission_meeting";
  if (value.includes("city") || value.includes("council") || value.includes("supervisor")) return "city_council_meeting";
  if (value.includes("legislature") || value.includes("legislative") || value.includes("hearing")) return "legislative_hearing";
  if (value.includes("court")) return "court_public_hearing";
  if (value.includes("regent") || value.includes("university")) return "university_governance_meeting";
  return "official_meeting";
}

function inferOfficialEventType(meeting: PublicMeetingRecord | null, items: PublicMeetingItemRecord[], bodyName: string): CivicEventType {
  const value = normalize(`${meeting?.meeting_type ?? ""} ${meeting?.title ?? ""} ${bodyName}`);
  if (value.includes("hearing") || items.some((item) => item.item_type === "public_hearing")) return "public_hearing";
  return "official_meeting";
}

function civicEventTypeFromCommunityEvent(event: CommunityEventSummary): CivicEventType {
  if (event.eventType === "publicHearing") return "public_hearing";
  if (event.eventType === "rally" || event.eventType === "demonstration") return "rally";
  if (event.eventType === "civicMeeting" || event.eventType === "interview") return "forum";
  return "community_event";
}

function civicEventKindFromCommunityEvent(event: CommunityEventSummary): CivicEventKind {
  const eventType = civicEventTypeFromCommunityEvent(event);
  if (eventType === "public_hearing") return "public_hearing";
  if (eventType === "rally") return "rally";
  if (eventType === "forum") return "forum";
  return "community_event";
}

function statusFromDates(startsAt: string | null, endsAt: string | null): CivicEventStatus {
  if (!startsAt) return "upcoming";
  const now = Date.now();
  const endTime = Date.parse(endsAt ?? startsAt);
  return Number.isFinite(endTime) && endTime < now ? "completed" : "upcoming";
}

function seededEventToEvent(event: SeededCivicEventInput): CivicEvent {
  return {
    ...event,
    status: statusFromDates(event.startsAt, event.endsAt),
    communityId: getCommunityIdForJurisdiction(event.jurisdiction),
    attendanceCount: 0,
    confirmedCount: 0,
    distanceLabel: null,
    momentumLabel: null,
    viewerStatus: null,
    actionsTaken: event.actionsTaken ?? [],
  };
}

function sourceFromMeeting(meeting: PublicMeetingRecord) {
  return meeting.source_urls[0] ?? meeting.agenda_url ?? meeting.minutes_url ?? meeting.packet_url ?? meeting.video_url ?? null;
}

function compactUnique(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function getMeetingLocation(meeting: PublicMeetingRecord, jurisdiction: string) {
  const location = meeting.meeting_summary?.match(/\bLocation:\s*(.+)$/i)?.[1]?.trim();
  return location || jurisdiction || null;
}

function meetingToEvent({
  meeting,
  body,
  items,
  votes,
  lastFetchedAt,
}: {
  meeting: PublicMeetingRecord;
  body: PublicBodyRecord | null;
  items: PublicMeetingItemRecord[];
  votes: VoteRecord[];
  lastFetchedAt: string | null;
}): CivicEvent {
  const bodyName = body?.name ?? "Public body";
  const jurisdiction = body?.jurisdiction ?? "Nevada";
  const sourceUrl = sourceFromMeeting(meeting);
  const eventType = inferOfficialEventType(meeting, items, bodyName);
  const issueLabels = compactUnique(items.map((item) => item.policy_area)).filter((label) => label !== "Other").slice(0, 5);
  const actionsTaken = votes.slice(0, 6).map((vote) => {
    const item = items.find((entry) => entry.id === vote.meeting_item_id);
    return {
      id: vote.id,
      title: item?.title ?? vote.motion ?? vote.vote_text,
      result: vote.result,
      sourceUrl: vote.source_url ?? item?.source_url ?? sourceUrl,
    };
  });

  return {
    id: meeting.id,
    title: meeting.title || `${bodyName} meeting`,
    description: items.length
      ? `${bodyName} public meeting with ${items.length} parsed agenda item${items.length === 1 ? "" : "s"}.`
      : `${bodyName} public meeting record from official source materials.`,
    eventType,
    civicEventKind: inferMeetingKind(bodyName, meeting.meeting_type),
    status: statusFromDates(meeting.meeting_date, null),
    startsAt: meeting.meeting_date,
    endsAt: null,
    locationName: getMeetingLocation(meeting, jurisdiction),
    address: null,
    virtualUrl: meeting.video_url ?? null,
    eventMode: meeting.video_url ? "hybrid" : "unknown",
    sourceUrl,
    agendaUrl: meeting.agenda_url,
    minutesUrl: meeting.minutes_url,
    videoUrl: meeting.video_url,
    packetUrl: meeting.packet_url,
    hostName: bodyName,
    hostType: body ? bodyHostType(body.level) : "state",
    jurisdiction,
    communityId: getCommunityIdForJurisdiction(jurisdiction),
    relatedOfficialIds: compactUnique(votes.map((vote) => vote.official_id)),
    relatedCandidateIds: [],
    relatedOrganizationIds: [],
    relatedIssueIds: [],
    relatedCaseIds: [],
    relatedIssueLabels: issueLabels,
    relatedEntityLabels: compactUnique([bodyName, ...issueLabels]),
    isOfficialMeeting: true,
    createdFromMeetingRecord: true,
    sourceProvider: "public_meeting_import",
    sourceProviderLabel: meeting.source_method === "manual_cache" ? "Imported from saved official source" : "Official meeting import",
    lastFetchedAt,
    meetingRecordId: meeting.id,
    communityEventId: null,
    attendanceCount: 0,
    confirmedCount: 0,
    distanceLabel: null,
    momentumLabel: null,
    viewerStatus: null,
    meetingSummary: meeting.meeting_summary,
    keyActions: meeting.key_actions ?? [],
    voteResults: (meeting.vote_results ?? []).map((vote) => ({
      motion: vote.motion,
      result: vote.result,
      voteText: vote.vote_text,
      sourceUrl: vote.source_url,
    })),
    sourceDocumentCount: meeting.source_document_count ?? compactUnique([meeting.agenda_url, meeting.minutes_url, meeting.packet_url, meeting.video_url, meeting.transcript_url]).length,
    summary: meeting.meeting_summary ?? items.at(0)?.description ?? null,
    actionsTaken,
  };
}

function sourceRegistryEventToEvent(body: PublicBodyRecord, seed: PublicMeetingSourceSeed | null, lastFetchedAt: string | null): CivicEvent {
  const sourceUrl = body.meeting_index_url ?? body.source_url ?? seed?.meetingIndexUrl ?? seed?.sourceUrl ?? seed?.website ?? null;
  const eventType = normalize(body.name).includes("hearing") ? "public_hearing" : "official_meeting";

  return {
    id: `meeting-source-${body.id}`,
    title: `${body.name} meeting calendar and archive`,
    description:
      body.notes ??
      `Official public meeting source for ${body.name}. Dated agenda, packet, minutes, and video records will appear as imports are connected.`,
    eventType,
    civicEventKind: inferMeetingKind(body.name),
    status: "upcoming",
    startsAt: null,
    endsAt: null,
    locationName: body.name,
    address: null,
    virtualUrl: seed?.videoArchiveUrl ?? null,
    eventMode: seed?.videoArchiveUrl ? "hybrid" : "unknown",
    sourceUrl,
    agendaUrl: seed?.agendaArchiveUrl ?? sourceUrl,
    minutesUrl: seed?.minutesArchiveUrl ?? null,
    videoUrl: seed?.videoArchiveUrl ?? null,
    packetUrl: seed?.packetArchiveUrl ?? null,
    hostName: body.name,
    hostType: bodyHostType(body.level),
    jurisdiction: body.jurisdiction,
    communityId: getCommunityIdForJurisdiction(body.jurisdiction),
    relatedOfficialIds: [],
    relatedCandidateIds: [],
    relatedOrganizationIds: [],
    relatedIssueIds: [],
    relatedCaseIds: [],
    relatedIssueLabels: [],
    relatedEntityLabels: [body.name],
    isOfficialMeeting: true,
    createdFromMeetingRecord: false,
    sourceProvider: "public_meeting_source_registry",
    sourceProviderLabel: "Official meeting source registry",
    lastFetchedAt,
    meetingRecordId: null,
    communityEventId: null,
    meetingSummary: null,
    keyActions: [],
    voteResults: [],
    sourceDocumentCount: compactUnique([sourceUrl, seed?.agendaArchiveUrl, seed?.minutesArchiveUrl, seed?.packetArchiveUrl, seed?.videoArchiveUrl]).length,
    attendanceCount: 0,
    confirmedCount: 0,
    distanceLabel: null,
    momentumLabel: null,
    viewerStatus: null,
    summary: "Structured meeting-date imports are pending. This card links voters to the official schedule and archive source.",
    actionsTaken: [],
  };
}

function communityEventToEvent({
  event,
  attendanceCount,
  confirmedCount,
  viewerStatus,
}: {
  event: CommunityEventSummary;
  attendanceCount: number;
  confirmedCount: number;
  viewerStatus: CivicEvent["viewerStatus"];
}): CivicEvent {
  const eventType = civicEventTypeFromCommunityEvent(event);

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    eventType,
    civicEventKind: civicEventKindFromCommunityEvent(event),
    status: statusFromDates(event.startsAt, event.endsAt ?? null),
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    locationName: event.locationLabel ?? null,
    address: null,
    virtualUrl: event.meetingUrl ?? null,
    eventMode: event.format === "virtual" ? "virtual" : event.meetingUrl ? "hybrid" : "in_person",
    sourceUrl: event.sponsorHref ?? null,
    agendaUrl: null,
    minutesUrl: null,
    videoUrl: null,
    packetUrl: null,
    hostName: event.sponsorName,
    hostType: event.sponsorType,
    jurisdiction: event.jurisdictionName,
    communityId: getCommunityIdForJurisdiction(event.jurisdictionName),
    relatedOfficialIds: event.sponsorType === "official" && event.sponsorHref ? [event.sponsorHref.split("/").at(-1) ?? ""].filter(Boolean) : [],
    relatedCandidateIds: event.sponsorType === "candidate" && event.sponsorHref ? [event.sponsorHref.split("/").at(-1) ?? ""].filter(Boolean) : [],
    relatedOrganizationIds: event.organizationId ? [event.organizationId] : [],
    relatedIssueIds: event.issueSlug ? [event.issueSlug] : [],
    relatedCaseIds: [],
    relatedIssueLabels: event.issueLabel ? [event.issueLabel] : [],
    relatedEntityLabels: compactUnique([event.sponsorName, event.issueLabel]),
    isOfficialMeeting: false,
    createdFromMeetingRecord: false,
    sourceProvider: "community_event",
    sourceProviderLabel: "Community event",
    lastFetchedAt: null,
    meetingRecordId: null,
    communityEventId: event.id,
    meetingSummary: null,
    keyActions: [],
    voteResults: [],
    sourceDocumentCount: compactUnique([event.sponsorHref, event.meetingUrl]).length,
    attendanceCount,
    confirmedCount,
    distanceLabel: null,
    momentumLabel: attendanceCount >= 10 ? "High attendance" : attendanceCount >= 4 ? "Rising" : null,
    viewerStatus,
    summary: event.purpose,
    actionsTaken: [],
  };
}

function eventMatchesScope(scope: VoteQuestionScope | "all", jurisdictionName: string, userJurisdictionName: string) {
  if (scope === "all") return true;
  if (scope === "local") return normalizeJurisdiction(jurisdictionName) === normalizeJurisdiction(userJurisdictionName);
  if (scope === "state") return normalizeJurisdiction(jurisdictionName).includes("nevada");
  return normalizeJurisdiction(jurisdictionName).includes("united states");
}

function getDistanceLabel(userJurisdictionName: string, eventJurisdictionName: string) {
  const userJurisdiction = normalizeJurisdiction(userJurisdictionName);
  const eventJurisdiction = normalizeJurisdiction(eventJurisdictionName);
  if (eventJurisdiction === userJurisdiction) return "Near you";
  if (eventJurisdiction.includes("nevada") || userJurisdiction.includes("nevada")) return "Regional";
  if (eventJurisdiction.includes("united states")) return "National";
  return "Regional";
}

const getAllCivicEventsCached = cache(async (viewerUserId: string): Promise<CivicEvent[]> => {
  const [dashboard, communityEvents, attendance] = await Promise.all([
    getPublicMeetingAdminDashboard(),
    getAllCommunityEvents(),
    getAllEventAttendance(),
  ]);
  const bodyById = new Map(dashboard.publicBodies.map((body) => [body.id, body]));
  const seedById = new Map(dashboard.seedSources.map((seed) => [seed.id, seed]));
  const itemsByMeetingId = new Map<string, PublicMeetingItemRecord[]>();
  const votesByMeetingId = new Map<string, VoteRecord[]>();

  for (const item of dashboard.meetingItems) {
    itemsByMeetingId.set(item.meeting_id, [...(itemsByMeetingId.get(item.meeting_id) ?? []), item]);
  }
  for (const vote of dashboard.voteRecords) {
    const item = dashboard.meetingItems.find((entry) => entry.id === vote.meeting_item_id);
    if (item) votesByMeetingId.set(item.meeting_id, [...(votesByMeetingId.get(item.meeting_id) ?? []), vote]);
  }

  const meetingEvents = dashboard.meetings.map((meeting) =>
    meetingToEvent({
      meeting,
      body: bodyById.get(meeting.public_body_id) ?? null,
      items: itemsByMeetingId.get(meeting.id) ?? [],
      votes: votesByMeetingId.get(meeting.id) ?? [],
      lastFetchedAt: dashboard.ingestionReport?.generated_at ?? null,
    }),
  );
  const bodiesWithDatedMeetings = new Set(dashboard.meetings.map((meeting) => meeting.public_body_id));
  const sourceEvents = dashboard.publicBodies
    .filter((body) => body.active)
    .filter((body) => !bodiesWithDatedMeetings.has(body.id))
    .map((body) => sourceRegistryEventToEvent(body, seedById.get(body.seed_source_id) ?? null, dashboard.ingestionReport?.generated_at ?? body.updated_at));
  const attendanceByEvent = new Map<string, typeof attendance>();
  for (const entry of attendance) {
    attendanceByEvent.set(entry.eventId, [...(attendanceByEvent.get(entry.eventId) ?? []), entry]);
  }
  const communityCivicEvents = communityEvents.map((event) => {
    const entries = attendanceByEvent.get(event.id) ?? [];
    return communityEventToEvent({
      event,
      attendanceCount: entries.filter((entry) => entry.status === "attending" || entry.status === "confirmed").length,
      confirmedCount: entries.filter((entry) => entry.status === "confirmed" || entry.confirmedAt).length,
      viewerStatus: entries.find((entry) => entry.userId === viewerUserId)?.status ?? null,
    });
  });

  return [...meetingEvents, ...sourceEvents, ...communityCivicEvents].map((event) => ({
    ...event,
    distanceLabel: event.distanceLabel ?? null,
  }));
});

export async function getAllCivicEventsForUser(user: AuthUser) {
  const events = await getAllCivicEventsCached(user.id);
  return events.map((event) => ({
    ...event,
    distanceLabel: event.distanceLabel ?? getDistanceLabel(user.jurisdictionName, event.jurisdiction),
  }));
}

export async function getCivicEventsForBrowse(
  user: AuthUser,
  options: {
    communityId?: string;
    status?: CivicEventBrowseStatus;
    source?: CivicEventBrowseSource;
    type?: CivicEventBrowseType;
    scope?: VoteQuestionScope | "all";
    mode?: CivicEventBrowseMode;
    dateFrom?: string;
    dateTo?: string;
    linkedTo?: string;
    sort?: CivicEventBrowseSort;
    limit?: number;
  } = {},
) {
  const community = options.communityId ? getCommunityById(options.communityId) ?? null : null;
  const status = options.status ?? "all";
  const source = options.source ?? "all";
  const type = options.type ?? "all";
  const scope = options.scope ?? "all";
  const mode = options.mode ?? "all";
  const linkedTo = normalize(options.linkedTo);
  const dateFrom = options.dateFrom ? Date.parse(`${options.dateFrom}T00:00:00`) : Number.NaN;
  const dateTo = options.dateTo ? Date.parse(`${options.dateTo}T23:59:59`) : Number.NaN;
  const sort = options.sort ?? "official-first";
  const filtered = (await getAllCivicEventsForUser(user))
    .filter((event) => eventMatchesCommunity(event, community))
    .filter((event) => eventMatchesScope(scope, event.jurisdiction, user.jurisdictionName))
    .filter((event) => {
      if (status === "all") return true;
      if (status === "upcoming") return event.status === "upcoming" && Boolean(event.startsAt);
      return event.status === status;
    })
    .filter((event) => (source === "official" ? event.isOfficialMeeting : source === "community" ? !event.isOfficialMeeting : true))
    .filter((event) => (type === "all" ? true : event.eventType === type))
    .filter((event) => (mode === "all" ? true : event.eventMode === mode))
    .filter((event) => {
      if (!Number.isFinite(dateFrom) && !Number.isFinite(dateTo)) return true;
      const startsAt = event.startsAt ? Date.parse(event.startsAt) : Number.NaN;
      if (!Number.isFinite(startsAt)) return false;
      if (Number.isFinite(dateFrom) && startsAt < dateFrom) return false;
      if (Number.isFinite(dateTo) && startsAt > dateTo) return false;
      return true;
    })
    .filter((event) => {
      if (!linkedTo) return true;
      const haystack = normalize(
        [
          event.hostName,
          event.hostType,
          event.jurisdiction,
          ...event.relatedEntityLabels,
          ...event.relatedIssueLabels,
          ...event.relatedOfficialIds,
          ...event.relatedCandidateIds,
          ...event.relatedOrganizationIds,
          ...event.relatedIssueIds,
        ].join(" "),
      );
      return haystack.includes(linkedTo);
    });

  const sorted = filtered.sort((left, right) => {
    if (sort === "soonest") {
      return (Date.parse(left.startsAt ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(right.startsAt ?? "") || Number.MAX_SAFE_INTEGER);
    }
    if (sort === "recent") {
      return (Date.parse(right.startsAt ?? "") || 0) - (Date.parse(left.startsAt ?? "") || 0);
    }
    if (sort === "recommended") {
      return right.attendanceCount - left.attendanceCount || Number(right.isOfficialMeeting) - Number(left.isOfficialMeeting);
    }
    return Number(right.isOfficialMeeting) - Number(left.isOfficialMeeting) || (Date.parse(left.startsAt ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(right.startsAt ?? "") || Number.MAX_SAFE_INTEGER);
  });

  return typeof options.limit === "number" ? sorted.slice(0, options.limit) : sorted;
}

export async function getCivicEventById(user: AuthUser, eventId: string) {
  const events = await getAllCivicEventsForUser(user);
  return events.find((event) => event.id === eventId || event.communityEventId === eventId || event.meetingRecordId === eventId) ?? null;
}

export function getCivicEventTypeLabel(eventType: CivicEventType) {
  switch (eventType) {
    case "official_meeting":
      return "Official meeting";
    case "public_hearing":
      return "Public hearing";
    case "rally":
      return "Rally";
    case "forum":
      return "Forum";
    case "election_deadline":
      return "Election deadline";
    case "community_event":
      return "Community event";
    default:
      return "Event";
  }
}

export function getCivicEventStatusLabel(status: CivicEventStatus) {
  return status === "upcoming" ? "Upcoming" : status === "completed" ? "Completed" : "Cancelled";
}
