import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import { inferIdeologicalLeaningLabel } from "@/lib/profile/ideology";
import { isGuestUserId } from "@/lib/auth/session";
import type { AuthUser, FollowSummary, IssueFollowSummary, UserSocialSummary } from "@/types/domain";
import { buildTrustedProgressForUser } from "@/lib/social/trusted-status";

const FOLLOWS_COOKIE = "dd_social_follows";
const REMOVED_FOLLOWS_COOKIE = "dd_removed_social_follows";
const ISSUE_FOLLOWS_COOKIE = "dd_issue_follows";

export type FollowerSnapshotSummary = {
  visibleFollowerCount: number;
  ideologicalMix: Array<{
    label: string;
    count: number;
    percentage: number;
  }>;
  reachBreakdown: Array<{
    label: string;
    count: number;
    percentage: number;
  }>;
  topJurisdictions: Array<{
    label: string;
    count: number;
  }>;
};

const seededFollows: FollowSummary[] = [
  {
    id: "follow_seed_1",
    followerUserId: "user_citizen_alicia_hart",
    followingUserId: "user_candidate_owen_castillo",
    createdAt: "2026-03-21T12:10:00.000Z",
  },
  {
    id: "follow_seed_2",
    followerUserId: "user_citizen_alicia_hart",
    followingUserId: "user_official_elena_ramirez",
    createdAt: "2026-03-21T12:12:00.000Z",
  },
  {
    id: "follow_seed_3",
    followerUserId: "user_citizen_miles_reed",
    followingUserId: "user_official_david_park",
    createdAt: "2026-03-22T09:15:00.000Z",
  },
  {
    id: "follow_seed_4",
    followerUserId: "user_citizen_tiana_moore",
    followingUserId: "user_candidate_sofia_bennett",
    createdAt: "2026-03-22T10:30:00.000Z",
  },
  {
    id: "follow_seed_5",
    followerUserId: "user_trusted_citizen_marco_silva",
    followingUserId: "user_official_elena_ramirez",
    createdAt: "2026-03-22T11:20:00.000Z",
  },
  {
    id: "follow_seed_6",
    followerUserId: "user_trusted_citizen_hannah_cho",
    followingUserId: "user_official_david_park",
    createdAt: "2026-03-22T12:05:00.000Z",
  },
  {
    id: "follow_seed_7",
    followerUserId: "user_candidate_sofia_bennett",
    followingUserId: "user_official_elena_ramirez",
    createdAt: "2026-03-23T08:50:00.000Z",
  },
  {
    id: "follow_seed_8",
    followerUserId: "user_candidate_owen_castillo",
    followingUserId: "user_trusted_citizen_marco_silva",
    createdAt: "2026-03-23T09:20:00.000Z",
  },
  {
    id: "follow_seed_9",
    followerUserId: "user_official_elena_ramirez",
    followingUserId: "user_candidate_sofia_bennett",
    createdAt: "2026-03-23T10:10:00.000Z",
  },
  {
    id: "follow_seed_10",
    followerUserId: "user_official_david_park",
    followingUserId: "user_trusted_citizen_hannah_cho",
    createdAt: "2026-03-23T10:25:00.000Z",
  },
  {
    id: "follow_seed_11",
    followerUserId: "user_citizen_tiana_moore",
    followingUserId: "user_candidate_maya_ortega",
    createdAt: "2026-03-24T09:10:00.000Z",
  },
  {
    id: "follow_seed_12",
    followerUserId: "user_trusted_citizen_nora_patel",
    followingUserId: "user_candidate_ava_marquette",
    createdAt: "2026-03-24T09:25:00.000Z",
  },
  {
    id: "follow_seed_13",
    followerUserId: "user_trusted_citizen_nora_patel",
    followingUserId: "user_candidate_maya_ortega",
    createdAt: "2026-03-24T09:27:00.000Z",
  },
  {
    id: "follow_seed_14",
    followerUserId: "user_citizen_alicia_hart",
    followingUserId: "user_candidate_ava_marquette",
    createdAt: "2026-03-24T10:05:00.000Z",
  },
  {
    id: "follow_seed_15",
    followerUserId: "user_citizen_miles_reed",
    followingUserId: "user_candidate_cole_wyatt",
    createdAt: "2026-03-24T10:18:00.000Z",
  },
  {
    id: "follow_seed_16",
    followerUserId: "user_candidate_sofia_bennett",
    followingUserId: "user_candidate_maya_ortega",
    createdAt: "2026-03-24T11:00:00.000Z",
  },
  {
    id: "follow_seed_17",
    followerUserId: "user_official_elena_ramirez",
    followingUserId: "user_candidate_ava_marquette",
    createdAt: "2026-03-24T11:12:00.000Z",
  },
  {
    id: "follow_seed_18",
    followerUserId: "user_candidate_maya_ortega",
    followingUserId: "user_trusted_citizen_nora_patel",
    createdAt: "2026-03-24T11:25:00.000Z",
  },
];

function isFollowSummary(value: unknown): value is FollowSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const follow = value as Record<string, unknown>;
  return (
    typeof follow.id === "string" &&
    typeof follow.followerUserId === "string" &&
    typeof follow.followingUserId === "string" &&
    typeof follow.createdAt === "string"
  );
}

