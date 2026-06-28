import { createHash } from "node:crypto";

import type { AdminOperationRecord } from "@/lib/admin/operations/store";
import { ensureDurableOperationSchema, getDurableOperationStorageStatus } from "@/lib/identity/durable-storage";
import { prisma } from "@/lib/prisma";

export function operationIdempotencyKey(record: Pick<AdminOperationRecord, "operationType" | "actorUserId" | "createdAt" | "validatedArguments" | "parentOperationId">) {
  return createHash("sha256")
    .update(JSON.stringify({
      operationType: record.operationType,
      actorUserId: record.actorUserId,
      createdAt: record.createdAt,
      validatedArguments: record.validatedArguments,
      parentOperationId: record.parentOperationId,
    }))
    .digest("hex");
}

export async function upsertDurableAdminOperation(record: AdminOperationRecord) {
  let status = await getDurableOperationStorageStatus();
  if (!status.ready) {
    await ensureDurableOperationSchema().catch(() => null);
    status = await getDurableOperationStorageStatus();
  }
  if (!status.ready) return { ok: false as const, status: status.status };

  await prisma.$executeRawUnsafe(
    `insert into "AdminOperation" ("id","operationType","triggerType","actorUserId","actorRole","permissionsAtTrigger","scope","sourceIds","jurisdiction","documentType","validatedArguments","executionBackend","parentOperationId","retryOfOperationId","idempotencyKey","status","currentStage","progressSummary","progress","retryCount","createdAt","queuedAt","startedAt","heartbeatAt","completedAt","cancellationRequested","sanitizedResultSummary","externalRunUrl","failureClassification","environmentCapabilitySnapshot","artifactReferences")
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21::timestamptz,$22::timestamptz,$23::timestamptz,$24::timestamptz,$25::timestamptz,$26,$27,$28,$29,$30::jsonb,$31)
     on conflict ("id") do update set
     "status"=excluded."status",
     "currentStage"=excluded."currentStage",
     "progressSummary"=excluded."progressSummary",
     "heartbeatAt"=excluded."heartbeatAt",
     "completedAt"=excluded."completedAt",
     "cancellationRequested"=excluded."cancellationRequested",
     "sanitizedResultSummary"=excluded."sanitizedResultSummary",
     "failureClassification"=excluded."failureClassification",
     "artifactReferences"=excluded."artifactReferences"`,
    record.id,
    record.operationType,
    record.triggerType,
    record.actorUserId,
    record.actorRole,
    Array.isArray(record.environmentCapabilitySnapshot.permissionsAtTrigger) ? record.environmentCapabilitySnapshot.permissionsAtTrigger : [],
    JSON.stringify(record.scope),
    record.sourceIds,
    record.jurisdiction,
    record.documentType,
    record.validatedArguments,
    record.executionBackend,
    record.parentOperationId,
    record.parentOperationId,
    operationIdempotencyKey(record),
    record.status,
    record.currentStage,
    record.progressSummary,
    JSON.stringify({ retryCount: record.retryCount }),
    record.retryCount,
    record.createdAt,
    record.queuedAt,
    record.startedAt,
    record.heartbeatAt,
    record.completedAt,
    record.cancellationRequested,
    record.status === "succeeded" ? record.progressSummary : null,
    record.externalRunUrl,
    record.failureClassification,
    JSON.stringify(record.environmentCapabilitySnapshot),
    record.resultArtifactPaths,
  );

  return { ok: true as const, status: "durable_operations_configured" as const };
}
