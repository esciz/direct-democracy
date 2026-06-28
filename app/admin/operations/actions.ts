"use server";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/permissions";
import { getOperationDefinition, type OperationType } from "@/lib/admin/operations/catalog";
import { createOperationRequest, dispatchAdminOperation, retryAdminOperation } from "@/lib/admin/operations/runner";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const HUMAN_REVIEW_STATE_PATH = path.join(GENERATED_DIR, "human-review-workflow-state.json");
const REVIEW_STATUSES = new Set(["pending", "needs_source", "needs_roster", "reviewed_no_change", "resolved", "deferred"]);
const REVIEW_TYPES = new Set(["ambiguous_vote", "attendance_review", "distribution_review", "identity_quality"]);

function formArgs(formData: FormData) {
  const args: Record<string, unknown> = {};
  for (const key of ["limit", "from", "to", "jurisdiction", "host", "document-type", "sourceId", "source-id", "run-id", "confirm", "path", "provider", "url", "sourceTitle", "scope", "recipient", "worker-id"]) {
    const value = formData.get(key);
    if (typeof value === "string" && value.trim()) args[key] = value.trim();
  }
  for (const key of ["offline", "priority-only", "retry-only", "force-refresh", "force", "confirm-production-send", "confirm-restore-smoke-test", "allow-ephemeral-dev-key"]) {
    if (formData.get(key) === "on" || formData.get(key) === "true") args[key] = true;
  }
  return args;
}

export async function startAdminOperation(formData: FormData) {
  const user = await requireAdminSession("dataops.run");
  const operationType = formData.get("operationType");

  if (typeof operationType !== "string" || !getOperationDefinition(operationType)) {
    redirect("/admin/operations?error=unknown-operation");
  }

  const operation = await createOperationRequest({
    operationType: operationType as OperationType,
    actor: user,
    args: formArgs(formData),
    triggerType: "admin_run_now",
  });

  await dispatchAdminOperation(operation.id);
  revalidatePath("/admin/operations");
  redirect(`/admin/operations?operation=${operation.id}`);
}

export async function retryOperationAction(formData: FormData) {
  const user = await requireAdminSession("dataops.retry");
  const operationId = formData.get("operationId");
  if (typeof operationId !== "string") redirect("/admin/operations?error=missing-operation");
  const operation = await retryAdminOperation(operationId, user);
  await dispatchAdminOperation(operation.id);
  revalidatePath("/admin/operations");
  redirect(`/admin/operations?operation=${operation.id}`);
}

function readReviewState() {
  if (!existsSync(HUMAN_REVIEW_STATE_PATH)) return { generatedAt: new Date().toISOString(), records: {} as Record<string, unknown> };
  try {
    return JSON.parse(readFileSync(HUMAN_REVIEW_STATE_PATH, "utf8")) as { records?: Record<string, unknown> };
  } catch {
    return { records: {} as Record<string, unknown> };
  }
}

export async function updateHumanReviewWorkflowAction(formData: FormData) {
  const user = await requireAdminSession("review.approve");
  const itemId = formData.get("itemId");
  const reviewType = formData.get("reviewType");
  const status = formData.get("status");
  const notes = formData.get("notes");

  if (typeof itemId !== "string" || !itemId.trim()) redirect("/admin/operations?error=missing-review-item");
  if (typeof reviewType !== "string" || !REVIEW_TYPES.has(reviewType)) redirect("/admin/operations?error=invalid-review-type");
  if (typeof status !== "string" || !REVIEW_STATUSES.has(status)) redirect("/admin/operations?error=invalid-review-status");

  mkdirSync(GENERATED_DIR, { recursive: true });
  const current = readReviewState();
  const now = new Date().toISOString();
  const records = {
    ...(current.records ?? {}),
    [itemId]: {
      itemId,
      reviewType,
      status,
      notes: typeof notes === "string" ? notes.trim().slice(0, 2000) : "",
      reviewerUserId: user.id,
      reviewerName: user.name,
      updatedAt: now,
    },
  };
  writeFileSync(HUMAN_REVIEW_STATE_PATH, `${JSON.stringify({ generatedAt: now, records }, null, 2)}\n`);
  revalidatePath("/admin/operations");
  redirect("/admin/operations#human-review");
}
