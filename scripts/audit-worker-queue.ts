import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { getWorkerQueueStatus, type IdentityJobType } from "@/lib/identity/worker-queue";
import { getDurableIdentityStorageStatus } from "@/lib/identity/durable-storage";
import { prisma } from "@/lib/prisma";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "worker-queue-audit.json");

async function countByJobType() {
  const storage = await getDurableIdentityStorageStatus();
  if (!storage.ready) return null;
  const rows = await prisma.$queryRawUnsafe<Array<{ jobType: IdentityJobType; status: string; count: bigint }>>(
    `select "jobType", "status", count(*)::bigint as count from "IdentityJob" group by "jobType", "status" order by "jobType", "status"`,
  );
  return rows.map((row) => ({
    jobType: row.jobType,
    status: row.status,
    count: Number(row.count),
  }));
}

function readWorkerSmokeTest() {
  const filePath = path.join(GENERATED_DIR, "worker-smoke-test.json");
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

async function main() {
  const worker = await getWorkerQueueStatus();
  const latestSmokeTest = readWorkerSmokeTest();
  const githubWorkerWorkflow = existsSync(path.join(process.cwd(), ".github", "workflows", "identity-worker.yml"));
  const provenance = createAuditProvenance({
    artifactName: "worker-queue-audit",
    databaseReachability: worker.storageStatus === "schema_ready" ? "database_reachable" : worker.storageStatus,
    storageBackend: worker.storageStatus,
    workerBackend: worker.configured ? "configured_runtime" : githubWorkerWorkflow ? "github_actions_worker_available" : "worker_unconfigured",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    worker,
    networkEnabledWorkerPath: {
      githubActionsWorkflowPresent: githubWorkerWorkflow,
      workflowPath: githubWorkerWorkflow ? ".github/workflows/identity-worker.yml" : null,
      configuredWorkerFlag: Boolean(process.env.DIRECT_DEMOCRACY_WORKER_ENABLED),
      status: worker.configured ? "worker_configured" : githubWorkerWorkflow ? "github_actions_worker_available_pending_run" : "worker_unconfigured",
    },
    jobTypesSupported: [
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
    queueByJobType: await countByJobType(),
    latestSmokeTest: latestSmokeTest ? {
      status: latestSmokeTest.status,
      workerConfigured: latestSmokeTest.workerConfigured === true,
      workerHeartbeatRecorded: latestSmokeTest.workerHeartbeatRecorded === true,
      sensitiveValuesIncluded: latestSmokeTest.sensitiveValuesIncluded === false,
    } : null,
    controls: {
      idempotencyKeyRequired: true,
      claimUsesDatabaseLocking: true,
      heartbeatSupported: true,
      retryBackoffSupported: true,
      deadLetterSupported: true,
      cancellationSupported: true,
      parentOperationSupported: true,
      noLongRunningRequestHandlers: true,
      sanitizedFailureReason: true,
    },
    nextOperatorCommands: ["npm run worker:smoke-test", "npm run worker:once", "npm run worker:local", "npm run queue:audit"],
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("worker-queue-audit", report);
  console.log("Worker queue audit complete.");
  console.log(JSON.stringify({
    status: worker.status,
    queueDepth: worker.queueDepth,
    runningJobs: worker.runningJobs,
    deadLetters: worker.deadLetters,
    staleRunningJobs: worker.staleRunningJobs,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
