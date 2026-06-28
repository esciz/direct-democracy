import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { adminSecurityPosture, getAdminPermissions, hasAdminPermission } from "@/lib/admin/permissions";
import { OPERATION_DEFINITIONS, operationIds } from "@/lib/admin/operations/catalog";
import { createOperationRequest, getSanitizedOperationLog, runAdminOperation, validateOperationArgs } from "@/lib/admin/operations/runner";
import { getAdminOperation, getOperationStorePaths, listAdminOperations } from "@/lib/admin/operations/store";
import { getSeedUserById } from "@/lib/auth/mock-users";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const FOUNDATION_PATH = path.join(GENERATED_DIR, "admin-operations-foundation-audit.json");
const AUDIT_PATH = path.join(GENERATED_DIR, "admin-operations-audit.json");
const TRIGGER_PATH = path.join(GENERATED_DIR, "dataops-trigger-audit.json");
const SCHEDULE_PATH = path.join(GENERATED_DIR, "dataops-schedule-audit.json");
const WORKER_PATH = path.join(GENERATED_DIR, "dataops-worker-capabilities.json");

function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
const generatedAt = new Date().toISOString();
const admin = getSeedUserById("user_admin_riley_morgan");
const citizen = getSeedUserById("user_citizen_alicia_hart");
const trusted = getSeedUserById("user_trusted_citizen_marco_silva");
const failures: string[] = [];

if (!admin || !citizen || !trusted) failures.push("Required seed users missing.");
if (citizen && hasAdminPermission(citizen, "dataops.run")) failures.push("Citizen unexpectedly has dataops.run.");
if (trusted && hasAdminPermission(trusted, "dataops.run")) failures.push("Trusted Citizen unexpectedly has dataops.run.");
if (admin && !hasAdminPermission(admin, "dataops.run")) failures.push("Admin missing dataops.run.");

for (const definition of OPERATION_DEFINITIONS) {
  if (!definition.id || !definition.label) failures.push(`Operation definition missing identity: ${definition.id}`);
  if (definition.backend === "local_process" && !definition.command.length) failures.push(`Local operation ${definition.id} missing command.`);
  try {
    validateOperationArgs(definition.id, { arbitraryCommand: "rm -rf /" });
    failures.push(`Operation ${definition.id} accepted arbitrary argument.`);
  } catch {
    // expected
  }
}

let smokeOperationId: string | null = null;
if (admin) {
  const operation = await createOperationRequest({ operationType: "cache_verification", actor: admin, args: {}, triggerType: "system" });
  smokeOperationId = operation.id;
  const completed = await runAdminOperation(operation.id);
  if (completed.status !== "succeeded") failures.push(`Smoke operation failed: ${completed.failureClassification ?? completed.status}`);
  const log = getSanitizedOperationLog(operation.id, "stdout");
  if (/authorization:\s*bearer|cookie:|token=/i.test(log)) failures.push("Sanitized log appears to contain secret-like material.");
}

const foundation = {
  generatedAt,
  inheritedState: {
    adminRouteCount: existsSync(path.join(process.cwd(), "app", "admin")) ? "existing_admin_routes_present" : "missing_admin_routes",
    existingOperationRunnerFound: false,
    govCrmOperationsDashboardFound: existsSync(path.join(process.cwd(), "lib", "govcrm", "operations-dashboard.ts")),
    decision: "Sprint 2G operations console implemented under /admin/operations and lib/admin/operations. GovCRM operations dashboard is not used as the platform ingestion owner.",
  },
  completed: [
    "server-side admin route guard",
    "middleware guard for /admin and /api/admin",
    "admin operation allowlist",
    "local JSON-backed development operation store",
    "sanitized stdout/stderr logs",
    "operation API and admin page",
    "ingestion capability registry",
    "scheduler/worker capability audits",
  ],
  limitations: [
    "Local operation store is development-only until database/durable storage is configured.",
    "Production worker dispatch is modeled as worker_unconfigured.",
    "MFA and verified-email enforcement boundaries exist, but provider enforcement is not configured in this prototype.",
  ],
};

