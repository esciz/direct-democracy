import { createHash } from "node:crypto";

import { getDurableIdentityStorageStatus } from "@/lib/identity/durable-storage";
import { prisma } from "@/lib/prisma";

export type IdentityJobType =
  | "email_delivery"
  | "residency_provider_check"
  | "address_normalization"
  | "district_mapping"
  | "voter_provider_check"
  | "verification_evidence_purge"
  | "privacy_export"
  | "account_deletion_anonymization"
  | "dataops_operation"
  | "ocr_processing"
  | "scheduled_health_check";

export type IdentityJobStatus = "queued" | "running" | "succeeded" | "failed" | "dead_lettered" | "cancelled";

export type DurableJobRecord = {
  id: string;
  jobType: IdentityJobType;
  status: IdentityJobStatus;
  idempotencyKey: string;
  actorAccountId: string | null;
  operationId: string | null;
  parentJobId: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  queuedAt: string;
  nextRunAt: string | null;
  startedAt: string | null;
  heartbeatAt: string | null;
  workerId: string | null;
  lockedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  failedAt: string | null;
  deadLetteredAt: string | null;
  failureReason: string | null;
};

function stableJobId(idempotencyKey: string) {
  return `job_${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24)}`;
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function toJobRecord(row: Record<string, unknown>): DurableJobRecord {
  return {
    id: String(row.id),
    jobType: row.jobType as IdentityJobType,
    status: row.status as IdentityJobStatus,
    idempotencyKey: String(row.idempotencyKey),
    actorAccountId: row.actorAccountId ? String(row.actorAccountId) : null,
    operationId: row.operationId ? String(row.operationId) : null,
    parentJobId: row.parentJobId ? String(row.parentJobId) : null,
    payload: parsePayload(row.payload),
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.maxAttempts ?? 3),
    queuedAt: new Date(row.queuedAt as string | Date).toISOString(),
    nextRunAt: row.nextRunAt ? new Date(row.nextRunAt as string | Date).toISOString() : null,
    startedAt: row.startedAt ? new Date(row.startedAt as string | Date).toISOString() : null,
    heartbeatAt: row.heartbeatAt ? new Date(row.heartbeatAt as string | Date).toISOString() : null,
    workerId: row.workerId ? String(row.workerId) : null,
    lockedAt: row.lockedAt ? new Date(row.lockedAt as string | Date).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt as string | Date).toISOString() : null,
    cancelledAt: row.cancelledAt ? new Date(row.cancelledAt as string | Date).toISOString() : null,
    failedAt: row.failedAt ? new Date(row.failedAt as string | Date).toISOString() : null,
    deadLetteredAt: row.deadLetteredAt ? new Date(row.deadLetteredAt as string | Date).toISOString() : null,
    failureReason: row.failureReason ? String(row.failureReason) : null,
  };
}

async function addJobEvent(jobId: string, eventType: string, summary: string) {
  await prisma.$executeRawUnsafe(
    `insert into "IdentityJobEvent" ("id","jobId","eventType","summary")
     values ($1,$2,$3,$4)
     on conflict ("id") do nothing`,
    `job_event_${Date.now()}_${createHash("sha256").update(`${jobId}:${eventType}:${summary}`).digest("hex").slice(0, 8)}`,
    jobId,
    eventType,
    summary.slice(0, 500),
  );
}

export async function getWorkerQueueStatus() {
  const storage = await getDurableIdentityStorageStatus();
  if (!storage.ready) {
    return {
      configured: false,
      status: "worker_unconfigured" as const,
      storageStatus: storage.status,
      queueDepth: null,
      runningJobs: null,
      deadLetters: null,
      cancelledJobs: null,
      staleRunningJobs: null,
    };
  }

  const rows = await prisma.$queryRawUnsafe<Array<{ status: string; count: bigint }>>(
    `select "status", count(*)::bigint as count from "IdentityJob" group by "status"`,
  ).catch(() => []);
  const byStatus = new Map(rows.map((row) => [row.status, Number(row.count)]));
  const stale = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `select count(*)::bigint as count from "IdentityJob"
     where "status"='running' and coalesce("heartbeatAt","lockedAt","startedAt") < now() - interval '10 minutes'`,
  ).catch(() => [{ count: BigInt(0) }]);

  return {
    configured: Boolean(process.env.DIRECT_DEMOCRACY_WORKER_ENABLED),
    status: process.env.DIRECT_DEMOCRACY_WORKER_ENABLED ? "worker_configured" as const : "worker_unconfigured" as const,
    storageStatus: storage.status,
    queueDepth: byStatus.get("queued") ?? 0,
    runningJobs: byStatus.get("running") ?? 0,
    deadLetters: byStatus.get("dead_lettered") ?? 0,
    cancelledJobs: byStatus.get("cancelled") ?? 0,
    staleRunningJobs: Number(stale[0]?.count ?? 0),
  };
}

