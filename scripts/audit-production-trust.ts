import "@/lib/env/load-local-env";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { inspectBrowserSessionStorage } from "@/lib/admin/operations/browser-session-storage";
import { getDurableIdentityStorageStatus, getDurableOperationStorageStatus, productionIdentityFallbackAllowed } from "@/lib/identity/durable-storage";
import { runDatabaseConnectivityAudit } from "@/lib/identity/database-diagnostics";
import { getEmailConfigurationRequirements, getEmailProviderStatus } from "@/lib/identity/email";
import { getEvidenceStorageStatus } from "@/lib/identity/evidence-storage";
import { getMfaConfigurationStatus } from "@/lib/identity/mfa";
import { readIdentityStore } from "@/lib/identity/storage";
import { getWorkerQueueStatus } from "@/lib/identity/worker-queue";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

function readGenerated(fileName: string) {
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function sourceHas(relativePath: string, needle: string) {
  const filePath = path.join(process.cwd(), relativePath);
  return existsSync(filePath) && readFileSync(filePath, "utf8").includes(needle);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function smokePassed(report: Record<string, unknown> | null, expectedStorageStatus?: string) {
  if (!report) return false;
  const status = asString(report.status);
  if (!status?.startsWith("smoke_passed")) return false;
  if (expectedStorageStatus && report.storageStatus !== expectedStorageStatus) return false;
  return true;
}

function emailProductionTestPassed(emailAudit: Record<string, unknown> | null, emailTest: Record<string, unknown> | null) {
  return emailAudit?.status === "production_configured"
    && emailTest?.status === "sent"
    && emailTest.productionConfirmed === true
    && emailTest.queuedThroughDurableWorker === true
    && emailTest.emailSent === true;
}

function officialsPipelineReady(input: {
  officialsPromotion: Record<string, unknown> | null;
  officialsCoverage: Record<string, unknown> | null;
  officialsHealth: Record<string, unknown> | null;
}) {
  const promotion = input.officialsPromotion;
  const coverageTotals = asRecord(input.officialsCoverage?.totals);
  const healthRecords = asArray(input.officialsHealth?.records);
  const failures = asArray(input.officialsCoverage?.failures);
  const recordsPromoted = asNumber(promotion?.recordsPromoted) ?? 0;
  const conflictsRemaining = asNumber(promotion?.conflictsRemaining) ?? 0;
  const runtimeOfficials = asNumber(coverageTotals?.carsonCityRuntimeOfficials) ?? 0;
  const cachedSources = healthRecords.filter((record) => Boolean(asRecord(record)?.cachedPath)).length;
  return {
    ready: promotion?.status === "promoted" && recordsPromoted >= 5 && conflictsRemaining === 0 && runtimeOfficials >= 5 && failures.length === 0,
    status: asString(promotion?.status) ?? "not_promoted",
    recordsPromoted,
    conflictsRemaining,
    runtimeOfficials,
    cachedSources,
    coverageFailures: failures.length,
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const store = readIdentityStore();
  const owner = store.accounts.find((account) => account.role === "admin" || account.role === "platform_admin");
  const database = await runDatabaseConnectivityAudit({ timeoutMs: 4000 });
  const canInspectDurableSchema = database.probes.readOnlyQuery.status === "ok";
  const identity = canInspectDurableSchema
    ? await getDurableIdentityStorageStatus()
    : { status: database.classification, configured: true, ready: false, missingTables: [], error: "Durable identity schema was not inspected because this environment cannot reach the database." };
  const operations = canInspectDurableSchema
    ? await getDurableOperationStorageStatus()
    : { status: database.classification, configured: true, ready: false, missingTables: [], error: "Durable operation schema was not inspected because this environment cannot reach the database." };
  const worker = await getWorkerQueueStatus();
  const emailProvider = getEmailProviderStatus();
  const evidenceStorage = getEvidenceStorageStatus();
  const browserSessionStorage = inspectBrowserSessionStorage();
  const backupAudit = readGenerated("backup-recovery-audit.json");
  const restoreAudit = readGenerated("restore-audit.json");
  const emailAudit = readGenerated("email-provider-audit.json");
  const emailTest = readGenerated("email-test-audit.json");
  const evidenceSmoke = readGenerated("evidence-storage-smoke-test.json");
  const evidencePurgeAudit = readGenerated("evidence-purge-audit.json");
  const browserSmoke = readGenerated("browser-session-smoke-test.json");
  const workerSmoke = readGenerated("worker-smoke-test.json");
  const secretsAudit = readGenerated("secrets-audit.json");
  const trustPlan = readGenerated("production-trust-services-plan.json");
  const officialsPromotion = readGenerated("carson-city-officials-promotion-audit.json");
  const officialsCoverage = readGenerated("officials-coverage-audit.json");
  const officialsHealth = readGenerated("officials-source-health.json");
  const officials = officialsPipelineReady({ officialsPromotion, officialsCoverage, officialsHealth });
  const databaseReachability = database.classification;
  const productionEmailReady = emailProductionTestPassed(emailAudit, emailTest);
  const evidenceProductionReady = evidenceStorage === "production_storage_configured" && smokePassed(evidenceSmoke, "production_storage_configured");
  const evidenceLocalSmokePassed = smokePassed(evidenceSmoke, "local_encrypted_development");
  const evidencePurgeReady = evidencePurgeAudit?.privateStorageOnly === true && evidencePurgeAudit?.rawEvidenceIncluded === false;
  const browserProductionReady = browserSessionStorage.status === "production_storage_configured" && smokePassed(browserSmoke, "production_storage_configured");
  const browserLocalSmokePassed = smokePassed(browserSmoke, "local_encrypted_development");
  const workerSmokePassed = workerSmoke?.status === "smoke_passed";
  const backupReady = backupAudit?.backup === "backup_configured";
  const restoreReady = restoreAudit?.restore === "restore_tested";
  const secretsReady = Array.isArray(secretsAudit?.missingRequiredDomains) && secretsAudit.missingRequiredDomains.length === 0;
  const dataOpsSchedulerPresent = sourceHas(".github/workflows/identity-worker.yml", "schedule:");
  const officialsSchedulerPresent = sourceHas("lib/admin/operations/catalog.ts", "officials_carson_city_refresh");
  const failures = [
    identity.ready ? null : `identity_storage:${identity.status}`,
    operations.ready ? null : `operation_storage:${operations.status}`,
    productionEmailReady ? null : `email:${emailAudit?.status ?? emailProvider}`,
    evidenceProductionReady ? null : `evidence:${evidenceStorage}`,
    evidencePurgeReady ? null : "evidence_purge:not_verified",
    worker.configured && workerSmokePassed ? null : `worker:${worker.status}:${workerSmoke?.status ?? "smoke_not_run"}`,
    browserProductionReady ? null : `browser_session:${browserSessionStorage.status}`,
    backupReady ? null : `backup:${backupAudit?.backup ?? "backup_unconfigured"}`,
    restoreReady ? null : `restore:${restoreAudit?.restore ?? "restore_untested"}`,
    secretsReady ? null : `secrets:${Array.isArray(secretsAudit?.missingRequiredDomains) ? secretsAudit.missingRequiredDomains.length : "audit_missing"}`,
    dataOpsSchedulerPresent ? null : "dataops_scheduler:missing",
    officialsSchedulerPresent ? null : "officials_scheduler:missing",
    officials.ready ? null : `officials:${officials.status}`,
  ].filter((value): value is string => Boolean(value));
  const blockers = {
    database: database.classification === "database_reachable" ? "ready" : "blocked",
    identityStorage: identity.ready ? "ready" : "blocked",
    operationStorage: operations.ready ? "ready" : "blocked",
    email: productionEmailReady ? "ready" : emailProvider === "production_provider_configured" ? "partially_ready" : "unconfigured",
    evidence: evidenceProductionReady ? "ready" : evidenceLocalSmokePassed ? "partially_ready" : evidenceStorage === "production_storage_configured" ? "degraded" : "unconfigured",
    evidencePurge: evidencePurgeReady ? "ready" : "blocked",
    browserSessionStorage: browserProductionReady ? "ready" : browserLocalSmokePassed ? "partially_ready" : browserSessionStorage.status === "production_storage_configured" ? "degraded" : "unconfigured",
    worker: worker.configured && workerSmokePassed ? "ready" : worker.configured ? "partially_ready" : "unconfigured",
    backup: backupReady ? "ready" : "unconfigured",
    restore: restoreReady ? "ready" : "blocked",
    secrets: secretsReady ? "ready" : "blocked",
    dataOpsScheduler: dataOpsSchedulerPresent ? "ready" : "blocked",
    officialsScheduler: officialsSchedulerPresent ? "ready" : "blocked",
    carsonCityOfficials: officials.ready ? "ready" : "blocked",
    officialScorecards: "not_applicable",
  };
  const status = failures.length ? "blocked" : "ready";
  const provenance = createAuditProvenance({
    artifactName: "production-trust-readiness",
    databaseReachability,
    storageBackend: identity.ready && operations.ready ? "prisma_durable" : "unavailable",
    workerBackend: worker.status,
    generatedAt,
  });

  const report = {
    generatedAt,
    status,
    readiness: blockers,
    provenance,
    database: {
      classification: database.classification,
      hostSummary: database.configuration.hostSummary,
      readOnlyQuery: database.probes.readOnlyQuery.status,
      migrationTable: database.probes.migrationTable.status,
      schema: database.probes.schema.status,
      credentialsRedacted: true,
    },
    identityStorage: identity.ready ? "schema_ready" : identity.status,
    operationStorage: operations.ready ? "schema_ready" : operations.status,
    ownerAdmin: owner ? {
      present: true,
      passwordRotated: !owner.mustChangePassword,
      mfaEnabled: Boolean(owner.mfaEnabled),
      mfaEnrolled: Boolean(owner.mfaEnrolledAt),
    } : { present: false },
    localIdentityFallback: {
      allowedInCurrentEnvironment: productionIdentityFallbackAllowed(),
      forbiddenInProduction: true,
    },
    emailProvider,
    emailAuditStatus: emailAudit?.status ?? null,
    emailProductionTest: emailTest ? {
      status: emailTest.status,
      productionConfirmed: emailTest.productionConfirmed === true,
      queuedThroughDurableWorker: emailTest.queuedThroughDurableWorker === true,
      emailSent: emailTest.emailSent === true,
    } : null,
    emailRequirements: getEmailConfigurationRequirements(),
    mfa: getMfaConfigurationStatus(),
    evidenceStorage,
    evidenceStorageSmoke: evidenceSmoke ? {
      status: evidenceSmoke.status,
      uploadSucceeded: evidenceSmoke.uploadSucceeded,
      authorizedReadSucceeded: evidenceSmoke.authorizedReadSucceeded,
      purgeSucceeded: evidenceSmoke.purgeSucceeded,
    } : null,
    evidencePurge: evidencePurgeAudit ? {
      status: evidencePurgeAudit.status,
      dueForPurge: evidencePurgeAudit.dueForPurge,
      privateStorageOnly: evidencePurgeAudit.privateStorageOnly === true,
      rawEvidenceIncluded: evidencePurgeAudit.rawEvidenceIncluded === true,
    } : null,
    browserSessionStorage: browserSessionStorage.status,
    browserSessionSmoke: browserSmoke ? {
      status: browserSmoke.status,
      encryptedWriteSucceeded: browserSmoke.encryptedWriteSucceeded,
      retrievalSucceeded: browserSmoke.retrievalSucceeded,
      revocationRecorded: browserSmoke.revocationRecorded,
    } : null,
    worker: worker.status,
    workerSmoke: workerSmoke ? {
      status: workerSmoke.status,
      internalJob: asRecord(workerSmoke.internalJob)?.status ?? null,
      emailJob: asRecord(workerSmoke.emailJob)?.status ?? null,
      evidencePurgeJob: asRecord(workerSmoke.evidencePurgeJob)?.status ?? null,
      workerHeartbeatRecorded: workerSmoke.workerHeartbeatRecorded === true,
    } : null,
    queue: {
      depth: worker.queueDepth,
      running: worker.runningJobs,
      deadLetters: worker.deadLetters,
      staleRunning: worker.staleRunningJobs,
    },
    backup: backupAudit?.backup ?? (process.env.DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED === "true" ? "backup_configured" : "backup_unconfigured"),
    restore: restoreAudit?.restore ?? (process.env.DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED === "true" ? "restore_tested" : "restore_untested"),
    trustServicesPlan: trustPlan ? {
      generatedAt: trustPlan.generatedAt,
      services: Array.isArray(trustPlan.services) ? trustPlan.services.length : null,
      sensitiveValuesIncluded: trustPlan.sensitiveValuesIncluded === false,
    } : null,
    carsonCityOfficials: officials,
    lastKnownNetworkEnabledCutover: readGenerated("identity-cutover-audit.json"),
    auditPolicy: {
      canonicalUpdatedByThisCommand: false,
      canonicalPromotionCommand: "npm run audit:promote -- --run-id=<run-id>",
      environmentScopedArtifact: `data/generated/production-trust-readiness.${provenance.executionEnvironment.replaceAll("_", "-")}.json`,
    },
    disabledByDesignThisSprint: {
      liveVoterRegistrationProvider: true,
      officialAccountabilityScorecards: true,
      hiddenVoteWeighting: true,
      destructiveDatabaseReset: true,
      plaintextEvidenceStorage: true,
      plaintextBrowserSessionStorage: true,
      govCrmIdentityOwnership: true,
    },
    sourceChecks: {
      adminRoutesProtected: sourceHas("app/admin/layout.tsx", "requireAdminPage"),
      adminApiProtected: sourceHas("proxy.ts", '"/api/admin/:path*"'),
      canonicalAdminRedirect: sourceHas("app/admin/page.tsx", 'redirect("/admin/operations")'),
      durableMigrationScriptPresent: sourceHas("scripts/migrate-identity-store.ts", "--apply"),
      databaseDiagnosticPresent: sourceHas("scripts/diagnose-database.ts", "database-connectivity-audit.json"),
      githubActionsWorkerPresent: sourceHas(".github/workflows/identity-worker.yml", "Identity Worker"),
      productionEmailTestPresent: sourceHas("scripts/test-production-email.ts", "queuedThroughDurableWorker"),
      workerSmokeTestPresent: sourceHas("scripts/worker-smoke-test.ts", "scheduled_health_check"),
      trustServicesPlanPresent: existsSync(path.join(GENERATED_DIR, "production-trust-services-plan.json")),
    },
    secrets: secretsAudit ? {
      missingRequiredDomains: secretsAudit.missingRequiredDomains,
      separation: secretsAudit.separation,
    } : null,
    failures,
    promotion: {
      eligible: provenance.networkCapability === "available" && database.probes.readOnlyQuery.status === "ok" && reportSafeFailuresOnly(failures),
      databaseChecksRan: true,
      validationPassed: failures.length === 0,
      requiresExplicitCommand: true,
    },
    sensitiveValuesIncluded: false,
  };
  const written = writeProvenancedAudit("production-trust-readiness", report);
  console.log("Production trust readiness audit complete.");
  console.log(JSON.stringify({
    runId: provenance.runId,
    status: report.status,
    environment: provenance.executionEnvironment,
    database: report.database.classification,
    identityStorage: report.identityStorage,
    operationStorage: report.operationStorage,
    emailProvider: report.emailProvider,
    evidenceStorage: report.evidenceStorage,
    worker: report.worker,
    failures: report.failures.length,
    canonicalUpdated: false,
    runPath: written.runPath,
  }, null, 2));
}

function reportSafeFailuresOnly(failures: string[]) {
  return failures.every((failure) => !/secret|token|password|credential/i.test(failure));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
