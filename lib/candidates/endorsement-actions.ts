"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getAllCandidateCampaigns, getAllPublicProfiles } from "@/lib/server/elections-context";
import {
  getAllCandidateEndorsements,
  getEndorsementForUserInElection,
  setStoredCandidateEndorsements,
} from "@/lib/candidates/endorsements";
import type { CandidateEndorsementSummary } from "@/types/domain";

function redirectWithError(path: string, error: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}endorsement=${error}`);
}

function canEndorse(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  return user.isVerifiedVoter && (user.role === "citizen" || user.role === "trustedCitizen");
}

async function persistCandidateEndorsement(candidateCampaignId: string, isPublic: boolean) {
  const currentUser = await getCurrentUser();

  if (!canEndorse(currentUser)) {
    return {
      ok: false as const,
      message: "Only verified citizens and trusted citizens can endorse candidates.",
    };
  }

  const campaigns = await getAllCandidateCampaigns();
  const campaign = campaigns.find((entry) => entry.id === candidateCampaignId);

  if (!campaign) {
    return {
      ok: false as const,
      message: "That campaign could not be found.",
    };
  }

  const [existingForElection, profiles] = await Promise.all([
    getEndorsementForUserInElection(currentUser.id, campaign.electionId),
    getAllPublicProfiles(),
  ]);
  const candidateProfile = profiles.find((profile) => profile.id === campaign.publicProfileId);
  const allEndorsements = await getAllCandidateEndorsements();
  const filtered = allEndorsements.filter((endorsement) => endorsement.id !== existingForElection?.id);
  const nextEndorsement: CandidateEndorsementSummary = {
    id: existingForElection?.id ?? `endorsement_created_${Date.now()}`,
    userId: currentUser.id,
    userName: currentUser.name,
    candidateCampaignId: campaign.id,
    electionId: campaign.electionId,
    electionTitle: campaign.electionTitle ?? campaign.officeSought,
    candidateName: candidateProfile?.name ?? "Candidate",
    officeSought: campaign.officeSought,
    isPublic,
    createdAt: new Date().toISOString(),
  };

  await setStoredCandidateEndorsements([nextEndorsement, ...filtered]);

  return {
    ok: true as const,
  };
}

export async function saveCandidateEndorsement(formData: FormData) {
  const candidateCampaignId = formData.get("candidateCampaignId");
  const returnPath = formData.get("returnPath");
  const safeReturnPath = typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/elections";

  if (typeof candidateCampaignId !== "string") {
    redirectWithError(safeReturnPath, "campaign");
  }

  const result = await persistCandidateEndorsement(candidateCampaignId, formData.get("isPublic") === "on");

  if (!result.ok) {
    redirectWithError(safeReturnPath, "not-allowed");
  }

  redirect(
    `${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}endorsement=saved`,
  );
}

export async function removeCandidateEndorsement(formData: FormData) {
  const currentUser = await getCurrentUser();
  const electionId = formData.get("electionId");
  const returnPath = formData.get("returnPath");
  const safeReturnPath = typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/elections";

  if (!canEndorse(currentUser)) {
    redirectWithError(safeReturnPath, "not-allowed");
  }

  if (typeof electionId !== "string") {
    redirectWithError(safeReturnPath, "election");
  }

  const endorsements = await getAllCandidateEndorsements();
  const nextStored = endorsements.filter(
    (endorsement) => !(endorsement.userId === currentUser.id && endorsement.electionId === electionId),
  );

  await setStoredCandidateEndorsements(nextStored);

  redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}endorsement=removed`);
}

export async function saveCandidateEndorsementInline(candidateCampaignId: string) {
  return persistCandidateEndorsement(candidateCampaignId, true);
}

export async function removeCandidateEndorsementInline(electionId: string) {
  const currentUser = await getCurrentUser();

  if (!canEndorse(currentUser)) {
    return {
      ok: false as const,
      message: "Only verified citizens and trusted citizens can endorse candidates.",
    };
  }

  const endorsements = await getAllCandidateEndorsements();
  const nextStored = endorsements.filter(
    (endorsement) => !(endorsement.userId === currentUser.id && endorsement.electionId === electionId),
  );

  await setStoredCandidateEndorsements(nextStored);

  return {
    ok: true as const,
  };
}
