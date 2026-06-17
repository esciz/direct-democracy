import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import type {
  CandidateCampaignSummary,
  CandidateEndorsementSummary,
  CitizenEndorsementDisplaySummary,
  VisibleCandidateEndorserSummary,
} from "@/types/domain";

const CANDIDATE_ENDORSEMENTS_COOKIE = "dd_candidate_endorsements";

export const seededCandidateEndorsements: CandidateEndorsementSummary[] = [
  {
    id: "endorsement_alicia_sofia",
    userId: "user_citizen_alicia_hart",
    userName: "Alicia Hart",
    candidateCampaignId: "campaign_sofia_2026",
    electionId: "election_nevada_governor_2026",
    electionTitle: "Nevada Governor Election",
    candidateName: "Sofia Bennett",
    officeSought: "Governor",
    isPublic: true,
    createdAt: "2026-03-28T13:10:00.000Z",
  },
  {
    id: "endorsement_miles_owen",
    userId: "user_citizen_miles_reed",
    userName: "Miles Reed",
    candidateCampaignId: "campaign_owen_2026",
    electionId: "election_carson_school_board_2026",
    electionTitle: "Carson City School Board Election",
    candidateName: "Owen Castillo",
    officeSought: "School Board Trustee",
    isPublic: true,
    createdAt: "2026-03-28T15:40:00.000Z",
  },
  {
    id: "endorsement_tiana_sofia",
    userId: "user_citizen_tiana_moore",
    userName: "Tiana Moore",
    candidateCampaignId: "campaign_sofia_2026",
    electionId: "election_nevada_governor_2026",
    electionTitle: "Nevada Governor Election",
    candidateName: "Sofia Bennett",
    officeSought: "Governor",
    isPublic: false,
    createdAt: "2026-03-29T09:25:00.000Z",
  },
  {
    id: "endorsement_marco_elena",
    userId: "user_trusted_citizen_marco_silva",
    userName: "Marco Silva",
    candidateCampaignId: "campaign_elena_2026",
    electionId: "election_carson_mayor_2026",
    electionTitle: "Carson City Mayor Election",
    candidateName: "Elena Ramirez",
    officeSought: "Mayor",
    isPublic: true,
    createdAt: "2026-03-29T10:15:00.000Z",
  },
  {
    id: "endorsement_hannah_daniel",
    userId: "user_trusted_citizen_hannah_cho",
    userName: "Hannah Cho",
    candidateCampaignId: "campaign_daniel_2026",
    electionId: "election_nevada_governor_2026",
    electionTitle: "Nevada Governor Election",
    candidateName: "Daniel Rowe",
    officeSought: "Governor",
    isPublic: true,
    createdAt: "2026-03-29T11:20:00.000Z",
  },
  {
    id: "endorsement_nora_ava",
    userId: "user_trusted_citizen_nora_patel",
    userName: "Nora Patel",
    candidateCampaignId: "campaign_ava_2028",
    electionId: "election_us_president_2028",
    electionTitle: "United States Presidential Election",
    candidateName: "Ava Marquette",
    officeSought: "President",
    isPublic: true,
    createdAt: "2026-03-30T16:10:00.000Z",
  },
  {
    id: "endorsement_tiana_maya",
    userId: "user_citizen_tiana_moore",
    userName: "Tiana Moore",
    candidateCampaignId: "campaign_maya_2028",
    electionId: "election_nevada_senate_2028",
    electionTitle: "Nevada U.S. Senate Election",
    candidateName: "Maya Ortega",
    officeSought: "U.S. Senator",
    isPublic: true,
    createdAt: "2026-03-30T16:25:00.000Z",
  },
  {
    id: "endorsement_miles_cole",
    userId: "user_citizen_miles_reed",
    userName: "Miles Reed",
    candidateCampaignId: "campaign_cole_2028",
    electionId: "election_nevada_senate_2028",
    electionTitle: "Nevada U.S. Senate Election",
    candidateName: "Cole Wyatt",
    officeSought: "U.S. Senator",
    isPublic: false,
    createdAt: "2026-03-30T16:35:00.000Z",
  },
];

function isCandidateEndorsement(value: unknown): value is CandidateEndorsementSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const endorsement = value as Record<string, unknown>;

  return (
    typeof endorsement.id === "string" &&
    typeof endorsement.userId === "string" &&
    typeof endorsement.userName === "string" &&
    typeof endorsement.candidateCampaignId === "string" &&
    typeof endorsement.electionId === "string" &&
    typeof endorsement.electionTitle === "string" &&
    typeof endorsement.candidateName === "string" &&
    typeof endorsement.officeSought === "string" &&
    typeof endorsement.isPublic === "boolean" &&
    typeof endorsement.createdAt === "string"
  );
}

export async function getStoredCandidateEndorsements() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CANDIDATE_ENDORSEMENTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCandidateEndorsement) : [];
  } catch {
    return [];
  }
}

export async function setStoredCandidateEndorsements(endorsements: CandidateEndorsementSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(CANDIDATE_ENDORSEMENTS_COOKIE, JSON.stringify(endorsements.slice(0, 120)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getAllCandidateEndorsements() {
  const stored = await getStoredCandidateEndorsements();
  const source = stored.length ? stored : seededCandidateEndorsements;

  return [...source].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getEndorsementForUserInElection(userId: string, electionId: string) {
  const endorsements = await getAllCandidateEndorsements();
  return endorsements.find((endorsement) => endorsement.userId === userId && endorsement.electionId === electionId) ?? null;
}

export async function attachEndorsementsToCampaigns(campaigns: CandidateCampaignSummary[], viewerId?: string) {
  const endorsements = await getAllCandidateEndorsements();

  return campaigns.map((campaign) => {
    const campaignEndorsements = endorsements.filter((endorsement) => endorsement.candidateCampaignId === campaign.id);
    const visibleEndorsers: VisibleCandidateEndorserSummary[] = campaignEndorsements
      .filter((endorsement) => endorsement.isPublic)
      .slice(0, 4)
      .flatMap((endorsement) => {
        const user = seedUsers.find((entry) => entry.id === endorsement.userId);

        if (!user) {
          return [];
        }

        return [
          {
            userId: user.id,
            userName: user.name,
            username: user.username,
            jurisdictionName: user.jurisdictionName,
          },
        ];
      });

    return {
      ...campaign,
      endorsementCount: campaignEndorsements.length,
      visibleEndorsers,
      viewerEndorsement: viewerId
        ? campaignEndorsements.find((endorsement) => endorsement.userId === viewerId) ?? null
        : null,
      viewerElectionEndorsementCampaignId: viewerId
        ? endorsements.find((endorsement) => endorsement.userId === viewerId && endorsement.electionId === campaign.electionId)
            ?.candidateCampaignId ?? null
        : null,
    };
  });
}

export async function getPublicEndorsementsForUser(userId: string): Promise<CitizenEndorsementDisplaySummary[]> {
  const endorsements = await getAllCandidateEndorsements();

  return endorsements
    .filter((endorsement) => endorsement.userId === userId && endorsement.isPublic)
    .map((endorsement) => ({
      id: endorsement.id,
      candidateCampaignId: endorsement.candidateCampaignId,
      electionTitle: endorsement.electionTitle,
      candidateName: endorsement.candidateName,
      officeSought: endorsement.officeSought,
      jurisdictionName: seedUsers.find((entry) => entry.id === userId)?.jurisdictionName ?? "",
      createdAt: endorsement.createdAt,
    }));
}
