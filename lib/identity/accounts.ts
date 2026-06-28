import type { AuthUser } from "@/types/domain";
import { createHash, randomBytes } from "node:crypto";

import { getAdminPermissions } from "@/lib/admin/permissions";
import { OWNER_ADMIN_DEFAULT_EMAIL, OWNER_ADMIN_USER_ID } from "@/lib/identity/constants";
import { createTotpEnrollmentSecret, decryptMfaSecret, encryptMfaSecret, generateBackupCodes, hashBackupCode, verifyRecoveryCode, verifyTotpCode } from "@/lib/identity/mfa";
import { hashPassword, verifyPassword } from "@/lib/identity/passwords";
import { createSecurityEvent, readIdentityStore, writeIdentityStore } from "@/lib/identity/storage";
import type { IdentityAccount } from "@/lib/identity/types";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function slugifyUsername(email: string) {
  return email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "citizen";
}

function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function accountToAuthUser(account: IdentityAccount): AuthUser {
  const isVerifiedVoter = readIdentityStore().verificationClaims.some(
    (claim) =>
      claim.userId === account.id &&
      claim.claimType === "voter" &&
      claim.status === "matched" &&
      (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now()),
  );
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    username: account.username,
    bio: account.role === "admin" || account.role === "platform_admin" ? "Public-platform administrator." : "Direct Democracy account.",
    role: account.role,
    verificationState: isVerifiedVoter ? "voterVerified" : "unverified",
    jurisdictionName: "Nevada",
    followerCount: 0,
    isVerifiedVoter,
    isAnonymousPublic: account.role !== "admin" && account.role !== "platform_admin",
  };
}

export function getIdentityAccountById(userId: string | null | undefined) {
  if (!userId) return null;
  return readIdentityStore().accounts.find((account) => account.id === userId) ?? null;
}

export function getIdentityAccountByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return readIdentityStore().accounts.find((account) => account.email.toLowerCase() === normalized) ?? null;
}