export async function getStoredFollows(): Promise<FollowSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FOLLOWS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFollowSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredFollows(follows: FollowSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(FOLLOWS_COOKIE, JSON.stringify(follows.slice(0, 100)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getRemovedFollowKeys(): Promise<string[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(REMOVED_FOLLOWS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export async function setRemovedFollowKeys(keys: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(REMOVED_FOLLOWS_COOKIE, JSON.stringify(keys.slice(0, 100)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getAllFollows() {
  const removedKeys = new Set(await getRemovedFollowKeys());
  const merged = new Map<string, FollowSummary>();

  for (const follow of seededFollows) {
    const key = `${follow.followerUserId}:${follow.followingUserId}`;

    if (!removedKeys.has(key)) {
      merged.set(key, follow);
    }
  }

  for (const follow of await getStoredFollows()) {
    merged.set(`${follow.followerUserId}:${follow.followingUserId}`, follow);
  }

  return [...merged.values()];
}

function isIssueFollowSummary(value: unknown): value is IssueFollowSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const follow = value as Record<string, unknown>;

  return (
    typeof follow.id === "string" &&
    typeof follow.userId === "string" &&
    typeof follow.issueId === "string" &&
    typeof follow.createdAt === "string"
  );
}

export async function getStoredIssueFollows(): Promise<IssueFollowSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ISSUE_FOLLOWS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isIssueFollowSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredIssueFollows(follows: IssueFollowSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(ISSUE_FOLLOWS_COOKIE, JSON.stringify(follows.slice(0, 150)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getIssueFollowState(userId: string, issueId: string) {
  const follows = await getStoredIssueFollows();
  return {
    viewerIsFollowing: follows.some((follow) => follow.userId === userId && follow.issueId === issueId),
    followCount: follows.filter((follow) => follow.issueId === issueId).length,
  };
}

export async function getFollowedUserIds(userId: string) {
  const follows = await getAllFollows();
  return follows.filter((follow) => follow.followerUserId === userId).map((follow) => follow.followingUserId);
}

export async function getFollowerUserIds(userId: string) {
  const follows = await getAllFollows();
  return follows.filter((follow) => follow.followingUserId === userId).map((follow) => follow.followerUserId);
}

export async function getUserSocialSummary(userId: string, baseFollowerCount = 0): Promise<UserSocialSummary> {
  const follows = await getAllFollows();
  const user = seedUsers.find((entry) => entry.id === userId);

  if (!user) {
    return {
      followerCount: follows.filter((follow) => follow.followingUserId === userId).length,
      followingCount: follows.filter((follow) => follow.followerUserId === userId).length,
      trustedProgressByCommunity: [],
    };
  }

  const social = await buildTrustedProgressForUser({
    user,
    baseFollowerCount,
    follows,
  });

  return {
    followerCount: social.followerCount,
    followingCount: social.followingCount,
    trustedProgressByCommunity: social.trustedProgressByCommunity,
  };
}

export async function getFollowState(viewerUserId: string, targetUserId: string, baseFollowerCount = 0) {
  const follows = await getAllFollows();
  const social = await getUserSocialSummary(targetUserId, baseFollowerCount);

  return {
    ...social,
    viewerIsFollowing: follows.some(
      (follow) => follow.followerUserId === viewerUserId && follow.followingUserId === targetUserId,
    ),
    viewerCanFollow: viewerUserId !== targetUserId && !isGuestUserId(viewerUserId),
  };
}

export async function getLightweightFollowState(viewerUserId: string, targetUserId: string, baseFollowerCount = 0) {
  const follows = await getAllFollows();
  const followerCount =
    baseFollowerCount + follows.filter((follow) => follow.followingUserId === targetUserId).length;
  const followingCount = follows.filter((follow) => follow.followerUserId === targetUserId).length;

  return {
    followerCount,
    followingCount,
    viewerIsFollowing: follows.some(
      (follow) => follow.followerUserId === viewerUserId && follow.followingUserId === targetUserId,
    ),
    viewerCanFollow: viewerUserId !== targetUserId && !isGuestUserId(viewerUserId),
  };
}

function toPercentage(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function getReachBucket(user: AuthUser) {
  const jurisdiction = user.jurisdictionName.toLowerCase();

  if (jurisdiction.includes("united states") || jurisdiction.includes("federal") || jurisdiction.includes("national")) {
    return "National";
  }

  if (jurisdiction.includes("county") || jurisdiction.includes("district")) {
    return "County / District";
  }

  if (jurisdiction.includes(",")) {
    return "City / Local";
  }

  return "State";
}

export async function getFollowerSnapshotByUserId(userId: string): Promise<FollowerSnapshotSummary | null> {
  const followerIds = await getFollowerUserIds(userId);
  const followers = seedUsers.filter((user) => followerIds.includes(user.id));

  if (!followers.length) {
    return null;
  }

  const ideologyCounts = new Map<string, number>();
  const reachCounts = new Map<string, number>();
  const jurisdictionCounts = new Map<string, number>();

  for (const follower of followers) {
    const ideology =
      inferIdeologicalLeaningLabel({
        partyText: null,
        sourceTexts: [follower.bio ?? "", follower.jurisdictionName],
      }) ?? "Unclear";
    ideologyCounts.set(ideology, (ideologyCounts.get(ideology) ?? 0) + 1);

    const reachBucket = getReachBucket(follower);
    reachCounts.set(reachBucket, (reachCounts.get(reachBucket) ?? 0) + 1);

    jurisdictionCounts.set(follower.jurisdictionName, (jurisdictionCounts.get(follower.jurisdictionName) ?? 0) + 1);
  }

  const visibleFollowerCount = followers.length;

  return {
    visibleFollowerCount,
    ideologicalMix: [...ideologyCounts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        percentage: toPercentage(count, visibleFollowerCount),
      }))
      .sort((left, right) => right.count - left.count),
    reachBreakdown: [...reachCounts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        percentage: toPercentage(count, visibleFollowerCount),
      }))
      .sort((left, right) => right.count - left.count),
    topJurisdictions: [...jurisdictionCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 3),
  };
}
