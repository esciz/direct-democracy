import "server-only";

import { cookies } from "next/headers";

import { getSeedUserById, seedUsers } from "@/lib/auth/mock-users";
import { evaluateVerificationTrust } from "@/lib/auth/trust";
import { isGuestUser } from "@/lib/auth/session";
import { getCommunityById, seededCommunities } from "@/lib/community/communities";
import { getCanonicalIssueTitles } from "@/lib/issues/utils";
import { getSeedVoterIdentityRecord, type VerificationMatchStatus } from "@/lib/onboarding/voter-provider";
import { getAllPublicProfiles } from "@/lib/server/elections-context";
import type {
  AuthUser,
  CandidateOfficialMatchStatus,
  ContactVerificationStatus,
  EnhancedIdentityStatus,
  ManualReviewStatus,
  PublicProfileSummary,
  UserRole,
  VerificationMatchConfidence,
  VerificationRiskFlag,
} from "@/types/domain";

const ONBOARDING_DRAFT_COOKIE = "dd_onboarding_draft";

export type ClaimMatchStatus = "eligible" | "needsReview" | "notMatched";
export type ClaimActionState = "public" | "continueClaim" | "reviewMatch" | "hidden";

export type OnboardingDraft = {
  accountName?: string;
  accountEmail?: string;
  emailVerificationStatus?: ContactVerificationStatus;
  phoneNumber?: string;
  phoneVerificationStatus?: ContactVerificationStatus;
  antiBotScreened?: boolean;
  legalFirstName?: string;
  legalLastName?: string;
  dateOfBirth?: string;
  streetAddress?: string;
  state?: string;
  jurisdictionName?: string;
  selectedCommunityId?: string;
  topIssueTitles?: string[];
  claimTargetProfileId?: string | null;
  verificationStatus?: VerificationMatchStatus;
  voterMatchConfidence?: VerificationMatchConfidence;
  matchedVoterRecordName?: string | null;
  matchedPublicProfileId?: string | null;
  matchedPublicProfileRole?: "candidate" | "official" | null;
  candidateOfficialMatchStatus?: CandidateOfficialMatchStatus;
  enhancedIdentityStatus?: EnhancedIdentityStatus;
  manualReviewStatus?: ManualReviewStatus;
  riskFlags?: VerificationRiskFlag[];
};

type PublicIdentityRecord = {
  profileId: string;
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  streetAddress: string;
  jurisdictionName: string;
};

const publicIdentityRecords: PublicIdentityRecord[] = [
  {
    profileId: "profile_daniel_rowe",
    legalFirstName: "Daniel",
    legalLastName: "Rowe",
    dateOfBirth: "1981-11-04",
    streetAddress: "405 Pine Crest Avenue",
    jurisdictionName: "Nevada",
  },
  {
    profileId: "profile_aaron_hale",
    legalFirstName: "Aaron",
    legalLastName: "Hale",
    dateOfBirth: "1978-02-18",
    streetAddress: "88 Silver Oak Drive",
    jurisdictionName: "Washoe County, Nevada",
  },
];

function normalize(value: string | undefined | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isOnboardingDraft(value: unknown): value is OnboardingDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Record<string, unknown>;
  return (
    (typeof draft.accountName === "string" || typeof draft.accountName === "undefined") &&
    (typeof draft.accountEmail === "string" || typeof draft.accountEmail === "undefined") &&
    (typeof draft.legalFirstName === "string" || typeof draft.legalFirstName === "undefined") &&
    (typeof draft.legalLastName === "string" || typeof draft.legalLastName === "undefined") &&
    (typeof draft.dateOfBirth === "string" || typeof draft.dateOfBirth === "undefined") &&
    (typeof draft.streetAddress === "string" || typeof draft.streetAddress === "undefined") &&
    (typeof draft.state === "string" || typeof draft.state === "undefined") &&
    (typeof draft.jurisdictionName === "string" || typeof draft.jurisdictionName === "undefined") &&
    (typeof draft.selectedCommunityId === "string" || typeof draft.selectedCommunityId === "undefined") &&
    (Array.isArray(draft.topIssueTitles) || typeof draft.topIssueTitles === "undefined")
  );
}

