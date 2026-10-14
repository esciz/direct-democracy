"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import {
  getElectionById,
  getElectionSummaries,
  getStoredCandidateCampaigns,
  getStoredOfficialPositions,
  getStoredPublicProfiles,
  setStoredCandidateCampaigns,
  setStoredOfficialPositions,
  setStoredPublicProfiles,
} from "@/lib/server/elections-context";
import type { CandidateCampaignSummary, OfficialPositionSummary, PublicProfileSummary, PublicProfileType } from "@/types/domain";

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

export async function createAdminPublicProfile(formData: FormData) {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const name = formData.get("name");
  const bio = formData.get("bio");
  const jurisdictionName = formData.get("jurisdictionName");
  const profileType = formData.get("profileType");
  const donationUrl = formData.get("donationUrl");
  const websiteUrl = formData.get("websiteUrl");
  const officeTitle = formData.get("officeTitle");
  const electionId = formData.get("electionId");
  const partyText = formData.get("partyText");

  if (typeof name !== "string" || name.trim().length < 3) {
    redirectWithError("/admin/profiles", "name");
  }

  if (typeof bio !== "string" || bio.trim().length < 20) {
    redirectWithError("/admin/profiles", "bio");
  }

  if (typeof jurisdictionName !== "string" || jurisdictionName.trim().length < 3) {
    redirectWithError("/admin/profiles", "jurisdiction");
  }

  if (
    profileType !== "candidate" &&
    profileType !== "official" &&
    profileType !== "incumbentCandidate"
  ) {
    redirectWithError("/admin/profiles", "profileType");
  }

  const nextProfileType: PublicProfileType = profileType;
  const trimmedName = name.trim();
  const trimmedBio = bio.trim();
  const trimmedJurisdiction = jurisdictionName.trim();
  const trimmedDonationUrl = typeof donationUrl === "string" && donationUrl.trim() ? donationUrl.trim() : null;
  const trimmedWebsiteUrl = typeof websiteUrl === "string" && websiteUrl.trim() ? websiteUrl.trim() : null;
  const trimmedOfficeTitle = typeof officeTitle === "string" && officeTitle.trim() ? officeTitle.trim() : null;
  const trimmedPartyText = typeof partyText === "string" && partyText.trim() ? partyText.trim() : null;

  if ((nextProfileType === "official" || nextProfileType === "incumbentCandidate") && !trimmedOfficeTitle) {
    redirectWithError("/admin/profiles", "officeTitle");
  }

  if ((nextProfileType === "candidate" || nextProfileType === "incumbentCandidate") && typeof electionId !== "string") {
    redirectWithError("/admin/profiles", "election");
  }

  const safeElectionId = typeof electionId === "string" ? electionId : null;

  const profileId = `profile_created_${Date.now()}`;
  const slugBase = slugify(trimmedName);
  const publicProfile: PublicProfileSummary = {
    id: profileId,
    claimedByUserId: null,
    slug: `${slugBase}-${Date.now().toString().slice(-4)}`,
    name: trimmedName,
    profileType: nextProfileType,
    jurisdictionName: trimmedJurisdiction,
    partyText: trimmedPartyText,
    bio: trimmedBio,
    profileImageUrl: null,
    donationUrl: trimmedDonationUrl,
    websiteUrl: trimmedWebsiteUrl,
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  };

  const existingProfiles = await getStoredPublicProfiles();
  await setStoredPublicProfiles([publicProfile, ...existingProfiles]);

  if (nextProfileType === "candidate" || nextProfileType === "incumbentCandidate") {
    if (!safeElectionId) {
      redirectWithError("/admin/profiles", "election");
    }

    const election = await getElectionById(safeElectionId);

    if (!election) {
      redirectWithError("/admin/profiles", "election");
    }

    const campaign: CandidateCampaignSummary = {
      id: `campaign_created_${Date.now()}`,
      publicProfileId: profileId,
      electionId: safeElectionId,
      officeSought: election.officeTitle,
      jurisdictionName: election.jurisdictionName,
      partyText: trimmedPartyText,
      campaignStatus: "ANNOUNCED",
      donationUrl: trimmedDonationUrl,
      websiteUrl: trimmedWebsiteUrl,
      isIncumbent: nextProfileType === "incumbentCandidate",
      totalRaised: null,
      topDonorCategories: [],
      pollingSummary: null,
    };

    const campaigns = await getStoredCandidateCampaigns();
    await setStoredCandidateCampaigns([campaign, ...campaigns]);
  }

  if (nextProfileType === "official" || nextProfileType === "incumbentCandidate") {
    const position: OfficialPositionSummary = {
      id: `position_created_${Date.now()}`,
      publicProfileId: profileId,
      officeTitle: trimmedOfficeTitle ?? "Official",
      jurisdictionName: trimmedJurisdiction,
      partyText: trimmedPartyText,
      isCurrent: true,
      startedAt: null,
      endedAt: null,
    };

    const positions = await getStoredOfficialPositions();
    await setStoredOfficialPositions([position, ...positions]);
  }

  redirect("/admin/profiles?created=success");
}

export async function getAdminProfileFormOptions() {
  const elections = await getElectionSummaries();

  return {
    elections: elections.map((election) => ({
      id: election.id,
      label: `${election.officeTitle} · ${election.jurisdictionName}`,
    })),
  };
}
