import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { getAdminPermissions, hasAdminPermission, type AdminPermission } from "@/lib/admin/permissions";
import { upsertDurableAdminOperation } from "@/lib/admin/operations/durable-store";
import { getOperationDefinition, type OperationType } from "@/lib/admin/operations/catalog";
import { createAdminOperation, getAdminOperation, listAdminOperations, operationLogPath, upsertAdminOperation, type AdminOperationRecord } from "@/lib/admin/operations/store";
import { getDurableOperationStorageStatus } from "@/lib/identity/durable-storage";
import { createDurableJob } from "@/lib/identity/worker-queue";
import type { AuthUser } from "@/types/domain";

const SECRET_PATTERNS = [
  /(authorization:\s*bearer\s+)[^\s]+/gi,
  /(cookie:\s*)[^\n]+/gi,
  /(set-cookie:\s*)[^\n]+/gi,
  /(token=)[^&\s]+/gi,
  /(password=)[^&\s]+/gi,
  /(secret=)[^&\s]+/gi,
  /(api[_-]?key=)[^&\s]+/gi,
];

function redact(value: string) {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "$1[REDACTED]"), value).slice(0, 250_000);
}

function normalizeArgKey(value: string) {
  return value.replace(/^--/, "");
}

export function validateOperationArgs(operationType: OperationType, rawArgs: Record<string, unknown> = {}) {
  const definition = getOperationDefinition(operationType);
  if (!definition) throw new Error(`Unknown operation: ${operationType}`);
  const args: string[] = [];
  for (const [key, value] of Object.entries(rawArgs)) {
    const normalizedKey = normalizeArgKey(key);
    if (!definition.allowedArgs.includes(normalizedKey)) throw new Error(`Argument not allowed for ${operationType}: ${normalizedKey}`);
    if (typeof value === "boolean") {
      if (value) args.push(`--${normalizedKey}`);
    } else if (typeof value === "string" && value.trim()) {
      if (/[\0\r\n]/.test(value)) throw new Error(`Unsafe argument value for ${normalizedKey}`);
      args.push(`--${normalizedKey}=${value.trim()}`);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      args.push(`--${normalizedKey}=${value}`);
    }
  }
  return args;
}

function environmentSnapshot() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    networkAccess: "unknown_at_operation_start",
    ocrToolsConfigured: existsSync("data/generated/dataops-ocr-capabilities.json"),
    durableStorage: "prisma_adapter_available_when_database_ready",
    productionWorker: "worker_unconfigured",
  };
}

