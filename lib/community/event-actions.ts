"use server";

import { redirect } from "next/navigation";

import {
  canUserApproveEventProposal,
  canUserCreateCommunityEvent,
  canUserDirectlyCreateEventType,
  canUserProposeEventType,
} from "@/lib/auth/guards";
import { isGuestUser } from "@/lib/auth/session";
import { getCommunityById } from "@/lib/community/communities";
import { getRelevantUserIdsForEventNotifications } from "@/lib/community/event-discovery";
import { getAllCommunityEvents, getStoredCommunityEvents, setStoredCommunityEvents } from "@/lib/community/events";
import {
  getStoredEventProposals,
  promoteEventProposal,
  proposalCanAutoPromote,
  setStoredEventProposals,
} from "@/lib/community/event-proposals";
import { createNearbyEventNotifications } from "@/lib/notifications/store";
import { getOrganizationById } from "@/lib/organizations/store";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getAllPublicProfiles } from "@/lib/server/elections-context";
import { ensureIssueReferenceForUser } from "@/lib/server/issues";
import type {
  CommunityEventFormat,
  CommunityEventSummary,
  CommunityEventType,
  CommunitySponsorType,
  EventProposalSummary,
} from "@/types/domain";

const VALID_EVENT_TYPES: CommunityEventType[] = [
  "civicMeeting",
  "publicHearing",
  "demonstration",
  "rally",
  "communityEvent",
  "culturalSocialEvent",
];

function resolveSponsorType(role: string): CommunitySponsorType {
  if (role === "official") return "official";
  if (role === "candidate") return "candidate";
  if (role === "trustedCitizen") return "trustedCitizen";
  return "community";
}

async function getSponsorHref(userId: string, role: string) {
  if (role === "trustedCitizen" || role === "citizen") {
    return `/citizens/${userId}`;
  }

  const profiles = await getAllPublicProfiles();
  const linked = profiles.find((profile) => profile.claimedByUserId === userId && profile.isClaimed);

  if (!linked) {
    return null;
  }

  if (role === "candidate") {
    return `/candidates/${linked.id}`;
  }

  if (role === "official") {
    return `/officials/${linked.id}`;
  }

  return null;
}

function buildErrorPath(basePath: string, code: string) {
  return `${basePath}${basePath.includes("?") ? "&" : "?"}error=${code}`;
}

function sanitizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeOptionalText(value: FormDataEntryValue | null) {
  const trimmed = sanitizeText(value);
  return trimmed || null;
}

function sanitizeOptionalUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeIssueSlug(issueLabel: string | null) {
  return issueLabel ? issueLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : null;
}

async function parseEventRequest(formData: FormData) {
  const communityId = sanitizeText(formData.get("communityId"));
  const title = sanitizeText(formData.get("title"));
  const description = sanitizeText(formData.get("description"));
  const purpose = sanitizeText(formData.get("purpose"));
  const eventTypeValue = sanitizeText(formData.get("eventType"));
  const startsAt = sanitizeText(formData.get("startsAt"));
  const formatValue = sanitizeText(formData.get("format"));
  const issueLabel = sanitizeOptionalText(formData.get("issueLabel"));
  const locationLabel = sanitizeOptionalText(formData.get("locationLabel"));
  const meetingUrl = sanitizeOptionalUrl(formData.get("meetingUrl"));
  const organizationId = sanitizeOptionalText(formData.get("organizationId"));
  const returnPath = sanitizeText(formData.get("returnPath")) || (communityId ? `/events?communityId=${communityId}` : "/events");

  if (!communityId || !title || !description || !purpose || !eventTypeValue || !startsAt || !formatValue) {
    redirect(buildErrorPath("/events/create", "fields"));
  }

  const community = getCommunityById(communityId);

  if (!community) {
    redirect(buildErrorPath("/events/create", "community"));
  }

  if (title.length < 8 || description.length < 20 || purpose.length < 12) {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "details"));
  }

  if (!VALID_EVENT_TYPES.includes(eventTypeValue as CommunityEventType)) {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "type"));
  }

  if (formatValue !== "virtual" && formatValue !== "inPerson") {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "format"));
  }

  const startsAtValue = Date.parse(startsAt);

  if (Number.isNaN(startsAtValue)) {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "startsAt"));
  }

  if (formatValue === "inPerson" && !locationLabel) {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "location"));
  }

  if (formatValue === "virtual" && !meetingUrl) {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "meetingUrl"));
  }

  return {
    communityId,
    community,
    title,
    description,
    purpose,
    eventType: eventTypeValue as CommunityEventType,
    startsAt,
    startsAtValue,
    format: formatValue as CommunityEventFormat,
    issueLabel,
    locationLabel,
    meetingUrl,
    organizationId,
    returnPath,
  };
}