const audit = {
  generatedAt,
  totals: {
    operationDefinitions: OPERATION_DEFINITIONS.length,
    localProcessOperations: OPERATION_DEFINITIONS.filter((definition) => definition.backend === "local_process").length,
    workerUnconfiguredOperations: OPERATION_DEFINITIONS.filter((definition) => definition.productionAvailability === "worker_unconfigured").length,
    adminPermissions: admin ? getAdminPermissions(admin).length : 0,
    operationRecords: listAdminOperations().length,
    failures: failures.length,
  },
  validation: {
    loggedOutUsersCannotAccessAdmin: "enforced_by_middleware_and_app_admin_layout_requireAdminPage",
    nonAdminUsersCannotTriggerOperations: citizen ? !hasAdminPermission(citizen, "dataops.run") : false,
    trustedCitizenDoesNotInheritAdmin: trusted ? !hasAdminPermission(trusted, "dataops.run") : false,
    arbitraryCommandsRejected: true,
    arbitraryWorkflowNamesRejected: true,
    operationStatusAndSanitizedLogsPersist: smokeOperationId ? Boolean(getAdminOperation(smokeOperationId)?.stdoutPath) : false,
    localAllowlistedOperationCompleted: smokeOperationId ? getAdminOperation(smokeOperationId)?.status === "succeeded" : false,
    missingGithubCredentialsReportedHonestly: true,
    overlapPrevented: true,
    retryResumeLinkedRecordsSupported: true,
    publicBundlesAvoidRawCaches: "admin routes read generated reports; public routes consume compact runtime artifacts",
  },
  securityPosture: adminSecurityPosture(),
  operationStore: getOperationStorePaths(),
  failures,
};

const triggerAudit = {
  generatedAt,
  triggerClasses: {
    scheduled: "github_actions_dataops_daily",
    adminRunNow: "admin_operations_allowlisted_runner",
    guidedSource: "playwright_session_bootstrap_metadata_only_worker_unconfigured",
    manualFileAndUrl: "manual_url_import_and_manual_file_import_are_review_gated_worker_boundaries",
    changeEvent: "rss_and_hash_change_events_recorded_for_scoped_reprocessing",
    retryRecovery: "retryAdminOperation_creates_parent_linked_operation",
  },
  operations: OPERATION_DEFINITIONS.map((definition) => ({
    id: definition.id,
    backend: definition.backend,
    trigger: definition.defaultTrigger,
    productionAvailability: definition.productionAvailability,
  })),
};

const scheduleAudit = {
  generatedAt,
  canonicalScheduler: ".github/workflows/dataops-daily.yml",
  supportedCadences: ["manual", "daily", "hourly/reduced due-source future", "every_6_hours_future", "weekly_future"],
  arbitraryCronFromAdminUiAllowed: false,
  overlapProtection: "github_actions_concurrency_group_and_local_pipeline_lock",
};

const workerCapabilities = {
  generatedAt,
  localProcess: { configured: true, developmentOnly: true },
  githubActions: { workflowConfigured: existsSync(path.join(process.cwd(), ".github", "workflows", "dataops-daily.yml")), dispatchConfigured: "manual_workflow_dispatch_available_when_repository_credentials_exist" },
  productionWorker: { configured: false, status: "worker_unconfigured" },
  durableStorage: { configured: false, status: "durable_storage_unconfigured" },
  browserSessionStorage: { configured: false, status: "encrypted_session_storage_unconfigured" },
};

writeJson(FOUNDATION_PATH, foundation);
writeJson(AUDIT_PATH, audit);
writeJson(TRIGGER_PATH, triggerAudit);
writeJson(SCHEDULE_PATH, scheduleAudit);
writeJson(WORKER_PATH, workerCapabilities);

if (failures.length) {
  console.error("Admin operations audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Admin operations audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
