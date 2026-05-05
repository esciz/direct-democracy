"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getCandidateDraftForUser, upsertCandidateDraft } from "@/lib/candidates/drafts";
import {
  getAllPublicProfiles,
  getElectionById,
  getStoredCandidateCampaigns,
  getStoredPublicProfiles,
  setStoredCandidateCampaigns,
  setStoredPublicProfiles,
} from "@/lib/server/elections-context";
import { getStoredPublicProfilePromises, setStoredPublicProfilePromises } from "@/lib/officials/promises";
import { recordRoleTransition } from "@/lib/profile/role-progression";
import type { CampaignPromiseSummary, CandidateCampaignSummary, CandidateDraftSummary, PublicProfileSummary } from "@/types/domain";

function redirectWithError(path: string, error: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${error}`);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDraftPromises(formData: FormData) {
  const nextPromises: CampaignPromiseSummary[] = [];

  for (let index = 0; index < 4; index += 1) {
    const title = formData.get(`promiseTitle${index}`);
    const description = formData.get(`promiseDescription${index}`);
    const category = formData.get(`promiseCategory${index}`);

    if (typeof title !== "string" || !title.trim()) {
      continue;
    }

    nextPromises.push({
      id: `draft_promise_${index}`,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      category: typeof category === "string" && category.trim() ? category.trim() : null,
      status: null,
      notes: null,
    });
  }

  return nextPromises;
}

async function buildNextDraft(formData: FormData, userId: string): Promise<CandidateDraftSummary> {
  const electionId = formData.get("electionId");
  const officeSought = formData.get("officeSought");
  const electionTitle = formData.get("electionTitle");
  const jurisdictionName = formData.get("jurisdictionName");
  const electionDate = formData.get("electionDate");
  const bio = formData.get("bio");

  if (
    typeof electionId !== "string" ||
    typeof officeSought !== "string" ||
    typeof electionTitle !== "string" ||
    typeof jurisdictionName !== "string" ||
    typeof electionDate !== "string"
  ) {
    redirectWithError("/run-for-office/races", "race");
  }

  const existing = await getCandidateDraftForUser(userId, electionId);
  const now = new Date().toISOString();

  return {
    id: existing?.id ?? `candidate_draft_${userId}_${electionId}`,
    userId,
    electionId,
    officeSought,
    electionTitle,
    jurisdictionName,
    electionDate,
    bio: typeof bio === "string" && bio.trim() ? bio.trim() : null,
    campaignPromises: parseDraftPromises(formData),
    isPublished: existing?.isPublished ?? false,
    publishedCandidateProfileId: existing?.publishedCandidateProfileId ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function saveCandidateDraft(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (currentUser.role !== "trustedCitizen") {
    redirect("/profile");
  }

  const nextDraft = await buildNextDraft(formData, currentUser.id);
  await upsertCandidateDraft(nextDraft);

  redirect(`/run-for-office/races/${nextDraft.electionId}?saved=draft`);
}

export async function publishCandidateDraft(formData: FormData) {
  const currentUser = await getCurrentUser();

  if (currentUser.role !== "trustedCitizen") {
    redirect("/profile");
  }

  const nextDraft = await buildNextDraft(formData, currentUser.id);
  const election = await getElectionById(nextDraft.electionId);

  if (!election) {
    redirectWithError("/run-for-office/races", "race");
  }

  const allProfiles = await getAllPublicProfiles();
  const existingCandidateProfile = allProfiles.find((profile) => profile.claimedByUserId === currentUser.id);
  const existingCampaign = (await getStoredCandidateCampaigns()).find(
    (campaign) =>
      campaign.publicProfileId === (existingCandidateProfile?.id ?? "") && campaign.electionId === nextDraft.electionId,
  );

  const publicProfileId = existingCandidateProfile?.id ?? `profile_candidate_${currentUser.id}`;
  const publicProfile: PublicProfileSummary = {
    id: publicProfileId,
    claimedByUserId: currentUser.id,
    slug: existingCandidateProfile?.slug ?? `${slugify(currentUser.name)}-candidate`,
    name: currentUser.name,
    profileType: "candidate",
    jurisdictionName: nextDraft.jurisdictionName,
    partyText: existingCandidateProfile?.partyText ?? null,
    bio: nextDraft.bio,
    profileImageUrl: existingCandidateProfile?.profileImageUrl ?? null,
    donationUrl: existingCandidateProfile?.donationUrl ?? null,
    websiteUrl: existingCandidateProfile?.websiteUrl ?? null,
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  };

  const storedProfiles = await getStoredPublicProfiles();
  await setStoredPublicProfiles([publicProfile, ...storedProfiles.filter((profile) => profile.id !== publicProfileId)]);

  if (!existingCampaign) {
    const newCampaign: CandidateCampaignSummary = {
      id: `campaign_${currentUser.id}_${nextDraft.electionId}`,
      publicProfileId,
      electionId: nextDraft.electionId,
      electionTitle: nextDraft.electionTitle,
      officeSought: nextDraft.officeSought,
      jurisdictionName: nextDraft.jurisdictionName,
      partyText: publicProfile.partyText,
      campaignStatus: "ANNOUNCED",
      donationUrl: publicProfile.donationUrl,
      websiteUrl: publicProfile.websiteUrl,
      isIncumbent: false,
      totalRaised: null,
      topDonorCategories: [],
      pollingSummary: null,
    };

    const storedCampaigns = await getStoredCandidateCampaigns();
    await setStoredCandidateCampaigns([newCampaign, ...storedCampaigns]);
  }

  const storedPromises = await getStoredPublicProfilePromises();
  storedPromises[publicProfileId] = nextDraft.campaignPromises;
  await setStoredPublicProfilePromises(storedPromises);

  await upsertCandidateDraft({
    ...nextDraft,
    isPublished: true,
    publishedCandidateProfileId: publicProfileId,
  });

  await recordRoleTransition({
    userId: currentUser.id,
    userName: currentUser.name,
    fromRole: "trustedCitizen",
    toRole: "candidate",
    targetProfileId: publicProfileId,
    jurisdictionName: nextDraft.jurisdictionName,
  });

  redirect(`/candidates/${publicProfileId}`);
}
