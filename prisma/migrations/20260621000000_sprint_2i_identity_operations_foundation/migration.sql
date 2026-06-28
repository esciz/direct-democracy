-- Sprint 2I identity, worker, and admin-operation persistence foundation.
-- This migration is additive only. It does not reset, drop, or rename civic/runtime data.

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

create index if not exists "IdentityAccount_role_idx" on "IdentityAccount" ("role");
create index if not exists "IdentityAccount_status_idx" on "IdentityAccount" ("status");
create index if not exists "IdentityAccount_emailVerificationStatus_idx" on "IdentityAccount" ("emailVerificationStatus");
create index if not exists "IdentityAccount_mfaEnabled_idx" on "IdentityAccount" ("mfaEnabled");

create table if not exists "IdentityCredential" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "credentialType" text not null,
  "algorithm" text not null,
  "salt" text not null,
  "hash" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "revokedAt" timestamptz
);

create index if not exists "IdentityCredential_accountId_idx" on "IdentityCredential" ("accountId");
create index if not exists "IdentityCredential_credentialType_idx" on "IdentityCredential" ("credentialType");

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

create index if not exists "IdentitySession_accountId_idx" on "IdentitySession" ("accountId");
create index if not exists "IdentitySession_expiresAt_idx" on "IdentitySession" ("expiresAt");
create index if not exists "IdentitySession_revokedAt_idx" on "IdentitySession" ("revokedAt");

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
create index if not exists "IdentityPermissionGrant_accountId_idx" on "IdentityPermissionGrant" ("accountId");
create index if not exists "IdentityPermissionGrant_permission_idx" on "IdentityPermissionGrant" ("permission");

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
create index if not exists "IdentityRoleGrant_accountId_idx" on "IdentityRoleGrant" ("accountId");
create index if not exists "IdentityRoleGrant_role_idx" on "IdentityRoleGrant" ("role");

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

create index if not exists "IdentityToken_accountId_idx" on "IdentityToken" ("accountId");
create index if not exists "IdentityToken_tokenType_idx" on "IdentityToken" ("tokenType");
create index if not exists "IdentityToken_expiresAt_idx" on "IdentityToken" ("expiresAt");

create table if not exists "IdentityMfaRecoveryCode" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "codeHash" text not null,
  "createdAt" timestamptz not null default now(),
  "usedAt" timestamptz,
  unique ("accountId", "codeHash")
);

create index if not exists "IdentityMfaRecoveryCode_accountId_idx" on "IdentityMfaRecoveryCode" ("accountId");
create index if not exists "IdentityMfaRecoveryCode_usedAt_idx" on "IdentityMfaRecoveryCode" ("usedAt");

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
create index if not exists "IdentityVerificationClaim_accountId_idx" on "IdentityVerificationClaim" ("accountId");
create index if not exists "IdentityVerificationClaim_claimType_idx" on "IdentityVerificationClaim" ("claimType");
create index if not exists "IdentityVerificationClaim_status_idx" on "IdentityVerificationClaim" ("status");
create index if not exists "IdentityVerificationClaim_expiresAt_idx" on "IdentityVerificationClaim" ("expiresAt");

