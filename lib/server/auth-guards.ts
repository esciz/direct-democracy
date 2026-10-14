import "server-only";

import type { AuthUser } from "@/types/domain";

import { canCreatePublicPosts } from "@/lib/auth/roles";
import { isGuestUser } from "@/lib/auth/session";
import { getAllPublicProfiles } from "@/lib/server/elections-context";

export async function canUserCreatePublicPost(user: AuthUser) {
  if (isGuestUser(user)) {
    return false;
  }

  if (!canCreatePublicPosts(user.role)) {
    return false;
  }

  if (user.role === "trustedCitizen") {
    return true;
  }

  const profiles = await getAllPublicProfiles();
  const linkedProfile = profiles.find((profile) => profile.claimedByUserId === user.id && profile.isClaimed);

  if (!linkedProfile) {
    return false;
  }

  if (user.role === "candidate") {
    return linkedProfile.profileType === "candidate" || linkedProfile.profileType === "incumbentCandidate";
  }

  if (user.role === "official") {
    return linkedProfile.profileType === "official" || linkedProfile.profileType === "incumbentCandidate";
  }

  if (user.role === "media") {
    return linkedProfile.profileType === "media";
  }

  return false;
}

export async function canUserCreatePoll(user: AuthUser) {
  if (isGuestUser(user)) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return canUserCreatePublicPost(user);
}
