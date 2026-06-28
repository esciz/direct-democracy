import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { inspectBrowserSessionStorage } from "@/lib/admin/operations/browser-session-storage";
import { getEmailConfigurationRequirements, getEmailProviderStatus } from "@/lib/identity/email";
import { getEvidenceStorageStatus } from "@/lib/identity/evidence-storage";
import { isDatabaseConfigured } from "@/lib/identity/durable-storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const PLAN_PATH = path.join(GENERATED_DIR, "production-trust-services-plan.json");

function configured(name: string) {
  const value = process.env[name];
  return Boolean(value && value.trim() && !/replace-with|placeholder/i.test(value));
}

function workflowHas(fileName: string, needle: string) {
  const filePath = path.join(process.cwd(), ".github", "workflows", fileName);
  return existsSync(filePath) && readFileSync(filePath, "utf8").includes(needle);
}

function schemaProvider() {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  if (!existsSync(schemaPath)) return "unknown";
  const match = readFileSync(schemaPath, "utf8").match(/datasource\s+db\s+\{[\s\S]*?provider\s*=\s*"([^"]+)"/);
  return match?.[1] ?? "unknown";
}

function safeService(input: {
  service: string;
  selectedBackend: string;
  whySelected: string;
  configurationStatus: string;
  requiredSecretNames?: string[];
  requiredVariableNames?: string[];
  localDevelopmentBehavior: string;
  githubActionsBehavior: string;
  productionBehavior: string;
  remainingManualOperatorSteps: string[];
}) {
  return {
    requiredSecretNames: [],
    requiredVariableNames: [],
    ...input,
    secretValuesIncluded: false,
    credentialValuesIncluded: false,
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const emailStatus = getEmailProviderStatus();
  const evidenceStatus = getEvidenceStorageStatus();
  const browserStatus = inspectBrowserSessionStorage().status;
  const workerStatus = process.env.DIRECT_DEMOCRACY_WORKER_ENABLED ? "worker_configured" : "worker_unconfigured";
  const backupConfigured = process.env.DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED === "true";
  const restoreTested = process.env.DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED === "true";
  const workerWorkflowPresent = existsSync(path.join(process.cwd(), ".github", "workflows", "identity-worker.yml"));
  const provider = schemaProvider();
  const provenance = createAuditProvenance({
    artifactName: "production-trust-services-plan",
    databaseReachability: isDatabaseConfigured() ? "configured_unverified" : "database_unconfigured",
    storageBackend: evidenceStatus,
    workerBackend: workerStatus,
    generatedAt,
  });

  const plan = {
    generatedAt,
    provenance,
    scope: "Sprint 2I-D-B2 production trust services",
    summary: {
      databaseProvider: provider,
      networkWorkerWorkflowPresent: workerWorkflowPresent,
      productionEmailStatus: emailStatus,
      evidenceStorageStatus: evidenceStatus,
      browserSessionStorageStatus: browserStatus,
      workerStatus,
      backupStatus: backupConfigured ? "backup_configured_unverified_by_this_plan" : "backup_unconfigured",
      restoreStatus: restoreTested ? "restore_tested_by_operator_flag" : "restore_untested",
      realProviderSmokeTestsRequiredBeforeResidencyEvidenceCollection: true,
    },
    services: [
      safeService({
        service: "durable_identity_and_admin_operations",
        selectedBackend: `Prisma ${provider}`,
        whySelected: "The repo already uses Prisma identity, session, operation, and worker-job tables; reusing it avoids a second identity or queue system.",
        configurationStatus: isDatabaseConfigured() ? "database_configured_unverified_by_plan" : "database_unconfigured",
        requiredSecretNames: ["DATABASE_URL"],
        localDevelopmentBehavior: "Local fallback identity is allowed only outside production; production reads must use durable Prisma storage.",
        githubActionsBehavior: "Workflows receive DATABASE_URL through protected secrets and run diagnostics before worker or migration steps.",
        productionBehavior: "Production must fail closed when durable identity or operation tables are unavailable.",
        remainingManualOperatorSteps: ["Run npm run database:diagnose", "Run npm run identity:cutover-audit", "Promote only a successful network-enabled production trust audit."],
      }),
      safeService({
        service: "production_email",
        selectedBackend: "Existing provider-neutral identity email adapter; Resend is the only concrete production adapter currently implemented.",
        whySelected: "The identity layer already centralizes token creation, sanitized delivery logs, and provider selection.",
        configurationStatus: emailStatus,
        requiredSecretNames: getEmailConfigurationRequirements(),
        requiredVariableNames: ["DIRECT_DEMOCRACY_EMAIL_TEST_RECIPIENT_ALLOWLIST", "DIRECT_DEMOCRACY_NETWORK_ENABLED"],
        localDevelopmentBehavior: "Development adapter writes metadata-only private outbox entries and never writes tokens to generated artifacts.",
        githubActionsBehavior: "Production tests require protected email secrets and an allowlisted recipient; arbitrary workflow recipients are not trusted.",
        productionBehavior: "Production readiness requires npm run email:production-test with confirmation, network enabled, durable queue processing, and provider acceptance.",
        remainingManualOperatorSteps: ["Verify sender/domain with the provider.", "Set provider secrets.", "Set an authorized test recipient allowlist.", "Run npm run email:production-test -- --recipient=<authorized> --confirm-production-send."],
      }),
      safeService({
        service: "private_verification_evidence_storage",
        selectedBackend: "Existing identity evidence storage boundary with encrypted local-development storage and production private object-storage configuration gate.",
        whySelected: "The identity layer already keeps evidence separate from public civic caches, browser sessions, and generated artifacts.",
        configurationStatus: evidenceStatus,
        requiredSecretNames: ["IDENTITY_EVIDENCE_ENCRYPTION_KEY"],
        requiredVariableNames: ["IDENTITY_EVIDENCE_STORAGE_BUCKET", "IDENTITY_EVIDENCE_KEY_VERSION"],
        localDevelopmentBehavior: "Encrypted fixture-only local smoke tests may run with an explicit ephemeral development key flag.",
        githubActionsBehavior: "Production evidence smoke tests require private storage variables and protected encryption-key secrets.",
        productionBehavior: "Do not collect real residency evidence until encrypted upload/read/unauthorized-read/purge smoke tests pass against the configured private backend.",
        remainingManualOperatorSteps: ["Configure private object storage.", "Configure independent evidence encryption key.", "Run npm run evidence:smoke-test.", "Run npm run evidence:purge-audit."],
      }),
      safeService({
        service: "encrypted_browser_session_storage",
        selectedBackend: "Existing admin operations browser-session storage boundary with separate Playwright session key namespace.",
        whySelected: "Authenticated source sessions are operational secrets and must stay separate from evidence storage and public source caches.",
        configurationStatus: browserStatus,
        requiredSecretNames: ["PLAYWRIGHT_SESSION_STORAGE_KEY"],
        requiredVariableNames: ["PLAYWRIGHT_SESSION_STORAGE_BUCKET", "PLAYWRIGHT_SESSION_KEY_VERSION"],
        localDevelopmentBehavior: "Fixture-only encrypted local smoke tests are allowed with an explicit ephemeral development key flag.",
        githubActionsBehavior: "Workflow artifacts must include metadata-only audits and never raw storage state.",
        productionBehavior: "Production readiness requires encrypted round-trip, expiry detection, revocation, and post-revocation denial.",
        remainingManualOperatorSteps: ["Configure private browser-session storage.", "Configure independent browser-session key.", "Run npm run browser-sessions:smoke-test."],
      }),
      safeService({
        service: "durable_network_worker",
        selectedBackend: workerWorkflowPresent ? "GitHub Actions durable worker plus local operator worker" : "local operator worker only",
        whySelected: "The repo already has IdentityJob queue primitives and an allowlisted operation runner.",
        configurationStatus: workerStatus,
        requiredSecretNames: ["DATABASE_URL", "DIRECT_DEMOCRACY_EMAIL_API_KEY", "IDENTITY_EVIDENCE_ENCRYPTION_KEY", "PLAYWRIGHT_SESSION_STORAGE_KEY"],
        requiredVariableNames: ["DIRECT_DEMOCRACY_WORKER_ENABLED", "DIRECT_DEMOCRACY_WORKER_BATCH_SIZE", "DIRECT_DEMOCRACY_NETWORK_ENABLED"],
        localDevelopmentBehavior: "npm run worker:smoke-test enqueues and claims a harmless internal job when durable storage is reachable.",
        githubActionsBehavior: "identity-worker.yml runs scheduled/manual bounded batches, audits the queue, and uploads non-sensitive diagnostics.",
        productionBehavior: "Production web requests enqueue work; bounded workers claim jobs, heartbeat, retry, and dead-letter through durable storage.",
        remainingManualOperatorSteps: ["Enable protected GitHub environment secrets.", "Run npm run worker:smoke-test in a network-enabled durable environment.", "Confirm worker heartbeat and queue health."],
      }),
      safeService({
        service: "backup_and_restore",
        selectedBackend: "Database-provider native backup/restore first; encrypted private-storage fallback only if provider-native backup is unavailable.",
        whySelected: "Provider-native snapshots/PITR are safer than ad hoc dumps and avoid plaintext backup artifacts.",
        configurationStatus: backupConfigured && restoreTested ? "backup_and_restore_tested" : backupConfigured ? "backup_configured_restore_untested" : "backup_unconfigured",
        requiredSecretNames: ["DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL"],
        requiredVariableNames: ["DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED", "DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED", "DIRECT_DEMOCRACY_DATABASE_BACKUP_PROVIDER"],
        localDevelopmentBehavior: "Commands write truthful refusal/status artifacts and never restore into the primary database.",
        githubActionsBehavior: "Restore smoke tests require a protected isolated target and must upload only non-sensitive audit counts.",
        productionBehavior: "Production trust remains blocked until backup status is verified and an isolated restore smoke test succeeds.",
        remainingManualOperatorSteps: ["Verify provider backup/PITR status.", "Run npm run backup:audit.", "Run npm run restore:smoke-test against an isolated target.", "Run npm run restore:audit."],
      }),
      safeService({
        service: "carson_city_officials_pipeline",
        selectedBackend: "Existing officials source registry, network retrieval, verification, reconciliation, guarded promotion, and coverage audit.",
        whySelected: "The Carson City officials path is now a permanent parallel DataOps responsibility and already has guarded canonical promotion.",
        configurationStatus: workflowHas("identity-worker.yml", "officials") ? "worker_workflow_available" : "manual_operator_sync_available",
        requiredVariableNames: ["OFFICIALS_NETWORK_ENABLED", "OFFICIALS_EXECUTION_ENVIRONMENT"],
        localDevelopmentBehavior: "npm run officials:carson-city:sync performs retrieval, reconciliation, promotion guard, regeneration, and browse audit when network is enabled.",
        githubActionsBehavior: "Officials refresh operations are allowlisted and must preserve source evidence artifacts.",
        productionBehavior: "Canonical officials promotion requires clean reconciliation and governing-body guard success.",
        remainingManualOperatorSteps: ["Run OFFICIALS_NETWORK_ENABLED=true npm run officials:carson-city:sync.", "Run npm run officials:source-verification:audit.", "Confirm canonical promotion health."],
      }),
    ],
    githubActionsRequiredConfiguration: {
      repositorySecrets: [
        "DATABASE_URL",
        "DIRECT_DEMOCRACY_EMAIL_PROVIDER",
        "DIRECT_DEMOCRACY_EMAIL_FROM",
        "DIRECT_DEMOCRACY_EMAIL_API_KEY",
        "IDENTITY_MFA_ENCRYPTION_KEY",
      ],
      protectedEnvironmentSecrets: [
        "IDENTITY_EVIDENCE_ENCRYPTION_KEY",
        "PLAYWRIGHT_SESSION_STORAGE_KEY",
        "DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL",
      ],
      repositoryVariables: [
        "DIRECT_DEMOCRACY_WORKER_ENABLED",
        "DIRECT_DEMOCRACY_NETWORK_ENABLED",
        "DIRECT_DEMOCRACY_WORKER_BATCH_SIZE",
        "IDENTITY_EVIDENCE_STORAGE_BUCKET",
        "PLAYWRIGHT_SESSION_STORAGE_BUCKET",
        "DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED",
        "DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED",
      ],
    },
    guardrails: {
      noRealResidencyEvidenceBeforeEvidenceSmokePasses: true,
      noLiveVoterRegistrationMatching: true,
      noOfficialScorecards: true,
      noHiddenVoteWeighting: true,
      noGovCrmOwnershipOfPublicTrustServices: true,
      noSecondIdentityQueueOrAdminSystem: true,
    },
    sensitiveValuesIncluded: false,
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(PLAN_PATH, `${JSON.stringify(plan, null, 2)}\n`);
  writeProvenancedAudit("production-trust-services-plan", plan);
  console.log("Production trust services plan generated.");
  console.log(JSON.stringify({
    path: PLAN_PATH,
    services: plan.services.length,
    emailStatus,
    evidenceStatus,
    browserStatus,
    workerStatus,
    sensitiveValuesIncluded: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
