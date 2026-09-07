import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { IDENTITY_TABLES } from "../lib/identity/durable-storage";
import { getEvidenceStorageStatus } from "../lib/identity/evidence-storage";

async function main() {
  Object.assign(process.env, { NODE_ENV: "test", DATABASE_URL: "postgresql://fixture:fixture@localhost/fixture", DIRECT_DEMOCRACY_WORKER_ENABLED: "true" });
  let failQueueQuery = false; let claimedSpecific: unknown = null;
  let job: Record<string, unknown> = { id: "fixture-job", jobType: "verification_evidence_purge", status: "running", accountId: null, payload: {}, attempts: 1, maxAttempts: 2, idempotencyKey: "fixture", queuedAt: new Date(), startedAt: new Date(), workerId: "fixture-worker", expiresAt: null };
  const fake = { $executeRawUnsafe: async () => 1, $queryRawUnsafe: async (sql: string, ...values: unknown[]) => {
    if (sql.includes("information_schema.tables")) return IDENTITY_TABLES.map((table_name) => ({ table_name }));
    if (sql.includes('group by "status"')) { if (failQueueQuery) throw new Error("fixture_queue_column_missing"); return []; }
    if (sql.includes('count(*)::bigint')) return [{ count: BigInt(0) }];
    if (sql.startsWith("with next_job")) { claimedSpecific = values[1]; assert.ok(sql.includes('$2::text is null or "id"=$2')); return [job]; }
    if (sql.startsWith('select * from "IdentityJob"')) return [job];
    if (sql.includes('"status"=\'queued\'')) { job = { ...job, status: "queued" }; return [job]; }
    if (sql.includes('"status"=\'succeeded\'')) { job = { ...job, status: "succeeded" }; return [job]; }
    return [job];
  } };
  globalThis.prisma = fake as unknown as PrismaClient;
  const { claimNextJob, getWorkerQueueStatus } = await import("../lib/identity/worker-queue");
  assert.equal((await getWorkerQueueStatus()).configured, true);
  process.env.DIRECT_DEMOCRACY_WORKER_ENABLED = "false"; assert.equal((await getWorkerQueueStatus()).configured, false); process.env.DIRECT_DEMOCRACY_WORKER_ENABLED = "true";
  failQueueQuery = true; const unavailable = await getWorkerQueueStatus(); assert.equal(unavailable.configured, false); assert.equal(unavailable.queueDepth, null); assert.equal(unavailable.status, "worker_queue_unavailable"); failQueueQuery = false;
  await claimNextJob("fixture-worker", "only-smoke-job"); assert.equal(claimedSpecific, "only-smoke-job", "Smoke checks must not claim unrelated work");
  Object.assign(process.env, { NODE_ENV: "production", IDENTITY_EVIDENCE_STORAGE_BUCKET: "fixture-bucket", IDENTITY_EVIDENCE_ENCRYPTION_KEY: "fixture-key" });
  assert.equal(getEvidenceStorageStatus(), "verification_evidence_storage_unconfigured", "Bucket/key settings alone must not claim a working remote adapter");
  const { processClaimedIdentityJob } = await import("../lib/identity/worker-handlers");
  const claimed = await claimNextJob("fixture-worker", "fixture-job"); assert.ok(claimed.job);
  const result = await processClaimedIdentityJob(claimed.job, "fixture-worker");
  assert.equal(result.job?.status, "queued", "Unsupported evidence purge must schedule failure, never report successful deletion");
  console.log("Identity worker boundaries: exact enabled flag, schema/query failure states, scoped smoke claims, truthful private-storage configuration and unsupported purge failure passed in an isolated repository.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
