import { getCommunityById } from "@/lib/community/communities";
import type { PublicCitizenProfileSummary, UserSummary } from "@/types/domain";

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

export function communityMatchesMembership(
  communityId: string,
  member: Pick<PublicCitizenProfileSummary, "jurisdictionName">,
) {
  return communityMatchesJurisdiction(communityId, member.jurisdictionName);
}

export function userContentMatchesCommunity(
  communityId: string,
  user: Pick<UserSummary, "jurisdictionName">,
) {
  return communityMatchesJurisdiction(communityId, user.jurisdictionName);
}
