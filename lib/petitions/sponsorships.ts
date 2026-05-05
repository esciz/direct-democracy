import { cookies } from "next/headers";

import type { SponsorshipRequestSummary } from "@/types/domain";

const SPONSORSHIP_REQUESTS_COOKIE = "dd_petition_sponsorship_requests";

const seededSponsorshipRequests: SponsorshipRequestSummary[] = [
  {
    id: "seeded_sponsorship_carson_meeting_archives",
    petitionId: "petition_carson_meeting_archives",
    requesterId: "user_trusted_citizen_marco_silva",
    requesterName: "Marco Silva",
    targetedOfficialIds: ["profile_elena_ramirez"],
    targetedOfficialNames: ["Elena Ramirez"],
    createdAt: "2026-03-27T11:45:00.000Z",
  },
  {
    id: "seeded_sponsorship_finance_transparency",
    petitionId: "petition_finance_transparency",
    requesterId: "user_trusted_citizen_hannah_cho",
    requesterName: "Hannah Cho",
    targetedOfficialIds: ["profile_priya_desai"],
    targetedOfficialNames: ["Priya Desai"],
    createdAt: "2026-03-26T17:30:00.000Z",
  },
];

function isSponsorshipRequest(value: unknown): value is SponsorshipRequestSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const request = value as Record<string, unknown>;
  return (
    typeof request.id === "string" &&
    typeof request.petitionId === "string" &&
    typeof request.requesterId === "string" &&
    typeof request.requesterName === "string" &&
    Array.isArray(request.targetedOfficialIds) &&
    Array.isArray(request.targetedOfficialNames) &&
    typeof request.createdAt === "string"
  );
}

export async function getStoredSponsorshipRequests(): Promise<SponsorshipRequestSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SPONSORSHIP_REQUESTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSponsorshipRequest) : [];
  } catch {
    return [];
  }
}

export async function getAllSponsorshipRequests(): Promise<SponsorshipRequestSummary[]> {
  return [...seededSponsorshipRequests, ...(await getStoredSponsorshipRequests())];
}

export async function setStoredSponsorshipRequests(requests: SponsorshipRequestSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(SPONSORSHIP_REQUESTS_COOKIE, JSON.stringify(requests.slice(0, 60)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
