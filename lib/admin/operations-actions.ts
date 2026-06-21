"use server";

import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin/auth";
import { cancelAdminOperation, startAdminOperation, type AdminOperationRun } from "@/lib/admin/operations";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown administrator operation error.";
  return message.slice(0, 280);
}

export async function startAdminOperationAction(formData: FormData) {
  const session = await requireAdminSession("/admin");
  const operationId = readFormString(formData, "operationId");

  if (!operationId) {
    return redirect("/admin?error=Choose%20an%20operation%20to%20run.");
  }

  let run: AdminOperationRun;

  try {
    run = await startAdminOperation(operationId, session.email);
  } catch (error) {
    redirect(`/admin?error=${encodeURIComponent(errorMessage(error))}`);
  }

  redirect(`/admin/operations/${run.id}`);
}

export async function cancelAdminOperationAction(formData: FormData) {
  const runId = readFormString(formData, "runId");
  await requireAdminSession(runId ? `/admin/operations/${runId}` : "/admin");

  if (!runId) {
    return redirect("/admin?error=Operation%20run%20not%20found.");
  }

  try {
    await cancelAdminOperation(runId);
  } catch (error) {
    redirect(`/admin/operations/${runId}?error=${encodeURIComponent(errorMessage(error))}`);
  }

  redirect(`/admin/operations/${runId}?cancelled=1`);
}
