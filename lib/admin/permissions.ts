import { redirect } from "next/navigation";

import type { AuthUser } from "@/types/domain";
import { readIdentityStore } from "@/lib/identity/storage";

export type AdminPermission =
  | "dataops.view"
  | "dataops.run"
  | "dataops.retry"
  | "dataops.cancel"
  | "dataops.reprocess"
  | "dataops.import"
  | "dataops.bootstrap_session"
  | "dataops.manage_sources"
  | "dataops.manage_schedules"
  | "dataops.view_sensitive_logs"
  | "review.view"
  | "review.approve"
  | "security.manage_admins"
  | "identity.view"
  | "identity.manage"
  | "verification.view"
  | "verification.review"
  | "verification.revoke"
  | "verification.view_sensitive"
  | "claims.review"
  | "trusted_citizen.manage"
  | "privacy.requests"
  | "security.events";

const IDENTITY_PERMISSIONS: AdminPermission[] = [
  "identity.view",
  "identity.manage",
  "verification.view",
  "verification.review",
  "verification.revoke",
  "verification.view_sensitive",
  "claims.review",
  "trusted_citizen.manage",
  "privacy.requests",
  "security.events",
];

export class AdminAuthError extends Error {
  status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.status = status;
  }
}

export const ADMIN_ROLE_PERMISSIONS: Record<string, AdminPermission[]> = {
  admin: [
    "dataops.view",
    "dataops.run",
    "dataops.retry",
    "dataops.cancel",
    "dataops.reprocess",
    "dataops.import",
    "dataops.bootstrap_session",
    "dataops.manage_sources",
    "dataops.manage_schedules",
    "dataops.view_sensitive_logs",
    "review.view",
    "review.approve",
    "security.manage_admins",
    ...IDENTITY_PERMISSIONS,
  ],
  platform_admin: [
    "dataops.view",
    "dataops.run",
    "dataops.retry",
    "dataops.cancel",
    "dataops.reprocess",
    "dataops.import",
    "dataops.bootstrap_session",
    "dataops.manage_sources",
    "dataops.manage_schedules",
    "dataops.view_sensitive_logs",
    "review.view",
    "review.approve",
    "security.manage_admins",
    ...IDENTITY_PERMISSIONS,
  ],
};

export function getAdminPermissions(user: Pick<AuthUser, "role">): AdminPermission[] {
  return ADMIN_ROLE_PERMISSIONS[user.role] ?? [];
}

export function hasAdminPermission(user: Pick<AuthUser, "role">, permission: AdminPermission) {
  return getAdminPermissions(user).includes(permission);
}

export function hasAdminDashboardPermission(user: Pick<AuthUser, "id" | "role"> | null | undefined, permission: AdminPermission = "dataops.view") {
  if (!user) return false;
  if (hasAdminPermission(user, permission)) return true;

  return readIdentityStore().permissionGrants.some(
    (grant) => grant.userId === user.id && grant.permission === permission && !grant.revokedAt,
  );
}

export async function requireAdminSession(permission: AdminPermission = "dataops.view") {
  const { getCurrentSessionUser } = await import("@/lib/server/auth-session");
  const user = await getCurrentSessionUser();

  if (!user) {
    throw new AdminAuthError("Authentication required.", 401);
  }

  const { cookies } = await import("next/headers");
  const { MOCK_AUTH_COOKIE, DEV_ONLY_AUTH_ENABLED } = await import("@/lib/auth/constants");
  const { resolveDurableSession } = await import("@/lib/identity/durable-sessions");
  const { durableAdminSecurityGate } = await import("@/lib/identity/session-tokens");
  const cookieStore = await cookies();
  const session = await resolveDurableSession(cookieStore.get(MOCK_AUTH_COOKIE)?.value);
  if (session) {
    const account = session.account;
    if (session.accountId !== user.id || account.emailVerificationStatus !== "verified") {
      throw new AdminAuthError("Active verified admin account required.", 403);
    }
    const permitted = hasAdminPermission({ role: account.role as AuthUser["role"] }, permission)
      || account.permissionGrants.some((grant) => grant.permission === permission);
    if (!permitted) throw new AdminAuthError("Admin permission required.", 403);
    const gate = durableAdminSecurityGate(session);
    if (gate !== "ok") throw new AdminAuthError(gate, 403);
  } else {
    // Explicit demo profiles remain isolated from durable accounts and permission grants.
    const { getSeedUserById } = await import("@/lib/auth/mock-users");
    const demoUser = DEV_ONLY_AUTH_ENABLED ? getSeedUserById(cookieStore.get(MOCK_AUTH_COOKIE)?.value) : null;
    if (!demoUser || demoUser.id !== user.id || !hasAdminPermission(demoUser, permission)) {
      throw new AdminAuthError("Admin permission required.", 403);
    }
  }

  return user;
}

export async function requireAdminPage(permission: AdminPermission = "dataops.view") {
  try {
    return await requireAdminSession(permission);
  } catch (error) {
    if (error instanceof AdminAuthError && error.status === 401) redirect("/auth");
    if (error instanceof AdminAuthError && error.message === "password_rotation_required") redirect("/account/security/change-password");
    if (error instanceof AdminAuthError && error.message === "mfa_enrollment_required") redirect("/account/security/mfa/enroll");
    if (error instanceof AdminAuthError && error.message === "mfa_challenge_required") redirect("/account/security/mfa/challenge");
    redirect("/");
  }
}

export function adminSecurityPosture() {
  return {
    sessionCookie: {
      httpOnly: true,
      sameSite: "lax",
      secureInProduction: true,
      source: "existing demo/session cookie layer",
    },
    mfa: {
      enforced: true,
      boundary: "Identity-backed admins require TOTP enrollment and a signed MFA session before admin access.",
    },
    verifiedEmail: {
      enforced: true,
      boundary: "Durable local identity admins require verified email; seed/demo admin remains a legacy development fixture.",
    },
    csrf: {
      sameSiteCookie: true,
      serverActions: true,
      apiRequiresAdminSession: true,
      note: "State-changing admin APIs require same-origin authenticated admin sessions; no browser-controlled role fields are trusted.",
    },
  };
}
