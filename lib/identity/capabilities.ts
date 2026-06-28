import type { AuthUser, UserRole } from "@/types/domain";

import { isGuestUser } from "@/lib/auth/session";
import { isVoterVerifiedUser } from "@/lib/auth/verification";
import { readIdentityStore } from "@/lib/identity/storage";

export type CivicCapability =
  | "browse_public_civic_information"
  | "manage_own_account"
  | "manage_own_profile"
  | "begin_verification"
  | "vote_on_eligible_civic_questions"
  | "participate_in_eligible_civic_discussions"
  | "create_debates"
  | "comment_publicly"
  | "submit_evidence"
  | "curate_evidence"
  | "flag_content"
  | "moderate_limited_community_spaces"
  | "access_government_tools"
  | "access_public_platform_admin_tools";

export type VerificationClass = "anonymous_public" | "authenticated_unverified" | "verified_resident" | "verified_voter";

export const CAPABILITY_POLICY_VERSION = "identity-capability-policy-v1";

const publicCapabilities: CivicCapability[] = ["browse_public_civic_information"];
const accountCapabilities: CivicCapability[] = [...publicCapabilities, "manage_own_account", "manage_own_profile", "begin_verification"];
const verifiedCapabilities: CivicCapability[] = [
  ...accountCapabilities,
  "vote_on_eligible_civic_questions",
  "participate_in_eligible_civic_discussions",
  "submit_evidence",
];
const trustedCapabilities: CivicCapability[] = [
  ...verifiedCapabilities,
  "create_debates",
  "comment_publicly",
  "curate_evidence",
  "flag_content",
  "moderate_limited_community_spaces",
];

export const ROLE_CAPABILITY_MATRIX: Record<UserRole | "anonymous", CivicCapability[]> = {
  anonymous: publicCapabilities,
  public_user: publicCapabilities,
  citizen: accountCapabilities,
  verified_resident: verifiedCapabilities,
  trustedCitizen: trustedCapabilities,
  candidate: [...verifiedCapabilities, "comment_publicly"],
  official: [...verifiedCapabilities, "comment_publicly"],
  media: [...verifiedCapabilities, "comment_publicly"],
  moderator: [...trustedCapabilities],
  admin: [...trustedCapabilities, "access_public_platform_admin_tools"],
  platform_admin: [...trustedCapabilities, "access_public_platform_admin_tools"],
  government_admin: [...accountCapabilities, "access_government_tools"],
  government_staff: [...accountCapabilities, "access_government_tools"],
  government_observer: [...accountCapabilities, "access_government_tools"],
};

export function getVerificationClass(user: AuthUser | null): VerificationClass {
  if (!user || isGuestUser(user)) return "anonymous_public";
  if (isVoterVerifiedUser(user)) return "verified_voter";
  const store = readIdentityStore();
  const voterClaim = store.verificationClaims.find(
    (claim) => claim.userId === user.id && claim.claimType === "voter" && claim.status === "matched" && (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now()),
  );
  if (voterClaim) return "verified_voter";
  const residentClaim = store.verificationClaims.find(
    (claim) => claim.userId === user.id && claim.claimType === "residency" && claim.status === "verified" && (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now()),
  );
  if (residentClaim || user.role === "verified_resident") return "verified_resident";
  return "authenticated_unverified";
}

export function getCapabilitiesForUser(user: AuthUser | null): CivicCapability[] {
  if (!user || isGuestUser(user)) return ROLE_CAPABILITY_MATRIX.anonymous;
  const capabilities = new Set<CivicCapability>(ROLE_CAPABILITY_MATRIX[user.role] ?? accountCapabilities);
  const verificationClass = getVerificationClass(user);
  if (verificationClass === "verified_resident" || verificationClass === "verified_voter") {
    for (const capability of verifiedCapabilities) capabilities.add(capability);
  }
  const trustedGrant = readIdentityStore().trustedCitizenGrants.find((grant) => grant.userId === user.id && grant.status === "active");
  if (trustedGrant) {
    for (const capability of trustedGrant.capabilities as CivicCapability[]) capabilities.add(capability);
  }
  return [...capabilities];
}

export function hasCivicCapability(user: AuthUser | null, capability: CivicCapability) {
  return getCapabilitiesForUser(user).includes(capability);
}

export function canCastEqualWeightCivicVote(user: AuthUser | null) {
  return hasCivicCapability(user, "vote_on_eligible_civic_questions");
}

export function getVoteEligibilitySnapshot(user: AuthUser) {
  const verificationClass = getVerificationClass(user);
  return {
    verificationClass,
    jurisdictionName: user.jurisdictionName,
    policyVersion: CAPABILITY_POLICY_VERSION,
    voteWeight: 1,
    hiddenWeighting: false,
  };
}
