"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { CivicEntityType, CivicRecordReviewStatus, DataQualityIssueSeverity, DataQualityIssueStatus, DataQualityIssueType } from "@prisma/client";

import { syncCivicImportJob, syncNevadaElectionsSources, syncNevadaOfficialsSources, type CivicImportJobKey } from "@/lib/civic-data/import-jobs";
import { syncCivicSource } from "@/lib/civic-data/service";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

async function requireAdmin() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  return user;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateCivicAdminPaths() {
  revalidatePath("/admin/data");
  revalidatePath("/admin/sources");
  revalidatePath("/admin/imports");
  revalidatePath("/admin/candidates");
  revalidatePath("/admin/officials");
}

export async function manualSyncSourceAction(formData: FormData) {
  await requireAdmin();

  const sourceSlug = String(formData.get("sourceSlug") ?? "");

  if (!sourceSlug) {
    redirect("/admin/sources?error=missing-source");
  }

  try {
    await syncCivicSource(sourceSlug, "manual");
  } catch {
    redirect(`/admin/sources?error=sync-failed&source=${encodeURIComponent(sourceSlug)}`);
  }

  revalidateCivicAdminPaths();
  redirect(`/admin/sources?synced=${encodeURIComponent(sourceSlug)}`);
}

export async function syncNevadaOfficialsSourcesAction() {
  await requireAdmin();

  try {
    await syncNevadaOfficialsSources("manual");
  } catch {
    redirect("/admin/imports?error=sync-all-failed");
  }

  revalidatePath("/admin/data");
  revalidatePath("/admin/sources");
  revalidatePath("/admin/imports");
  revalidatePath("/admin/officials");
  revalidatePath("/imported-officials");
  redirect("/admin/imports?synced=officials");
}

export async function syncNevadaElectionsSourcesAction() {
  await requireAdmin();

  try {
    await syncNevadaElectionsSources("manual");
  } catch {
    redirect("/admin/imports?error=sync-elections-failed");
  }

  revalidatePath("/admin/data");
  revalidatePath("/admin/sources");
  revalidatePath("/admin/imports");
  revalidatePath("/admin/elections");
  revalidatePath("/admin/candidates");
  revalidatePath("/admin/ballot-measures");
  revalidatePath("/admin/elections/qa");
  revalidatePath("/elections");
  revalidatePath("/candidates");
  revalidatePath("/ballot-measures");
  redirect("/admin/imports?synced=elections");
}

async function syncCivicImportJobAction(jobKey: CivicImportJobKey, syncedKey: string) {
  await requireAdmin();

  try {
    await syncCivicImportJob(jobKey, "manual");
  } catch {
    redirect(`/admin/imports?error=${encodeURIComponent(`${syncedKey}-failed`)}`);
  }

  revalidatePath("/admin/data");
  revalidatePath("/admin/sources");
  revalidatePath("/admin/imports");
  revalidatePath("/elections");
  revalidatePath("/candidates");
  revalidatePath("/ballot-measures");
  redirect(`/admin/imports?synced=${encodeURIComponent(syncedKey)}`);
}

export async function syncCandidateElectionDailyAction() {
  return syncCivicImportJobAction("candidate-election-daily", "candidate-election-daily");
}

export async function syncVoterRegistrationMonthlyAction() {
  return syncCivicImportJobAction("voter-registration-monthly", "voter-registration-monthly");
}

export async function syncLegislativeWeeklyAction() {
  return syncCivicImportJobAction("legislative-weekly", "legislative-weekly");
}