export function createLocalAccount(input: {
  email: string;
  name: string;
  password: string;
  role?: IdentityAccount["role"];
  emailVerified?: boolean;
  mustChangePassword?: boolean;
  mfaEnrollmentRequired?: boolean;
}) {
  const store = readIdentityStore();
  const email = input.email.trim().toLowerCase();
  if (store.accounts.some((account) => account.email.toLowerCase() === email)) {
    throw new Error("account_exists");
  }

  const timestamp = nowIso();
  const account: IdentityAccount = {
    id: `identity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email,
    name: input.name.trim(),
    username: slugifyUsername(email),
    role: input.role ?? "citizen",
    status: "active",
    emailVerificationStatus: input.emailVerified ? "verified" : "unverified",
    emailVerificationRequest: null,
    passwordHash: hashPassword(input.password),
    mustChangePassword: input.mustChangePassword ?? false,
    mfaEnrollmentRequired: input.mfaEnrollmentRequired ?? false,
    mfaEnrolledAt: null,
    mfaEnabled: false,
    mfaEncryptedSecret: null,
    mfaPendingEnrollment: null,
    mfaRecoveryCodes: [],
    mfaLastAcceptedCounterHash: null,
    mfaFailedAttempts: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: null,
    disabledAt: null,
  };

  store.accounts.push(account);
  store.securityEvents.unshift({
    id: `security_${Date.now()}_account`,
    type: "account_created",
    userId: account.id,
    actorUserId: null,
    createdAt: timestamp,
    summary: "Account created.",
    metadata: { emailVerified: account.emailVerificationStatus === "verified" },
  });
  writeIdentityStore(store);
  return account;
}

export function bootstrapOwnerAdmin(email: string, temporaryPassword: string) {
  const store = readIdentityStore();
  const normalized = email.trim().toLowerCase();
  const existing = store.accounts.find((account) => account.email.toLowerCase() === normalized || account.id === OWNER_ADMIN_USER_ID);
  if (existing) {
    if (existing.email.toLowerCase() !== normalized || existing.role !== "admin") {
      throw new Error("owner_exists_with_different_configuration");
    }
    return { account: existing, created: false };
  }

  const timestamp = nowIso();
  const account: IdentityAccount = {
    id: OWNER_ADMIN_USER_ID,
    email: normalized,
    name: "Owner Admin",
    username: "owner-admin",
    role: "admin",
    status: "active",
    emailVerificationStatus: "verified",
    emailVerificationRequest: null,
    passwordHash: hashPassword(temporaryPassword),
    mustChangePassword: true,
    mfaEnrollmentRequired: true,
    mfaEnrolledAt: null,
    mfaEnabled: false,
    mfaEncryptedSecret: null,
    mfaPendingEnrollment: null,
    mfaRecoveryCodes: [],
    mfaLastAcceptedCounterHash: null,
    mfaFailedAttempts: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: null,
    disabledAt: null,
  };
  store.accounts.push(account);
  for (const permission of getAdminPermissions({ role: "admin" })) {
    store.permissionGrants.push({
      id: `perm_${Date.now()}_${permission.replace(/[^a-z0-9]/gi, "_")}`,
      userId: account.id,
      permission,
      grantedBy: "bootstrap",
      grantedAt: timestamp,
      revokedAt: null,
    });
  }
  store.sessions.push({ id: `session_${Date.now()}_bootstrap`, userId: account.id, createdAt: timestamp, revokedAt: null, reason: null });
  store.securityEvents.unshift({
    id: `security_${Date.now()}_bootstrap`,
    type: "admin_bootstrap",
    userId: account.id,
    actorUserId: "bootstrap",
    createdAt: timestamp,
    summary: "Development owner admin bootstrapped.",
    metadata: { passwordPersistedPlaintext: false, mfaEnrollmentRequired: true, mustChangePassword: true },
  });
  writeIdentityStore(store);
  return { account, created: true };
}

export function authenticateLocalAccount(email: string, password: string) {
  const store = readIdentityStore();
  const normalized = email.trim().toLowerCase();
  const account = store.accounts.find((entry) => entry.email.toLowerCase() === normalized);
  const genericFailure = { ok: false as const, reason: "invalid_credentials" as const, account: null };

  if (!account) return genericFailure;
  if (account.status !== "active" || account.disabledAt) return { ok: false as const, reason: "disabled" as const, account };
  if (account.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now()) {
    return { ok: false as const, reason: "locked" as const, account };
  }

  if (!verifyPassword(password, account.passwordHash)) {
    account.failedLoginAttempts += 1;
    if (account.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
      account.status = "locked";
      account.lockedUntil = new Date(Date.now() + LOCKOUT_MS).toISOString();
    }
    account.updatedAt = nowIso();
    writeIdentityStore(store);
    createSecurityEvent("login_failed", "Login failed.", { userId: account.id, metadata: { reason: "invalid_credentials" } });
    return genericFailure;
  }

  account.failedLoginAttempts = 0;
  account.lockedUntil = null;
  account.status = "active";
  account.lastLoginAt = nowIso();
  account.updatedAt = nowIso();
  store.sessions.unshift({ id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, userId: account.id, createdAt: nowIso(), revokedAt: null, reason: null });
  writeIdentityStore(store);
  createSecurityEvent("login_succeeded", "Login succeeded.", { userId: account.id });
  return { ok: true as const, account };
}

export function changeLocalPassword(userId: string, currentPassword: string, nextPassword: string) {
  const store = readIdentityStore();
  const account = store.accounts.find((entry) => entry.id === userId);
  if (!account) return { ok: false as const, reason: "missing_account" as const };
  if (!verifyPassword(currentPassword, account.passwordHash)) return { ok: false as const, reason: "invalid_current_password" as const };
  account.passwordHash = hashPassword(nextPassword);
  account.mustChangePassword = false;
  account.updatedAt = nowIso();
  for (const session of store.sessions) {
    if (session.userId === userId && !session.revokedAt) {
      session.revokedAt = nowIso();
      session.reason = "password_changed";
    }
  }
  store.securityEvents.unshift({
    id: `security_${Date.now()}_password_changed`,
    type: "password_changed",
    userId: account.id,
    actorUserId: account.id,
    createdAt: nowIso(),
    summary: "Password changed and prior sessions revoked.",
    metadata: { priorSessionsRevoked: true, resetTokensInvalidated: true },
  });
  writeIdentityStore(store);
  return { ok: true as const, account };
}

export function createEmailVerificationRequest(userId: string) {
  const store = readIdentityStore();
  const account = store.accounts.find((entry) => entry.id === userId);
  if (!account) return { ok: false as const, reason: "missing_account" as const };
  if (account.emailVerificationStatus === "verified") return { ok: true as const, alreadyVerified: true as const, account };

  const token = randomBytes(32).toString("base64url");
  const timestamp = nowIso();
  account.emailVerificationRequest = {
    tokenHash: hashEmailVerificationToken(token),
    createdAt: timestamp,
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString(),
    deliveryStatus: "pending",
  };
  account.updatedAt = timestamp;
  store.securityEvents.unshift({
    id: `security_${Date.now()}_email_verification_started`,
    type: "verification_status_changed",
    userId: account.id,
    actorUserId: account.id,
    createdAt: timestamp,
    summary: "Email verification requested.",
    metadata: { emailVerificationStatus: account.emailVerificationStatus },
  });
  writeIdentityStore(store);
  return { ok: true as const, alreadyVerified: false as const, account, token, expiresAt: account.emailVerificationRequest.expiresAt };
}

export function updateEmailVerificationDeliveryStatus(userId: string, deliveryStatus: NonNullable<IdentityAccount["emailVerificationRequest"]>["deliveryStatus"]) {
  const store = readIdentityStore();
  const account = store.accounts.find((entry) => entry.id === userId);
  if (!account?.emailVerificationRequest) return { ok: false as const, reason: "missing_request" as const };
  account.emailVerificationRequest.deliveryStatus = deliveryStatus;
  account.updatedAt = nowIso();
  writeIdentityStore(store);
  return { ok: true as const, account };
}

export function verifyAccountEmailToken(token: string) {
  const tokenHash = hashEmailVerificationToken(token.trim());
  const store = readIdentityStore();
  const account = store.accounts.find((entry) => entry.emailVerificationRequest?.tokenHash === tokenHash);
  if (!account?.emailVerificationRequest) return { ok: false as const, reason: "token_invalid" as const };
  if (new Date(account.emailVerificationRequest.expiresAt).getTime() <= Date.now()) {
    account.emailVerificationRequest = null;
    account.updatedAt = nowIso();
    writeIdentityStore(store);
    return { ok: false as const, reason: "token_expired" as const };
  }

  account.emailVerificationStatus = "verified";
  account.emailVerificationRequest = null;
  account.updatedAt = nowIso();
  store.securityEvents.unshift({
    id: `security_${Date.now()}_email_verified`,
    type: "verification_status_changed",
    userId: account.id,
    actorUserId: account.id,
    createdAt: nowIso(),
    summary: "Email address verified.",
    metadata: { emailVerificationStatus: "verified" },
  });
  writeIdentityStore(store);
  return { ok: true as const, account };
}

export function getAccountSecurityGate(account: IdentityAccount | null | undefined) {
  if (!account) return { fullAccess: false, reason: "missing_account" as const };
  if (account.status !== "active" || account.emailVerificationStatus !== "verified") {
    return { fullAccess: false, reason: "inactive_or_unverified" as const };
  }
  if (account.mustChangePassword) return { fullAccess: false, reason: "password_rotation_required" as const };
  if (account.mfaEnrollmentRequired && !account.mfaEnrolledAt) return { fullAccess: false, reason: "mfa_enrollment_required" as const };
  if (account.mfaEnabled && !account.mfaEnrolledAt) return { fullAccess: false, reason: "mfa_enrollment_required" as const };
  return { fullAccess: true, reason: "ok" as const };
}

export function startMfaEnrollment(userId: string) {
  const store = readIdentityStore();
  const account = store.accounts.find((entry) => entry.id === userId);
  if (!account) return { ok: false as const, reason: "missing_account" as const };
  const now = Date.now();
  const existing = account.mfaPendingEnrollment;
  if (existing && new Date(existing.expiresAt).getTime() > now && existing.failedAttempts < 5) {
    return { ok: true as const, encryptedSecret: existing.encryptedSecret, created: false };
  }
  const secret = createTotpEnrollmentSecret().secret;
  const encryptedSecret = encryptMfaSecret(secret);
  account.mfaPendingEnrollment = {
    encryptedSecret,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    failedAttempts: 0,
  };
  account.updatedAt = nowIso();
  store.securityEvents.unshift({
    id: `security_${Date.now()}_mfa_started`,
    type: "mfa_enrollment_started",
    userId: account.id,
    actorUserId: account.id,
    createdAt: nowIso(),
    summary: "MFA enrollment started.",
    metadata: { secretEncrypted: true },
  });
  writeIdentityStore(store);
  return { ok: true as const, encryptedSecret, created: true };
}

export function confirmMfaEnrollment(userId: string, code: string) {
  const store = readIdentityStore();
  const account = store.accounts.find((entry) => entry.id === userId);
  if (!account) return { ok: false as const, reason: "missing_account" as const };
  const pending = account.mfaPendingEnrollment;
  if (!pending) return { ok: false as const, reason: "missing_enrollment" as const };
  if (new Date(pending.expiresAt).getTime() <= Date.now()) {
    account.mfaPendingEnrollment = null;
    writeIdentityStore(store);
    return { ok: false as const, reason: "enrollment_expired" as const };
  }
  if (pending.failedAttempts >= 5) return { ok: false as const, reason: "rate_limited" as const };
  const secret = decryptMfaSecret(pending.encryptedSecret);
  const verification = verifyTotpCode({ secret, code, lastAcceptedCounterHash: account.mfaLastAcceptedCounterHash ?? null });
  if (!verification.ok) {
    pending.failedAttempts += 1;
    account.mfaFailedAttempts = (account.mfaFailedAttempts ?? 0) + 1;
    account.updatedAt = nowIso();
    store.securityEvents.unshift({
      id: `security_${Date.now()}_mfa_failed`,
      type: "mfa_challenge_failed",
      userId: account.id,
      actorUserId: account.id,
      createdAt: nowIso(),
      summary: "MFA enrollment confirmation failed.",
      metadata: { reason: verification.reason, attempts: pending.failedAttempts },
    });
    writeIdentityStore(store);
    return { ok: false as const, reason: verification.reason };
  }
  const recoveryCodes = generateBackupCodes();
  account.mfaEncryptedSecret = pending.encryptedSecret;
  account.mfaPendingEnrollment = null;
  account.mfaEnabled = true;
  account.mfaEnrollmentRequired = false;
  account.mfaEnrolledAt = nowIso();
  account.mfaLastAcceptedCounterHash = verification.counterHash;
  account.mfaFailedAttempts = 0;
  account.mfaRecoveryCodes = recoveryCodes.map((recoveryCode) => ({
    id: `mfa_recovery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    codeHash: hashBackupCode(recoveryCode),
    createdAt: nowIso(),
    usedAt: null,
  }));
  account.updatedAt = nowIso();
  for (const session of store.sessions) {
    if (session.userId === userId && !session.revokedAt) {
      session.revokedAt = nowIso();
      session.reason = "mfa_enrolled_session_rotated";
    }
  }
  store.sessions.unshift({ id: `session_${Date.now()}_mfa`, userId, createdAt: nowIso(), revokedAt: null, reason: null, mfaVerifiedAt: nowIso() });
  store.securityEvents.unshift({
    id: `security_${Date.now()}_mfa_completed`,
    type: "mfa_enrollment_completed",
    userId: account.id,
    actorUserId: account.id,
    createdAt: nowIso(),
    summary: "MFA enrollment completed.",
    metadata: { recoveryCodesStoredHashed: true, sessionRotated: true },
  });
  writeIdentityStore(store);
  return { ok: true as const, recoveryCodes };
}

