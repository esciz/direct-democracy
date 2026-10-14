import { GUEST_BROWSE_USER_ID } from "@/lib/auth/constants";
import { seedUsers } from "@/lib/auth/mock-users";
import type { AuthUser } from "@/types/domain";

export type FeedViewerContext = Pick<AuthUser, "id" | "role" | "jurisdictionName" | "isVerifiedVoter">;

export function isGuestUser(user: Pick<AuthUser, "id"> | null | undefined) {
  return user?.id === GUEST_BROWSE_USER_ID;
}

export function isGuestUserId(userId: string | null | undefined) {
  return userId === GUEST_BROWSE_USER_ID;
}

export function getAllSeedUsers() {
  return seedUsers;
}
