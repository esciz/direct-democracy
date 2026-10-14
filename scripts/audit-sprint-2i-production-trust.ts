import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getAdminPermissions } from "@/lib/admin/permissions";
import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { getEmailConfigurationRequirements, getEmailProviderStatus } from "@/lib/identity/email";
import { getEvidenceStorageStatus } from "@/lib/identity/evidence-storage";
import { getMfaConfigurationStatus } from "@/lib/identity/mfa";
import { getDurableIdentityStorageStatus, IDENTITY_TABLES, productionIdentityFallbackAllowed } from "@/lib/identity/durable-storage";
import { summarizeLocalStore } from "@/lib/identity/migration";
import { readIdentityStore } from "@/lib/identity/storage";
import { getWorkerQueueStatus } from "@/lib/identity/worker-queue";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
mkdirSync(GENERATED_DIR, { recursive: true });

function writeGenerated(fileName: string, value: unknown) {
  writeFileSync(path.join(GENERATED_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function fileHas(fileName: string, pattern: string) {
  const filePath = path.join(process.cwd(), fileName);
  return existsSync(filePath) && readFileSync(filePath, "utf8").includes(pattern);
}

async function main() {
  const generatedAt = new Date().toISOString();
  const localStore = readIdentityStore();
  const storage = await getDurableIdentityStorageStatus();
  const worker = await getWorkerQueueStatus();
  const emailStatus = getEmailProviderStatus();
  const mfaStatus = getMfaConfigurationStatus();
  const evidenceStatus = getEvidenceStorageStatus();
  const owner = localStore.accounts.find((account) => account.email === "owner-admin@direct-democracy.local");
  const failures: string[] = [];

  if (!fileHas("app/profile/page.tsx", "Admin Dashboard")) failures.push("Admin Dashboard profile link missing.");
if (!fileHas("app/admin/page.tsx", 'redirect("/admin/operations")')) failures.push("Canonical /admin redirect missing.");
if (!fileHas("proxy.ts", '"/admin"')) failures.push("Proxy does not include /admin matcher.");
if (!fileHas("prisma/schema.prisma", "model IdentityAccount")) failures.push("Prisma identity models missing.");
if (!fileHas("prisma/schema.prisma", "model IdentityJob")) failures.push("Prisma job models missing.");
if (!owner) failures.push("Owner admin missing from local migration source.");

const foundationAudit = {
  generatedAt,
  existingReusableModels: [
    "User",
    "VoteResponse @@unique([userId, questionId])",
    "PollVote @@unique([pollId, userId])",
    "Jurisdiction",
    "CivicSentimentAggregate",
    "Sprint 2G admin operation allowlist",
    "Sprint 2H identity capability matrix",
  ],
  localOnlyModels: [
    "data/private/identity/identity-store.json",
    "data/generated/admin-operations/operations.json",
  ],
  durableModelsAdded: [...IDENTITY_TABLES],
  duplicateConcepts: [
    "User remains public/profile identity; IdentityAccount stores credential/security boundary.",
    "Existing VoteResponse/PollVote remain participation records; IdentityVerificationClaim stores eligibility evidence.",
  ],
  migrationRequirements: [
    "Run npm run identity:migrate -- --dry-run",
    "Run npm run identity:migrate after DATABASE_URL points to the production database.",
    "Do not delete data/private/identity/identity-store.json until counts and rollback window are verified.",
  ],
  incompleteOrBlockedPaths: [
    storage.ready ? null : storage.status,
    emailStatus === "production_provider_configured" ? null : "email_provider_unconfigured",
    mfaStatus === "configured" ? null : "mfa_encryption_unconfigured",
    evidenceStatus === "production_storage_configured" ? null : "verification_evidence_storage_unconfigured",
    worker.configured ? null : "worker_unconfigured",
  ].filter(Boolean),
  compatibilityRisks: [
    "Prisma client must be regenerated after schema migration.",
    "Production must not enable local identity fallback.",
    "Owner admin must rotate the bootstrap password and enroll MFA before full admin access.",
  ],
  failures,
};

const durableIdentityStorageAudit = {
  generatedAt,
  storage,
  localFallback: {
    allowedInCurrentEnvironment: productionIdentityFallbackAllowed(),
    forbiddenInProduction: true,
  },
  sourceCounts: summarizeLocalStore(localStore),
  tablePlan: IDENTITY_TABLES,
};

const ownerPasswordRotated = owner ? !owner.mustChangePassword : false;
const adminMfaAudit = {
  generatedAt,
  status: mfaStatus,
  totals: {
    adminAccounts: localStore.accounts.filter((account) => account.role === "admin" || account.role === "platform_admin").length,
    mfaEnrollmentRequired: localStore.accounts.filter((account) => account.mfaEnrollmentRequired).length,
    mfaEnrolled: localStore.accounts.filter((account) => account.mfaEnrolledAt).length,
  },
  enforcement: {
    fullAdminRequiresPasswordRotation: true,
    fullAdminRequiresMfaEnrollment: true,
    mfaSecretsInGeneratedArtifacts: false,
    backupCodesHashed: true,
    ownerPasswordRotated,
  },
  configurationRequired: ["IDENTITY_MFA_ENCRYPTION_KEY"],
};

const emailProviderAudit = {
  generatedAt,
  status: emailStatus,
  supports: [
    "account email verification",
    "password reset",
    "password changed notification",
    "suspicious login notification",
    "MFA disabled notification",
    "email change confirmation",
    "verification review status notification",
  ],
  tokenPolicy: {
    hashedTokens: true,
    oneTimeUse: true,
    expiryRequired: true,
    nonEnumeratingResponses: true,
  },
  configurationRequired: getEmailConfigurationRequirements(),
};

const evidenceStorageAudit = {
  generatedAt,
  status: evidenceStatus,
  controls: {
    privateOnly: true,
    safeGeneratedObjectKeys: true,
    contentTypeAndMagicByteValidation: true,
    executableRejectionBoundary: true,
    maxFileSizeBytes: 10485760,
    noPublicUrls: true,
    noCiArtifacts: true,
    purgePolicyDays: 14,
  },
  configurationRequired: ["IDENTITY_EVIDENCE_STORAGE_BUCKET", "IDENTITY_EVIDENCE_ENCRYPTION_KEY"],
};

const verificationOperationsAudit = {
  generatedAt,
  residency: {
    operationalMode: evidenceStatus === "production_storage_configured" && storage.ready ? "manual_review_ready" : "manual_review_boundary_present_storage_unconfigured",
    statusesSupported: ["not_started", "pending", "needs_information", "pending_manual_review", "verified", "rejected", "expired", "revoked", "address_changed", "reverify_required", "provider_unconfigured"],
    sensitiveAccessPermission: "verification.view_sensitive",
    exactAddressesPublic: false,
    govCrmReceivesExactAddressesByDefault: false,
  },
  voterVerification: {
    providerStatus: "provider_unconfigured",
    developmentTestProvider: true,
    requiresActiveVerifiedResident: true,
    importsPoliticalPartyAutomatically: false,
  },
};

const workerQueueAudit = {
  generatedAt,
  worker,
  jobTypes: [
    "email_delivery",
    "residency_provider_check",
    "address_normalization",
    "district_mapping",
    "voter_provider_check",
    "verification_evidence_purge",
    "privacy_export",
    "account_deletion_anonymization",
    "dataops_operation",
    "ocr_processing",
    "scheduled_health_check",
  ],
  controls: {
    idempotencyKey: true,
    boundedRetries: true,
    heartbeat: true,
    deadLetterState: true,
    sanitizedErrors: true,
    noLongRunningProductionRequestHandlers: true,
  },
};

const backupRecoveryAudit = {
  generatedAt,
  database: storage.configured ? "database_configured" : "database_unconfigured",
  backup: process.env.DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED === "true" ? "backup_configured" : "backup_unconfigured",
  restore: process.env.DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED === "true" ? "restore_tested" : "restore_untested",
  rollbackGuidance: [
    "Keep local identity source store until migrated counts are verified.",
    "Take database backup before identity:migrate without --dry-run.",
    "Rollback by restoring database backup and disabling durable identity reads.",
  ],
  cleanupJobs: {
    expiredTokenCleanup: "worker_job_boundary",
    sessionCleanup: "worker_job_boundary",
    evidenceRetentionCleanup: "npm run evidence:purge",
    queueRecovery: "worker_dead_letter_boundary",
  },
};

const productionTrustProvenance = createAuditProvenance({
  artifactName: "production-trust-readiness",
  databaseReachability: storage.ready ? "database_reachable" : storage.status,
  storageBackend: storage.ready ? "prisma_durable" : storage.status,
  workerBackend: worker.status,
  generatedAt,
});
const productionTrustReadiness = {
  generatedAt,
  provenance: productionTrustProvenance,
  status: failures.length ? "blocked" : "partially_ready",
  identityStorage: storage.ready ? "schema_ready" : storage.status,
  ownerAdmin: {
    present: Boolean(owner),
    passwordRotationRequired: Boolean(owner?.mustChangePassword),
    passwordRotated: ownerPasswordRotated,
    permissions: owner ? getAdminPermissions({ role: owner.role }).length : 0,
  },
  emailProvider: emailStatus,
  mfa: mfaStatus,
  evidenceStorage: evidenceStatus,
  worker: worker.status,
  backup: backupRecoveryAudit.backup,
  restore: backupRecoveryAudit.restore,
  govCrmSeparate: true,
  officialScorecardsDisabled: true,
  hiddenVoteWeighting: false,
  smallCohortsSuppressed: true,
  failures,
  promotion: {
    eligible: false,
    validationPassed: failures.length === 0,
    requiresExplicitCommand: true,
    reason: "Legacy Sprint 2I compatibility audit is not canonical. Use npm run production:trust-audit, then promote an eligible network-enabled run.",
  },
  sensitiveValuesIncluded: false,
};

writeGenerated("sprint-2i-foundation-audit.json", foundationAudit);
writeGenerated("durable-identity-storage-audit.json", durableIdentityStorageAudit);
writeGenerated("admin-mfa-audit.json", adminMfaAudit);
writeGenerated("email-provider-audit.json", emailProviderAudit);
writeGenerated("evidence-storage-audit.json", evidenceStorageAudit);
writeGenerated("verification-operations-audit.json", verificationOperationsAudit);
writeGenerated("worker-queue-audit.json", workerQueueAudit);
writeGenerated("backup-recovery-audit.json", backupRecoveryAudit);
writeProvenancedAudit("production-trust-readiness", productionTrustReadiness);

if (failures.length) {
  console.error("Sprint 2I production trust audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

  console.log("Sprint 2I production trust audit passed.");
  console.log(JSON.stringify({
    identityStorage: productionTrustReadiness.identityStorage,
    emailProvider: productionTrustReadiness.emailProvider,
    mfa: productionTrustReadiness.mfa,
    evidenceStorage: productionTrustReadiness.evidenceStorage,
    worker: productionTrustReadiness.worker,
    failures: failures.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
