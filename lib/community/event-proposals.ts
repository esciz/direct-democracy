import { cookies } from "next/headers";

import { getCommunityById } from "@/lib/community/communities";
import { getStoredCommunityEvents, setStoredCommunityEvents } from "@/lib/community/events";
import type { CommunityEventSummary, EventProposalSummary } from "@/types/domain";

const EVENT_PROPOSALS_COOKIE = "dd_event_proposals";
const MIN_PROPOSAL_SUPPORTERS = 3;

function isEventProposal(value: unknown): value is EventProposalSummary {
  if (!value || typeof value !== "object") return false;
  const proposal = value as Record<string, unknown>;
  return (
    typeof proposal.id === "string" &&
    typeof proposal.title === "string" &&
    typeof proposal.description === "string" &&
    typeof proposal.purpose === "string" &&
    typeof proposal.jurisdictionName === "string" &&
    typeof proposal.startsAt === "string" &&
    typeof proposal.eventType === "string" &&
    typeof proposal.format === "string" &&
    typeof proposal.proposerUserId === "string" &&
    typeof proposal.proposerName === "string" &&
    Array.isArray(proposal.supporterUserIds)
  );
}

export async function getStoredEventProposals() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(EVENT_PROPOSALS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEventProposal) : [];
  } catch {
    return [];
  }
}

export async function setStoredEventProposals(proposals: EventProposalSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(EVENT_PROPOSALS_COOKIE, JSON.stringify(proposals.slice(0, 150)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getOpenEventProposals(communityId?: string) {
  const proposals = await getStoredEventProposals();
  const community = communityId ? getCommunityById(communityId) : null;

  return proposals
    .filter((proposal) => !proposal.promotedEventId)
    .filter((proposal) => (community ? community.jurisdictionMatches.includes(proposal.jurisdictionName) : true))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function proposalCanAutoPromote(proposal: EventProposalSummary) {
  return proposal.supporterUserIds.length >= MIN_PROPOSAL_SUPPORTERS || Boolean(proposal.approvedByTrustedCitizenId);
}

export async function promoteEventProposal(proposal: EventProposalSummary) {
  const existingEvents = await getStoredCommunityEvents();
  const nextEvent: CommunityEventSummary = {
    id: `community_event_from_proposal_${Date.now()}`,
    title: proposal.title,
    description: proposal.description,
    purpose: proposal.purpose,
    jurisdictionName: proposal.jurisdictionName,
    startsAt: proposal.startsAt,
    endsAt: new Date(Date.parse(proposal.startsAt) + 2 * 60 * 60 * 1000).toISOString(),
    eventType: proposal.eventType,
    format: proposal.format,
    sponsorName: proposal.proposerName,
    sponsorType: "community",
    sponsorUserId: proposal.proposerUserId,
    sponsorHref: `/citizens/${proposal.proposerUserId}`,
    issueLabel: proposal.issueLabel ?? null,
    issueSlug: proposal.issueSlug ?? null,
    locationLabel: proposal.locationLabel ?? null,
    meetingUrl: proposal.meetingUrl ?? null,
  };

  await setStoredCommunityEvents([nextEvent, ...existingEvents]);
  return nextEvent;
}

export { MIN_PROPOSAL_SUPPORTERS };
