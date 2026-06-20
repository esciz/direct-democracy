import "server-only";

import { cookies } from "next/headers";

import { applyPreviewContextToUser, getActivePreviewContext } from "@/lib/admin-preview/context";
import { MOCK_AUTH_COOKIE, PUBLIC_SESSION_VALUE } from "@/lib/auth/constants";
import { getDefaultSeedUser, getSeedUserById } from "@/lib/auth/mock-users";
import type { FeedViewerContext } from "@/lib/auth/session";
import { getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
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
    primaryCommunityId: profileContent.primaryCommunityId ?? getDefaultCommunityForJurisdiction(user.jurisdictionName)?.id ?? null,
  };
}

export async function getRawCurrentSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(MOCK_AUTH_COOKIE)?.value;

  if (!userId || userId === PUBLIC_SESSION_VALUE) {
    return null;
  }

  const seededUser = getSeedUserById(userId);

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
  const cookieStore = await cookies();
  const previewContext = await getActivePreviewContext();
  const userId = cookieStore.get(MOCK_AUTH_COOKIE)?.value;
  const seededUser = userId && userId !== PUBLIC_SESSION_VALUE ? getSeedUserById(userId) ?? getDefaultSeedUser() : getDefaultSeedUser();
  const previewUser = applyPreviewContextToUser(seededUser, previewContext) ?? getSeedUserById("user_guest_browse") ?? seededUser;

  return {
    id: previewUser.id,
    role: previewUser.role,
    jurisdictionName: previewUser.jurisdictionName,
    isVerifiedVoter: previewUser.isVerifiedVoter,
  };
}