async function validateEventQuality({
  role,
  userId,
  communityId,
  title,
  startsAtValue,
  isProposal,
}: {
  role: string;
  userId: string;
  communityId: string;
  title: string;
  startsAtValue: number;
  isProposal: boolean;
}) {
  const [storedEvents, storedProposals] = await Promise.all([getAllCommunityEvents(), getStoredEventProposals()]);
  const minLeadHours = isProposal ? 12 : 6;

  if (startsAtValue - Date.now() < minLeadHours * 60 * 60 * 1000) {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "leadTime"));
  }

  const normalizedTitle = title.toLowerCase();
  const duplicateEvent = storedEvents.some(
    (event) =>
      event.title.toLowerCase() === normalizedTitle &&
      Math.abs(Date.parse(event.startsAt) - startsAtValue) < 24 * 60 * 60 * 1000,
  );
  const duplicateProposal = storedProposals.some(
    (proposal) =>
      !proposal.promotedEventId &&
      proposal.title.toLowerCase() === normalizedTitle &&
      Math.abs(Date.parse(proposal.startsAt) - startsAtValue) < 24 * 60 * 60 * 1000,
  );

  if (duplicateEvent || duplicateProposal) {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "duplicate"));
  }

  const futureEventCount = storedEvents.filter((event) => event.sponsorUserId === userId && Date.parse(event.startsAt) > Date.now()).length;
  const openProposalCount = storedProposals.filter((proposal) => proposal.proposerUserId === userId && !proposal.promotedEventId).length;

  if (role === "citizen" && !isProposal && futureEventCount >= 2) {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "limit"));
  }

  if (role === "citizen" && isProposal && openProposalCount >= 3) {
    redirect(buildErrorPath(`/events/create?communityId=${communityId}`, "proposalLimit"));
  }
}

async function createOfficialEvent(event: CommunityEventSummary, creatorId: string) {
  const existing = await getStoredCommunityEvents();
  await setStoredCommunityEvents([event, ...existing]);
  await createNearbyEventNotifications({
    userIds: getRelevantUserIdsForEventNotifications(event.jurisdictionName).filter((id) => id !== creatorId),
    eventId: event.id,
    eventTitle: event.title,
  });
}

export async function createCommunityEvent(formData: FormData) {
  const user = await getCurrentUser();

  if (!(await canUserCreateCommunityEvent(user))) {
    redirect("/my-community?denied=create-event");
  }

  const parsed = await parseEventRequest(formData);
  const organization = parsed.organizationId ? await getOrganizationById(parsed.organizationId, user) : null;
  const linkedIssue = parsed.issueLabel
    ? await ensureIssueReferenceForUser(user, parsed.issueLabel, {
        jurisdictionName: parsed.community.primaryJurisdictionName,
      })
    : null;

  if (parsed.organizationId && (!organization || !organization.canManage || organization.communityId !== parsed.communityId)) {
    redirect(buildErrorPath(`/events/create?communityId=${parsed.communityId}`, "organization"));
  }

  if (!canUserDirectlyCreateEventType(user, parsed.eventType)) {
    redirect(buildErrorPath(`/events/create?communityId=${parsed.communityId}`, "permissions"));
  }

  await validateEventQuality({
    role: user.role,
    userId: user.id,
    communityId: parsed.communityId,
    title: parsed.title,
    startsAtValue: parsed.startsAtValue,
    isProposal: false,
  });

  const nextEvent: CommunityEventSummary = {
    id: `community_event_${Date.now()}`,
    title: parsed.title,
    description: parsed.description,
    purpose: parsed.purpose,
    jurisdictionName: parsed.community.primaryJurisdictionName,
    startsAt: new Date(parsed.startsAtValue).toISOString(),
    endsAt: new Date(parsed.startsAtValue + 2 * 60 * 60 * 1000).toISOString(),
    eventType: parsed.eventType,
    format: parsed.format,
    organizationId: organization?.id ?? null,
    sponsorName: organization?.name ?? user.name,
    sponsorType: organization ? "community" : resolveSponsorType(user.role),
    sponsorUserId: user.id,
    sponsorHref: organization ? `/organizations/${organization.id}` : await getSponsorHref(user.id, user.role),
    issueLabel: linkedIssue?.issueText ?? parsed.issueLabel,
    issueSlug: normalizeIssueSlug(linkedIssue?.issueText ?? parsed.issueLabel),
    locationLabel: parsed.locationLabel,
    meetingUrl: parsed.meetingUrl,
  };

  await createOfficialEvent(nextEvent, user.id);
  redirect(`${parsed.returnPath}${parsed.returnPath.includes("?") ? "&" : "?"}event=created`);
}