export async function createDurableJob(input: {
  jobType: IdentityJobType;
  actorAccountId?: string | null;
  operationId?: string | null;
  parentJobId?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  maxAttempts?: number;
}) {
  const storage = await getDurableIdentityStorageStatus();
  if (!storage.ready) {
    return { ok: false as const, status: storage.status, jobId: null, existing: false };
  }
  const id = stableJobId(input.idempotencyKey);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `insert into "IdentityJob" ("id","jobType","status","idempotencyKey","actorAccountId","operationId","parentJobId","payload","maxAttempts")
     values ($1,$2,'queued',$3,$4,$5,$6,$7::jsonb,$8)
     on conflict ("idempotencyKey") do update set "idempotencyKey"=excluded."idempotencyKey"
     returning *`,
    id,
    input.jobType,
    input.idempotencyKey,
    input.actorAccountId ?? null,
    input.operationId ?? null,
    input.parentJobId ?? null,
    JSON.stringify(input.payload),
    input.maxAttempts ?? 3,
  );
  const job = rows[0] ? toJobRecord(rows[0]) : null;
  if (job) await addJobEvent(job.id, "queued", "Durable job accepted by the identity worker queue.");
  return { ok: true as const, status: "queued", jobId: job?.id ?? id, existing: Boolean(job && job.id !== id), job };
}

export async function claimNextJob(workerId: string) {
  const storage = await getDurableIdentityStorageStatus();
  if (!storage.ready) return { ok: false as const, status: storage.status, job: null };
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `with next_job as (
       select "id" from "IdentityJob"
       where "status"='queued'
         and "cancelledAt" is null
         and ("nextRunAt" is null or "nextRunAt" <= now())
       order by coalesce("nextRunAt","queuedAt") asc, "queuedAt" asc
       for update skip locked
       limit 1
     )
     update "IdentityJob" j
     set "status"='running',
         "attempts"=j."attempts" + 1,
         "startedAt"=coalesce(j."startedAt", now()),
         "heartbeatAt"=now(),
         "lockedAt"=now(),
         "workerId"=$1
     from next_job
     where j."id"=next_job."id"
     returning j.*`,
    workerId,
  );
  const job = rows[0] ? toJobRecord(rows[0]) : null;
  if (job) await addJobEvent(job.id, "claimed", `Claimed by worker ${workerId}.`);
  return { ok: true as const, status: job ? "claimed" : "empty", job };
}

export async function heartbeatJob(jobId: string, workerId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `update "IdentityJob"
     set "heartbeatAt"=now()
     where "id"=$1 and "workerId"=$2 and "status"='running'
     returning *`,
    jobId,
    workerId,
  );
  return rows[0] ? { ok: true as const, job: toJobRecord(rows[0]) } : { ok: false as const, job: null };
}

export async function completeJob(jobId: string, workerId: string, summary = "Job completed.") {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `update "IdentityJob"
     set "status"='succeeded',
         "heartbeatAt"=now(),
         "completedAt"=now(),
         "failureReason"=null
     where "id"=$1 and "workerId"=$2 and "status"='running'
     returning *`,
    jobId,
    workerId,
  );
  const job = rows[0] ? toJobRecord(rows[0]) : null;
  if (job) await addJobEvent(job.id, "completed", summary);
  return { ok: Boolean(job), job };
}

export async function failJob(jobId: string, workerId: string, reason: string) {
  const currentRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `select * from "IdentityJob" where "id"=$1 and "workerId"=$2 and "status"='running' limit 1`,
    jobId,
    workerId,
  );
  const current = currentRows[0] ? toJobRecord(currentRows[0]) : null;
  if (!current) return { ok: false as const, status: "job_not_claimed", job: null };

  const deadLetter = current.attempts >= current.maxAttempts;
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, current.attempts - 1));
  const rows = deadLetter
    ? await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `update "IdentityJob"
         set "status"='dead_lettered',
             "failedAt"=now(),
             "deadLetteredAt"=now(),
             "heartbeatAt"=now(),
             "failureReason"=$3
         where "id"=$1 and "workerId"=$2
         returning *`,
      jobId,
      workerId,
      reason.slice(0, 500),
    )
    : await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `update "IdentityJob"
         set "status"='queued',
             "failedAt"=now(),
             "nextRunAt"=now() + ($4 || ' seconds')::interval,
             "heartbeatAt"=now(),
             "workerId"=null,
             "lockedAt"=null,
             "failureReason"=$3
         where "id"=$1 and "workerId"=$2
         returning *`,
      jobId,
      workerId,
      reason.slice(0, 500),
      String(delaySeconds),
    );
  const job = rows[0] ? toJobRecord(rows[0]) : null;
  if (job) await addJobEvent(job.id, deadLetter ? "dead_lettered" : "retry_scheduled", reason);
  return { ok: Boolean(job), status: deadLetter ? "dead_lettered" as const : "retry_scheduled" as const, job };
}

export async function cancelJob(jobId: string, reason: string) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `update "IdentityJob"
     set "status"='cancelled',
         "cancelledAt"=now(),
         "failureReason"=$2
     where "id"=$1 and "status" in ('queued','running')
     returning *`,
    jobId,
    reason.slice(0, 500),
  );
  const job = rows[0] ? toJobRecord(rows[0]) : null;
  if (job) await addJobEvent(job.id, "cancelled", reason);
  return { ok: Boolean(job), job };
}
