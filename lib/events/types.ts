export type CivicEventType =
  | "official_meeting"
  | "public_hearing"
  | "rally"
  | "forum"
  | "election_deadline"
  | "community_event";

export type CivicEventKind =
  | "city_council_meeting"
  | "county_commission_meeting"
  | "school_board_meeting"
  | "planning_commission_meeting"
  | "legislative_hearing"
  | "court_public_hearing"
  | "university_governance_meeting"
  | "official_meeting"
  | "public_hearing"
  | "rally"
  | "forum"
  | "election_deadline"
  | "community_event";

export type CivicEventStatus = "upcoming" | "completed" | "cancelled";

export type CivicEventHostType =
  | "city"
  | "county"
  | "state"
  | "school"
  | "university"
  | "special_district"
  | "trustedCitizen"
  | "official"
  | "candidate"
  | "community";

export type CivicEventSourceProvider =
  | "public_meeting_import"
  | "public_meeting_source_registry"
  | "community_event"
  | "seeded_source_backed";

export type CivicEvent = {
  id: string;
  title: string;
  description: string;
  eventType: CivicEventType;
  civicEventKind: CivicEventKind;
  status: CivicEventStatus;
  startsAt: string | null;
  endsAt: string | null;
  locationName: string | null;
  address: string | null;
  virtualUrl: string | null;
  eventMode: "virtual" | "in_person" | "hybrid" | "unknown";
  sourceUrl: string | null;
  agendaUrl: string | null;
  minutesUrl: string | null;
  videoUrl: string | null;
  packetUrl: string | null;
  hostName: string;
  hostType: CivicEventHostType;
  jurisdiction: string;
  communityId: string | null;
  relatedOfficialIds: string[];
  relatedCandidateIds: string[];
  relatedOrganizationIds: string[];
  relatedIssueIds: string[];
  relatedCaseIds: string[];
  relatedIssueLabels: string[];
  relatedEntityLabels: string[];
  isOfficialMeeting: boolean;
  createdFromMeetingRecord: boolean;
  sourceProvider: CivicEventSourceProvider;
  sourceProviderLabel: string;
  lastFetchedAt: string | null;
  meetingRecordId: string | null;
  communityEventId: string | null;
  meetingSummary: string | null;
  keyActions: string[];
  voteResults: Array<{
    motion: string | null;
    result: string | null;
    voteText: string | null;
    sourceUrl: string | null;
  }>;
  sourceDocumentCount: number;
  attendanceCount: number;
  confirmedCount: number;
  distanceLabel: string | null;
  momentumLabel: string | null;
  viewerStatus: "attending" | "maybe" | "confirmed" | null;
  summary: string | null;
  actionsTaken: Array<{
    id: string;
    title: string;
    result: string | null;
    sourceUrl: string | null;
  }>;
};
