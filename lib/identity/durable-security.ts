import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDurableIdentityAccountById } from "@/lib/identity/durable-accounts";
import { createTotpEnrollmentSecret, encryptMfaSecret, decryptMfaSecret, verifyTotpCode, generateBackupCodes, hashBackupCode, verifyRecoveryCode } from "@/lib/identity/mfa";
import { hashPassword, verifyPassword } from "@/lib/identity/passwords";

const pendingEnrollmentSchema = (value: Prisma.JsonValue) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.encryptedSecret !== "string" || typeof value.expiresAt !== "string" || typeof value.failedAttempts !== "number") return null;
  return { encryptedSecret: value.encryptedSecret, expiresAt: value.expiresAt, failedAttempts: value.failedAttempts };
};

export async function startDurableMfaEnrollment(accountId: string) {
  const account = await getDurableIdentityAccountById(accountId);
  if (!account || account.status !== "active" || account.disabledAt) return { ok: false as const, reason: "missing_account" };
  if (account.mfaEnabled && !account.mfaEnrollmentRequired) return { ok: false as const, reason: "already_enrolled" };
  const now = Date.now(); const existing = pendingEnrollmentSchema(account.mfaPendingEnrollment);
  if (existing && Date.parse(existing.expiresAt) > now && existing.failedAttempts < 5) return { ok: true as const, encryptedSecret: existing.encryptedSecret };
  const encryptedSecret = encryptMfaSecret(createTotpEnrollmentSecret().secret);
  const changed = await prisma.identityAccount.updateMany({ where: { id: accountId, updatedAt: account.updatedAt }, data: { mfaPendingEnrollment: { encryptedSecret, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 10 * 60_000).toISOString(), failedAttempts: 0 } } });
  if (changed.count !== 1) return { ok: false as const, reason: "retry_enrollment" };
  return { ok: true as const, encryptedSecret };
}

export async function confirmDurableMfaEnrollment(accountId: string, code: string) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.identityAccount.findUnique({ where: { id: accountId } });
    if (!account || account.status !== "active" || account.disabledAt) return { ok: false as const, reason: "missing_account" };
    const pending = pendingEnrollmentSchema(account.mfaPendingEnrollment);
    if (!pending || Date.parse(pending.expiresAt) <= Date.now() || pending.failedAttempts >= 5) return { ok: false as const, reason: "enrollment_expired_or_limited" };
    const verification = verifyTotpCode({ secret: decryptMfaSecret(pending.encryptedSecret), code, lastAcceptedCounterHash: account.mfaLastAcceptedCounterHash });
    if (!verification.ok) {
      await tx.identityAccount.updateMany({ where: { id: accountId, updatedAt: account.updatedAt }, data: { mfaPendingEnrollment: { ...pending, failedAttempts: pending.failedAttempts + 1 }, mfaFailedAttempts: { increment: 1 } } });
      return { ok: false as const, reason: verification.reason };
    }
    const recoveryCodes = generateBackupCodes(); const now = new Date();
    const changed = await tx.identityAccount.updateMany({ where: { id: accountId, updatedAt: account.updatedAt }, data: { mfaEncryptedSecret: pending.encryptedSecret, mfaPendingEnrollment: Prisma.DbNull, mfaEnabled: true, mfaEnrollmentRequired: false, mfaEnrolledAt: now, mfaLastAcceptedCounterHash: verification.counterHash, mfaFailedAttempts: 0 } });
    if (changed.count !== 1) return { ok: false as const, reason: "enrollment_changed" };
    await tx.identityMfaRecoveryCode.deleteMany({ where: { accountId } });
    await tx.identityMfaRecoveryCode.createMany({ data: recoveryCodes.map((value) => ({ id: `mfa_recovery_${randomUUID()}`, accountId, codeHash: hashBackupCode(value), createdAt: now })) });
    await tx.identitySecurityEvent.create({ data: { id: `security_${randomUUID()}`, accountId, eventType: "mfa_enrollment_completed", summary: "MFA enrollment completed.", metadata: { recoveryCodesStoredHashed: true } } });
    return { ok: true as const, recoveryCodes };
  });
}

