import { createHash } from "node:crypto";

import { getAdminPermissions } from "@/lib/admin/permissions";
import { ensureDurableIdentitySchema, getDurableIdentityStorageStatus, isDatabaseConfigured } from "@/lib/identity/durable-storage";
import { readIdentityStore } from "@/lib/identity/storage";
import type { IdentityStore } from "@/lib/identity/types";
import { prisma } from "@/lib/prisma";

function hashSessionId(id: string) {
  return createHash("sha256").update(id).digest("hex");
}

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

function futureIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function summarizeLocalStore(local = readIdentityStore()) {
  return {
    accounts: local.accounts.length,
    sessions: local.sessions.length,
    activeSessions: local.sessions.filter((session) => !session.revokedAt).length,
    permissionGrants: local.permissionGrants.length,
    verificationClaims: local.verificationClaims.length,
    consentRecords: local.consentRecords.length,
    profileClaims: local.profileClaims.length,
    organizationAffiliations: local.organizationAffiliations.length,
    trustedCitizenGrants: local.trustedCitizenGrants.length,
    securityEvents: local.securityEvents.length,
    privacyRequests: local.privacyRequests.length,
    verificationEvidence: local.verificationEvidence.length,
    mfaEnabledAccounts: local.accounts.filter((account) => account.mfaEnabled).length,
    mfaRecoveryCodeHashes: local.accounts.reduce((count, account) => count + (account.mfaRecoveryCodes?.length ?? 0), 0),
  };
}

async function tableCount(tableName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`select count(*)::bigint as count from "${tableName}"`);
  return Number(rows[0]?.count ?? 0);
}

export async function summarizeDurableStore() {
  return {
    accounts: await tableCount("IdentityAccount"),
    credentials: await tableCount("IdentityCredential"),
    sessions: await tableCount("IdentitySession"),
    roleGrants: await tableCount("IdentityRoleGrant"),
    permissionGrants: await tableCount("IdentityPermissionGrant"),
    tokens: await tableCount("IdentityToken"),
    mfaRecoveryCodes: await tableCount("IdentityMfaRecoveryCode"),
    verificationClaims: await tableCount("IdentityVerificationClaim"),
    consentRecords: await tableCount("IdentityConsentRecord"),
    profileClaims: await tableCount("IdentityProfileClaim"),
    organizationAffiliations: await tableCount("IdentityOrganizationAffiliation"),
    trustedCitizenGrants: await tableCount("IdentityTrustedCitizenGrant"),
    securityEvents: await tableCount("IdentitySecurityEvent"),
    privacyRequests: await tableCount("IdentityPrivacyRequest"),
    verificationEvidence: await tableCount("IdentityEvidenceMetadata"),
  };
}

async function existingIdentityRows() {
  const accounts = await prisma.$queryRawUnsafe<Array<{ id: string; email: string }>>('select "id", "email" from "IdentityAccount"');
  const permissions = await prisma.$queryRawUnsafe<Array<{ id: string }>>('select "id" from "IdentityPermissionGrant"');
  const sessions = await prisma.$queryRawUnsafe<Array<{ id: string }>>('select "id" from "IdentitySession"');
  return {
    accountIds: new Set(accounts.map((account) => account.id)),
    accountEmails: new Map(accounts.map((account) => [account.email.toLowerCase(), account.id])),
    permissionIds: new Set(permissions.map((grant) => grant.id)),
    sessionIds: new Set(sessions.map((session) => session.id)),
  };
}

function manualReviewFindings(local: IdentityStore) {
  const findings: string[] = [];
  for (const account of local.accounts) {
    if (!account.id || !account.email || !account.passwordHash?.hash) findings.push(`invalid_account:${account.id || "missing_id"}`);
    if (account.mfaEnabled && !account.mfaEncryptedSecret) findings.push(`mfa_enabled_without_secret:${account.id}`);
    if (account.mfaRecoveryCodes?.some((code) => !code.codeHash)) findings.push(`mfa_recovery_code_without_hash:${account.id}`);
  }
  return findings;
}