export async function addCandidateWebsiteUrlAction(formData: FormData) {
  await requireAdmin();
  const candidateId = readString(formData, "candidateId");
  const websiteUrl = readString(formData, "websiteUrl");

  if (!candidateId || !websiteUrl) {
    redirect("/admin/data?error=missing-candidate-website");
  }

  await prisma.candidate.update({
    where: { id: candidateId },
    data: { websiteUrl },
  });
  await prisma.civicEntityReview.upsert({
    where: {
      entityType_entityId: {
        entityType: CivicEntityType.CANDIDATE,
        entityId: candidateId,
      },
    },
    create: {
      entityType: CivicEntityType.CANDIDATE,
      entityId: candidateId,
      entityName: readString(formData, "entityName") || candidateId,
      sourceUrl: websiteUrl,
      sourceName: "Admin-added campaign website",
      summary: "Campaign website URL added through admin QA workflow.",
      reviewStatus: CivicRecordReviewStatus.pending_review,
      verificationStatus: CivicRecordReviewStatus.imported,
    },
    update: {
      sourceUrl: websiteUrl,
      sourceName: "Admin-added campaign website",
      summary: "Campaign website URL added through admin QA workflow.",
      reviewStatus: CivicRecordReviewStatus.pending_review,
      lastUpdatedAt: new Date(),
    },
  });

  revalidateCivicAdminPaths();
  revalidatePath(`/candidates/${candidateId}`);
  redirect("/admin/data?updated=candidate-website");
}

export async function addOfficialWebsiteUrlAction(formData: FormData) {
  await requireAdmin();
  const officialId = readString(formData, "officialId");
  const websiteUrl = readString(formData, "websiteUrl");

  if (!officialId || !websiteUrl) {
    redirect("/admin/data?error=missing-official-website");
  }

  await prisma.official.update({
    where: { id: officialId },
    data: { websiteUrl },
  });
  await prisma.civicEntityReview.upsert({
    where: {
      entityType_entityId: {
        entityType: CivicEntityType.OFFICIAL,
        entityId: officialId,
      },
    },
    create: {
      entityType: CivicEntityType.OFFICIAL,
      entityId: officialId,
      entityName: readString(formData, "entityName") || officialId,
      sourceUrl: websiteUrl,
      sourceName: "Admin-added official website",
      summary: "Official website URL added through admin QA workflow.",
      reviewStatus: CivicRecordReviewStatus.pending_review,
      verificationStatus: CivicRecordReviewStatus.imported,
    },
    update: {
      sourceUrl: websiteUrl,
      sourceName: "Admin-added official website",
      summary: "Official website URL added through admin QA workflow.",
      reviewStatus: CivicRecordReviewStatus.pending_review,
      lastUpdatedAt: new Date(),
    },
  });

  revalidateCivicAdminPaths();
  revalidatePath(`/officials/${officialId}`);
  redirect("/admin/data?updated=official-website");
}

export async function markRecordVerifiedAction(formData: FormData) {
  await requireAdmin();
  const entityType = readString(formData, "entityType") as CivicEntityType;
  const entityId = readString(formData, "entityId");
  const entityName = readString(formData, "entityName") || entityId;
  const sourceUrl = readString(formData, "sourceUrl") || null;
  const sourceName = readString(formData, "sourceName") || "Admin verification";

  if (!entityType || !entityId || !(entityType in CivicEntityType)) {
    redirect("/admin/data?error=missing-verification-target");
  }

  await prisma.civicEntityReview.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
    create: {
      entityType,
      entityId,
      entityName,
      sourceUrl,
      sourceName,
      summary: "Record marked verified through admin QA workflow.",
      reviewStatus: CivicRecordReviewStatus.verified,
      verificationStatus: CivicRecordReviewStatus.verified,
      confidenceScore: 1,
    },
    update: {
      entityName,
      sourceUrl,
      sourceName,
      summary: "Record marked verified through admin QA workflow.",
      reviewStatus: CivicRecordReviewStatus.verified,
      verificationStatus: CivicRecordReviewStatus.verified,
      confidenceScore: 1,
      lastUpdatedAt: new Date(),
    },
  });

  revalidateCivicAdminPaths();
  redirect("/admin/data?updated=record-verified");
}