export async function verifyDurableMfaChallenge(accountId: string, code: string) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.identityAccount.findUnique({ where: { id: accountId }, include: { mfaRecoveryCodes: { where: { usedAt: null } } } });
    if (!account || account.status !== "active" || account.disabledAt || !account.mfaEnabled) return { ok: false as const, reason: "mfa_not_enabled" };
    if (account.mfaFailedAttempts >= 8) return { ok: false as const, reason: "rate_limited" };
    // Recovery codes are independently hashed and must remain usable when the
    // encrypted authenticator secret is unavailable (for example after key loss).
    const recovery = account.mfaRecoveryCodes.find((row) => verifyRecoveryCode(code, row.codeHash));
    let verification: ReturnType<typeof verifyTotpCode> = { ok: false, reason: "invalid_format" };
    if (!recovery && /^\d{6}$/.test(code.trim().replace(/[\s-]+/g, ""))) {
      if (!account.mfaEncryptedSecret) return { ok: false as const, reason: "mfa_setup_unavailable" };
      let secret: string;
      try {
        secret = decryptMfaSecret(account.mfaEncryptedSecret);
      } catch {
        return { ok: false as const, reason: "mfa_setup_unavailable" };
      }
      verification = verifyTotpCode({ secret, code, lastAcceptedCounterHash: account.mfaLastAcceptedCounterHash });
    }
    if (!verification.ok && !recovery) {
      await tx.identityAccount.update({ where: { id: accountId }, data: { mfaFailedAttempts: { increment: 1 } } });
      return { ok: false as const, reason: verification.reason };
    }
    if (recovery) {
      const used = await tx.identityMfaRecoveryCode.updateMany({ where: { id: recovery.id, usedAt: null }, data: { usedAt: new Date() } });
      if (used.count !== 1) return { ok: false as const, reason: "replayed_code" };
    }
    const changed = await tx.identityAccount.updateMany({ where: { id: accountId, updatedAt: account.updatedAt }, data: { mfaFailedAttempts: 0, ...(verification.ok ? { mfaLastAcceptedCounterHash: verification.counterHash } : {}) } });
    if (changed.count !== 1) throw new Error("mfa_challenge_changed_retry"); // Roll back consumed recovery code as well.
    await tx.identitySecurityEvent.create({ data: { id: `security_${randomUUID()}`, accountId, eventType: "mfa_challenge_succeeded", summary: "MFA challenge succeeded.", metadata: { recoveryCodeUsed: Boolean(recovery) } } });
    return { ok: true as const };
  });
}

export async function changeDurablePassword(accountId: string, currentPassword: string, nextPassword: string) {
  const account = await getDurableIdentityAccountById(accountId); const credential = account?.credentials[0];
  if (!account || account.status !== "active" || account.disabledAt || !credential || credential.algorithm !== "scrypt") return { ok: false as const };
  const metadata = credential.metadata && typeof credential.metadata === "object" && !Array.isArray(credential.metadata) ? credential.metadata : {};
  if (!verifyPassword(currentPassword, { algorithm: "scrypt", salt: credential.salt, hash: credential.hash, keyLength: typeof metadata.keyLength === "number" ? metadata.keyLength : 64, cost: "node_crypto_scrypt", createdAt: credential.createdAt.toISOString() })) return { ok: false as const };
  const passwordHash = hashPassword(nextPassword); const now = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.identityCredential.updateMany({ where: { id: credential.id, revokedAt: null }, data: { revokedAt: now } });
    if (updated.count !== 1) throw new Error("password_changed_retry");
    await tx.identityCredential.create({ data: { id: `credential_${randomUUID()}`, accountId, credentialType: "password", algorithm: passwordHash.algorithm, salt: passwordHash.salt, hash: passwordHash.hash, metadata: { keyLength: passwordHash.keyLength, cost: passwordHash.cost }, createdAt: now } });
    await tx.identityAccount.update({ where: { id: accountId }, data: { mustChangePassword: false } });
    await tx.identitySession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: now, reason: "password_changed" } });
    await tx.identityToken.updateMany({ where: { accountId, consumedAt: null, revokedAt: null }, data: { revokedAt: now } });
    await tx.identitySecurityEvent.create({ data: { id: `security_${randomUUID()}`, accountId, eventType: "password_changed", summary: "Password changed and prior sessions revoked.", metadata: { priorSessionsRevoked: true } } });
  });
  return { ok: true as const };
}
