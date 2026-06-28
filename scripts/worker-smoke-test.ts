import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { getEmailProviderStatus, redactEmailForAudit } from "@/lib/identity/email";
import { getEvidenceStorageStatus } from "@/lib/identity/evidence-storage";
import { getDurableIdentityStorageStatus } from "@/lib/identity/durable-storage";
import { processClaimedIdentityJob } from "@/lib/identity/worker-handlers";
import { claimNextJob, createDurableJob, getWorkerQueueStatus, type IdentityJobType } from "@/lib/identity/worker-queue";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "worker-smoke-test.json");

function getArg(name: string) {
  const flag = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return flag?.split("=").slice(1).join("=");
}

function authorizedRecipient(recipient: string | undefined) {
  if (!recipient) return false;
  const configured = process.env.DIRECT_DEMOCRACY_EMAIL_TEST_RECIPIENT_ALLOWLIST;
  if (!configured) return false;
  return configured.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).includes(recipient.toLowerCase());
}

async function enqueueAndRun(input: {
  jobType: IdentityJobType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  workerId: string;
  maxAttempts?: number;
}) {
  const queued = await createDurableJob({
    jobType: input.jobType,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
    actorAccountId: "worker_smoke_test",
    maxAttempts: input.maxAttempts ?? 1,
  });
  if (!queued.ok) return { jobType: input.jobType, queued: false, claimed: false, completed: false, status: queued.status };
  const claimed = await claimNextJob(input.workerId);
  if (!claimed.ok || !claimed.job) return { jobType: input.jobType, queued: true, jobId: queued.jobId, claimed: false, completed: false, status: claimed.status };
  const result = await processClaimedIdentityJob(claimed.job, input.workerId);
  return {
    jobType: input.jobType,
    queued: true,
    jobId: claimed.job.id,
    claimed: true,
    completed: result.ok && result.job?.status === "succeeded",
    status: result.job?.status ?? "unknown",
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const storage = await getDurableIdentityStorageStatus();
  const workerBefore = await getWorkerQueueStatus();
  const emailStatus = getEmailProviderStatus();
  const evidenceStatus = getEvidenceStorageStatus();
  const provenance = createAuditProvenance({
    artifactName: "worker-smoke-test",
    databaseReachability: storage.ready ? "database_reachable" : storage.status,
    storageBackend: storage.status,
    workerBackend: workerBefore.status,
    generatedAt,
  });

  if (!storage.ready) {
    const report = {
      generatedAt,
      provenance,
      status: "smoke_blocked_durable_storage_unavailable",
      storageStatus: storage.status,
      workerStatus: workerBefore.status,
      internalJob: null,
      emailJob: null,
      evidencePurgeJob: null,
      workerHeartbeatRecorded: false,
      retryAndDeadLetterBoundaryPresent: true,
      sensitiveValuesIncluded: false,
    };
    mkdirSync(GENERATED_DIR, { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    writeProvenancedAudit("worker-smoke-test", report);
    console.log("Worker smoke test blocked: durable storage unavailable.");
    console.log(JSON.stringify({ status: report.status, storageStatus: report.storageStatus }, null, 2));
    return;
  }

  const workerId = `worker_smoke_${process.pid}`;
  const internalJob = await enqueueAndRun({
    jobType: "scheduled_health_check",
    payload: { smokeTest: true, generatedAt },
    idempotencyKey: `worker-smoke:health:${generatedAt}`,
    workerId,
  });

  let emailJob: Record<string, unknown> | null = null;
  if (emailStatus === "production_provider_configured" || emailStatus === "development_adapter") {
    const recipient = getArg("--recipient");
    if (emailStatus === "production_provider_configured" && !authorizedRecipient(recipient)) {
      emailJob = {
        skipped: true,
        status: "skipped_missing_authorized_recipient",
        reason: "Production email worker smoke requires --recipient in DIRECT_DEMOCRACY_EMAIL_TEST_RECIPIENT_ALLOWLIST.",
      };
    } else if (recipient) {
      emailJob = await enqueueAndRun({
        jobType: "email_delivery",
        payload: {
          to: recipient,
          purpose: "account_email_verification",
          subject: "Direct Democracy worker email smoke test",
          text: "This is a Direct Democracy worker email smoke test. Generated audits contain no tokens.",
        },
        idempotencyKey: `worker-smoke:email:${recipient}:${generatedAt}`,
        workerId,
      });
      emailJob.recipient = redactEmailForAudit(recipient);
    } else {
      emailJob = { skipped: true, status: "skipped_missing_recipient", reason: "Pass --recipient=<authorized-address> to include email delivery in worker smoke." };
    }
  }

  let evidencePurgeJob: Record<string, unknown> | null = null;
  if (evidenceStatus !== "verification_evidence_storage_unconfigured") {
    evidencePurgeJob = await enqueueAndRun({
      jobType: "verification_evidence_purge",
      payload: { smokeTest: true, generatedAt },
      idempotencyKey: `worker-smoke:evidence-purge:${generatedAt}`,
      workerId,
    });
  }

  const workerAfter = await getWorkerQueueStatus();
  const requiredJobsCompleted = Boolean(internalJob.completed)
    && (emailStatus === "production_provider_configured" ? Boolean(emailJob?.completed) : true)
    && (evidenceStatus !== "verification_evidence_storage_unconfigured" ? Boolean(evidencePurgeJob?.completed) : true);
  const status = requiredJobsCompleted ? "smoke_passed" : "smoke_partially_exercised";
  const report = {
    generatedAt,
    provenance,
    status,
    storageStatus: storage.status,
    workerStatusBefore: workerBefore.status,
    workerStatusAfter: workerAfter.status,
    workerConfigured: workerAfter.configured,
    workerId,
    internalJob,
    emailProviderStatus: emailStatus,
    emailJob,
    evidenceStorageStatus: evidenceStatus,
    evidencePurgeJob,
    workerHeartbeatRecorded: Boolean(internalJob.claimed),
    retryAndDeadLetterBoundaryPresent: true,
    durableQueueHealth: {
      queueDepth: workerAfter.queueDepth,
      runningJobs: workerAfter.runningJobs,
      deadLetters: workerAfter.deadLetters,
      staleRunningJobs: workerAfter.staleRunningJobs,
    },
    sensitiveValuesIncluded: false,
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("worker-smoke-test", report);
  console.log("Worker smoke test complete.");
  console.log(JSON.stringify({
    status,
    internalJob: internalJob.status,
    emailJob: emailJob?.status ?? "not_run",
    evidencePurgeJob: evidencePurgeJob?.status ?? "not_run",
    workerConfigured: report.workerConfigured,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