export async function attachSourceToProfileAction(formData: FormData) {
  await requireAdmin();
  const entityType = readString(formData, "entityType") as CivicEntityType;
  const entityId = readString(formData, "entityId");
  const entityName = readString(formData, "entityName") || entityId;
  const sourceSlug = readString(formData, "sourceSlug");
  const sourceNameInput = readString(formData, "sourceName");
  const sourceUrlInput = readString(formData, "sourceUrl");
  const notes = readString(formData, "notes") || "Source attached through admin QA workflow.";

  if (!entityId || !(entityType in CivicEntityType)) {
    redirect("/admin/data?error=missing-source-target");
  }

  const source = sourceSlug
    ? await prisma.source.findUnique({
        where: { slug: sourceSlug },
        select: { id: true, name: true, url: true },
      })
    : null;
  const sourceName = sourceNameInput || source?.name || "Admin-attached source";
  const sourceUrl = sourceUrlInput || source?.url || null;

  if (!sourceUrl) {
    redirect("/admin/data?error=missing-source-url");
  }

  if (entityType === CivicEntityType.CANDIDATE) {
    await prisma.candidate.update({
      where: { id: entityId },
      data: {
        sourceId: source?.id,
        sourceUrl,
      },
    });
  }

  if (entityType === CivicEntityType.OFFICIAL) {
    await prisma.official.update({
      where: { id: entityId },
      data: {
        sourceId: source?.id,
      },
    });
  }

  await prisma.civicEntityReview.upsert({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
    create: {
      entityType,
      entityId,
      entityName,
      sourceId: source?.id,
      sourceUrl,
      sourceName,
      summary: notes,
      reviewStatus: CivicRecordReviewStatus.pending_review,
      verificationStatus: CivicRecordReviewStatus.imported,
    },
    update: {
      entityName,
      sourceId: source?.id,
      sourceUrl,
      sourceName,
      summary: notes,
      reviewStatus: CivicRecordReviewStatus.pending_review,
      lastUpdatedAt: new Date(),
    },
  });

  revalidateCivicAdminPaths();
  if (entityType === CivicEntityType.CANDIDATE) revalidatePath(`/candidates/${entityId}`);
  if (entityType === CivicEntityType.OFFICIAL) revalidatePath(`/officials/${entityId}`);
  redirect("/admin/data?updated=source-attached");
}

export async function flagDataQualityIssueAction(formData: FormData) {
  await requireAdmin();
  const recordType = readString(formData, "recordType") as CivicEntityType;
  const recordId = readString(formData, "recordId") || null;
  const issueType = readString(formData, "issueType") as DataQualityIssueType;
  const severity = (readString(formData, "severity") || "warning") as DataQualityIssueSeverity;
  const notes = readString(formData, "notes") || null;

  if (!(recordType in CivicEntityType) || !(issueType in DataQualityIssueType) || !(severity in DataQualityIssueSeverity)) {
    redirect("/admin/data?error=invalid-quality-issue");
  }

  await prisma.dataQualityIssue.create({
    data: {
      recordType,
      recordId,
      issueType,
      severity,
      notes,
      status: DataQualityIssueStatus.open,
    },
  });

  revalidateCivicAdminPaths();
  redirect("/admin/data?updated=quality-issue");
}

export async function resolveDataQualityIssueAction(formData: FormData) {
  await requireAdmin();
  const issueId = readString(formData, "issueId");

  if (!issueId) {
    redirect("/admin/data?error=missing-quality-issue");
  }

  await prisma.dataQualityIssue.update({
    where: { id: issueId },
    data: {
      status: DataQualityIssueStatus.resolved,
      resolvedAt: new Date(),
    },
  });

  revalidateCivicAdminPaths();
  redirect("/admin/data?updated=quality-issue-resolved");
}

export async function mergeDuplicateCandidateRecordsAction(formData: FormData) {
  await requireAdmin();
  const primaryCandidateId = readString(formData, "primaryCandidateId");
  const duplicateCandidateId = readString(formData, "duplicateCandidateId");

  if (!primaryCandidateId || !duplicateCandidateId || primaryCandidateId === duplicateCandidateId) {
    redirect("/admin/data?error=invalid-duplicate-candidates");
  }

  await prisma.dataQualityIssue.create({
    data: {
      recordType: CivicEntityType.CANDIDATE,
      recordId: duplicateCandidateId,
      issueType: DataQualityIssueType.duplicate_candidate,
      severity: DataQualityIssueSeverity.warning,
      status: DataQualityIssueStatus.in_review,
      notes: `Duplicate merge requested. Primary candidate: ${primaryCandidateId}. Duplicate candidate: ${duplicateCandidateId}. No destructive merge was performed automatically.`,
    },
  });

  revalidateCivicAdminPaths();
  redirect("/admin/data?updated=duplicate-merge-review");
}
