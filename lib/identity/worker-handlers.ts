import { spawnSync } from "node:child_process";

import { getOperationDefinition, type OperationType } from "@/lib/admin/operations/catalog";
import { runAdminOperation, validateOperationArgs } from "@/lib/admin/operations/runner";
import { getAdminOperation } from "@/lib/admin/operations/store";
import { completeJob, failJob, heartbeatJob, type DurableJobRecord } from "@/lib/identity/worker-queue";
import { sendIdentityEmail, type EmailPurpose } from "@/lib/identity/email";

function stringPayload(job: DurableJobRecord, key: string) {
  const value = job.payload[key];
  return typeof value === "string" ? value : null;
}

function stringArrayPayload(job: DurableJobRecord, key: string) {
  const value = job.payload[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function runAllowlistedDataOpsPayload(job: DurableJobRecord) {
  const operationType = stringPayload(job, "operationType") as OperationType | null;
  if (!operationType) return { ok: false, summary: "DataOps job missing operation type." };
  const definition = getOperationDefinition(operationType);
  if (!definition) return { ok: false, summary: `Unknown operation type: ${operationType}` };
  if ((process.env.NODE_ENV === "production" || process.env.GITHUB_ACTIONS === "true") && definition.productionAvailability !== "available") return { ok: false, summary: `Operation ${operationType} is ${definition.productionAvailability}; use the configured civic refresh worker instead.` };
  if (!definition.command.length) return { ok: false, summary: `Operation ${operationType} has no allowlisted command.` };
  const validatedArguments = stringArrayPayload(job, "validatedArguments");
  try {
    const raw: Record<string, string | boolean> = {};
    for (const argument of validatedArguments) {
      const match = argument.match(/^--([a-z0-9-]+)(?:=(.*))?$/i);
      if (!match || Object.hasOwn(raw, match[1])) throw new Error("invalid_argument");
      raw[match[1]] = match[2] ?? true;
    }
    validateOperationArgs(operationType, raw);
  } catch { return { ok: false, summary: "DataOps worker payload contains arguments outside the operation allowlist." }; }
  const command = definition.command[0];
  const args = [...definition.command.slice(1), ...validatedArguments];
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: "utf8", timeout: 20 * 60 * 1000, env: process.env });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.slice(-2000).replace(/(authorization:\s*bearer\s+)[^\s]+/gi, "$1[REDACTED]").replace(/(cookie:\s*)[^\n]+/gi, "$1[REDACTED]");
  if (result.status === 0 && !result.error) return { ok: true, summary: `Operation ${operationType} completed. ${output}`.slice(0, 1200) };
  return { ok: false, summary: `Operation ${operationType} failed: ${result.error?.message ?? `exit_${result.status}`}. ${output}`.slice(0, 1200) };
}

export async function processClaimedIdentityJob(job: DurableJobRecord, workerId: string) {
  const heartbeat = await heartbeatJob(job.id, workerId);
  if (!heartbeat.ok) return { ok: false, job: null };

  if (job.jobType === "scheduled_health_check") {
    return completeJob(job.id, workerId, "Worker completed scheduled health check.");
  }

  if (job.jobType === "email_delivery") {
    const to = stringPayload(job, "to");
    const purpose = stringPayload(job, "purpose") as EmailPurpose | null;
    const subject = stringPayload(job, "subject") ?? "Direct Democracy notification";
    const text = stringPayload(job, "text") ?? "A Direct Democracy notification is available.";
    if (!to || !purpose) return failJob(job.id, workerId, "Email delivery job missing safe recipient or purpose.");
    const delivery = await sendIdentityEmail({ to, purpose, subject, text });
    if (!delivery.ok) {
      const reason = "reason" in delivery && typeof delivery.reason === "string" ? ` (${delivery.reason})` : "";
      return failJob(job.id, workerId, `Email delivery failed: ${delivery.status}${reason}`);
    }
    return completeJob(job.id, workerId, `Email delivery completed: ${delivery.status}`);
  }

  if (job.jobType === "verification_evidence_purge") {
    return failJob(job.id, workerId, "Durable evidence-object purge is not implemented. Updating local metadata would not verify deletion from private storage.");
  }

  if (job.jobType === "dataops_operation") {
    const operationId = stringPayload(job, "operationId");
    if (operationId && getAdminOperation(operationId)) {
      const operation = await runAdminOperation(operationId, { fromWorker: true });
      if (operation.status === "succeeded") return completeJob(job.id, workerId, `DataOps operation completed: ${operation.operationType}.`);
      return failJob(job.id, workerId, `DataOps operation failed: ${operation.failureClassification ?? operation.status}.`);
    }
    const result = runAllowlistedDataOpsPayload(job);
    if (result.ok) return completeJob(job.id, workerId, result.summary);
    return failJob(job.id, workerId, result.summary);
  }

  if (job.jobType === "ocr_processing") {
    return failJob(job.id, workerId, `${job.jobType} requires a dedicated bounded OCR handler.`);
  }

  return failJob(job.id, workerId, `No worker handler is registered for ${job.jobType}.`);
}
