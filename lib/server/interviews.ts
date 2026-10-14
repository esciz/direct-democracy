import "server-only";

import { cookies } from "next/headers";

import { getSeedUserById } from "@/lib/auth/mock-users";
import { getAllCommunityEvents, getStoredCommunityEvents, setStoredCommunityEvents } from "@/lib/community/events";
import { getCreatedPosts } from "@/lib/feed/posts";
import { canonicalizeIssueTags } from "@/lib/issues/utils";
import { addFavoriteForUser } from "@/lib/server/favorites";
import { getAllOfficialPositions, getAllPublicProfiles } from "@/lib/server/elections-context";
import type {
  AuthUser,
  CommunityEventFormat,
  CommunityEventSummary,
  InterviewRequestFormat,
  InterviewRequestStatus,
  InterviewRequestSummary,
  PublicProfileInterviewsSummary,
} from "@/types/domain";

const INTERVIEW_REQUESTS_COOKIE = "dd_interview_requests";

type InterviewRequestRecord = {
  id: string;
  threadId: string;
  requesterUserId: string;
  recipientUserId: string;
  recipientProfileId: string;
  topicTitle: string;
  issueTags: string[];
  requestedFormat: InterviewRequestFormat;
  proposedQuestions: string;
  status: InterviewRequestStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  eventId?: string | null;
  eventStartsAt?: string | null;
  publishedPostId?: string | null;
};

const seededInterviewRequests: InterviewRequestRecord[] = [
  {
    id: "interview_request_marco_elena_budget",
    threadId: "thread_demo_interview_marco_elena_budget",
    requesterUserId: "user_trusted_citizen_marco_silva",
    recipientUserId: "user_official_elena_ramirez",
    recipientProfileId: "profile_elena_ramirez",
    topicTitle: "Carson City budget tradeoffs and school staffing",
    issueTags: ["Budget clarity", "Teacher retention"],
    requestedFormat: "written",
    proposedQuestions:
      "Marco Silva requested a short written interview asking Mayor Elena Ramirez to explain the budget tradeoffs between road maintenance, park staffing, and teacher recruitment support.",
    status: "pending",
    createdAt: "2026-04-10T18:00:00.000Z",
    updatedAt: "2026-04-10T18:00:00.000Z",
  },
  {
    id: "interview_request_hannah_david_growth",
    threadId: "thread_demo_interview_hannah_david_growth",
    requesterUserId: "user_trusted_citizen_hannah_cho",
    recipientUserId: "user_official_david_park",
    recipientProfileId: "profile_david_park",
    topicTitle: "Washoe growth sequencing and road capacity",
    issueTags: ["Growth planning", "Roads"],
    requestedFormat: "remote",
    proposedQuestions:
      "Hannah Cho requested a remote interview focused on road sequencing, growth approvals, and which county milestones residents should expect before the next major zoning vote.",
    status: "accepted",
    createdAt: "2026-04-04T17:30:00.000Z",
    updatedAt: "2026-04-06T18:00:00.000Z",
  },
  {
    id: "interview_request_nora_sofia_water",
    threadId: "thread_demo_interview_nora_sofia_water",
    requesterUserId: "user_trusted_citizen_nora_patel",
    recipientUserId: "user_candidate_sofia_bennett",
    recipientProfileId: "profile_sofia_bennett",
    topicTitle: "Nevada water resilience and housing growth",
    issueTags: ["Water policy", "Housing", "Public accountability"],
    requestedFormat: "video",
    proposedQuestions:
      "Nora Patel asked Sofia Bennett to respond on camera to three practical questions: how a statewide water plan should affect new housing approvals, what residents should be able to verify in public dashboards, and what Bennett would change in the first budget year if elected.",
    status: "completed",
    createdAt: "2026-04-02T18:00:00.000Z",
    updatedAt: "2026-04-09T18:30:00.000Z",
    completedAt: "2026-04-09T18:30:00.000Z",
    publishedPostId: "post_interview_nora_sofia_water",
  },
  {
    id: "interview_request_nora_owen_schools",
    threadId: "thread_demo_interview_nora_owen_schools",
    requesterUserId: "user_trusted_citizen_nora_patel",
    recipientUserId: "user_candidate_owen_castillo",
    recipientProfileId: "profile_owen_castillo",
    topicTitle: "School board staffing and budget transparency",
    issueTags: ["Schools", "Budget clarity"],
    requestedFormat: "video",
    proposedQuestions:
      "Nora Patel requested a short candidate interview on school staffing, classroom materials, and how school board reporting should change for working families.",
    status: "declined",
    createdAt: "2026-04-01T20:00:00.000Z",
    updatedAt: "2026-04-03T16:30:00.000Z",
  },
  {
    id: "interview_request_marco_sofia_followup",
    threadId: "thread_demo_interview_marco_sofia_followup",
    requesterUserId: "user_trusted_citizen_marco_silva",
    recipientUserId: "user_candidate_sofia_bennett",
    recipientProfileId: "profile_sofia_bennett",
    topicTitle: "Follow-up on statewide housing accountability",
    issueTags: ["Housing", "Public accountability"],
    requestedFormat: "written",
    proposedQuestions:
      "Marco Silva requested a follow-up written interview asking for a simpler answer on what statewide housing dashboards residents could expect in the first year.",
    status: "pending",
    createdAt: "2026-04-01T17:00:00.000Z",
    updatedAt: "2026-04-01T17:00:00.000Z",
  },
];

