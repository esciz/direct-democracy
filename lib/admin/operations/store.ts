import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { OperationBackend, OperationStatus, OperationTriggerType, OperationType } from "@/lib/admin/operations/catalog";

const OPERATIONS_DIR = path.join(process.cwd(), "data", "generated", "admin-operations");
const OPERATIONS_PATH = path.join(OPERATIONS_DIR, "operations.json");

export type AdminOperationRecord = {
  id: string;
  operationType: OperationType;
  triggerType: OperationTriggerType;
  executionBackend: OperationBackend;
  actorUserId: string;
  actorRole: string;
  scope: Record<string, unknown>;
  sourceIds: string[];
  jurisdiction: string | null;
  documentType: string | null;
  validatedArguments: string[];
  createdAt: string;
  queuedAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  completedAt: string | null;
  currentStage: string | null;
  status: OperationStatus;
  progressSummary: string;
  retryCount: number;
  parentOperationId: string | null;
  stdoutPath: string | null;
  stderrPath: string | null;
  resultArtifactPaths: string[];
  failureClassification: string | null;
  cancellationRequested: boolean;
  environmentCapabilitySnapshot: Record<string, unknown>;
  externalRunUrl: string | null;
};

function readOperations(): AdminOperationRecord[] {
  try {
    return JSON.parse(readFileSync(OPERATIONS_PATH, "utf8")) as AdminOperationRecord[];
  } catch {
    return [];
  }
}

function writeOperations(records: AdminOperationRecord[]) {
  mkdirSync(OPERATIONS_DIR, { recursive: true });
  writeFileSync(OPERATIONS_PATH, `${JSON.stringify(records, null, 2)}\n`);
}

export function getOperationStorePaths() {
  return {
    operationsDir: OPERATIONS_DIR,
    operationsPath: OPERATIONS_PATH,
    durableStorageStatus: "local_file_adapter_with_prisma_durable_adapter",
  };
}

export function listAdminOperations() {
  return readOperations().sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getAdminOperation(id: string) {
  return readOperations().find((record) => record.id === id) ?? null;
}

export function upsertAdminOperation(record: AdminOperationRecord) {
  const records = readOperations();
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = record;
  else records.push(record);
  writeOperations(records.slice(-250));
  return record;
}

export function createAdminOperation(input: Omit<AdminOperationRecord, "id" | "createdAt" | "queuedAt" | "startedAt" | "heartbeatAt" | "completedAt" | "currentStage" | "status" | "progressSummary" | "retryCount" | "stdoutPath" | "stderrPath" | "resultArtifactPaths" | "failureClassification" | "cancellationRequested" | "externalRunUrl">) {
  const now = new Date().toISOString();
  return upsertAdminOperation({
    ...input,
    id: `admin-operation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    queuedAt: now,
    startedAt: null,
    heartbeatAt: null,
    completedAt: null,
    currentStage: null,
    status: "queued",
    progressSummary: "Queued.",
    retryCount: 0,
    stdoutPath: null,
    stderrPath: null,
    resultArtifactPaths: [],
    failureClassification: null,
    cancellationRequested: false,
    externalRunUrl: null,
  });
}

export function operationLogPath(operationId: string, stream: "stdout" | "stderr") {
  mkdirSync(OPERATIONS_DIR, { recursive: true });
  return path.join(OPERATIONS_DIR, `${operationId}.${stream}.log`);
}

export function readOperationLog(logPath: string | null) {
  if (!logPath || !existsSync(logPath)) return "";
  return readFileSync(logPath, "utf8");
}
