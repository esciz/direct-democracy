"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/permissions";
import { getOperationDefinition, type OperationType } from "@/lib/admin/operations/catalog";
import { createOperationRequest, dispatchAdminOperation, retryAdminOperation } from "@/lib/admin/operations/runner";

import { humanReviewService, REVIEW_STATUSES, REVIEW_TYPES } from "@/lib/admin/operations/human-review";

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

export async function updateHumanReviewWorkflowAction(formData: FormData) {
  const user = await requireAdminSession("review.approve");
  const itemId = formData.get("itemId");
  const reviewType = formData.get("reviewType");
  const status = formData.get("status");
  const notes = formData.get("notes");

  if (typeof itemId !== "string" || !itemId.trim()) redirect("/admin/operations?error=missing-review-item");
  if (typeof reviewType !== "string" || !REVIEW_TYPES.has(reviewType)) redirect("/admin/operations?error=invalid-review-type");
  if (typeof status !== "string" || !REVIEW_STATUSES.has(status)) redirect("/admin/operations?error=invalid-review-status");

  let failed = false;
  try {
    await humanReviewService.save({ itemId, reviewType, status,
      notes: typeof notes === "string" ? notes : "",
      reviewerUserId: user.id, reviewerName: user.name,
    });
  } catch {
    console.error("[human-review] Durable review save failed.");
    failed = true;
  }
  if (failed) redirect("/admin/operations?error=review-save-failed#human-review");
  revalidatePath("/admin/operations");
  redirect("/admin/operations?reviewSaved=1#human-review");
}
