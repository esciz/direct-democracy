import { seedUsers } from "@/lib/auth/mock-users";
import { getAllComments } from "@/lib/feed/comments";
import { getFeedPosts } from "@/lib/feed/posts";
import { mockPollVotes } from "@/lib/mock-data";
import { getAllPolls, getStoredPollVotes } from "@/lib/polls/store";
import { getUserProfileContent } from "@/lib/profile/details";
import { getAllTruthRatings } from "@/lib/truth/ratings";
import { getAllCommunityEvents } from "@/lib/community/events";
import { getAllEventAttendance, getAllEventStatements } from "@/lib/community/event-participation";
import {
  getCommunityById,
  getCommunityByJurisdictionName,
  getDefaultCommunityForUser,
  seededCommunities,
} from "@/lib/community/communities";
import { userContentMatchesCommunity } from "@/lib/community/membership";
import { getAllDebateTurnsForTrust, getAllDebateReactionsForTrust } from "@/lib/debates/store";
import type {
  AuthUser,
  CommunitySummary,
  CommunityTrustScope,
  FollowSummary,
  TrustedCommunityProgressSummary,
} from "@/types/domain";

const ENGAGEMENT_REQUIREMENTS: Record<CommunityTrustScope, { percent: number; minimum: number }> = {
  campus: { percent: 0.03, minimum: 3 },
  local: { percent: 0.03, minimum: 3 },
  state: { percent: 0.02, minimum: 5 },
  national: { percent: 0.01, minimum: 25 },
};

function getCommunityTrustScope(community: CommunitySummary): CommunityTrustScope {
  if (community.communityType === "campus") {
    return "campus";
  }

  if (community.scope === "state") {
    return "state";
  }

  if (community.scope === "national") {
    return "national";
  }

  return "local";
}

function getFollowerTarget(scope: CommunityTrustScope, userCount: number) {
  switch (scope) {
    case "campus":
      return Math.max(1, Math.min(300, Math.ceil(userCount * 0.01)));
    case "local":
      return Math.max(1, Math.min(500, Math.ceil(userCount * 0.01)));
    case "state":
      return Math.max(1, Math.min(2500, Math.ceil(userCount * 0.005)));
    case "national":
      return 10000;
    default:
      return 500;
  }
}

function getCommunityLabel(scope: CommunityTrustScope, community: CommunitySummary) {
  if (scope === "campus") {
    return `${community.shortName} campus`;
  }

  return community.name;
}

function getUniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isUserAboveCitizenRole(user: AuthUser) {
  return user.role === "trustedCitizen" || user.role === "candidate" || user.role === "official";
}

function shouldTreatAsAlreadyTrusted(user: AuthUser, scope: CommunityTrustScope) {
  if (!isUserAboveCitizenRole(user)) {
    return false;
  }

  if (scope === "national") {
    return user.jurisdictionName === "United States" || user.primaryCommunityId === "united-states";
  }

  return true;
}

async function getRelevantTrustedCommunities(user: AuthUser) {
  const profileContent = await getUserProfileContent(user.id);
  const communities: CommunitySummary[] = [];
  const seenIds = new Set<string>();

  const addCommunity = (community: CommunitySummary | undefined) => {
    if (!community || seenIds.has(community.id)) {
      return;
    }

    communities.push(community);
    seenIds.add(community.id);
  };

  for (const campusId of profileContent.campusCommunityIds) {
    addCommunity(getCommunityById(campusId));
  }

  const primaryCommunity = getDefaultCommunityForUser(user);
  if (primaryCommunity.communityType === "geographic" && primaryCommunity.scope === "local") {
    addCommunity(primaryCommunity);
  }

  addCommunity(
    seededCommunities.find(
      (community) =>
        community.communityType === "geographic" &&
        community.scope === "state" &&
        community.jurisdictionMatches.includes(user.jurisdictionName),
    ),
  );

  addCommunity(getCommunityByJurisdictionName("United States") ?? getCommunityById("united-states"));

  return {
    communities,
    profileContent,
  };
}

async function getCommunityUserCounts(communities: CommunitySummary[]) {
  const profiles = await Promise.all(seedUsers.map((seedUser) => getUserProfileContent(seedUser.id)));

  return new Map(
    communities.map((community) => [
      community.id,
      seedUsers.filter((seedUser, index) => seedUser.role !== "admin" && userContentMatchesCommunity(community.id, seedUser, profiles[index])).length,
    ]),
  );
}

