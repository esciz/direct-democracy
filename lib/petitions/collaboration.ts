import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getDraftLegislationById } from "@/lib/petitions/legislation";
import { getPetitionById } from "@/lib/petitions/store";
import type { DraftLegislationDetail, LegislationChangeVote, ProposedChangeSummary } from "@/types/domain";

const PROPOSED_CHANGES_COOKIE = "dd_legislation_proposed_changes";
const PROPOSED_CHANGE_VOTES_COOKIE = "dd_legislation_change_votes";

type ProposedChangeRecord = {
  id: string;
  legislationId: string;
  userId: string;
  userName: string;
  changeText: string;
  sectionReference?: string | null;
  createdAt: string;
};

type ProposedChangeVoteRecord = {
  id: string;
  changeId: string;
  userId: string;
  vote: LegislationChangeVote;
  createdAt: string;
};

const seededChanges: ProposedChangeRecord[] = [
  {
    id: "change_meeting_access_1",
    legislationId: "draft_legislation_carson_meeting_access",
    userId: "user_citizen_alicia_hart",
    userName: "Alicia Hart",
    changeText: "Require meeting recordings to be posted within 48 hours except during declared emergencies, with a public explanation when the deadline is missed.",
    sectionReference: "Section 2 - Archive timing",
    createdAt: "2026-03-29T13:20:00.000Z",
  },
  {
    id: "change_meeting_access_2",
    legislationId: "draft_legislation_carson_meeting_access",
    userId: "user_trusted_citizen_marco_silva",
    userName: "Marco Silva",
    changeText: "Add a requirement that agenda packets and recording links appear on one mobile-friendly public page so residents do not have to search across departments.",
    sectionReference: "Section 3 - Public access",
    createdAt: "2026-03-29T17:45:00.000Z",
  },
];

const seededVotes: ProposedChangeVoteRecord[] = [
  {
    id: "change_vote_1",
    changeId: "change_meeting_access_1",
    userId: "user_citizen_tiana_moore",
    vote: "adopt",
    createdAt: "2026-03-29T18:10:00.000Z",
  },
  {
    id: "change_vote_2",
    changeId: "change_meeting_access_1",
    userId: "user_candidate_owen_castillo",
    vote: "adopt",
    createdAt: "2026-03-29T18:55:00.000Z",
  },
  {
    id: "change_vote_3",
    changeId: "change_meeting_access_1",
    userId: "user_official_elena_ramirez",
    vote: "adopt",
    createdAt: "2026-03-29T19:10:00.000Z",
  },
  {
    id: "change_vote_4",
    changeId: "change_meeting_access_2",
    userId: "user_citizen_alicia_hart",
    vote: "reject",
    createdAt: "2026-03-29T20:15:00.000Z",
  },
  {
    id: "change_vote_5",
    changeId: "change_meeting_access_2",
    userId: "user_trusted_citizen_hannah_cho",
    vote: "adopt",
    createdAt: "2026-03-29T20:40:00.000Z",
  },
];

function isProposedChangeRecord(value: unknown): value is ProposedChangeRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const change = value as Record<string, unknown>;
  return (
    typeof change.id === "string" &&
    typeof change.legislationId === "string" &&
    typeof change.userId === "string" &&
    typeof change.userName === "string" &&
    typeof change.changeText === "string" &&
    typeof change.createdAt === "string"
  );
}

function isVoteRecord(value: unknown): value is ProposedChangeVoteRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const vote = value as Record<string, unknown>;
  return (
    typeof vote.id === "string" &&
    typeof vote.changeId === "string" &&
    typeof vote.userId === "string" &&
    (vote.vote === "adopt" || vote.vote === "reject") &&
    typeof vote.createdAt === "string"
  );
}

async function readCookieArray<T>(cookieName: string, guard: (value: unknown) => value is T): Promise<T[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(cookieName)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

async function writeCookieArray<T>(cookieName: string, data: T[]) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, JSON.stringify(data), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getStoredProposedChanges() {
  return readCookieArray(PROPOSED_CHANGES_COOKIE, isProposedChangeRecord);
}

export async function setStoredProposedChanges(changes: ProposedChangeRecord[]) {
  await writeCookieArray(PROPOSED_CHANGES_COOKIE, changes.slice(0, 200));
}

export async function getStoredProposedChangeVotes() {
  return readCookieArray(PROPOSED_CHANGE_VOTES_COOKIE, isVoteRecord);
}

export async function setStoredProposedChangeVotes(votes: ProposedChangeVoteRecord[]) {
  await writeCookieArray(PROPOSED_CHANGE_VOTES_COOKIE, votes.slice(0, 400));
}

function resolveChangeStatus(adoptCount: number, rejectCount: number): ProposedChangeSummary["status"] {
  if (adoptCount >= 3 && adoptCount > rejectCount) {
    return "accepted";
  }

  if (rejectCount >= 3 && rejectCount > adoptCount) {
    return "rejected";
  }

  return "underReview";
}

export async function getDraftLegislationDetail(legislationId: string): Promise<DraftLegislationDetail | null> {
  const viewer = await getCurrentUser();
  const legislation = await getDraftLegislationById(legislationId);

  if (!legislation) {
    return null;
  }

  const petition = await getPetitionById(legislation.petitionId, viewer);
  const [storedChanges, storedVotes] = await Promise.all([getStoredProposedChanges(), getStoredProposedChangeVotes()]);
  const changes = [...storedChanges, ...seededChanges]
    .filter((change) => change.legislationId === legislationId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const votes = [...storedVotes, ...seededVotes];

  return {
    ...legislation,
    linkedPetitionTitle: petition?.title ?? "Linked petition",
    viewerCanSuggestChanges: Boolean(petition?.hasSigned),
    viewerHasSignedPetition: Boolean(petition?.hasSigned),
    proposedChanges: changes.map((change) => {
      const relatedVotes = votes.filter((vote) => vote.changeId === change.id);
      const adoptCount = relatedVotes.filter((vote) => vote.vote === "adopt").length;
      const rejectCount = relatedVotes.filter((vote) => vote.vote === "reject").length;

      return {
        id: change.id,
        legislationId,
        userId: change.userId,
        userName: change.userName,
        changeText: change.changeText,
        sectionReference: change.sectionReference ?? null,
        createdAt: change.createdAt,
        adoptCount,
        rejectCount,
        viewerVote: relatedVotes.find((vote) => vote.userId === viewer.id)?.vote ?? null,
        status: resolveChangeStatus(adoptCount, rejectCount),
      };
    }),
  };
}
