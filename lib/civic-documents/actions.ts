"use server";

import { redirect } from "next/navigation";
import { DocumentFieldReviewStatus, DocumentReviewIssueStatus, CivicDocumentRelatedEntityType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }
  return user;
}

function validFieldStatus(value: FormDataEntryValue | null) {
  return typeof value === "string" && value in DocumentFieldReviewStatus ? (value as DocumentFieldReviewStatus) : DocumentFieldReviewStatus.PENDING_REVIEW;
}

export async function updateExtractedFieldReviewAction(formData: FormData) {
  await requireAdmin();
  const fieldId = String(formData.get("fieldId") ?? "");
  const fieldValue = String(formData.get("fieldValue") ?? "").trim();
  const reviewStatus = validFieldStatus(formData.get("reviewStatus"));
  if (!fieldId) return;

  await prisma.documentExtractedField.update({
    where: { id: fieldId },
    data: {
      fieldValue,
      normalizedValue: fieldValue,
      reviewStatus: fieldValue && reviewStatus === DocumentFieldReviewStatus.PENDING_REVIEW ? DocumentFieldReviewStatus.EDITED : reviewStatus,
    },
  });
}

export async function resolveDocumentReviewIssueAction(formData: FormData) {
  await requireAdmin();
  const issueId = String(formData.get("issueId") ?? "");
  const statusValue = String(formData.get("status") ?? DocumentReviewIssueStatus.RESOLVED);
  const status = statusValue in DocumentReviewIssueStatus ? (statusValue as DocumentReviewIssueStatus) : DocumentReviewIssueStatus.RESOLVED;
  if (!issueId) return;

  await prisma.documentReviewIssue.update({
    where: { id: issueId },
    data: {
      status,
      resolvedAt: status === DocumentReviewIssueStatus.RESOLVED || status === DocumentReviewIssueStatus.DISMISSED ? new Date() : null,
    },
  });
}

export async function linkCivicDocumentAction(formData: FormData) {
  await requireAdmin();
  const documentId = String(formData.get("documentId") ?? "");
  const relatedEntityId = String(formData.get("relatedEntityId") ?? "").trim();
  const relatedEntityTypeValue = String(formData.get("relatedEntityType") ?? CivicDocumentRelatedEntityType.UNKNOWN);
  const relatedEntityType =
    relatedEntityTypeValue in CivicDocumentRelatedEntityType ? (relatedEntityTypeValue as CivicDocumentRelatedEntityType) : CivicDocumentRelatedEntityType.UNKNOWN;
  if (!documentId) return;

  await prisma.civicDocument.update({
    where: { id: documentId },
    data: {
      relatedEntityType,
      relatedEntityId: relatedEntityId || null,
    },
  });
}

export async function markCivicDocumentSourceVerifiedAction(formData: FormData) {
  await requireAdmin();
  const documentId = String(formData.get("documentId") ?? "");
  if (!documentId) return;

  await prisma.civicDocument.update({
    where: { id: documentId },
    data: {
      sourceVerified: true,
      sourceVerifiedAt: new Date(),
    },
  });
}