async function planMigration(local: IdentityStore, schemaReady: boolean) {
  const plan = {
    accountsToCreate: local.accounts.length,
    accountsAlreadyPresent: 0,
    rolesToMigrate: local.accounts.length,
    permissionsToMigrate: local.permissionGrants.length,
    mfaAccountsToMigrate: local.accounts.filter((account) => account.mfaEnabled || account.mfaEnrollmentRequired || account.mfaEncryptedSecret).length,
    mfaRecoveryCodeHashesToMigrate: local.accounts.reduce((count, account) => count + (account.mfaRecoveryCodes?.length ?? 0), 0),
    sessionsToRecordRevokedForCutover: local.sessions.length,
    consentRecordsToMigrate: local.consentRecords.length,
    claimsToMigrate: local.verificationClaims.length + local.profileClaims.length,
    organizationAffiliationsToMigrate: local.organizationAffiliations.length,
    trustedCitizenGrantsToMigrate: local.trustedCitizenGrants.length,
    privacyRequestsToMigrate: local.privacyRequests.length,
    evidenceMetadataToMigrate: local.verificationEvidence.length,
  };
  const conflicts: string[] = [];

  if (!schemaReady) return { plan, conflicts };

  const existing = await existingIdentityRows();
  plan.accountsAlreadyPresent = local.accounts.filter((account) => existing.accountIds.has(account.id)).length;
  plan.accountsToCreate = local.accounts.length - plan.accountsAlreadyPresent;
  for (const account of local.accounts) {
    const existingIdForEmail = existing.accountEmails.get(account.email.toLowerCase());
    if (existingIdForEmail && existingIdForEmail !== account.id) conflicts.push(`email_conflict:${account.email}`);
  }

  return { plan, conflicts };
}

