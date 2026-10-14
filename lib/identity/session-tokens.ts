import { createHash, randomBytes } from "node:crypto";

export const IDENTITY_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const IDENTITY_MFA_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export function createIdentitySessionToken() { return `dd1_${randomBytes(32).toString("base64url")}`; }
export function isIdentitySessionToken(value: unknown): value is string { return typeof value === "string" && /^dd1_[A-Za-z0-9_-]{43}$/.test(value); }
export function hashIdentitySessionToken(value: string) {
  if (!isIdentitySessionToken(value)) throw new Error("invalid_session_token");
  return createHash("sha256").update(value).digest("hex");
}
export function sessionIsActive(session: { revokedAt: Date | null; expiresAt: Date; account: { status: string; disabledAt: Date | null } } | null, now = Date.now()) {
  return Boolean(session && !session.revokedAt && session.expiresAt.getTime() > now && session.account.status === "active" && !session.account.disabledAt);
}
export function sessionHasRecentMfa(session: { mfaAuthenticatedAt: Date | null } | null, now = Date.now()) {
  const time = session?.mfaAuthenticatedAt?.getTime();
  return typeof time === "number" && time <= now && time > now - IDENTITY_MFA_SESSION_TTL_MS;
}

export function durableAdminSecurityGate(session: { mfaAuthenticatedAt: Date | null; account: { emailVerificationStatus: string; mustChangePassword: boolean; mfaEnabled: boolean; mfaEnrollmentRequired: boolean; mfaEnrolledAt: Date | null } }) {
  if (session.account.emailVerificationStatus !== "verified") return "active_verified_account_required";
  if (session.account.mustChangePassword) return "password_rotation_required";
  if (!session.account.mfaEnabled || session.account.mfaEnrollmentRequired || !session.account.mfaEnrolledAt) return "mfa_enrollment_required";
  if (!sessionHasRecentMfa(session)) return "mfa_challenge_required";
  return "ok";
}