export async function createEventProposal(formData: FormData) {
  const user = await getCurrentUser();

  if (!(await canUserCreateCommunityEvent(user))) {
    redirect("/my-community?denied=create-event");
  }

  const parsed = await parseEventRequest(formData);
  const linkedIssue = parsed.issueLabel
    ? await ensureIssueReferenceForUser(user, parsed.issueLabel, {
        jurisdictionName: parsed.community.primaryJurisdictionName,
      })
    : null;

  if (!canUserProposeEventType(user, parsed.eventType)) {
    redirect(buildErrorPath(`/events/create?communityId=${parsed.communityId}`, "proposalPermissions"));
  }

  await validateEventQuality({
    role: user.role,
    userId: user.id,
    communityId: parsed.communityId,
    title: parsed.title,
    startsAtValue: parsed.startsAtValue,
    isProposal: true,
  });

  const proposal: EventProposalSummary = {
    id: `event_proposal_${Date.now()}`,
    title: parsed.title,
    description: parsed.description,
    purpose: parsed.purpose,
    jurisdictionName: parsed.community.primaryJurisdictionName,
    startsAt: new Date(parsed.startsAtValue).toISOString(),
    eventType: parsed.eventType,
    format: parsed.format,
    locationLabel: parsed.locationLabel,
    meetingUrl: parsed.meetingUrl,
    issueLabel: linkedIssue?.issueText ?? parsed.issueLabel,
    issueSlug: normalizeIssueSlug(linkedIssue?.issueText ?? parsed.issueLabel),
    proposerUserId: user.id,
    proposerName: user.name,
    supporterUserIds: [user.id],
    approvedByTrustedCitizenId: null,
    promotedEventId: null,
    createdAt: new Date().toISOString(),
  };

  const existing = await getStoredEventProposals();
  await setStoredEventProposals([proposal, ...existing]);
  redirect(`${parsed.returnPath}${parsed.returnPath.includes("?") ? "&" : "?"}event=proposed`);
}

export async function supportEventProposal(formData: FormData) {
  const user = await getCurrentUser();
  if (isGuestUser(user)) {
    const returnPath = sanitizeText(formData.get("returnPath")) || "/events";
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}denied=guest`);
  }
  const proposalId = sanitizeText(formData.get("proposalId"));
  const returnPath = sanitizeText(formData.get("returnPath")) || "/events";
  const proposals = await getStoredEventProposals();
  const target = proposals.find((proposal) => proposal.id === proposalId && !proposal.promotedEventId);

  if (!target) {
    redirect(buildErrorPath(returnPath, "proposalMissing"));
  }

  const updated: EventProposalSummary = {
    ...target,
    supporterUserIds: [...new Set([...target.supporterUserIds, user.id])],
  };

  if (proposalCanAutoPromote(updated)) {
    const promotedEvent = await promoteEventProposal(updated);
    await setStoredEventProposals(
      proposals.map((proposal) => (proposal.id === proposalId ? { ...updated, promotedEventId: promotedEvent.id } : proposal)),
    );
    await createNearbyEventNotifications({
      userIds: getRelevantUserIdsForEventNotifications(promotedEvent.jurisdictionName).filter((id) => id !== user.id),
      eventId: promotedEvent.id,
      eventTitle: promotedEvent.title,
    });
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}event=proposal-promoted`);
  }

  await setStoredEventProposals(proposals.map((proposal) => (proposal.id === proposalId ? updated : proposal)));
  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}event=proposal-supported`);
}

export async function approveEventProposal(formData: FormData) {
  const user = await getCurrentUser();
  const proposalId = sanitizeText(formData.get("proposalId"));
  const returnPath = sanitizeText(formData.get("returnPath")) || "/events";

  if (!canUserApproveEventProposal(user)) {
    redirect(buildErrorPath(returnPath, "proposalApproval"));
  }

  const proposals = await getStoredEventProposals();
  const target = proposals.find((proposal) => proposal.id === proposalId && !proposal.promotedEventId);

  if (!target) {
    redirect(buildErrorPath(returnPath, "proposalMissing"));
  }

  const updated: EventProposalSummary = {
    ...target,
    approvedByTrustedCitizenId: user.id,
  };
  const promotedEvent = await promoteEventProposal(updated);
  await setStoredEventProposals(
    proposals.map((proposal) => (proposal.id === proposalId ? { ...updated, promotedEventId: promotedEvent.id } : proposal)),
  );
  await createNearbyEventNotifications({
    userIds: getRelevantUserIdsForEventNotifications(promotedEvent.jurisdictionName).filter((id) => id !== user.id),
    eventId: promotedEvent.id,
    eventTitle: promotedEvent.title,
  });
  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}event=proposal-promoted`);
}