async function getEngagedSupporterCounts(user: AuthUser, followerIds: string[]) {
  const [posts, comments, truthRatings, pollVotes, events, attendance, statements, debateTurns, debateReactions] = await Promise.all([
    getFeedPosts("forYou"),
    getAllComments(),
    getAllTruthRatings(),
    getStoredPollVotes(),
    getAllCommunityEvents(),
    getAllEventAttendance(),
    getAllEventStatements(),
    getAllDebateTurnsForTrust(),
    getAllDebateReactionsForTrust(),
  ]);

  const authoredPostIds = new Set(posts.filter((post) => post.authorId === user.id).map((post) => post.id));
  const allPolls = await getAllPolls(user.id);
  const createdPollIds = new Set(allPolls.filter((poll) => poll.creatorId === user.id).map((poll) => poll.id));

  const eventIds = new Set(events.filter((event) => event.sponsorUserId === user.id).map((event) => event.id));
  const debateTurnIds = new Set(debateTurns.filter((turn) => turn.createdByUserId === user.id).map((turn) => turn.id));
  const storedAndSeededPollVotes = [...pollVotes, ...mockPollVotes];

  const engagerIds = getUniqueValues([
    ...comments.filter((comment) => authoredPostIds.has(comment.postId) && comment.userId !== user.id).map((comment) => comment.userId),
    ...truthRatings.filter((rating) => authoredPostIds.has(rating.entityId) && rating.userId !== user.id).map((rating) => rating.userId),
    ...storedAndSeededPollVotes.filter((vote) => createdPollIds.has(vote.pollId) && vote.userId !== user.id).map((vote) => vote.userId),
    ...attendance.filter((entry) => eventIds.has(entry.eventId) && entry.userId !== user.id).map((entry) => entry.userId),
    ...statements.filter((entry) => eventIds.has(entry.eventId) && entry.userId !== user.id).map((entry) => entry.userId),
    ...debateReactions.filter((reaction) => debateTurnIds.has(reaction.turnId) && reaction.userId !== user.id).map((reaction) => reaction.userId),
  ]);

  const actualFollowerIds = new Set(followerIds);
  const engagedFollowerIds = engagerIds.filter((engagerId) => actualFollowerIds.has(engagerId));

  return {
    observableEngagerCount: engagerIds.length,
    engagedFollowerCount: engagedFollowerIds.length,
  };
}

export async function buildTrustedProgressForUser({
  user,
  baseFollowerCount = 0,
  follows,
}: {
  user: AuthUser;
  baseFollowerCount?: number;
  follows: FollowSummary[];
}) {
  const followerIds = follows.filter((follow) => follow.followingUserId === user.id).map((follow) => follow.followerUserId);
  const followingCount = follows.filter((follow) => follow.followerUserId === user.id).length;
  const followerCount = baseFollowerCount + followerIds.length;
  const { communities } = await getRelevantTrustedCommunities(user);
  const [communityUserCounts, engagementCounts] = await Promise.all([
    getCommunityUserCounts(communities),
    getEngagedSupporterCounts(user, followerIds),
  ]);

  const trustedProgressByCommunity: TrustedCommunityProgressSummary[] = communities.map((community) => {
    const scope = getCommunityTrustScope(community);
    const userCount = communityUserCounts.get(community.id) ?? 0;
    const followerTarget = getFollowerTarget(scope, userCount);
    const engagementRule = ENGAGEMENT_REQUIREMENTS[scope];
    const engagedFollowerCount = Math.max(engagementCounts.engagedFollowerCount, engagementCounts.observableEngagerCount);
    const engagementTarget = Math.max(
      engagementRule.minimum,
      Math.ceil(Math.max(Math.min(followerCount, Math.max(followerIds.length, engagementCounts.observableEngagerCount)), 1) * engagementRule.percent),
    );
    const meetsFollowerThreshold = followerCount >= followerTarget;
    const meetsEngagementThreshold = engagedFollowerCount >= engagementTarget;
    const voterVerified = user.verificationState === "voterVerified";
    const alreadyTrusted = shouldTreatAsAlreadyTrusted(user, scope);
    const eligible = voterVerified && meetsFollowerThreshold && meetsEngagementThreshold;
    const communityLabel = getCommunityLabel(scope, community);
    const engagementRatePercent = followerCount ? Math.round((engagedFollowerCount / followerCount) * 100) : 0;

    return {
      communityId: community.id,
      communityName: communityLabel,
      communityShortName: community.shortName,
      communityScope: scope,
      communityType: community.communityType,
      currentFollowers: followerCount,
      followerTarget,
      followerProgressPercent: Math.min(100, Math.round((followerCount / followerTarget) * 100)),
      engagedFollowerCount,
      engagementTarget,
      engagementProgressPercent: Math.min(100, Math.round((engagedFollowerCount / engagementTarget) * 100)),
      engagementRatePercent,
      engagementThresholdPercent: Math.round(engagementRule.percent * 100),
      userCount,
      voterVerified,
      meetsFollowerThreshold,
      meetsEngagementThreshold,
      eligible,
      alreadyTrusted,
      explanation: !voterVerified
        ? `${communityLabel} trusted status starts after voter verification. Then you need ${followerTarget.toLocaleString()} followers and ${engagementTarget.toLocaleString()} engaged supporters.`
        : alreadyTrusted
          ? `This account already holds a higher-trust public role in ${communityLabel}. The same follower and engagement checks remain visible here for transparency.`
          : eligible
            ? `You have reached the ${communityLabel} threshold with enough follower support and engaged supporters to qualify for trusted status.`
            : `${communityLabel} trusted status requires ${followerTarget.toLocaleString()} followers and at least ${engagementTarget.toLocaleString()} engaged supporters (${Math.round(engagementRule.percent * 100)}% of your observable follower base, minimum ${engagementRule.minimum}).`,
    };
  });

  return {
    followerCount,
    followingCount,
    trustedProgressByCommunity,
  };
}

export function hasEligibleTrustedScope(trustedProgressByCommunity: TrustedCommunityProgressSummary[]) {
  return trustedProgressByCommunity.some((scope) => scope.eligible);
}
