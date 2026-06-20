import { seedUsers } from "@/lib/auth/mock-users";
import { getCommunityHierarchy } from "@/lib/community/communities";
import { communityMatchesMembership } from "@/lib/community/membership";
import { getUserProfileContent } from "@/lib/profile/details";
import { getSafeReputationSummary } from "@/lib/profile/reputation";
import { getVisibilityOverrides } from "@/lib/profile/visibility";
import { getEffectiveUserRole } from "@/lib/profile/role-progression";
import { getLightweightFollowState } from "@/lib/social/follows";
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

    return b.followerCount - a.followerCount;
  });
}

export async function getPublicPeopleDirectory(_viewer: AuthUser) {
  const overrides = await getVisibilityOverrides();
  const visibleUsers = seedUsers
    .filter((user) => user.role === "citizen" || user.role === "trustedCitizen")
    .filter((user) => {
      const isPublic = typeof overrides[user.id] === "boolean" ? overrides[user.id] : !user.isAnonymousPublic;
      return isPublic;
    });
  const allProfiles = await Promise.all(
    visibleUsers.map(async (user) => {
      const [content, followState] = await Promise.all([
        getUserProfileContent(user.id),
        getLightweightFollowState(_viewer.id, user.id, user.followerCount),
      ]);
      const reputation = getSafeReputationSummary(user);

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: getEffectiveUserRole(user.role),
        bio: user.bio,
        profileImageUrl: content.profileImageUrl || null,
        jurisdictionName: user.jurisdictionName,
        followerCount: followState.followerCount,
        topIssuesPreview: [...content.localIssues, ...content.stateIssues, ...content.nationalIssues]
          .map((issue) => issue.value)
          .filter(Boolean)
          .slice(0, 3),
        civicCredibility: {
          label: reputation.tier === "Highly Trusted" ? "High" : reputation.tier === "Trusted" ? "Solid" : reputation.tier === "Mixed Reliability" ? "Mixed" : "Still Forming",
          summary: reputation.summary,
        },
        trustSignal: {
          label: reputation.label,
        },
        viewerIsFollowing: followState.viewerIsFollowing,
        viewerCanFollow: followState.viewerCanFollow,
      } satisfies PublicCitizenDirectorySummary;
    }),
  );

  return sortUsers(allProfiles);
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
