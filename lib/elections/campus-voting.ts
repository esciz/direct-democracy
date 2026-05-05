import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/server/auth-session";
import { isVoterVerifiedUser } from "@/lib/auth/verification";
import { getElectionById } from "@/lib/server/elections-context";
import type { CampusElectionVoteSummary, ElectionSummary } from "@/types/domain";

const CAMPUS_ELECTION_VOTES_COOKIE = "dd_campus_election_votes";

const seededCampusElectionVotes: CampusElectionVoteSummary[] = [
  {
    id: "campus_vote_hannah_jasmine",
    electionId: "election_unr_student_government_2026",
    candidateCampaignId: "campaign_jasmine_unr_2026",
    userId: "user_trusted_citizen_hannah_cho",
    createdAt: "2026-04-04T11:00:00.000Z",
  },
];

function isCampusElectionVoteSummary(value: unknown): value is CampusElectionVoteSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const vote = value as Record<string, unknown>;

  return (
    typeof vote.id === "string" &&
    typeof vote.electionId === "string" &&
    typeof vote.candidateCampaignId === "string" &&
    typeof vote.userId === "string" &&
    typeof vote.createdAt === "string"
  );
}

export async function getStoredCampusElectionVotes() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CAMPUS_ELECTION_VOTES_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCampusElectionVoteSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredCampusElectionVotes(votes: CampusElectionVoteSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(CAMPUS_ELECTION_VOTES_COOKIE, JSON.stringify(votes.slice(0, 300)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getAllCampusElectionVotes() {
  const merged = new Map<string, CampusElectionVoteSummary>();

  for (const vote of seededCampusElectionVotes) {
    merged.set(`${vote.electionId}:${vote.userId}`, vote);
  }

  for (const vote of await getStoredCampusElectionVotes()) {
    merged.set(`${vote.electionId}:${vote.userId}`, vote);
  }

  return [...merged.values()];
}

export async function canUserVoteInCampusElection(election: ElectionSummary) {
  const user = await getCurrentUser();

  if (!election.isCommunityVoteOnly || !election.communityId) {
    return false;
  }

  if (!isVoterVerifiedUser(user)) {
    return false;
  }

  return user.primaryCommunityId === election.communityId || user.campusCommunityIds?.includes(election.communityId);
}

export async function getCampusElectionVoteState(electionId: string, viewerUserId?: string) {
  const election = await getElectionById(electionId);

  if (!election || !election.isCommunityVoteOnly) {
    return null;
  }

  const votes = (await getAllCampusElectionVotes()).filter((vote) => vote.electionId === electionId);
  const totalVotes = votes.length;
  const viewerVote = viewerUserId ? votes.find((vote) => vote.userId === viewerUserId)?.candidateCampaignId ?? null : null;
  const candidateTotals = election.candidates.map((campaign) => {
    const count = votes.filter((vote) => vote.candidateCampaignId === campaign.id).length;

    return {
      candidateCampaignId: campaign.id,
      count,
      percentage: totalVotes ? Math.round((count / totalVotes) * 100) : 0,
    };
  });

  return {
    totalVotes,
    viewerVote,
    candidateTotals,
  };
}