const INTERVIEW_NO_RESPONSE_DAYS = 5;

function isInterviewFormat(value: unknown): value is InterviewRequestFormat {
  return value === "written" || value === "video" || value === "inPerson" || value === "remote";
}

function isInterviewStatus(value: unknown): value is InterviewRequestStatus {
  return value === "pending" || value === "accepted" || value === "completed" || value === "declined" || value === "canceled";
}

function isInterviewRequestRecord(value: unknown): value is InterviewRequestRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const request = value as Record<string, unknown>;
  return (
    typeof request.id === "string" &&
    typeof request.threadId === "string" &&
    typeof request.requesterUserId === "string" &&
    typeof request.recipientUserId === "string" &&
    typeof request.recipientProfileId === "string" &&
    typeof request.topicTitle === "string" &&
    Array.isArray(request.issueTags) &&
    request.issueTags.every((entry) => typeof entry === "string") &&
    isInterviewFormat(request.requestedFormat) &&
    typeof request.proposedQuestions === "string" &&
    isInterviewStatus(request.status) &&
    typeof request.createdAt === "string" &&
    typeof request.updatedAt === "string" &&
    (typeof request.completedAt === "string" || request.completedAt === null || typeof request.completedAt === "undefined") &&
    (typeof request.eventId === "string" || request.eventId === null || typeof request.eventId === "undefined") &&
    (typeof request.eventStartsAt === "string" || request.eventStartsAt === null || typeof request.eventStartsAt === "undefined") &&
    (typeof request.publishedPostId === "string" || request.publishedPostId === null || typeof request.publishedPostId === "undefined")
  );
}

function mergeInterviewRequests(stored: InterviewRequestRecord[]) {
  const merged = new Map<string, InterviewRequestRecord>();

  for (const request of seededInterviewRequests) {
    merged.set(request.id, { ...request, issueTags: canonicalizeIssueTags(request.issueTags) });
  }

  for (const request of stored) {
    merged.set(request.id, { ...request, issueTags: canonicalizeIssueTags(request.issueTags) });
  }

  return [...merged.values()];
}

function mapInterviewFormatToEventFormat(format: InterviewRequestFormat): CommunityEventFormat {
  return format === "inPerson" ? "inPerson" : "virtual";
}

function buildInterviewSchedule(sourceIso: string) {
  const start = new Date(Date.parse(sourceIso) + 7 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  return {
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
  };
}

async function readStoredInterviewRequests() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(INTERVIEW_REQUESTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isInterviewRequestRecord) : [];
  } catch {
    return [];
  }
}

