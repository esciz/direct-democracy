import type { AuthUser } from "@/types/domain";

type RoleOnlyUser = Pick<AuthUser, "role">;

export function canUserCommentOnPostsClient(user: RoleOnlyUser) {
  return user.role === "trustedCitizen" || user.role === "candidate" || user.role === "official";
}
