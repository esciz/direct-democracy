import type { AuthUser, CommunityEventType, UserRole } from "@/types/domain";

import { canCreatePublicPosts } from "@/lib/auth/roles";
import { isGuestUser } from "@/lib/auth/session";
import { isVoterVerifiedUser } from "@/lib/auth/verification";
import { canCastEqualWeightCivicVote } from "@/lib/identity/capabilities";

export function requirePublicPostCreator(role: UserRole) {
  return canCreatePublicPosts(role);
}

export async function canUserCreateCommunityEvent(user: AuthUser) {
  if (isGuestUser(user)) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return user.role === "citizen" || canCreatePublicPosts(user.role);
}

export function getDirectCreateEventTypesForUser(user: Pick<AuthUser, "role">): CommunityEventType[] {
  if (user.role === "citizen") {
    return ["communityEvent", "culturalSocialEvent"];
  }

  return ["civicMeeting", "publicHearing", "demonstration", "rally", "communityEvent", "culturalSocialEvent"];
}

export function getProposableEventTypesForUser(user: Pick<AuthUser, "role">): CommunityEventType[] {
  if (user.role === "citizen") {
    return ["civicMeeting", "publicHearing", "demonstration", "rally"];
  }

  return [];
}

export function canUserDirectlyCreateEventType(user: Pick<AuthUser, "role">, eventType: CommunityEventType) {
  return getDirectCreateEventTypesForUser(user).includes(eventType);
}

export function canUserProposeEventType(user: Pick<AuthUser, "role">, eventType: CommunityEventType) {
  return getProposableEventTypesForUser(user).includes(eventType);
}

export function canUserApproveEventProposal(user: Pick<AuthUser, "role">) {
  return user.role === "trustedCitizen" || user.role === "admin";
}

export function canUserCommentOnPosts(user: Pick<AuthUser, "role">) {
  return user.role === "trustedCitizen" || user.role === "candidate" || user.role === "official";
}

export function canUserVote(user: Pick<AuthUser, "verificationState" | "isVerifiedVoter">) {
  if (isVoterVerifiedUser(user)) return true;
  if ("id" in user && "role" in user) return canCastEqualWeightCivicVote(user as AuthUser);
  return false;
}

export function canUserSignPetitions(user: Pick<AuthUser, "verificationState" | "isVerifiedVoter">) {
  return isVoterVerifiedUser(user);
}

export function canUserMessagePublicFigures(user: Pick<AuthUser, "verificationState" | "isVerifiedVoter">) {
  return isVoterVerifiedUser(user);
}

type TruthGateUser = Pick<AuthUser, "role"> & Partial<Pick<AuthUser, "verificationState" | "isVerifiedVoter">>;

function hasVerifiedAccess(user: Partial<Pick<AuthUser, "verificationState" | "isVerifiedVoter">>) {
  if (typeof user.verificationState === "undefined" || typeof user.isVerifiedVoter === "undefined") {
    return true;
  }

  return isVoterVerifiedUser(user as Pick<AuthUser, "verificationState" | "isVerifiedVoter">);
}

export function canUserRateTruth(user: TruthGateUser) {
  return hasVerifiedAccess(user) && (user.role === "trustedCitizen" || user.role === "candidate" || user.role === "official");
}

export function canUserFlagFactualClaim(user: TruthGateUser) {
  return hasVerifiedAccess(user) && user.role === "trustedCitizen";
}

export function canUserCreateDebate(user: TruthGateUser) {
  return hasVerifiedAccess(user) && user.role === "trustedCitizen";
}

export function canUserTagDebateFallacies(user: TruthGateUser) {
  return hasVerifiedAccess(user) && user.role === "trustedCitizen";
}
