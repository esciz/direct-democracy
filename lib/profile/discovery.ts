import { getCommunityHierarchy } from "@/lib/community/communities";
import { communityMatchesMembership } from "@/lib/community/membership";
import { getDurablePublicPeopleDirectory } from "@/lib/profile/public-people";
import type { AuthUser, PublicCitizenDirectorySummary } from "@/types/domain";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function roleRank(role: PublicCitizenDirectorySummary["role"]) {
  return role === "trustedCitizen" ? 2 : 1;
}

function userMatchesSearch(user: PublicCitizenDirectorySummary, query: string) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    user.name,
    user.username,
    user.bio ?? "",
    user.jurisdictionName,
    user.civicCredibility.label,
    user.trustSignal.label,
    ...user.topIssuesPreview,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function sortUsers(users: PublicCitizenDirectorySummary[]) {
  return [...users].sort((a, b) => {
    const roleDifference = roleRank(b.role) - roleRank(a.role);

    if (roleDifference !== 0) {
      return roleDifference;
    }

    return b.followerCount - a.followerCount || a.name.localeCompare(b.name);
  });
}

export async function getPublicPeopleDirectory(viewer: AuthUser) {
  return sortUsers(await getDurablePublicPeopleDirectory(viewer));
}

export async function getPeopleDiscoveryData(
  viewer: AuthUser,
  options: {
    communityId: string;
    search?: string;
  },
) {
  const allProfiles = await getPublicPeopleDirectory(viewer);
  const localProfiles = sortUsers(
    allProfiles.filter((profile) => communityMatchesMembership(options.communityId, profile)),
  );
  const hierarchy = getCommunityHierarchy(options.communityId);
  const stateCommunityId = hierarchy.find((entry) => entry.level === "State")?.id ?? "nevada";
  const stateProfiles = sortUsers(
    allProfiles.filter((profile) => communityMatchesMembership(stateCommunityId, profile)),
  ).slice(0, 6);
  const nationalProfiles = sortUsers(allProfiles).slice(0, 6);
  const nationwideResults = options.search
    ? sortUsers(allProfiles.filter((profile) => userMatchesSearch(profile, options.search ?? "")))
    : [];
  const localSearchMatches = options.search
    ? sortUsers(localProfiles.filter((profile) => userMatchesSearch(profile, options.search ?? "")))
    : [];

  return {
    localProfiles,
    stateProfiles,
    nationalProfiles,
    stateCommunityId,
    nationwideResults,
    localSearchMatches,
  };
}

