import "server-only";

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, open, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import operationCatalog from "@/config/admin-operations.json";

export type AdminOperationStep = {
  label: string;
  script: string;
};

export type AdminOperationDefinition = {
  id: string;
  label: string;
  description: string;
  category: string;
  requiresPlaywright: boolean;
  steps: AdminOperationStep[];
};

export type AdminOperationRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type AdminOperationRun = {
  id: string;
  operationId: string;
  operationLabel: string;
  category: string;
  requestedBy: string;
  status: AdminOperationRunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pid: number | null;
  currentStepIndex: number | null;
  currentStepLabel: string | null;
  totalSteps: number;
  exitCode: number | null;
  errorMessage: string | null;
  cancelRequestedAt: string | null;
};

export type AdminOperationsRuntime = {
  enabled: boolean;
  reason: string;
  environment: string;
  runningOnVercel: boolean;
  runnerAvailable: boolean;
  playwrightAvailable: boolean;
  storageLabel: string;
};

const ROOT = process.cwd();
const OPERATIONS_ROOT = path.join(ROOT, ".local", "admin-operations");
const RUNS_ROOT = path.join(OPERATIONS_ROOT, "runs");
const START_LOCK_PATH = path.join(OPERATIONS_ROOT, "start.lock");
const RUNNER_PATH = path.join(ROOT, "scripts", "run-admin-operation.mjs");
const PLAYWRIGHT_PACKAGE_PATH = path.join(ROOT, "node_modules", "playwright", "package.json");
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,95}$/u;
const ACTIVE_STATUSES = new Set<AdminOperationRunStatus>(["queued", "running"]);
const definitions = operationCatalog.operations as AdminOperationDefinition[];

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function runMetadataPath(runId: string) {
  return path.join(RUNS_ROOT, `${runId}.json`);
}

function runLogPath(runId: string) {
  return path.join(RUNS_ROOT, `${runId}.log`);
}

function assertRunId(runId: string) {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error("Invalid operation run identifier.");
  }
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureOperationsStorage() {
  await mkdir(RUNS_ROOT, { recursive: true });
}

