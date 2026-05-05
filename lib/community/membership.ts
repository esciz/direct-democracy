import { getCommunityById } from "@/lib/community/communities";
import type { PublicCitizenProfileSummary, UserProfileContentSummary, UserSummary } from "@/types/domain";

export function communityMatchesJurisdiction(communityId: string, jurisdictionName: string) {
  const community = getCommunityById(communityId);

  if (!community) {
    return false;
  }

  if (community.scope === "national") {
    return true;
  }

  if (community.scope === "state") {
    return jurisdictionName === community.name || jurisdictionName.includes(community.name);
  }

  return community.jurisdictionMatches.includes(jurisdictionName);
}

export function communityMatchesCampus(communityId: string, campusCommunityIds: string[] | undefined) {
  return Array.isArray(campusCommunityIds) && campusCommunityIds.includes(communityId);
}

export function communityMatchesMembership(
  communityId: string,
  member: Pick<PublicCitizenProfileSummary, "jurisdictionName" | "campusCommunityIds">,
) {
  return (
    communityMatchesJurisdiction(communityId, member.jurisdictionName) ||
    communityMatchesCampus(communityId, member.campusCommunityIds)
  );
}

export function userContentMatchesCommunity(
  communityId: string,
  user: Pick<UserSummary, "jurisdictionName">,
  profileContent: Pick<UserProfileContentSummary, "campusCommunityIds">,
) {
  return (
    communityMatchesJurisdiction(communityId, user.jurisdictionName) ||
    communityMatchesCampus(communityId, profileContent.campusCommunityIds)
  );
}
