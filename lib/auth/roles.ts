import { PUBLIC_POST_CREATOR_ROLES, ROLE_LABELS } from "@/lib/auth/constants";
import type { UserRole } from "@/types/domain";

export function canCreatePublicPosts(role: UserRole) {
  return PUBLIC_POST_CREATOR_ROLES.includes(role);
}

export function getRoleLabel(role: UserRole) {
  return ROLE_LABELS[role];
}