export async function setStoredInterviewRequests(requests: InterviewRequestRecord[]) {
  const cookieStore = await cookies();
  cookieStore.set(INTERVIEW_REQUESTS_COOKIE, JSON.stringify(requests.slice(0, 300)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

async function buildInterviewSummary(request: InterviewRequestRecord): Promise<InterviewRequestSummary | null> {
  const requester = getSeedUserById(request.requesterUserId);
  const recipient = getSeedUserById(request.recipientUserId);
  const [profiles, positions, events] = await Promise.all([getAllPublicProfiles(), getAllOfficialPositions(), getAllCommunityEvents()]);
  const profile = profiles.find((entry) => entry.claimedByUserId === request.recipientUserId);

  if (!requester || !recipient || !profile) {
    return null;
  }

  const recipientRole =
    profile.profileType === "official" || positions.some((position) => position.publicProfileId === profile.id && position.isCurrent)
      ? "official"
      : "candidate";
  const recipientProfileHref = `${recipientRole === "official" ? "/officials" : "/candidates"}/${profile.id}`;
  const linkedEvent = request.eventId
    ? [...events].find((event) => event.id === request.eventId) ??
      null
    : null;

  const allPosts = await getCreatedPosts();
  const publishedPost = request.publishedPostId ? allPosts.find((post) => post.id === request.publishedPostId) ?? null : null;

  return {
    id: request.id,
    threadId: request.threadId,
    requesterUserId: request.requesterUserId,
    requesterName: requester.name,
    recipientUserId: request.recipientUserId,
    recipientName: recipient.name,
    recipientRole,
    recipientProfileId: request.recipientProfileId,
    recipientProfileHref,
    topicTitle: request.topicTitle,
    issueTags: request.issueTags,
    requestedFormat: request.requestedFormat,
    proposedQuestions: request.proposedQuestions,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    completedAt: request.completedAt ?? null,
    eventId: request.eventId ?? null,
    eventTitle: linkedEvent?.title ?? null,
    eventStartsAt: request.eventStartsAt ?? linkedEvent?.startsAt ?? null,
    publishedPostId: request.publishedPostId ?? null,
    publishedPostTitle: publishedPost?.title ?? null,
  };
}

export async function getAllInterviewRequests() {
  const stored = mergeInterviewRequests(await readStoredInterviewRequests());
  const summaries = await Promise.all(stored.map((request) => buildInterviewSummary(request)));
  return summaries.filter((entry): entry is InterviewRequestSummary => Boolean(entry));
}

export async function getInterviewRequestById(interviewId: string) {
  const requests = await getAllInterviewRequests();
  return requests.find((request) => request.id === interviewId) ?? null;
}

export async function getInterviewRequestByThreadId(threadId: string) {
  const requests = await getAllInterviewRequests();
  return requests.find((request) => request.threadId === threadId) ?? null;
}

export async function getInterviewRequestRecord(interviewId: string) {
  const requests = mergeInterviewRequests(await readStoredInterviewRequests());
  return requests.find((request) => request.id === interviewId) ?? null;
}

export async function createInterviewRequestRecord(input: {
  threadId: string;
  requesterUserId: string;
  recipientUserId: string;
  recipientProfileId: string;
  topicTitle: string;
  issueTags: string[];
  requestedFormat: InterviewRequestFormat;
  proposedQuestions: string;
}) {
  const nextRecord: InterviewRequestRecord = {
    id: `interview_${Date.now()}`,
    threadId: input.threadId,
    requesterUserId: input.requesterUserId,
    recipientUserId: input.recipientUserId,
    recipientProfileId: input.recipientProfileId,
    topicTitle: input.topicTitle,
    issueTags: input.issueTags,
    requestedFormat: input.requestedFormat,
    proposedQuestions: input.proposedQuestions,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const records = await readStoredInterviewRequests();
  await setStoredInterviewRequests([nextRecord, ...records]);
  return nextRecord;
}

export async function ensureInterviewEventForRequest(interviewId: string) {
  const request = await getInterviewRequestRecord(interviewId);

  if (!request) {
    return null;
  }

  if (request.eventId) {
    const events = await getStoredCommunityEvents();
    const existing = events.find((event) => event.id === request.eventId);

    if (existing) {
      await Promise.all([
        addFavoriteForUser(request.requesterUserId, "event", existing.id),
        addFavoriteForUser(request.recipientUserId, "event", existing.id),
      ]);
      return existing;
    }
  }

  const [profiles, storedEvents] = await Promise.all([getAllPublicProfiles(), getStoredCommunityEvents()]);
  const requester = getSeedUserById(request.requesterUserId);
  const recipient = getSeedUserById(request.recipientUserId);
  const recipientProfile = profiles.find((entry) => entry.id === request.recipientProfileId);

  if (!requester || !recipient || !recipientProfile) {
    return null;
  }

  const schedule = request.eventStartsAt ? { startsAt: request.eventStartsAt, endsAt: new Date(Date.parse(request.eventStartsAt) + 60 * 60 * 1000).toISOString() } : buildInterviewSchedule(new Date().toISOString());
  const eventId = request.eventId ?? `event_interview_${Date.now()}`;
  const nextEvent: CommunityEventSummary = {
    id: eventId,
    title: `Interview: ${requester.name} with ${recipient.name}`,
    description: `Trusted citizen interview on ${request.topicTitle}. Residents can RSVP to attend the public interview session and follow the published recap afterward.`,
    purpose: `Public interview covering ${request.topicTitle}, requested by ${requester.name} and featuring ${recipient.name}.`,
    jurisdictionName: recipient.jurisdictionName,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    eventType: "interview",
    format: mapInterviewFormatToEventFormat(request.requestedFormat),
    sponsorName: requester.name,
    sponsorType: "trustedCitizen",
    sponsorUserId: requester.id,
    sponsorHref: `/citizens/${requester.id}`,
    issueLabel: request.issueTags[0] ?? "Citizen interview",
    issueSlug: (request.issueTags[0] ?? "citizen interview").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    locationLabel: request.requestedFormat === "inPerson" ? "Interview location to be confirmed" : null,
    meetingUrl: request.requestedFormat === "inPerson" ? null : "https://events.directdemocracy.local/interviews/live",
    interviewRequestId: request.id,
    interviewerName: requester.name,
    interviewSubjectName: recipient.name,
  };

  await setStoredCommunityEvents([nextEvent, ...storedEvents.filter((event) => event.id !== eventId)]);
  await updateInterviewRequestRecord(interviewId, (record) => ({
    ...record,
    eventId,
    eventStartsAt: schedule.startsAt,
    updatedAt: new Date().toISOString(),
  }));
  await Promise.all([
    addFavoriteForUser(request.requesterUserId, "event", eventId),
    addFavoriteForUser(request.recipientUserId, "event", eventId),
  ]);

  return nextEvent;
}

export async function updateInterviewRequestRecord(
  interviewId: string,
  updater: (record: InterviewRequestRecord) => InterviewRequestRecord,
) {
  const records = await readStoredInterviewRequests();
  const current = records.find((record) => record.id === interviewId);

  if (!current) {
    return null;
  }

  const updated = updater(current);
  await setStoredInterviewRequests([updated, ...records.filter((record) => record.id !== interviewId)]);
  return updated;
}

export async function getInterviewRequestsForPublicProfile(profileId: string) {
  const requests = (await getAllInterviewRequests()).filter((request) => request.recipientProfileId === profileId);
  const noResponseThresholdMs = INTERVIEW_NO_RESPONSE_DAYS * 24 * 60 * 60 * 1000;
  const requested = requests.filter(
    (request) => request.status === "pending" && Date.now() - Date.parse(request.updatedAt) < noResponseThresholdMs,
  );
  const noResponse = requests.filter(
    (request) => request.status === "pending" && Date.now() - Date.parse(request.updatedAt) >= noResponseThresholdMs,
  );
  const accepted = requests.filter((request) => request.status === "accepted");
  const completed = requests.filter((request) => request.status === "completed");
  const declined = requests.filter((request) => request.status === "declined");
  const acceptedCount = accepted.length + completed.length;
  const completedCount = completed.length;
  const declinedCount = declined.length;
  const noResponseCount = noResponse.length;

  let signalLabel: string | null = null;
  let signalDescription = "No visible completed Citizen Interviews yet.";

  if (completedCount >= 2) {
    signalLabel = "Regularly completes Citizen Interviews";
    signalDescription = "This profile has multiple completed citizen interviews visible to the public.";
  } else if (completedCount >= 1) {
    signalLabel = "Responds to Citizen Interviews";
    signalDescription = "This profile has completed at least one visible citizen interview.";
  } else if (acceptedCount >= 1) {
    signalLabel = "Books Citizen Interviews";
    signalDescription = "This profile has accepted interview requests and booked public interview time.";
  }

  return {
    requested,
    accepted,
    completed,
    declined,
    noResponse,
    responsiveness: {
      acceptedCount,
      completedCount,
      declinedCount,
      noResponseCount,
      signalLabel,
      signalDescription,
    },
  } satisfies PublicProfileInterviewsSummary;
}

export function canUserCreateInterviewRequest(user: Pick<AuthUser, "role" | "verificationState" | "isVerifiedVoter">) {
  return user.role === "trustedCitizen" && (user.isVerifiedVoter || user.verificationState === "voterVerified");
}

export function canUserPublishInterview(user: Pick<AuthUser, "role">) {
  return user.role === "trustedCitizen";
}
