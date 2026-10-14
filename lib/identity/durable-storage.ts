import { prisma } from "@/lib/prisma";

export type DurableIdentityStorageStatus =
  | "database_configured"
  | "database_unconfigured"
  | "schema_ready"
  | "schema_missing"
  | "schema_error";

export const IDENTITY_TABLES = [
  "IdentityAccount",
  "IdentityCredential",
  "IdentitySession",
  "IdentityRoleGrant",
  "IdentityPermissionGrant",
  "IdentityToken",
  "IdentityMfaRecoveryCode",
  "IdentityVerificationClaim",
  "IdentityVerificationEvent",
  "IdentityVerificationReview",
  "IdentityConsentRecord",
  "IdentityProfileClaim",
  "IdentityOrganizationAffiliation",
  "IdentityTrustedCitizenGrant",
  "IdentitySecurityEvent",
  "IdentityPrivacyRequest",
  "IdentityEvidenceMetadata",
  "IdentityEligibilitySnapshot",
  "IdentityJob",
  "IdentityJobEvent",
] as const;

export const ADMIN_OPERATION_TABLES = [
  "AdminOperation",
  "AdminOperationStage",
  "AdminOperationAuditEvent",
  "AdminOperationLogReference",
] as const;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("placeholder"));
}

function redactDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown database error.";
  let databaseHost: string | null = null;
  try {
    databaseHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null;
  } catch {
    databaseHost = null;
  }
  return message
    .replaceAll(process.env.DATABASE_URL ?? "", "[redacted_database_url]")
    .replaceAll(databaseHost ?? "", "[redacted_database_host]")
    .replace(/\/\/[^:@/\s]+:[^@/\s]+@/g, "//[redacted]@")
    .replace(/password=([^&\s]+)/gi, "password=[redacted]")
    .replace(/sslcert=([^&\s]+)/gi, "sslcert=[redacted]")
    .replace(/sslkey=([^&\s]+)/gi, "sslkey=[redacted]")
    .slice(0, 500);
}

async function getTableStatus(tableNames: readonly string[]) {
  if (!isDatabaseConfigured()) {
    return {
      status: "database_unconfigured" as DurableIdentityStorageStatus,
      configured: false,
      ready: false,
      missingTables: [...tableNames],
      error: null,
    };
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `select table_name from information_schema.tables where table_schema='public' and table_name in (${tableNames.map((table) => `'${table}'`).join(",")})`,
    );
    const existing = new Set(rows.map((row) => row.table_name));
    const missingTables = tableNames.filter((table) => !existing.has(table));
    return {
      status: missingTables.length ? "schema_missing" as DurableIdentityStorageStatus : "schema_ready" as DurableIdentityStorageStatus,
      configured: true,
      ready: missingTables.length === 0,
      missingTables,
      error: null,
    };
  } catch (error) {
    return {
      status: "schema_error" as DurableIdentityStorageStatus,
      configured: true,
      ready: false,
      missingTables: [...tableNames],
      error: redactDatabaseError(error),
    };
  }
}

export async function getDurableIdentityStorageStatus() {
  return getTableStatus(IDENTITY_TABLES);
}

export async function getDurableOperationStorageStatus() {
  return getTableStatus(ADMIN_OPERATION_TABLES);
}

export function productionIdentityFallbackAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.DIRECT_DEMOCRACY_ALLOW_LOCAL_IDENTITY_FALLBACK !== "false";
}

export async function assertDurableIdentityAvailableForProduction() {
  if (process.env.NODE_ENV !== "production") return;
  const status = await getDurableIdentityStorageStatus();
  if (!status.ready) {
    throw new Error(`durable_identity_storage_unavailable:${status.status}`);
  }
}