create table if not exists "IdentityVerificationEvent" (
  "id" text primary key,
  "verificationClaimId" text not null references "IdentityVerificationClaim"("id") on delete cascade,
  "eventType" text not null,
  "actorAccountId" text,
  "summary" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists "IdentityVerificationEvent_claim_idx" on "IdentityVerificationEvent" ("verificationClaimId");
create index if not exists "IdentityVerificationEvent_eventType_idx" on "IdentityVerificationEvent" ("eventType");
create index if not exists "IdentityVerificationEvent_createdAt_idx" on "IdentityVerificationEvent" ("createdAt");

create table if not exists "IdentityVerificationReview" (
  "id" text primary key,
  "verificationClaimId" text not null references "IdentityVerificationClaim"("id") on delete cascade,
  "reviewerAccountId" text,
  "decision" text not null,
  "notes" text,
  "createdAt" timestamptz not null default now()
);

create index if not exists "IdentityVerificationReview_claim_idx" on "IdentityVerificationReview" ("verificationClaimId");
create index if not exists "IdentityVerificationReview_reviewer_idx" on "IdentityVerificationReview" ("reviewerAccountId");
create index if not exists "IdentityVerificationReview_decision_idx" on "IdentityVerificationReview" ("decision");

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

create index if not exists "IdentityConsentRecord_accountId_idx" on "IdentityConsentRecord" ("accountId");
create index if not exists "IdentityConsentRecord_consentType_idx" on "IdentityConsentRecord" ("consentType");
create index if not exists "IdentityConsentRecord_status_idx" on "IdentityConsentRecord" ("status");

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

create index if not exists "IdentityProfileClaim_accountId_idx" on "IdentityProfileClaim" ("accountId");
create index if not exists "IdentityProfileClaim_category_idx" on "IdentityProfileClaim" ("category");
create index if not exists "IdentityProfileClaim_visibility_idx" on "IdentityProfileClaim" ("visibility");

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

create index if not exists "IdentityOrganizationAffiliation_accountId_idx" on "IdentityOrganizationAffiliation" ("accountId");
create index if not exists "IdentityOrganizationAffiliation_status_idx" on "IdentityOrganizationAffiliation" ("status");

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

create index if not exists "IdentityTrustedCitizenGrant_accountId_idx" on "IdentityTrustedCitizenGrant" ("accountId");
create index if not exists "IdentityTrustedCitizenGrant_status_idx" on "IdentityTrustedCitizenGrant" ("status");
create index if not exists "IdentityTrustedCitizenGrant_expiresAt_idx" on "IdentityTrustedCitizenGrant" ("expiresAt");

create table if not exists "IdentitySecurityEvent" (
  "id" text primary key,
  "eventType" text not null,
  "accountId" text,
  "actorAccountId" text,
  "summary" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists "IdentitySecurityEvent_accountId_idx" on "IdentitySecurityEvent" ("accountId");
create index if not exists "IdentitySecurityEvent_eventType_idx" on "IdentitySecurityEvent" ("eventType");
create index if not exists "IdentitySecurityEvent_createdAt_idx" on "IdentitySecurityEvent" ("createdAt");

create table if not exists "IdentityPrivacyRequest" (
  "id" text primary key,
  "accountId" text not null references "IdentityAccount"("id") on delete cascade,
  "requestType" text not null,
  "status" text not null,
  "createdAt" timestamptz not null default now(),
  "completedAt" timestamptz
);

create index if not exists "IdentityPrivacyRequest_accountId_idx" on "IdentityPrivacyRequest" ("accountId");
create index if not exists "IdentityPrivacyRequest_status_idx" on "IdentityPrivacyRequest" ("status");

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

create index if not exists "IdentityEvidenceMetadata_accountId_idx" on "IdentityEvidenceMetadata" ("accountId");
create index if not exists "IdentityEvidenceMetadata_claim_idx" on "IdentityEvidenceMetadata" ("verificationClaimId");
create index if not exists "IdentityEvidenceMetadata_purgeAfter_idx" on "IdentityEvidenceMetadata" ("purgeAfter");
create index if not exists "IdentityEvidenceMetadata_purgedAt_idx" on "IdentityEvidenceMetadata" ("purgedAt");

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
create index if not exists "IdentityEligibilitySnapshot_accountId_idx" on "IdentityEligibilitySnapshot" ("accountId");
create index if not exists "IdentityEligibilitySnapshot_snapshotType_idx" on "IdentityEligibilitySnapshot" ("snapshotType");
create index if not exists "IdentityEligibilitySnapshot_status_idx" on "IdentityEligibilitySnapshot" ("status");
create index if not exists "IdentityEligibilitySnapshot_expiresAt_idx" on "IdentityEligibilitySnapshot" ("expiresAt");

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
create index if not exists "IdentityJob_jobType_idx" on "IdentityJob" ("jobType");
create index if not exists "IdentityJob_status_idx" on "IdentityJob" ("status");
create index if not exists "IdentityJob_queuedAt_idx" on "IdentityJob" ("queuedAt");
create index if not exists "IdentityJob_nextRunAt_idx" on "IdentityJob" ("nextRunAt");
create index if not exists "IdentityJob_heartbeatAt_idx" on "IdentityJob" ("heartbeatAt");
create index if not exists "IdentityJob_workerId_idx" on "IdentityJob" ("workerId");
create index if not exists "IdentityJob_operationId_idx" on "IdentityJob" ("operationId");
create index if not exists "IdentityJob_deadLetteredAt_idx" on "IdentityJob" ("deadLetteredAt");
create index if not exists "IdentityJob_next_run" on "IdentityJob" ("status", coalesce("nextRunAt", "queuedAt"));
create index if not exists "IdentityJob_dead_letter" on "IdentityJob" ("deadLetteredAt") where "deadLetteredAt" is not null;
create index if not exists "IdentityJob_operation" on "IdentityJob" ("operationId");

create table if not exists "IdentityJobEvent" (
  "id" text primary key,
  "jobId" text not null references "IdentityJob"("id") on delete cascade,
  "eventType" text not null,
  "summary" text not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists "IdentityJobEvent_jobId_idx" on "IdentityJobEvent" ("jobId");
create index if not exists "IdentityJobEvent_eventType_idx" on "IdentityJobEvent" ("eventType");

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

create index if not exists "AdminOperation_operationType_idx" on "AdminOperation" ("operationType");
create index if not exists "AdminOperation_status_idx" on "AdminOperation" ("status");
create index if not exists "AdminOperation_queuedAt_idx" on "AdminOperation" ("queuedAt");
create index if not exists "AdminOperation_heartbeatAt_idx" on "AdminOperation" ("heartbeatAt");
create index if not exists "AdminOperation_parentOperationId_idx" on "AdminOperation" ("parentOperationId");
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

create index if not exists "AdminOperationStage_operationId_idx" on "AdminOperationStage" ("operationId");
create index if not exists "AdminOperationStage_status_idx" on "AdminOperationStage" ("status");

create table if not exists "AdminOperationAuditEvent" (
  "id" text primary key,
  "operationId" text not null references "AdminOperation"("id") on delete cascade,
  "eventType" text not null,
  "actorUserId" text,
  "summary" text not null,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists "AdminOperationAuditEvent_operationId_idx" on "AdminOperationAuditEvent" ("operationId");
create index if not exists "AdminOperationAuditEvent_eventType_idx" on "AdminOperationAuditEvent" ("eventType");
create index if not exists "AdminOperationAuditEvent_createdAt_idx" on "AdminOperationAuditEvent" ("createdAt");

create table if not exists "AdminOperationLogReference" (
  "id" text primary key,
  "operationId" text not null references "AdminOperation"("id") on delete cascade,
  "stream" text not null,
  "adapter" text not null,
  "objectRef" text not null,
  "preview" text,
  "createdAt" timestamptz not null default now()
);

create index if not exists "AdminOperationLogReference_operationId_idx" on "AdminOperationLogReference" ("operationId");
create index if not exists "AdminOperationLogReference_stream_idx" on "AdminOperationLogReference" ("stream");
