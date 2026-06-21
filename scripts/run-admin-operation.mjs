import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const RUNS_ROOT = path.join(ROOT, ".local", "admin-operations", "runs");
const CATALOG_PATH = path.join(ROOT, "config", "admin-operations.json");
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,95}$/u;
const runId = process.argv[2] ?? "";
let cancellationRequested = false;
let currentChild = null;

class CancelledOperationError extends Error {
  constructor(message = "Operation cancelled by an administrator.") {
    super(message);
    this.name = "CancelledOperationError";
  }
}

function metadataPath() {
  return path.join(RUNS_ROOT, `${runId}.json`);
}

function logPath() {
  return path.join(RUNS_ROOT, `${runId}.log`);
}

async function atomicWriteJson(targetPath, value) {
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, targetPath);
}

async function readRun() {
  return JSON.parse(await readFile(metadataPath(), "utf8"));
}

async function updateRun(patch) {
  const run = await readRun();
  const nextRun = {
    ...run,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await atomicWriteJson(metadataPath(), nextRun);
  return nextRun;
}

async function appendLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  const handle = await open(logPath(), "a");

  try {
    await handle.write(line);
  } finally {
    await handle.close();
  }
}

async function loadOperation(operationId) {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const operation = Array.isArray(catalog.operations)
    ? catalog.operations.find((entry) => entry && entry.id === operationId)
    : null;

  if (!operation || !Array.isArray(operation.steps) || operation.steps.length === 0) {
    throw new Error(`Operation ${operationId} is not present in the administrator allowlist.`);
  }

  for (const step of operation.steps) {
    if (
      !step ||
      typeof step.label !== "string" ||
      typeof step.script !== "string" ||
      !/^[a-z0-9][a-z0-9:-]{1,80}$/u.test(step.script)
    ) {
      throw new Error(`Operation ${operationId} contains an invalid script definition.`);
    }
  }

  return operation;
}

function normalizeCommand(command) {
  if (process.platform === "win32" && command === "npm") {
    return "npm.cmd";
  }

  return command;
}

async function runStep(step, stepIndex, totalSteps) {
  if (cancellationRequested) {
    throw new CancelledOperationError();
  }

  const command = normalizeCommand("npm");
  const args = ["run", step.script];
  const commandLabel = `npm run ${step.script}`;

  await updateRun({
    currentStepIndex: stepIndex,
    currentStepLabel: step.label,
  });
  await appendLog(`Step ${stepIndex + 1}/${totalSteps}: ${step.label}`);
  await appendLog(`Command: ${commandLabel}`);

  const logHandle = await open(logPath(), "a");

  try {
    const exitResult = await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: ROOT,
        env: process.env,
        shell: false,
        stdio: ["ignore", logHandle.fd, logHandle.fd],
      });

      currentChild = child;
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    });

    currentChild = null;

    if (cancellationRequested) {
      throw new CancelledOperationError();
    }

    if (exitResult.code !== 0) {
      const suffix = exitResult.signal ? ` (signal ${exitResult.signal})` : "";
      throw new Error(`${step.label} exited with code ${exitResult.code ?? "unknown"}${suffix}.`);
    }

    await appendLog(`Completed: ${step.label}`);
    return exitResult.code;
  } finally {
    currentChild = null;
    await logHandle.close();
  }
}

function requestCancellation(signal) {
  if (cancellationRequested) {
    return;
  }

  cancellationRequested = true;
  void appendLog(`Cancellation signal received: ${signal}`).catch(() => undefined);

  if (currentChild && currentChild.exitCode === null && currentChild.signalCode === null) {
    const childToStop = currentChild;
    childToStop.kill("SIGTERM");
    const forceKillTimer = setTimeout(() => {
      if (childToStop.exitCode === null && childToStop.signalCode === null) {
        childToStop.kill("SIGKILL");
      }
    }, 10_000);
    forceKillTimer.unref();
  }
}

process.on("SIGTERM", () => requestCancellation("SIGTERM"));
process.on("SIGINT", () => requestCancellation("SIGINT"));

async function main() {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error("A valid operation run identifier is required.");
  }

  await mkdir(RUNS_ROOT, { recursive: true });
  const run = await readRun();

  if (run.status === "cancelled" || run.cancelRequestedAt) {
    throw new CancelledOperationError("Operation was cancelled before the runner started.");
  }

  const operation = await loadOperation(run.operationId);
  const startedAt = new Date().toISOString();

  await updateRun({
    status: "running",
    startedAt,
    completedAt: null,
    pid: process.pid,
    exitCode: null,
    errorMessage: null,
  });
  await appendLog(`Starting ${operation.label}`);
  await appendLog(`Requested by ${run.requestedBy}`);

  let lastExitCode = 0;

  for (let stepIndex = 0; stepIndex < operation.steps.length; stepIndex += 1) {
    lastExitCode = await runStep(operation.steps[stepIndex], stepIndex, operation.steps.length);
  }

  if (cancellationRequested) {
    throw new CancelledOperationError();
  }

  const completedAt = new Date().toISOString();
  await updateRun({
    status: "succeeded",
    completedAt,
    pid: null,
    currentStepIndex: operation.steps.length - 1,
    currentStepLabel: "Completed",
    exitCode: lastExitCode,
    errorMessage: null,
  });
  await appendLog(`Operation completed successfully: ${operation.label}`);
}

main().catch(async (error) => {
  const cancelled = error instanceof CancelledOperationError || cancellationRequested;
  const message = error instanceof Error ? error.message : "Unknown administrator operation error.";
  const completedAt = new Date().toISOString();

  try {
    await updateRun({
      status: cancelled ? "cancelled" : "failed",
      completedAt,
      pid: null,
      exitCode: cancelled ? null : 1,
      errorMessage: message,
    });
    await appendLog(`${cancelled ? "Cancelled" : "Failed"}: ${message}`);
  } catch (recordingError) {
    console.error("Unable to record administrator operation failure.", recordingError);
  }

  process.exitCode = cancelled ? 0 : 1;
});