export async function getOnboardingDraft(): Promise<OnboardingDraft | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ONBOARDING_DRAFT_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return isOnboardingDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setOnboardingDraft(draft: OnboardingDraft) {
  const cookieStore = await cookies();
  cookieStore.set(ONBOARDING_DRAFT_COOKIE, JSON.stringify(draft), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearOnboardingDraft() {
  const cookieStore = await cookies();
  cookieStore.delete(ONBOARDING_DRAFT_COOKIE);
}

export function resolveOnboardingSeedUserId(fullName: string) {
  const normalized = normalize(fullName);

  if (normalized === "daniel rowe") {
    return "user_citizen_daniel_rowe";
  }

  if (normalized === "aaron hale") {
    return "user_citizen_aaron_hale";
  }

  return "user_citizen_casey_rivera";
}

export async function getMatchedPublicProfileForIdentity(draft: OnboardingDraft | null): Promise<PublicProfileSummary | null> {
  if (!draft?.legalFirstName || !draft.legalLastName || !draft.dateOfBirth || !draft.streetAddress || !draft.jurisdictionName) {
    return null;
  }

  const profiles = await getAllPublicProfiles();
  const exact = publicIdentityRecords.find(
    (record) =>
      normalize(record.legalFirstName) === normalize(draft.legalFirstName) &&
      normalize(record.legalLastName) === normalize(draft.legalLastName) &&
      record.dateOfBirth === draft.dateOfBirth &&
      normalize(record.streetAddress) === normalize(draft.streetAddress) &&
      normalize(record.jurisdictionName) === normalize(draft.jurisdictionName),
  );

  if (!exact) {
    return null;
  }

  return profiles.find((profile) => profile.id === exact.profileId) ?? null;
}

export async function getClaimMatchForProfile(profileId: string, user: AuthUser | null, draft: OnboardingDraft | null) {
  const profiles = await getAllPublicProfiles();
  const profile = profiles.find((entry) => entry.id === profileId) ?? null;

  if (!profile) {
    return {
      profile: null,
      status: "notMatched" as ClaimMatchStatus,
      matchedRole: null as UserRole | null,
    };
  }

  if (profile.claimedByUserId && user?.id === profile.claimedByUserId) {
    return {
      profile,
      status: "eligible" as ClaimMatchStatus,
      matchedRole: profile.profileType === "official" ? ("official" as const) : ("candidate" as const),
    };
  }

  if (!user || !draft) {
    return {
      profile,
      status: "notMatched" as ClaimMatchStatus,
      matchedRole: null as UserRole | null,
    };
  }

  const strong = publicIdentityRecords.find(
    (record) =>
      record.profileId === profileId &&
      normalize(record.legalFirstName) === normalize(draft.legalFirstName) &&
      normalize(record.legalLastName) === normalize(draft.legalLastName) &&
      record.dateOfBirth === draft.dateOfBirth &&
      normalize(record.streetAddress) === normalize(draft.streetAddress) &&
      normalize(record.jurisdictionName) === normalize(draft.jurisdictionName) &&
      draft.verificationStatus === "strongMatch",
  );

  if (strong) {
    return {
      profile,
      status: "eligible" as ClaimMatchStatus,
      matchedRole: profile.profileType === "official" ? ("official" as const) : ("candidate" as const),
    };
  }

  const partial = publicIdentityRecords.find(
    (record) =>
      record.profileId === profileId &&
      normalize(record.legalFirstName) === normalize(draft.legalFirstName) &&
      normalize(record.legalLastName) === normalize(draft.legalLastName) &&
      normalize(record.jurisdictionName) === normalize(draft.jurisdictionName),
  );

  return {
    profile,
    status: partial ? ("needsReview" as ClaimMatchStatus) : ("notMatched" as ClaimMatchStatus),
    matchedRole: null as UserRole | null,
  };
}

export function buildCandidateOfficialMatchStatus(
  verificationStatus: VerificationMatchStatus | undefined,
  matchedProfile: PublicProfileSummary | null,
) {
  if (!matchedProfile) {
    return "none" as CandidateOfficialMatchStatus;
  }

  if (verificationStatus === "strongMatch") {
    return "strongMatch" as CandidateOfficialMatchStatus;
  }

  if (verificationStatus === "possibleMatch") {
    return "possibleMatch" as CandidateOfficialMatchStatus;
  }

  return "none" as CandidateOfficialMatchStatus;
}

export function buildOnboardingTrustSummary(draft: OnboardingDraft | null) {
  return evaluateVerificationTrust({
    emailStatus: draft?.emailVerificationStatus ?? (draft?.accountEmail ? "verified" : "unverified"),
    phoneStatus: draft?.phoneVerificationStatus ?? "pending",
    antiBotScreened: draft?.antiBotScreened ?? Boolean(draft?.accountEmail),
    voterMatchStatus: draft?.verificationStatus === "strongMatch" ? "voterVerified" : "unverified",
    voterMatchConfidence: draft?.voterMatchConfidence ?? "none",
    enhancedIdentityStatus: draft?.enhancedIdentityStatus ?? (draft?.verificationStatus === "possibleMatch" ? "recommended" : "notNeeded"),
    manualReviewStatus: draft?.manualReviewStatus ?? (draft?.verificationStatus && draft.verificationStatus !== "strongMatch" ? "available" : "notNeeded"),
    candidateOfficialMatchStatus:
      draft?.candidateOfficialMatchStatus ??
      (draft?.matchedPublicProfileId
        ? draft.verificationStatus === "strongMatch"
          ? "strongMatch"
          : draft.verificationStatus === "sourceUnavailable"
            ? "none"
            : "possibleMatch"
        : "none"),
    suspiciousSignals: draft?.riskFlags ?? [],
    trustedCitizenSignalsStrong: draft?.verificationStatus === "strongMatch",
  });
}

export function getClaimActionStateForViewer(
  user: AuthUser | null,
  claimMatch: { status: ClaimMatchStatus } | null,
): {
  state: ClaimActionState;
  label: string;
} {
  if (!user || isGuestUser(user)) {
    return {
      state: "public",
      label: "Claim This Profile",
    };
  }

  if (claimMatch?.status === "eligible") {
    return {
      state: "continueClaim",
      label: "Continue Claim",
    };
  }

  if (claimMatch?.status === "needsReview") {
    return {
      state: "reviewMatch",
      label: "Review Claim Match",
    };
  }

  return {
    state: "hidden",
    label: "Claim This Profile",
  };
}

export function getCanonicalOnboardingIssues() {
  return getCanonicalIssueTitles().slice(0, 8);
}

export function getOnboardingCommunities() {
  return seededCommunities.filter((community) => community.communityType === "geographic");
}

export function getCommunityLabel(communityId: string | undefined) {
  return getCommunityById(communityId)?.name ?? "Choose a community";
}

export function buildRoleMatchSummary(profile: PublicProfileSummary | null) {
  if (!profile) {
    return null;
  }

  return {
    title: profile.name,
    profileId: profile.id,
    roleLabel: profile.profileType === "official" ? "Official profile" : "Candidate profile",
    jurisdictionName: profile.jurisdictionName,
  };
}

export function getEffectiveRoleFromClaim(profile: PublicProfileSummary | null): UserRole | null {
  if (!profile?.isClaimed || !profile.claimedByUserId) {
    return null;
  }

  if (profile.profileType === "official") {
    return "official";
  }

  if (profile.profileType === "candidate" || profile.profileType === "incumbentCandidate") {
    return "candidate";
  }

  return null;
}

export function getSeedUserIdentityRecord(userId: string) {
  return getSeedVoterIdentityRecord(userId);
}

export function getOnboardingJurisdictionFromCommunity(communityId: string | undefined) {
  return getCommunityById(communityId)?.primaryJurisdictionName ?? "";
}
