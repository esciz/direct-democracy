"use server";

import { revalidatePath } from "next/cache";

import { CivicRecordReviewStatus, NewsMentionProviderName, NewsMentionTargetType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";
import { importNewsMentions } from "@/lib/news-mentions/store";

const allowedReviewStatuses = [
  CivicRecordReviewStatus.imported,
  CivicRecordReviewStatus.pending_review,
  CivicRecordReviewStatus.approved,
  CivicRecordReviewStatus.rejected,
  CivicRecordReviewStatus.verified,
] as const;

function requireAdminRole(role: string) {
  if (role !== "admin" && role !== "platform_admin") {
    throw new Error("Admin access is required.");
  }
}

function parseProvider(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized in NewsMentionProviderName) return normalized as NewsMentionProviderName;
  if (value === "carson_now") return NewsMentionProviderName.CARSON_NOW;
  if (value === "local_configured") return NewsMentionProviderName.LOCAL_CONFIGURED;
  return undefined;
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function parseReturnPath(formData: FormData) {
  const value = formData.get("returnPath");
  return typeof value === "string" && value.startsWith("/") ? value : "/admin/news-mentions";
}

async function revalidateMentionPaths(mentionId: string, returnPath: string) {
  const mention = await prisma.newsMention.findUnique({ where: { id: mentionId }, select: { candidateId: true, officialId: true } });
  revalidatePath(returnPath);
  revalidatePath("/admin/news-mentions");
  if (mention?.candidateId) revalidatePath(`/candidates/${mention.candidateId}`);
  if (mention?.officialId) revalidatePath(`/officials/${mention.officialId}`);
}

export async function runNewsMentionImportAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const limit = Number(formData.get("limit") ?? 10);
  const dailyCap = Number(formData.get("dailyCap") ?? 100);
  const targetTypeValue = formData.get("targetType");
  const targetIdValue = formData.get("targetId");
  const providerName = parseProvider(formData.get("provider"));
  const sourceSlugValue = formData.get("sourceSlug") ?? formData.get("source");
  const dryRun = formData.get("dryRun") === "on";
  const force = formData.get("force") === "on";
  const targetType =
    targetTypeValue === NewsMentionTargetType.CANDIDATE || targetTypeValue === NewsMentionTargetType.OFFICIAL
      ? targetTypeValue
      : undefined;
  const targetId = typeof targetIdValue === "string" && targetIdValue.trim() ? targetIdValue.trim() : undefined;
  const sourceSlug = typeof sourceSlugValue === "string" && sourceSlugValue.trim() ? sourceSlugValue.trim() : undefined;

  await importNewsMentions({
    limit: Number.isFinite(limit) ? Math.max(0, Math.min(limit, 25)) : 10,
    dailyCap: Number.isFinite(dailyCap) ? Math.max(0, Math.min(dailyCap, 100)) : 100,
    dryRun,
    force,
    providerName,
    sourceSlug,
    targetType,
    targetId,
  });

  revalidatePath("/admin/news-mentions");
  revalidatePath("/admin/data-factory/news-sources");
}

export async function updateNewsMentionReviewStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const mentionId = readRequiredString(formData, "mentionId");
  const reviewStatus = readRequiredString(formData, "reviewStatus") as CivicRecordReviewStatus;
  const returnPath = parseReturnPath(formData);

  if (!allowedReviewStatuses.includes(reviewStatus)) {
    throw new Error("Unsupported news mention review status.");
  }

  await prisma.newsMention.update({ where: { id: mentionId }, data: { reviewStatus } });
  await revalidateMentionPaths(mentionId, returnPath);
}

export async function linkNewsMentionToCandidateAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const mentionId = readRequiredString(formData, "mentionId");
  const candidateId = readRequiredString(formData, "candidateId");
  const returnPath = parseReturnPath(formData);

  await prisma.newsMention.update({
    where: { id: mentionId },
    data: {
      targetType: NewsMentionTargetType.CANDIDATE,
      targetId: candidateId,
      candidateId,
      officialId: null,
      reviewStatus: CivicRecordReviewStatus.pending_review,
    },
  });
  await revalidateMentionPaths(mentionId, returnPath);
  revalidatePath(`/candidates/${candidateId}`);
}

export async function linkNewsMentionToOfficialAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const mentionId = readRequiredString(formData, "mentionId");
  const officialId = readRequiredString(formData, "officialId");
  const returnPath = parseReturnPath(formData);

  await prisma.newsMention.update({
    where: { id: mentionId },
    data: {
      targetType: NewsMentionTargetType.OFFICIAL,
      targetId: officialId,
      candidateId: null,
      officialId,
      reviewStatus: CivicRecordReviewStatus.pending_review,
    },
  });
  await revalidateMentionPaths(mentionId, returnPath);
  revalidatePath(`/officials/${officialId}`);
}

export async function mergeDuplicateNewsMentionsAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const duplicateId = readRequiredString(formData, "duplicateId");
  const returnPath = parseReturnPath(formData);

  await prisma.newsMention.update({ where: { id: duplicateId }, data: { reviewStatus: CivicRecordReviewStatus.rejected } });
  await revalidateMentionPaths(duplicateId, returnPath);
}

export async function flagIncorrectNewsMentionAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const mentionId = readRequiredString(formData, "mentionId");
  const returnPath = parseReturnPath(formData);

  await prisma.newsMention.update({
    where: { id: mentionId },
    data: {
      candidateId: null,
      officialId: null,
      reviewStatus: CivicRecordReviewStatus.rejected,
    },
  });
  await revalidateMentionPaths(mentionId, returnPath);
}