export const CREATE_IDENTITY_TABLES_SQL = `
create table if not exists "IdentityAccount" (
  "id" text primary key,
  "userId" text unique,
  "email" text not null unique,
  "name" text not null,
  "username" text not null,
  "role" text not null,
  "status" text not null,
  "emailVerificationStatus" text not null,
  "mustChangePassword" boolean not null default false,
  "mfaEnrollmentRequired" boolean not null default false,
  "mfaEnabled" boolean not null default false,
  "mfaEncryptedSecret" text,
  "mfaPendingEnrollment" jsonb,
  "mfaEnrolledAt" timestamptz,
  "mfaLastAcceptedCounterHash" text,
  "mfaFailedAttempts" integer not null default 0,
  "failedLoginAttempts" integer not null default 0,
  "lockedUntil" timestamptz,
  "lastLoginAt" timestamptz,
  "disabledAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "IdentityCredential" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "credentialType" text not null,
  "algorithm" text not null,
  "salt" text not null,
  "hash" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "revokedAt" timestamptz,
  unique ("accountId", "credentialType", "revokedAt")
);

create table if not exists "IdentitySession" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "sessionHash" text not null unique,
  "createdAt" timestamptz not null default now(),
  "lastSeenAt" timestamptz,
  "expiresAt" timestamptz not null,
  "revokedAt" timestamptz,
  "reason" text,
  "mfaAuthenticatedAt" timestamptz,
  "deviceSummary" text,
  "suspicious" boolean not null default false
);

create table if not exists "IdentityPermissionGrant" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "permission" text not null,
  "grantedBy" text not null,
  "grantedAt" timestamptz not null,
  "revokedAt" timestamptz,
  unique ("accountId", "permission", "revokedAt")
);

create unique index if not exists "IdentityPermissionGrant_one_active"
on "IdentityPermissionGrant" ("accountId", "permission")
where "revokedAt" is null;

create table if not exists "IdentityRoleGrant" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "role" text not null,
  "grantedBy" text not null,
  "grantedAt" timestamptz not null,
  "revokedAt" timestamptz,
  unique ("accountId", "role", "revokedAt")
);

create unique index if not exists "IdentityRoleGrant_one_active"
on "IdentityRoleGrant" ("accountId", "role")
where "revokedAt" is null;

create table if not exists "IdentityToken" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "tokenType" text not null,
  "tokenHash" text not null unique,
  "purpose" text not null,
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz not null,
  "consumedAt" timestamptz,
  "revokedAt" timestamptz,
  "metadata" jsonb not null default '{}'::jsonb
);

create table if not exists "IdentityMfaRecoveryCode" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "codeHash" text not null,
  "createdAt" timestamptz not null default now(),
  "usedAt" timestamptz,
  unique ("accountId", "codeHash")
);

create table if not exists "IdentityVerificationClaim" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "claimType" text not null,
  "jurisdictionIds" text[] not null default '{}',
  "communityIds" text[] not null default '{}',
  "method" text not null,
  "provider" text not null,
  "status" text not null,
  "verifiedAt" timestamptz,
  "expiresAt" timestamptz,
  "reviewedAt" timestamptz,
  "reviewerId" text,
  "assuranceLevel" text not null,
  "evidenceDisposition" text not null,
  "evidenceHash" text,
  "sensitiveAddressRef" text,
  "rejectionReason" text,
  "revocationReason" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "IdentityVerificationClaim_one_active"
on "IdentityVerificationClaim" ("accountId", "claimType")
where "status" in ('pending','needs_information','pending_manual_review','verified','matched');

create table if not exists "IdentityVerificationEvent" (
  "id" text primary key,
  "verificationClaimId" text not null references "IdentityVerificationClaim"("id") on delete cascade,
  "eventType" text not null,
  "actorAccountId" text,
  "summary" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create table if not exists "IdentityVerificationReview" (
  "id" text primary key,
  "verificationClaimId" text not null references "IdentityVerificationClaim"("id") on delete cascade,
  "reviewerAccountId" text,
  "decision" text not null,
  "notes" text,
  "createdAt" timestamptz not null default now()
);

create table if not exists "IdentityConsentRecord" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "consentType" text not null,
  "policyVersion" text not null,
  "status" text not null,
  "grantedAt" timestamptz,
  "withdrawnAt" timestamptz,
  "collectionContext" text not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists "IdentityProfileClaim" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "category" text not null,
  "claimKey" text not null,
  "status" text not null,
  "visibility" text not null,
  "consentId" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "revokedAt" timestamptz
);

create table if not exists "IdentityOrganizationAffiliation" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "organizationName" text not null,
  "relationship" text not null,
  "status" text not null,
  "visibility" text not null,
  "authorizedToSpeakForOrganization" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "IdentityTrustedCitizenGrant" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "status" text not null,
  "capabilities" text[] not null default '{}',
  "grantReason" text not null,
  "grantedBy" text not null,
  "grantedAt" timestamptz not null,
  "expiresAt" timestamptz,
  "revokedAt" timestamptz,
  "suspendedAt" timestamptz,
  "reviewNotes" text
);

create table if not exists "IdentitySecurityEvent" (
  "id" text primary key,
  "eventType" text not null,
  "accountId" text,
  "actorAccountId" text,
  "summary" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create table if not exists "IdentityPrivacyRequest" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "requestType" text not null,
  "status" text not null,
  "createdAt" timestamptz not null default now(),
  "completedAt" timestamptz
);

create table if not exists "IdentityEvidenceMetadata" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "verificationClaimId" text,
  "storageAdapter" text not null,
  "objectRefHash" text not null,
  "contentHash" text not null,
  "documentCategory" text not null,
  "encrypted" boolean not null default true,
  "sourceFileRetained" boolean not null default false,
  "purgeAfter" timestamptz not null,
  "purgedAt" timestamptz,
  "accessHistory" jsonb not null default '[]'::jsonb,
  "createdAt" timestamptz not null default now()
);

create table if not exists "IdentityEligibilitySnapshot" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "snapshotType" text not null,
  "jurisdictionId" text,
  "communityId" text,
  "status" text not null,
  "assuranceLevel" text not null,
  "sourceClaimIds" text[] not null default '{}',
  "createdAt" timestamptz not null default now(),
  "expiresAt" timestamptz,
  "revokedAt" timestamptz
);

create unique index if not exists "IdentityEligibilitySnapshot_one_active"
on "IdentityEligibilitySnapshot" ("accountId", "snapshotType", coalesce("jurisdictionId", ''), coalesce("communityId", ''))
where "revokedAt" is null;

create table if not exists "IdentityJob" (
  "id" text primary key,
  "jobType" text not null,
  "status" text not null,
  "idempotencyKey" text not null unique,
  "actorAccountId" text,
  "operationId" text,
  "parentJobId" text,
  "payload" jsonb not null default '{}'::jsonb,
  "attempts" integer not null default 0,
  "maxAttempts" integer not null default 3,
  "queuedAt" timestamptz not null default now(),
  "nextRunAt" timestamptz,
  "startedAt" timestamptz,
  "heartbeatAt" timestamptz,
  "workerId" text,
  "lockedAt" timestamptz,
  "completedAt" timestamptz,
  "cancelledAt" timestamptz,
  "failedAt" timestamptz,
  "deadLetteredAt" timestamptz,
  "failureReason" text
);

alter table "IdentityJob" add column if not exists "operationId" text;
alter table "IdentityJob" add column if not exists "parentJobId" text;
alter table "IdentityJob" add column if not exists "nextRunAt" timestamptz;
alter table "IdentityJob" add column if not exists "workerId" text;
alter table "IdentityJob" add column if not exists "lockedAt" timestamptz;
alter table "IdentityJob" add column if not exists "cancelledAt" timestamptz;

create index if not exists "IdentityJob_next_run"
on "IdentityJob" ("status", coalesce("nextRunAt", "queuedAt"));

create index if not exists "IdentityJob_dead_letter"
on "IdentityJob" ("deadLetteredAt")
where "deadLetteredAt" is not null;

create index if not exists "IdentityJob_operation"
on "IdentityJob" ("operationId");

create table if not exists "IdentityJobEvent" (
  "id" text primary key,
  "jobId" text not null references "IdentityJob"("id") on delete cascade,
  "eventType" text not null,
  "summary" text not null,
  "createdAt" timestamptz not null default now()
);
`;