function overlapBlocked(operationType: OperationType, currentOperationId: string) {
  if (operationType !== "dataops_full" && operationType !== "dataops_daily" && operationType !== "dataops_offline") return false;
  return listAdminOperations().some((operation) => operation.id !== currentOperationId && ["queued", "starting", "running"].includes(operation.status) && ["dataops_full", "dataops_daily", "dataops_offline"].includes(operation.operationType));
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function operationWorkerIdempotencyKey(operation: AdminOperationRecord) {
  return `admin-operation-worker:${operation.id}:${operation.operationType}:${operation.validatedArguments.join("|")}`;
}

async function assertDurableOperationsForProduction() {
  if (!isProductionEnvironment()) return;
  const durable = await getDurableOperationStorageStatus();
  if (!durable.ready) throw new Error(`durable_operation_storage_unavailable:${durable.status}`);
}

async function persistOperation(record: AdminOperationRecord) {
  await assertDurableOperationsForProduction();
  const local = upsertAdminOperation(record);
  const durable = await getDurableOperationStorageStatus().catch(() => null);
  if (durable?.ready) {
    const result = await upsertDurableAdminOperation(local);
    if (!result.ok && isProductionEnvironment()) throw new Error(`durable_operation_write_failed:${result.status}`);
  }
  return local;
}

export async function createOperationRequest(input: {
  operationType: OperationType;
  actor: AuthUser;
  args?: Record<string, unknown>;
  triggerType?: AdminOperationRecord["triggerType"];
  parentOperationId?: string | null;
}) {
  await assertDurableOperationsForProduction();
  const definition = getOperationDefinition(input.operationType);
  if (!definition) throw new Error("Unknown operation.");
  for (const permission of definition.permissions) {
    if (!hasAdminPermission(input.actor, permission as AdminPermission)) throw new Error(`Missing permission: ${permission}`);
  }
  const validatedArguments = validateOperationArgs(input.operationType, input.args ?? {});
  const operation = createAdminOperation({
    operationType: definition.id,
    triggerType: input.triggerType ?? definition.defaultTrigger,
    executionBackend: definition.backend,
    actorUserId: input.actor.id,
    actorRole: input.actor.role,
    scope: input.args ?? {},
    sourceIds: typeof input.args?.sourceId === "string" ? [input.args.sourceId] : [],
    jurisdiction: typeof input.args?.jurisdiction === "string" ? input.args.jurisdiction : null,
    documentType: typeof input.args?.["document-type"] === "string" ? input.args["document-type"] : null,
    validatedArguments,
    parentOperationId: input.parentOperationId ?? null,
    environmentCapabilitySnapshot: { ...environmentSnapshot(), permissionsAtTrigger: getAdminPermissions(input.actor) },
  });
  await persistOperation(operation);
  return operation;
}

async function enqueueWorkerOperation(operation: AdminOperationRecord) {
  const job = await createDurableJob({
    jobType: "dataops_operation",
    actorAccountId: operation.actorUserId,
    operationId: operation.id,
    payload: {
      operationId: operation.id,
      operationType: operation.operationType,
      validatedArguments: operation.validatedArguments,
      scope: operation.scope,
    },
    idempotencyKey: operationWorkerIdempotencyKey(operation),
    maxAttempts: 3,
  });
  if (!job.ok) {
    return persistOperation({
      ...operation,
      status: "blocked_by_environment",
      completedAt: new Date().toISOString(),
      failureClassification: `durable_worker_queue_unavailable:${job.status}`,
      progressSummary: "Operation requires a network-enabled worker, but durable worker queue storage is unavailable.",
    });
  }
  return persistOperation({
    ...operation,
    status: "queued",
    heartbeatAt: new Date().toISOString(),
    progressSummary: `Queued for network-enabled worker as ${job.jobId}.`,
    resultArtifactPaths: [`durable-job:${job.jobId}`],
  });
}

export async function dispatchAdminOperation(operationId: string) {
  const operation = getAdminOperation(operationId);
  if (!operation) throw new Error(`Operation not found: ${operationId}`);
  const definition = getOperationDefinition(operation.operationType);
  if (!definition) throw new Error(`Unknown operation definition: ${operation.operationType}`);
  if (definition.backend !== "local_process") return enqueueWorkerOperation(operation);
  return runAdminOperation(operationId);
}

export async function runAdminOperation(operationId: string, options: { fromWorker?: boolean } = {}) {
  await assertDurableOperationsForProduction();
  let operation = getAdminOperation(operationId);
  if (!operation) throw new Error(`Operation not found: ${operationId}`);
  const definition = getOperationDefinition(operation.operationType);
  if (!definition) throw new Error(`Unknown operation definition: ${operation.operationType}`);

  if (operation.cancellationRequested) {
    return persistOperation({ ...operation, status: "cancelled", completedAt: new Date().toISOString(), progressSummary: "Cancelled before start." });
  }

  if (overlapBlocked(operation.operationType, operation.id)) {
    return persistOperation({ ...operation, status: "blocked_by_environment", completedAt: new Date().toISOString(), failureClassification: "overlapping_pipeline_run", progressSummary: "A full pipeline operation is already active." });
  }

  if (definition.backend !== "local_process" && !options.fromWorker) {
    return enqueueWorkerOperation(operation);
  }

  if (!definition.command.length) {
    return persistOperation({
      ...operation,
      status: definition.productionAvailability === "manual_review_only" ? "awaiting_admin" : "blocked_by_environment",
      completedAt: new Date().toISOString(),
      failureClassification: definition.productionAvailability,
      progressSummary: definition.productionAvailability === "manual_review_only" ? "Manual review gate is required before this operation can run." : "No allowlisted command is configured for this operation.",
    });
  }

  const stdoutPath = operationLogPath(operation.id, "stdout");
  const stderrPath = operationLogPath(operation.id, "stderr");
  operation = await persistOperation({ ...operation, status: "starting", startedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString(), stdoutPath, stderrPath, currentStage: definition.id, progressSummary: "Starting local allowlisted operation." });

  const command = definition.command[0];
  const args = [...definition.command.slice(1), ...operation.validatedArguments];
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: "utf8", timeout: 20 * 60 * 1000, env: process.env });
  writeFileSync(stdoutPath, redact(result.stdout ?? ""));
  writeFileSync(stderrPath, redact(`${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`));

  const succeeded = result.status === 0 && !result.error;
  return persistOperation({
    ...operation,
    status: succeeded ? "succeeded" : "failed",
    completedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    progressSummary: succeeded ? "Operation completed." : "Operation failed. Review sanitized logs.",
    failureClassification: succeeded ? null : result.error?.message ?? `exit_${result.status}`,
    resultArtifactPaths: [
      "data/generated/dataops-pipeline-run.json",
      "data/generated/dataops-freshness-audit.json",
      "data/generated/officials-retrieval-run.json",
      "data/generated/carson-city-officials-source-evidence.json",
      "data/generated/carson-city-officials-source-reconciliation.json",
      "data/generated/carson-city-officials-promotion-audit.json",
      "data/generated/officials-coverage-audit.json",
      "data/generated/production-trust-services-plan.json",
      "data/generated/production-trust-readiness.json",
      "data/generated/email-provider-audit.json",
      "data/generated/email-test-audit.json",
      "data/generated/evidence-storage-smoke-test.json",
      "data/generated/evidence-purge-audit.json",
      "data/generated/browser-session-smoke-test.json",
      "data/generated/worker-smoke-test.json",
      "data/generated/worker-queue-audit.json",
      "data/generated/backup-create-audit.json",
      "data/generated/backup-recovery-audit.json",
      "data/generated/restore-smoke-test-audit.json",
      "data/generated/restore-audit.json",
    ].filter((filePath) => existsSync(filePath)),
  });
}

export async function retryAdminOperation(operationId: string, actor: AuthUser) {
  const existing = getAdminOperation(operationId);
  if (!existing) throw new Error("Operation not found.");
  return createOperationRequest({
    operationType: existing.operationType,
    actor,
    args: existing.scope,
    triggerType: "retry",
    parentOperationId: existing.id,
  });
}

export function getSanitizedOperationLog(operationId: string, stream: "stdout" | "stderr") {
  const operation = getAdminOperation(operationId);
  const logPath = stream === "stdout" ? operation?.stdoutPath : operation?.stderrPath;
  if (!logPath || !existsSync(logPath)) return "";
  return redact(readFileSync(logPath, "utf8"));
}
