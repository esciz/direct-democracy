import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import { getAllVoteQuestions, getStoredVoteResponses } from "@/lib/feed/quick-votes";
import { getPublicEndorsementsForUser } from "@/lib/candidates/endorsements";
import { getCreditBalance } from "@/lib/engagement/credits";
import { getCommunityGroupsForUser } from "@/lib/community/groups";
import { getRecentVotesForUser, getStructuredValueText, getUserProfileContent } from "@/lib/profile/details";
import { getEffectiveUserRole } from "@/lib/profile/role-progression";
import { getUserReputationSummary } from "@/lib/profile/reputation";
import { getFollowState } from "@/lib/social/follows";
import type { AuthUser, PublicOpinionSummary, PublicCitizenProfileSummary, VoteQuestionCategory, VoteQuestionSummary, VoteResponseSummary } from "@/types/domain";

const PUBLIC_VISIBILITY_COOKIE = "dd_public_visibility";

type VisibilityOverride = Record<string, boolean>;

function isVisibilityOverride(value: unknown): value is VisibilityOverride {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "boolean");
}

export async function getVisibilityOverrides(): Promise<VisibilityOverride> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PUBLIC_VISIBILITY_COOKIE)?.value;

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return isVisibilityOverride(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function setVisibilityOverrides(overrides: VisibilityOverride) {
  const cookieStore = await cookies();
  cookieStore.set(PUBLIC_VISIBILITY_COOKIE, JSON.stringify(overrides), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function resolveUserVisibility(user: AuthUser): Promise<AuthUser> {
  const overrides = await getVisibilityOverrides();

  if (typeof overrides[user.id] !== "boolean") {
    return user;
  }

  return {
    ...user,
    isAnonymousPublic: !overrides[user.id],
  };
}

function mergeVoteResponses(storedResponses: VoteResponseSummary[]) {
  const merged = new Map<string, VoteResponseSummary>();

  for (const response of storedResponses) {
    merged.set(`${response.questionId}:${response.userId}`, response);
  }

  return [...merged.values()];
}

function getPublicOpinionSummary(userId: string, responses: VoteResponseSummary[], questions: VoteQuestionSummary[]): PublicOpinionSummary {
  const categoryCounts: Record<VoteQuestionCategory, number> = {
    civic: 0,
    lifestyle: 0,
    identity: 0,
  };

  const userResponses = responses.filter((response) => response.userId === userId);

  userResponses.forEach((response) => {
    const question = questions.find((entry) => entry.id === response.questionId);

    if (question) {
      categoryCounts[question.category] += 1;
    }
  });

  return {
    totalVotes: userResponses.length,
    categoryCounts,
  };
}

function isPublicCitizenRole(role: AuthUser["role"]): role is PublicCitizenProfileSummary["role"] {
  return role === "citizen" || role === "trustedCitizen";
}

export async function getPublicCitizenProfiles(viewer: AuthUser): Promise<PublicCitizenProfileSummary[]> {
  const overrides = await getVisibilityOverrides();
  const [storedResponses, questions] = await Promise.all([getStoredVoteResponses(), getAllVoteQuestions()]);
  const mergedResponses = mergeVoteResponses(storedResponses);
  const visibleUsers = seedUsers
    .filter((user) => isPublicCitizenRole(user.role))
    .map((user) => ({
      ...user,
      isAnonymousPublic: typeof overrides[user.id] === "boolean" ? !overrides[user.id] : user.isAnonymousPublic,
    }))
    .filter((user) => !user.isAnonymousPublic)
    .filter((user) => mergedResponses.some((response) => response.userId === user.id));

  const profiles = await Promise.all(
    visibleUsers.map(async (user) => {
      const [followState, content, recentVotes, creditBalance, publicEndorsements, reputation] = await Promise.all([
        getFollowState(viewer.id, user.id, user.followerCount),
        getUserProfileContent(user.id),
        getRecentVotesForUser(user.id),
        getCreditBalance(user.id),
        getPublicEndorsementsForUser(user.id),
        getUserReputationSummary(user.id, { baseFollowerCount: user.followerCount }),
      ]);
      const localIssueValues = content.localIssues.map(getStructuredValueText);
      const stateIssueValues = content.stateIssues.map(getStructuredValueText);
      const nationalIssueValues = content.nationalIssues.map(getStructuredValueText);
      const groupTagValues = content.groupTags.map(getStructuredValueText);
      const publicIdentityTags = content.identityTags.filter((tag) => tag.isPublic);

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: getEffectiveUserRole(user.role),
        bio: user.bio,
        profileImageUrl: content.profileImageUrl || null,
        bannerImageUrl: content.bannerImageUrl || null,
        jurisdictionName: user.jurisdictionName,
        followerCount: followState.followerCount,
        followingCount: followState.followingCount,
        trustLevel: reputation.trustLevel,
        influenceLevel: reputation.influenceLevel,
        viewerIsFollowing: followState.viewerIsFollowing,
        viewerCanFollow: followState.viewerCanFollow,
        publicOpinionSummary: getPublicOpinionSummary(user.id, mergedResponses, questions),
        topIssuesByScope: {
          local: localIssueValues,
          state: stateIssueValues,
          national: nationalIssueValues,
        },
        topIssuesPreview: [...localIssueValues.slice(0, 1), ...stateIssueValues.slice(0, 1)].filter(Boolean),
        favoriteSpots: content.favoriteSpots,
        groupTags: groupTagValues,
        groupAffiliations: getCommunityGroupsForUser(user.id),
        background: {
          profession: content.background.professionPublic ? content.background.profession || null : null,
          experience: content.background.experiencePublic ? content.background.experience || null : null,
          politicalAffiliation: content.background.politicalAffiliationPublic ? content.background.politicalAffiliation || null : null,
        },
        publicIdentityTags,
        recentVotesPublic: content.recentVotesPublic,
        recentVotes: content.recentVotesPublic ? recentVotes : [],
        publicEndorsements,
        creditBalance,
        bookmarkedScopes: content.bookmarkedScopes,
      } satisfies PublicCitizenProfileSummary;
    }),
  );

  return profiles.sort((a, b) => b.followerCount - a.followerCount);
}