export async function migrateLocalIdentityToPrisma(options: { dryRun: boolean; apply?: boolean }) {
  const local = readIdentityStore();
  const sourceCounts = summarizeLocalStore(local);
  const invalidRecords = manualReviewFindings(local);
  const warnings: string[] = [];

  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      dryRun: options.dryRun,
      wrote: false,
      status: "database_unconfigured",
      sourceCounts,
      targetCounts: null,
      migrationPlan: await planMigration(local, false),
      invalidRecords,
      conflicts: [],
      warnings: ["DATABASE_URL is not configured for durable identity migration."],
    };
  }

  let status = await getDurableIdentityStorageStatus();
  let planning = await planMigration(local, status.ready);
  let targetCounts = status.ready ? await summarizeDurableStore().catch(() => null) : null;
  if (!status.ready && !options.dryRun) {
    const ensured = await ensureDurableIdentitySchema().catch((error) => ({
      ok: false as const,
      status: "schema_error" as const,
      error: error instanceof Error ? error.message : "Unknown schema initialization error.",
    }));
    if (!ensured.ok) {
      return {
        ok: false,
        dryRun: false,
        wrote: false,
        status: ensured.status,
        sourceCounts,
        targetCounts: null,
        migrationPlan: planning.plan,
        invalidRecords,
        conflicts: planning.conflicts,
        warnings: [...warnings, "Durable identity schema could not be initialized; local JSON fallback was not used."],
      };
    }
    status = await getDurableIdentityStorageStatus();
    planning = await planMigration(local, status.ready);
    targetCounts = status.ready ? await summarizeDurableStore().catch(() => null) : null;
  }

  if (invalidRecords.length) warnings.push("Some source records require manual review before apply.");

  if (options.dryRun || !options.apply) {
    return {
      ok: planning.conflicts.length === 0 && invalidRecords.length === 0,
      dryRun: true,
      wrote: false,
      status: status.status,
      sourceCounts,
      targetCounts,
      migrationPlan: planning.plan,
      invalidRecords,
      conflicts: planning.conflicts,
      warnings,
    };
  }

  if (planning.conflicts.length || invalidRecords.length) {
    return {
      ok: false,
      dryRun: false,
      wrote: false,
      status: "blocked_by_conflict",
      sourceCounts,
      targetCounts,
      migrationPlan: planning.plan,
      invalidRecords,
      conflicts: planning.conflicts,
      warnings,
    };
  }

  const cutoverAt = new Date().toISOString();
  await prisma.$transaction(async (tx) => {
    for (const account of local.accounts) {
      await tx.$executeRawUnsafe(
        `insert into "IdentityAccount" ("id","email","name","username","role","status","emailVerificationStatus","mustChangePassword","mfaEnrollmentRequired","mfaEnabled","mfaEncryptedSecret","mfaPendingEnrollment","mfaEnrolledAt","mfaLastAcceptedCounterHash","mfaFailedAttempts","failedLoginAttempts","lockedUntil","lastLoginAt","disabledAt","createdAt","updatedAt")
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::timestamptz,$14,$15,$16,$17::timestamptz,$18::timestamptz,$19::timestamptz,$20::timestamptz,$21::timestamptz)
         on conflict ("id") do update set
         "email"=excluded."email",
         "name"=excluded."name",
         "username"=excluded."username",
         "role"=excluded."role",
         "status"=excluded."status",
         "emailVerificationStatus"=excluded."emailVerificationStatus",
         "mustChangePassword"=excluded."mustChangePassword",
         "mfaEnrollmentRequired"=excluded."mfaEnrollmentRequired",
         "mfaEnabled"=excluded."mfaEnabled",
         "mfaEncryptedSecret"=excluded."mfaEncryptedSecret",
         "mfaPendingEnrollment"=excluded."mfaPendingEnrollment",
         "mfaEnrolledAt"=excluded."mfaEnrolledAt",
         "mfaLastAcceptedCounterHash"=excluded."mfaLastAcceptedCounterHash",
         "mfaFailedAttempts"=excluded."mfaFailedAttempts",
         "updatedAt"=excluded."updatedAt"`,
        account.id,
        account.email,
        account.name,
        account.username,
        account.role,
        account.status,
        account.emailVerificationStatus,
        account.mustChangePassword,
        account.mfaEnrollmentRequired,
        Boolean(account.mfaEnabled),
        account.mfaEncryptedSecret ?? null,
        account.mfaPendingEnrollment ? json(account.mfaPendingEnrollment) : null,
        account.mfaEnrolledAt ?? null,
        account.mfaLastAcceptedCounterHash ?? null,
        account.mfaFailedAttempts ?? 0,
        account.failedLoginAttempts,
        account.lockedUntil,
        account.lastLoginAt,
        account.disabledAt,
        account.createdAt,
        account.updatedAt,
      );
      await tx.$executeRawUnsafe(
        `insert into "IdentityCredential" ("id","accountId","credentialType","algorithm","salt","hash","metadata","createdAt")
         values ($1,$2,'password',$3,$4,$5,$6::jsonb,$7::timestamptz)
         on conflict ("id") do update set "metadata"=excluded."metadata"`,
        `credential_${account.id}`,
        account.id,
        account.passwordHash.algorithm,
        account.passwordHash.salt,
        account.passwordHash.hash,
        json({ keyLength: account.passwordHash.keyLength, cost: account.passwordHash.cost }),
        account.passwordHash.createdAt,
      );
      await tx.$executeRawUnsafe(
        `insert into "IdentityRoleGrant" ("id","accountId","role","grantedBy","grantedAt","revokedAt")
         values ($1,$2,$3,'migration',$4::timestamptz,null)
         on conflict ("id") do nothing`,
        `role_${account.id}_${account.role}`,
        account.id,
        account.role,
        account.createdAt,
      );
      for (const code of account.mfaRecoveryCodes ?? []) {
        await tx.$executeRawUnsafe(
          `insert into "IdentityMfaRecoveryCode" ("id","accountId","codeHash","createdAt","usedAt")
           values ($1,$2,$3,$4::timestamptz,$5::timestamptz)
           on conflict ("accountId","codeHash") do update set "usedAt"=excluded."usedAt"`,
          code.id,
          account.id,
          code.codeHash,
          code.createdAt,
          code.usedAt,
        );
      }
    }

    for (const grant of local.permissionGrants) {
      await tx.$executeRawUnsafe(
        `insert into "IdentityPermissionGrant" ("id","accountId","permission","grantedBy","grantedAt","revokedAt")
         values ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)
         on conflict ("id") do nothing`,
        grant.id,
        grant.userId,
        grant.permission,
        grant.grantedBy,
        grant.grantedAt,
        grant.revokedAt,
      );
    }

    for (const session of local.sessions) {
      await tx.$executeRawUnsafe(
        `insert into "IdentitySession" ("id","accountId","sessionHash","createdAt","expiresAt","revokedAt","reason","mfaAuthenticatedAt")
         values ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6::timestamptz,$7,$8::timestamptz)
         on conflict ("id") do update set "revokedAt"=excluded."revokedAt", "reason"=excluded."reason"`,
        session.id,
        session.userId,
        hashSessionId(session.id),
        session.createdAt,
        futureIso(30),
        session.revokedAt ?? cutoverAt,
        session.revokedAt ? session.reason : "identity_migration_cutover_requires_new_login",
        session.mfaVerifiedAt ?? null,
      );
    }

    for (const claim of local.verificationClaims) {
      await tx.$executeRawUnsafe(
        `insert into "IdentityVerificationClaim" ("id","accountId","claimType","jurisdictionIds","communityIds","method","provider","status","verifiedAt","expiresAt","reviewerId","assuranceLevel","evidenceDisposition","evidenceHash","sensitiveAddressRef","rejectionReason","revocationReason","createdAt","updatedAt")
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz,$11,$12,$13,$14,$15,$16,$17,$18::timestamptz,$19::timestamptz)
         on conflict ("id") do nothing`,
        claim.id,
        claim.userId,
        claim.claimType,
        claim.jurisdictionIds,
        claim.communityIds,
        claim.method,
        claim.provider,
        claim.status,
        claim.verifiedAt,
        claim.expiresAt,
        claim.reviewerId,
        claim.assuranceLevel,
        claim.evidenceDisposition,
        claim.evidenceHash,
        claim.sensitiveAddressRef,
        claim.rejectionReason,
        claim.revocationReason,
        claim.createdAt,
        claim.updatedAt,
      );
    }

    for (const record of local.consentRecords) {
      await tx.$executeRawUnsafe(
        `insert into "IdentityConsentRecord" ("id","accountId","consentType","policyVersion","status","grantedAt","withdrawnAt","collectionContext","createdAt")
         values ($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8,$9::timestamptz)
         on conflict ("id") do nothing`,
        record.id,
        record.userId,
        record.consentType,
        record.policyVersion,
        record.status,
        record.grantedAt,
        record.withdrawnAt,
        record.collectionContext,
        record.grantedAt ?? record.withdrawnAt ?? cutoverAt,
      );
    }

    for (const claim of local.profileClaims) {
      await tx.$executeRawUnsafe(
        `insert into "IdentityProfileClaim" ("id","accountId","category","claimKey","status","visibility","consentId","createdAt","updatedAt","revokedAt")
         values ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10::timestamptz)
         on conflict ("id") do nothing`,
        claim.id,
        claim.userId,
        claim.category,
        claim.claimKey,
        claim.status,
        claim.visibility,
        claim.consentId,
        claim.createdAt,
        claim.updatedAt,
        claim.revokedAt,
      );
    }

    for (const affiliation of local.organizationAffiliations) {
      await tx.$executeRawUnsafe(
        `insert into "IdentityOrganizationAffiliation" ("id","accountId","organizationName","relationship","status","visibility","authorizedToSpeakForOrganization","createdAt","updatedAt")
         values ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,$9::timestamptz)
         on conflict ("id") do nothing`,
        affiliation.id,
        affiliation.userId,
        affiliation.organizationName,
        affiliation.relationship,
        affiliation.status,
        affiliation.visibility,
        affiliation.authorizedToSpeakForOrganization,
        affiliation.createdAt,
        affiliation.updatedAt,
      );
    }

    for (const grant of local.trustedCitizenGrants) {
      await tx.$executeRawUnsafe(
        `insert into "IdentityTrustedCitizenGrant" ("id","accountId","status","capabilities","grantReason","grantedBy","grantedAt","expiresAt","revokedAt","suspendedAt","reviewNotes")
         values ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,$10::timestamptz,$11)
         on conflict ("id") do nothing`,
        grant.id,
        grant.userId,
        grant.status,
        grant.capabilities,
        grant.grantReason,
        grant.grantedBy,
        grant.grantedAt,
        grant.expiresAt,
        grant.revokedAt,
        grant.suspendedAt,
        grant.reviewNotes,
      );
    }

    for (const request of local.privacyRequests) {
      await tx.$executeRawUnsafe(
        `insert into "IdentityPrivacyRequest" ("id","accountId","requestType","status","createdAt","completedAt")
         values ($1,$2,$3,$4,$5::timestamptz,$6::timestamptz)
         on conflict ("id") do nothing`,
        request.id,
        request.userId,
        request.requestType,
        request.status,
        request.createdAt,
        request.completedAt,
      );
    }

    for (const evidence of local.verificationEvidence) {
      await tx.$executeRawUnsafe(
        `insert into "IdentityEvidenceMetadata" ("id","accountId","verificationClaimId","storageAdapter","objectRefHash","contentHash","documentCategory","encrypted","sourceFileRetained","purgeAfter","purgedAt","accessHistory","createdAt")
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11::timestamptz,$12::jsonb,$13::timestamptz)
         on conflict ("id") do nothing`,
        evidence.id,
        evidence.userId,
        evidence.claimId,
        evidence.storageAdapter,
        evidence.metadataHash,
        evidence.metadataHash,
        "verification_evidence",
        evidence.encrypted,
        evidence.sourceFileRetained,
        evidence.purgeAfter,
        evidence.purgedAt,
        json([]),
        evidence.createdAt,
      );
    }

    for (const event of local.securityEvents) {
      await tx.$executeRawUnsafe(
        `insert into "IdentitySecurityEvent" ("id","eventType","accountId","actorAccountId","summary","metadata","createdAt")
         values ($1,$2,$3,$4,$5,$6::jsonb,$7::timestamptz)
         on conflict ("id") do nothing`,
        event.id,
        event.type,
        event.userId,
        event.actorUserId,
        event.summary,
        json(event.metadata),
        event.createdAt,
      );
    }

    await tx.$executeRawUnsafe(
      `insert into "IdentitySecurityEvent" ("id","eventType","accountId","actorAccountId","summary","metadata","createdAt")
       values ($1,'identity_migration_cutover',null,'trusted_terminal','Local identity source migrated to durable identity storage; existing local sessions require new login.',$2::jsonb,$3::timestamptz)
       on conflict ("id") do nothing`,
      `security_${Date.now()}_identity_migration_cutover`,
      json({ localSessionsRecordedRevoked: local.sessions.length, secretsPrinted: false }),
      cutoverAt,
    );
  });

  const finalTargetCounts = await summarizeDurableStore();
  const owner = local.accounts.find((account) => account.role === "admin" || account.role === "platform_admin");
  const ownerHasPermissions = owner ? getAdminPermissions({ role: owner.role }).every((permission) => local.permissionGrants.some((grant) => grant.userId === owner.id && grant.permission === permission && !grant.revokedAt)) : false;
  if (!ownerHasPermissions) warnings.push("Owner local store is missing one or more explicit admin grants; role-based admin policy still grants them.");

  return {
    ok: true,
    dryRun: false,
    wrote: true,
    status: "schema_ready",
    sourceCounts,
    targetCounts: finalTargetCounts,
    migrationPlan: planning.plan,
    invalidRecords,
    conflicts: planning.conflicts,
    warnings,
    cutover: {
      localSessionsRecordedRevoked: local.sessions.length,
      requiresNewLogin: true,
      rawSessionTokensMigrated: false,
    },
  };
}