export function verifyMfaChallenge(userId: string, code: string) {
  const store = readIdentityStore();
  const account = store.accounts.find((entry) => entry.id === userId);
  if (!account) return { ok: false as const, reason: "missing_account" as const };
  if (!account.mfaEnabled || !account.mfaEncryptedSecret) return { ok: false as const, reason: "mfa_not_enabled" as const };
  if ((account.mfaFailedAttempts ?? 0) >= 8) return { ok: false as const, reason: "rate_limited" as const };
  const secret = decryptMfaSecret(account.mfaEncryptedSecret);
  const verification = verifyTotpCode({ secret, code, lastAcceptedCounterHash: account.mfaLastAcceptedCounterHash ?? null });
  let recoveryCodeUsed = false;
  if (!verification.ok) {
    const recovery = account.mfaRecoveryCodes?.find((entry) => !entry.usedAt && verifyRecoveryCode(code, entry.codeHash));
    if (!recovery) {
      account.mfaFailedAttempts = (account.mfaFailedAttempts ?? 0) + 1;
      account.updatedAt = nowIso();
      store.securityEvents.unshift({
        id: `security_${Date.now()}_mfa_challenge_failed`,
        type: "mfa_challenge_failed",
        userId: account.id,
        actorUserId: account.id,
        createdAt: nowIso(),
        summary: "MFA challenge failed.",
        metadata: { attempts: account.mfaFailedAttempts },
      });
      writeIdentityStore(store);
      return { ok: false as const, reason: verification.reason };
    }
    recovery.usedAt = nowIso();
    recoveryCodeUsed = true;
  } else {
    account.mfaLastAcceptedCounterHash = verification.counterHash;
  }
  account.mfaFailedAttempts = 0;
  store.sessions.unshift({ id: `session_${Date.now()}_mfa_challenge`, userId, createdAt: nowIso(), revokedAt: null, reason: null, mfaVerifiedAt: nowIso() });
  store.securityEvents.unshift({
    id: `security_${Date.now()}_mfa_challenge_succeeded`,
    type: "mfa_challenge_succeeded",
    userId: account.id,
    actorUserId: account.id,
    createdAt: nowIso(),
    summary: "MFA challenge succeeded.",
    metadata: { recoveryCodeUsed },
  });
  writeIdentityStore(store);
  return { ok: true as const, recoveryCodeUsed };
}