async function writeRunRecord(run: AdminOperationRun) {
  await ensureOperationsStorage();
  const targetPath = runMetadataPath(run.id);
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;

  await writeFile(temporaryPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await rename(temporaryPath, targetPath);
}

async function readRunRecord(runId: string): Promise<AdminOperationRun | null> {
  assertRunId(runId);

  try {
    return JSON.parse(await readFile(runMetadataPath(runId), "utf8")) as AdminOperationRun;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function isProcessAlive(pid: number | null) {
  if (!pid || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function reconcileRun(run: AdminOperationRun) {
  if (!ACTIVE_STATUSES.has(run.status)) {
    return run;
  }

  const ageMilliseconds = Date.now() - new Date(run.updatedAt).getTime();
  const queuedTooLong = run.status === "queued" && ageMilliseconds > 60_000;
  const runnerExited = run.status === "running" && run.pid !== null && !isProcessAlive(run.pid) && ageMilliseconds > 5_000;

  if (!queuedTooLong && !runnerExited) {
    return run;
  }

  const now = new Date().toISOString();
  const nextRun: AdminOperationRun = {
    ...run,
    status: "failed",
    updatedAt: now,
    completedAt: now,
    errorMessage: queuedTooLong
      ? "The native operation runner did not start within one minute."
      : "The native operation runner exited before recording a final status.",
  };

  await writeRunRecord(nextRun);
  return nextRun;
}

async function acquireStartLock() {
  await ensureOperationsStorage();

  try {
    return await open(START_LOCK_PATH, "wx");
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST") {
      throw error;
    }

    try {
      const lockStats = await stat(START_LOCK_PATH);

      if (Date.now() - lockStats.mtimeMs > 120_000) {
        await unlink(START_LOCK_PATH);
        return open(START_LOCK_PATH, "wx");
      }
    } catch (lockError) {
      if (!isNodeError(lockError) || lockError.code !== "ENOENT") {
        throw lockError;
      }

      return open(START_LOCK_PATH, "wx");
    }

    throw new Error("Another administrator is starting an operation. Try again after it is queued.");
  }
}

export function getAdminOperationDefinitions() {
  return definitions.map((definition) => ({
    ...definition,
    steps: definition.steps.map((step) => ({ ...step })),
  }));
}

export function getAdminOperationDefinition(operationId: string) {
  return getAdminOperationDefinitions().find((definition) => definition.id === operationId) ?? null;
}

export async function getAdminOperationsRuntime(): Promise<AdminOperationsRuntime> {
  const configuredFlag = process.env.ADMIN_OPERATIONS_ENABLED;
  const requested = configuredFlag ? configuredFlag === "true" : process.env.NODE_ENV !== "production";
  const runningOnVercel = process.env.VERCEL === "1";
  const [runnerAvailable, playwrightAvailable] = await Promise.all([pathExists(RUNNER_PATH), pathExists(PLAYWRIGHT_PACKAGE_PATH)]);
  const enabled = requested && !runningOnVercel && runnerAvailable;
  let reason = "Native operation execution is available.";

  if (runningOnVercel) {
    reason = "Execution is disabled on Vercel because detached jobs and local files are not durable there. Use a persistent self-hosted worker.";
  } else if (!requested) {
    reason = "Set ADMIN_OPERATIONS_ENABLED=true on the persistent application host to enable operation triggers.";
  } else if (!runnerAvailable) {
    reason = "The native operation runner script is missing from this deployment.";
  }

  return {
    enabled,
    reason,
    environment: process.env.NODE_ENV ?? "development",
    runningOnVercel,
    runnerAvailable,
    playwrightAvailable,
    storageLabel: ".local/admin-operations/runs",
  };
}

export async function listAdminOperationRuns(limit = 30) {
  await ensureOperationsStorage();
  const entries = await readdir(RUNS_ROOT, { withFileTypes: true });
  const runIds = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -".json".length))
    .filter((runId) => RUN_ID_PATTERN.test(runId));
  const runs = (
    await Promise.all(
      runIds.map(async (runId) => {
        try {
          const run = await readRunRecord(runId);
          return run ? reconcileRun(run) : null;
        } catch {
          return null;
        }
      }),
    )
  ).filter((run): run is AdminOperationRun => Boolean(run));

  return runs
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, Math.max(1, limit));
}

export async function getAdminOperationRun(runId: string) {
  const run = await readRunRecord(runId);
  return run ? reconcileRun(run) : null;
}

export async function getAdminOperationLogTail(runId: string, maxBytes = 120_000) {
  assertRunId(runId);

  try {
    const logStats = await stat(runLogPath(runId));
    const start = Math.max(0, logStats.size - maxBytes);
    const length = logStats.size - start;
    const handle = await open(runLogPath(runId), "r");

    try {
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, start);
      return buffer.toString("utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

export async function startAdminOperation(operationId: string, requestedBy: string) {
  const runtime = await getAdminOperationsRuntime();

  if (!runtime.enabled) {
    throw new Error(runtime.reason);
  }

  const operation = getAdminOperationDefinition(operationId);

  if (!operation) {
    throw new Error("Unknown administrator operation.");
  }

  if (operation.requiresPlaywright && !runtime.playwrightAvailable) {
    throw new Error("Playwright is not installed on this application host.");
  }

  const lockHandle = await acquireStartLock();

  try {
    const activeRun = (await listAdminOperationRuns(50)).find((run) => ACTIVE_STATUSES.has(run.status));

    if (activeRun) {
      throw new Error(`${activeRun.operationLabel} is already ${activeRun.status}. Only one native operation can run at a time.`);
    }

    const now = new Date().toISOString();
    const run: AdminOperationRun = {
      id: `${Date.now().toString(36)}-${randomUUID().replaceAll("-", "").slice(0, 18)}`,
      operationId: operation.id,
      operationLabel: operation.label,
      category: operation.category,
      requestedBy,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      pid: null,
      currentStepIndex: null,
      currentStepLabel: null,
      totalSteps: operation.steps.length,
      exitCode: null,
      errorMessage: null,
      cancelRequestedAt: null,
    };

    await writeRunRecord(run);

    const child = spawn(process.execPath, [RUNNER_PATH, run.id], {
      cwd: ROOT,
      detached: true,
      env: process.env,
      stdio: "ignore",
    });

    child.unref();
    return run;
  } finally {
    await lockHandle.close();
    await unlink(START_LOCK_PATH).catch(() => undefined);
  }
}

export async function cancelAdminOperation(runId: string) {
  const run = await getAdminOperationRun(runId);

  if (!run) {
    throw new Error("Operation run not found.");
  }

  if (!ACTIVE_STATUSES.has(run.status)) {
    return run;
  }

  const now = new Date().toISOString();
  const nextRun: AdminOperationRun = {
    ...run,
    cancelRequestedAt: now,
    updatedAt: now,
  };

  await writeRunRecord(nextRun);

  if (!run.pid) {
    const cancelledRun: AdminOperationRun = {
      ...nextRun,
      status: "cancelled",
      completedAt: now,
      errorMessage: "Cancelled before the runner started.",
    };
    await writeRunRecord(cancelledRun);
    return cancelledRun;
  }

  try {
    process.kill(process.platform === "win32" ? run.pid : -run.pid, "SIGTERM");
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ESRCH") {
      throw error;
    }

    const cancelledRun: AdminOperationRun = {
      ...nextRun,
      status: "cancelled",
      completedAt: now,
      errorMessage: "The runner had already exited when cancellation was requested.",
    };
    await writeRunRecord(cancelledRun);
    return cancelledRun;
  }

  return nextRun;
}
