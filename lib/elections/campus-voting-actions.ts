"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { canUserVoteInCampusElection, getCampusElectionVoteState, getStoredCampusElectionVotes, setStoredCampusElectionVotes } from "@/lib/elections/campus-voting";
import { getElectionById } from "@/lib/server/elections-context";
import type { CampusElectionVoteSummary } from "@/types/domain";

export async function voteInCampusElection(formData: FormData) {
  const currentUser = await getCurrentUser();
  const electionId = formData.get("electionId");
  const candidateCampaignId = formData.get("candidateCampaignId");
  const returnPath = formData.get("returnPath");
  const safeReturnPath = typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/elections";

  if (typeof electionId !== "string" || typeof candidateCampaignId !== "string") {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}campusVote=invalid`);
  }

  const election = await getElectionById(electionId);

  if (!election || !election.isCommunityVoteOnly) {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}campusVote=missing`);
  }

  if (!(await canUserVoteInCampusElection(election))) {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}campusVote=denied`);
  }

  if (!election.candidates.some((campaign) => campaign.id === candidateCampaignId)) {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}campusVote=option`);
  }

  const existingState = await getCampusElectionVoteState(electionId, currentUser.id);

  if (existingState?.viewerVote === candidateCampaignId) {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}campusVote=already`);
  }

  const existingVotes = await getStoredCampusElectionVotes();
  const nextVote: CampusElectionVoteSummary = {
    id: `campus_vote_${Date.now()}`,
    electionId,
    candidateCampaignId,
    userId: currentUser.id,
    createdAt: new Date().toISOString(),
  };

  await setStoredCampusElectionVotes([
    nextVote,
    ...existingVotes.filter((vote) => !(vote.electionId === electionId && vote.userId === currentUser.id)),
  ]);

  redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}campusVote=success`);
}