export function resetAccountMfa(email: string) {
  const store = readIdentityStore();
  const matches = store.accounts.filter((entry) => entry.email.toLowerCase() === email.trim().toLowerCase());
  if (matches.length !== 1) return { ok: false as const, reason: "ambiguous_or_missing_account" as const };
  const account = matches[0];
  account.mfaEnabled = false;
  account.mfaEncryptedSecret = null;
  account.mfaPendingEnrollment = null;
  account.mfaRecoveryCodes = [];
  account.mfaLastAcceptedCounterHash = null;
  account.mfaFailedAttempts = 0;
  account.mfaEnrollmentRequired = true;
  account.mfaEnrolledAt = null;
  account.updatedAt = nowIso();
  for (const session of store.sessions) {
    if (session.userId === account.id && !session.revokedAt) {
      session.revokedAt = nowIso();
      session.reason = "mfa_reset";
    }
  }
  store.securityEvents.unshift({
    id: `security_${Date.now()}_mfa_reset`,
    type: "mfa_reset",
    userId: account.id,
    actorUserId: "trusted_terminal",
    createdAt: nowIso(),
    summary: "MFA reset from trusted terminal.",
    metadata: { sessionsRevoked: true, passwordPreserved: true },
  });
  writeIdentityStore(store);
  return { ok: true as const, account };
}

