import "server-only";

import { cookies } from "next/headers";

import { applyPreviewContextToUser, getActivePreviewContext } from "@/lib/admin-preview/context";
import { DEV_ONLY_AUTH_ENABLED, MOCK_AUTH_COOKIE, PUBLIC_SESSION_VALUE } from "@/lib/auth/constants";
import { getDefaultSeedUser, getSeedUserById } from "@/lib/auth/mock-users";
import type { FeedViewerContext } from "@/lib/auth/session";
import { getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
import { getDurableAuthUserById } from "@/lib/identity/durable-accounts";
import { resolveDurableSession } from "@/lib/identity/durable-sessions";
import { getUserProfileContent } from "@/lib/profile/details";
import { resolveUserVisibility } from "@/lib/profile/visibility";
import { resolveUserVerification } from "@/lib/server/auth-verification";
import { getAllPublicProfiles } from "@/lib/server/elections-context";
import { getEffectiveRoleFromClaim } from "@/lib/server/onboarding";
import type { AuthUser } from "@/types/domain";

async function hydrateSeedUser(seededUser: AuthUser): Promise<AuthUser> {
  const [userWithVisibility, profileContent, publicProfiles] = await Promise.all([
    resolveUserVisibility(seededUser),
    getUserProfileContent(seededUser.id),
    getAllPublicProfiles().catch(() => []),
  ]);
  const user = await resolveUserVerification(userWithVisibility);
  const claimedProfile = publicProfiles.find((profile) => profile.claimedByUserId === seededUser.id && profile.isClaimed) ?? null;
  const effectiveRole = getEffectiveRoleFromClaim(claimedProfile);

  return {
    ...user,
    role: effectiveRole ?? user.role,
    primaryCommunityId: user.primaryCommunityId ?? profileContent.primaryCommunityId ?? getDefaultCommunityForJurisdiction(user.jurisdictionName)?.id ?? null,
  };
}

export async function getRawCurrentSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(MOCK_AUTH_COOKIE)?.value;

  if (!userId || userId === PUBLIC_SESSION_VALUE) {
    return null;
  }

  const session = await resolveDurableSession(userId);
  const durableUser = session ? await getDurableAuthUserById(session.accountId) : null;

  if (durableUser) {
    return hydrateSeedUser(durableUser);
  }

  const seededUser = DEV_ONLY_AUTH_ENABLED ? getSeedUserById(userId) : null;

  if (!seededUser) {
    return null;
  }

  return hydrateSeedUser(seededUser);
}

export async function getCurrentUser(): Promise<AuthUser> {
  const previewContext = await getActivePreviewContext();
  const currentSessionUser = await getCurrentSessionUser();

  if (currentSessionUser) {
    return currentSessionUser;
  }

  if (previewContext?.role === "public") {
    return hydrateSeedUser(getSeedUserById("user_guest_browse") ?? getDefaultSeedUser());
  }

  return hydrateSeedUser(getDefaultSeedUser());
}

export async function getCurrentSessionUser(): Promise<AuthUser | null> {
  const [rawUser, previewContext] = await Promise.all([getRawCurrentSessionUser(), getActivePreviewContext()]);

  if (!rawUser) {
    return null;
  }

  return applyPreviewContextToUser(rawUser, previewContext);
}

export async function getCurrentFeedViewer(): Promise<FeedViewerContext> {
  const previewUser = await getCurrentSessionUser() ?? getSeedUserById("user_guest_browse") ?? getDefaultSeedUser();

  return {
    id: previewUser.id,
    role: previewUser.role,
    jurisdictionName: previewUser.jurisdictionName,
    isVerifiedVoter: previewUser.isVerifiedVoter,
  };
}
