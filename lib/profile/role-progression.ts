import { cookies } from "next/headers";

import { getRoleLabel } from "@/lib/auth/roles";
import { getUserProgression } from "@/lib/profile/progression";
import { createFolloweeRoleProgressionNotifications } from "@/lib/notifications/store";
import { getAllFollows } from "@/lib/social/follows";
import type { UserProgressionSummary, UserRole, UserRoleTransitionSummary } from "@/types/domain";

const ROLE_TRANSITIONS_COOKIE = "dd_role_transitions";

const seededRoleTransitions: UserRoleTransitionSummary[] = [
  {
    id: "role_transition_hannah_trusted",
    userId: "user_trusted_citizen_hannah_cho",
    fromRole: "citizen",
    toRole: "trustedCitizen",
    createdAt: "2026-02-18T16:00:00.000Z",
    targetProfileId: null,
  },
  {
    id: "role_transition_nora_trusted",
    userId: "user_trusted_citizen_nora_patel",
    fromRole: "citizen",
    toRole: "trustedCitizen",
    createdAt: "2026-02-26T18:30:00.000Z",
    targetProfileId: null,
  },
  {
    id: "role_transition_sofia_candidate",
    userId: "user_candidate_sofia_bennett",
    fromRole: "trustedCitizen",
    toRole: "candidate",
    createdAt: "2026-03-04T15:00:00.000Z",
    targetProfileId: "profile_sofia_bennett",
  },
  {
    id: "role_transition_maya_candidate",
    userId: "user_candidate_maya_ortega",
    fromRole: "trustedCitizen",
    toRole: "candidate",
    createdAt: "2026-03-19T12:20:00.000Z",
    targetProfileId: "profile_maya_ortega",
  },
  {
    id: "role_transition_elena_official",
    userId: "user_official_elena_ramirez",
    fromRole: "candidate",
    toRole: "official",
    createdAt: "2025-11-12T20:00:00.000Z",
    targetProfileId: "profile_elena_ramirez",
  },
  {
    id: "role_transition_david_official",
    userId: "user_official_david_park",
    fromRole: "candidate",
    toRole: "official",
    createdAt: "2025-11-18T19:15:00.000Z",
    targetProfileId: "profile_david_park",
  },
];

function isRoleTransitionSummary(value: unknown): value is UserRoleTransitionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const transition = value as Record<string, unknown>;

  return (
    typeof transition.id === "string" &&
    typeof transition.userId === "string" &&
    typeof transition.fromRole === "string" &&
    typeof transition.toRole === "string" &&
    typeof transition.createdAt === "string" &&
    (typeof transition.targetProfileId === "string" || transition.targetProfileId === null || transition.targetProfileId === undefined)
  );
}

export async function getStoredRoleTransitions(): Promise<UserRoleTransitionSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ROLE_TRANSITIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRoleTransitionSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredRoleTransitions(transitions: UserRoleTransitionSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(ROLE_TRANSITIONS_COOKIE, JSON.stringify(transitions.slice(0, 100)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getRoleTransitionsForUser(userId: string) {
  const transitions = [...seededRoleTransitions, ...(await getStoredRoleTransitions())];

  return transitions
    .filter((transition) => transition.userId === userId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function hasRoleTransition(userId: string, toRole: UserRole) {
  const transitions = await getRoleTransitionsForUser(userId);
  return transitions.some((transition) => transition.toRole === toRole);
}

export function getEffectiveUserRole(role: UserRole): UserRole {
  return role;
}

export async function recordRoleTransition({
  userId,
  userName,
  fromRole,
  toRole,
  targetProfileId = null,
  jurisdictionName,
}: {
  userId: string;
  userName: string;
  fromRole: UserRole;
  toRole: UserRole;
  targetProfileId?: string | null;
  jurisdictionName: string;
}) {
  if (await hasRoleTransition(userId, toRole)) {
    return;
  }

  const transition: UserRoleTransitionSummary = {
    id: `role_transition_${userId}_${toRole}_${Date.now()}`,
    userId,
    fromRole,
    toRole,
    createdAt: new Date().toISOString(),
    targetProfileId,
  };

  const stored = await getStoredRoleTransitions();
  await setStoredRoleTransitions([transition, ...stored]);

  if (toRole === "trustedCitizen" || toRole === "candidate" || toRole === "official") {
    await createFolloweeRoleProgressionNotifications({
      userId,
      userName,
      toRole,
      jurisdictionName,
      profileId: targetProfileId ?? null,
    });
  }
}

function getRoleAtFollowMoment(transitions: UserRoleTransitionSummary[], followedAt: string) {
  let role: UserRole = "citizen";

  for (const transition of transitions) {
    if (Date.parse(transition.createdAt) <= Date.parse(followedAt)) {
      role = transition.toRole;
    }
  }

  return role;
}

export async function getProgressionContextForViewer({
  userId,
  currentRole,
  followerCount,
  jurisdictionName,
  viewerUserId,
  highlightedRole = null,
}: {
  userId: string;
  currentRole: UserRole;
  followerCount: number;
  jurisdictionName: string;
  viewerUserId?: string;
  highlightedRole?: UserRole | null;
}): Promise<UserProgressionSummary> {
  const effectiveRole = getEffectiveUserRole(currentRole);
  const progression = await getUserProgression(effectiveRole, userId, followerCount);

  if (!viewerUserId || viewerUserId === userId) {
    return {
      ...progression,
      highlightedRole,
    };
  }

  const follows = await getAllFollows();
  const follow = follows.find((entry) => entry.followerUserId === viewerUserId && entry.followingUserId === userId);

  if (!follow) {
    return {
      ...progression,
      highlightedRole,
    };
  }

  const transitions = await getRoleTransitionsForUser(userId);
  const roleAtFollowMoment = getRoleAtFollowMoment(transitions, follow.createdAt);

  return {
    ...progression,
    highlightedRole,
    viewerConnectionLabel: `You have followed this user since they were a ${getRoleLabel(roleAtFollowMoment).toLowerCase()}.`,
  };
}