export function changeAdminEmailFromTerminal(from: string, to: string) {
  const store = readIdentityStore();
  const matches = store.accounts.filter((entry) => entry.email.toLowerCase() === from.trim().toLowerCase());
  if (matches.length !== 1) return { ok: false as const, reason: "ambiguous_or_missing_account" as const };
  if (store.accounts.some((entry) => entry.email.toLowerCase() === to.trim().toLowerCase())) {
    return { ok: false as const, reason: "target_email_exists" as const };
  }
  const account = matches[0];
  account.email = to.trim().toLowerCase();
  account.emailVerificationStatus = "verified";
  account.updatedAt = nowIso();
  for (const session of store.sessions) {
    if (session.userId === account.id && !session.revokedAt) {
      session.revokedAt = nowIso();
      session.reason = "email_changed";
    }
  }
  store.securityEvents.unshift({
    id: `security_${Date.now()}_email_changed`,
    type: "email_changed",
    userId: account.id,
    actorUserId: "trusted_terminal",
    createdAt: nowIso(),
    summary: "Admin email changed from trusted terminal.",
    metadata: { sessionsRevoked: true, mfaPreserved: Boolean(account.mfaEnabled) },
  });
  writeIdentityStore(store);
  return { ok: true as const, account };
}

export function revokeUserSessions(userId: string, reason: string) {
  const store = readIdentityStore();
  const timestamp = nowIso();
  for (const session of store.sessions) {
    if (session.userId === userId && !session.revokedAt) {
      session.revokedAt = timestamp;
      session.reason = reason;
    }
  }
  writeIdentityStore(store);
  createSecurityEvent("session_revoked", "Sessions revoked.", { userId, metadata: { reason } });
}

export function isIdentityAdminSessionAllowed(userId: string | null | undefined) {
  const account = getIdentityAccountById(userId);
  return Boolean(account && account.status === "active" && account.emailVerificationStatus === "verified" && (account.role === "admin" || account.role === "platform_admin"));
}