export const CREATE_ADMIN_OPERATION_TABLES_SQL = `
create table if not exists "AdminOperation" (
  "id" text primary key,
  "operationType" text not null,
  "triggerType" text not null,
  "actorUserId" text not null,
  "actorRole" text not null,
  "permissionsAtTrigger" text[] not null default '{}',
  "scope" jsonb not null default '{}'::jsonb,
  "sourceIds" text[] not null default '{}',
  "jurisdiction" text,
  "documentType" text,
  "validatedArguments" text[] not null default '{}',
  "executionBackend" text not null,
  "parentOperationId" text,
  "retryOfOperationId" text,
  "idempotencyKey" text not null unique,
  "status" text not null,
  "currentStage" text,
  "progressSummary" text not null,
  "progress" jsonb not null default '{}'::jsonb,
  "retryCount" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "queuedAt" timestamptz not null,
  "startedAt" timestamptz,
  "heartbeatAt" timestamptz,
  "completedAt" timestamptz,
  "cancellationRequested" boolean not null default false,
  "cancellationReason" text,
  "sanitizedResultSummary" text,
  "externalRunUrl" text,
  "failureClassification" text,
  "environmentCapabilitySnapshot" jsonb not null default '{}'::jsonb,
  "artifactReferences" text[] not null default '{}'
);

create index if not exists "AdminOperation_active_pipeline"
on "AdminOperation" ("operationType", "status", "heartbeatAt")
where "status" in ('queued','starting','running');

create table if not exists "AdminOperationStage" (
  "id" text primary key,
  "operationId" text not null references "AdminOperation"("id") on delete cascade,
  "stageName" text not null,
  "status" text not null,
  "startedAt" timestamptz,
  "heartbeatAt" timestamptz,
  "completedAt" timestamptz,
  "summary" text,
  "metadata" jsonb not null default '{}'::jsonb,
  unique ("operationId", "stageName")
);

create table if not exists "AdminOperationAuditEvent" (
  "id" text primary key,
  "operationId" text not null references "AdminOperation"("id") on delete cascade,
  "eventType" text not null,
  "actorUserId" text,
  "summary" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create table if not exists "AdminOperationLogReference" (
  "id" text primary key,
  "operationId" text not null references "AdminOperation"("id") on delete cascade,
  "stream" text not null,
  "adapter" text not null,
  "objectRef" text not null,
  "preview" text,
  "createdAt" timestamptz not null default now()
);
`;

export async function ensureDurableIdentitySchema() {
  if (!isDatabaseConfigured()) {
    return { ok: false as const, status: "database_unconfigured" as const };
  }
  await prisma.$executeRawUnsafe(CREATE_IDENTITY_TABLES_SQL);
  return { ok: true as const, status: "schema_ready" as const };
}

export async function ensureDurableOperationSchema() {
  if (!isDatabaseConfigured()) {
    return { ok: false as const, status: "database_unconfigured" as const };
  }
  await prisma.$executeRawUnsafe(CREATE_ADMIN_OPERATION_TABLES_SQL);
  return { ok: true as const, status: "schema_ready" as const };
}
