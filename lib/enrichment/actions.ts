"use server";

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";

import {
  CandidateKnowledgeSourceType,
  CivicRecordReviewStatus,
  IssuePositionDerivation,
  IssuePositionStance,
  NewsMentionProviderName,
  NewsMentionTargetType,
  ProfileEnrichmentReviewStatus,
} from "@prisma/client";

import {
  classifyCandidateKnowledgeSource,
  runCandidateKnowledgeEnrichment,
  updateCandidateKnowledgeReviewStatus,
} from "@/lib/enrichment/candidate-knowledge";
import {
  runProfileWebsiteEnrichment,
  updateEnrichmentReviewStatus,
  type EnrichmentReviewStatus,
  type EnrichmentTargetType,
} from "@/lib/enrichment/website";
import { getCurrentUser } from "@/lib/server/auth-session";
import { slugifyIssueText } from "@/lib/issues/utils";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = path.join(process.cwd(), "data", "imports", "candidate-source-repository");

function requireAdminRole(role: string) {
  if (role !== "admin") {
    throw new Error("Admin access is required.");
  }
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeText(value: string, maxLength = 700) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trimEnd()}...` : text;
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function sourcePriority(sourceType: CandidateKnowledgeSourceType) {
  switch (sourceType) {
    case CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE:
    case CandidateKnowledgeSourceType.OFFICIAL_WEBSITE:
      return 1;
    case CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA:
      return 2;
    case CandidateKnowledgeSourceType.BALLOTPEDIA:
      return 3;
    case CandidateKnowledgeSourceType.VOTE_SMART:
      return 4;
    case CandidateKnowledgeSourceType.FILING_RECORD:
    case CandidateKnowledgeSourceType.CAMPAIGN_FINANCE:
      return 5;
    case CandidateKnowledgeSourceType.NEWS_ARTICLE:
    case CandidateKnowledgeSourceType.PRESS_RELEASE:
    case CandidateKnowledgeSourceType.LEGISLATIVE_VOTE:
      return 6;
    case CandidateKnowledgeSourceType.SOCIAL_PROFILE:
    case CandidateKnowledgeSourceType.OFFICIAL_SOCIAL:
      return 7;
    default:
      return 8;
  }
}

async function extractUploadedText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return normalizeWhitespace(parsed.text);
    } finally {
      await parser.destroy();
    }
  }
  if (file.type.startsWith("text/") || /\.(txt|text|html|htm|md)$/i.test(file.name)) {
    return normalizeWhitespace(buffer.toString("utf8").replace(/<[^>]+>/g, " "));
  }
  throw new Error("Unsupported source document type. Upload PDF, text, HTML, or Markdown.");
}

function uploadedSourceUrl(candidateId: string, fileName: string) {
  return `local://candidate-source-repository/${encodeURIComponent(candidateId)}/${encodeURIComponent(fileName)}`;
}

async function getKnowledgeRow(enrichmentId: string) {
  const row = await prisma.candidateKnowledgeEnrichment.findUnique({
    where: { id: enrichmentId },
    include: { candidate: { select: { id: true, ballotName: true, fullName: true } } },
  });
  if (!row) throw new Error("Candidate source was not found.");
  return row;
}

export async function runProfileWebsiteEnrichmentAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const targetType = readRequiredString(formData, "targetType") as EnrichmentTargetType;
  const targetId = readRequiredString(formData, "targetId");
  const sourceUrlValue = formData.get("sourceUrl");
  const sourceUrl = typeof sourceUrlValue === "string" && sourceUrlValue.trim() ? sourceUrlValue.trim() : null;

  if (targetType !== "CANDIDATE" && targetType !== "OFFICIAL") {
    throw new Error("Unsupported enrichment target type.");
  }

  await runProfileWebsiteEnrichment({ targetType, targetId, sourceUrl });
  revalidatePath("/admin/enrichment");
}

export async function updateEnrichmentReviewStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const enrichmentId = readRequiredString(formData, "enrichmentId");
  const reviewStatus = readRequiredString(formData, "reviewStatus") as EnrichmentReviewStatus;
  const notesValue = formData.get("reviewNotes");
  const reviewNotes = typeof notesValue === "string" && notesValue.trim() ? notesValue.trim() : null;
  const allowedStatuses: EnrichmentReviewStatus[] = ["PENDING_REVIEW", "APPROVED", "REJECTED", "NEEDS_MORE_SOURCES", "VERIFIED"];

  if (!allowedStatuses.includes(reviewStatus)) {
    throw new Error("Unsupported review status.");
  }

  await updateEnrichmentReviewStatus({
    enrichmentId,
    reviewStatus,
    reviewNotes,
    reviewerUserId: user.id,
  });
  revalidatePath("/admin/enrichment");
}

export async function runCandidateKnowledgeEnrichmentAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const candidateId = readRequiredString(formData, "candidateId");
  await runCandidateKnowledgeEnrichment({ candidateId });

  revalidatePath("/admin/enrichment");
  revalidatePath(`/candidates/${candidateId}`);
}

export async function addCandidateKnowledgeSourceAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const candidateId = readRequiredString(formData, "candidateId");
  const sourceUrl = readRequiredString(formData, "sourceUrl");
  const sourceNameValue = formData.get("sourceName");
  const sourceTypeValue = formData.get("sourceType");
  const sourceName = typeof sourceNameValue === "string" && sourceNameValue.trim() ? sourceNameValue.trim() : undefined;
  const sourceType =
    typeof sourceTypeValue === "string" && sourceTypeValue in CandidateKnowledgeSourceType
      ? (sourceTypeValue as CandidateKnowledgeSourceType)
      : classifyCandidateKnowledgeSource(sourceUrl);

  await runCandidateKnowledgeEnrichment({
    candidateId,
    source: {
      url: sourceUrl,
      sourceName,
      sourceType,
    },
  });

  revalidatePath("/admin/enrichment");
  revalidatePath(`/candidates/${candidateId}`);
}

export async function uploadCandidateKnowledgeDocumentAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const candidateId = readRequiredString(formData, "candidateId");
  const fileValue = formData.get("sourceDocument");
  const sourceTypeValue = formData.get("sourceType");
  const sourceNameValue = formData.get("sourceName");
  const sourceType =
    typeof sourceTypeValue === "string" && sourceTypeValue in CandidateKnowledgeSourceType
      ? (sourceTypeValue as CandidateKnowledgeSourceType)
      : CandidateKnowledgeSourceType.OTHER;
  const sourceName = typeof sourceNameValue === "string" && sourceNameValue.trim() ? sourceNameValue.trim() : "Uploaded candidate source document";

  if (!(fileValue instanceof File) || !fileValue.size) {
    throw new Error("A source document file is required.");
  }

  const text = await extractUploadedText(fileValue);
  const safeName = fileValue.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}-${safeName}`;
  const candidateDir = path.join(UPLOAD_DIR, candidateId);
  await fs.mkdir(candidateDir, { recursive: true });
  await fs.writeFile(path.join(candidateDir, storedName), Buffer.from(await fileValue.arrayBuffer()));

  const sourceUrl = uploadedSourceUrl(candidateId, storedName);
  const summary = summarizeText(text);
  const existing = await prisma.candidateKnowledgeEnrichment.findUnique({
    where: { candidateId_sourceUrl: { candidateId, sourceUrl } },
    select: { reviewStatus: true },
  });
  const protectReviewed =
    existing?.reviewStatus === ProfileEnrichmentReviewStatus.APPROVED ||
    existing?.reviewStatus === ProfileEnrichmentReviewStatus.VERIFIED;
  const data = {
    sourceName,
    sourceType,
    sourcePriority: sourcePriority(sourceType),
    title: fileValue.name,
    aboutSummary: sourceType === CandidateKnowledgeSourceType.NEWS_ARTICLE ? null : summary,
    ownWordsSummary:
      sourceType === CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA ||
      sourceType === CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE ||
      sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ||
      sourceType === CandidateKnowledgeSourceType.PRESS_RELEASE
        ? summary
        : null,
    issues: toJson([]),
    experienceSummary: null,
    financeContext: sourceType === CandidateKnowledgeSourceType.CAMPAIGN_FINANCE || sourceType === CandidateKnowledgeSourceType.FILING_RECORD ? summary : null,
    newsItems: toJson(
      sourceType === CandidateKnowledgeSourceType.NEWS_ARTICLE || sourceType === CandidateKnowledgeSourceType.PRESS_RELEASE
        ? [{ title: fileValue.name, summary: summary ?? "Summary pending review.", sourceUrl, sourceName }]
        : [],
    ),
    socialLinks: toJson([]),
    sourceAttribution: toJson([
      {
        sourceName,
        sourceUrl,
        sourceType,
        originalFileName: fileValue.name,
        storedFileName: storedName,
        textHash: createHash("sha256").update(text).digest("hex"),
      },
    ]),
    confidenceScore: summary ? 0.65 : 0.35,
    fetchedAt: new Date(),
    lastUpdatedAt: new Date(),
    errorLog: summary ? null : "No summary could be extracted from the uploaded document.",
  };

  if (!protectReviewed) {
    await prisma.candidateKnowledgeEnrichment.upsert({
      where: { candidateId_sourceUrl: { candidateId, sourceUrl } },
      create: {
        candidateId,
        sourceUrl,
        ...data,
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      },
      update: {
        ...data,
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNotes: null,
      },
    });
  }

  revalidatePath("/admin/enrichment");
  revalidatePath(`/candidates/${candidateId}`);
}

export async function linkCandidateKnowledgeToIssuePositionAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const enrichmentId = readRequiredString(formData, "knowledgeEnrichmentId");
  const issueText = readRequiredString(formData, "issueText");
  const stanceValue = readRequiredString(formData, "stance") as IssuePositionStance;
  const summaryValue = formData.get("summary");
  const summary = typeof summaryValue === "string" && summaryValue.trim() ? summaryValue.trim() : null;
  const row = await getKnowledgeRow(enrichmentId);
  const stance = Object.values(IssuePositionStance).includes(stanceValue) ? stanceValue : IssuePositionStance.UNKNOWN;
  const issueSlug = slugifyIssueText(issueText);

  const existingPosition = await prisma.issuePosition.findFirst({
    where: { candidateId: row.candidateId, issueSlug, evidenceUrl: row.sourceUrl },
    select: { id: true },
  });
  const positionData = {
    stance,
    derivation: IssuePositionDerivation.OFFICIAL,
    summary: summary ?? row.ownWordsSummary ?? row.aboutSummary,
    evidenceTitle: row.title,
    evidenceSourceName: row.sourceName,
    confidenceScore: row.confidenceScore,
    reviewStatus: CivicRecordReviewStatus.pending_review,
    verificationStatus: CivicRecordReviewStatus.imported,
    lastObservedAt: new Date(),
  };

  if (existingPosition) {
    await prisma.issuePosition.update({
      where: { id: existingPosition.id },
      data: positionData,
    });
  } else {
    await prisma.issuePosition.create({
      data: {
      candidateId: row.candidateId,
      issueText,
      issueSlug,
      evidenceUrl: row.sourceUrl,
        ...positionData,
      },
    });
  }

  revalidatePath("/admin/enrichment");
  revalidatePath(`/candidates/${row.candidateId}`);
}

export async function linkCandidateKnowledgeToNewsMentionAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const enrichmentId = readRequiredString(formData, "knowledgeEnrichmentId");
  const row = await getKnowledgeRow(enrichmentId);
  const title = row.title ?? `${row.candidate.ballotName ?? row.candidate.fullName} source mention`;
  const duplicateHash = createHash("sha256")
    .update([NewsMentionTargetType.CANDIDATE, row.candidateId, row.sourceUrl, title].join("|"))
    .digest("hex");

  await prisma.newsMention.upsert({
    where: { duplicateHash },
    create: {
      targetType: NewsMentionTargetType.CANDIDATE,
      targetId: row.candidateId,
      candidateId: row.candidateId,
      title,
      sourceName: row.sourceName,
      sourceDomain: null,
      url: row.sourceUrl,
      canonicalUrl: row.sourceUrl,
      snippetOrSummary: row.newsItems?.toString() ? row.ownWordsSummary ?? row.aboutSummary : row.aboutSummary ?? row.ownWordsSummary,
      matchedQuery: "candidate source repository",
      matchedTerms: [row.candidate.ballotName ?? row.candidate.fullName],
      confidenceScore: row.confidenceScore,
      provider: NewsMentionProviderName.CUSTOM_CRAWLER,
      reviewStatus: CivicRecordReviewStatus.pending_review,
      duplicateHash,
    },
    update: {
      title,
      sourceName: row.sourceName,
      snippetOrSummary: row.aboutSummary ?? row.ownWordsSummary,
      confidenceScore: row.confidenceScore,
      reviewStatus: CivicRecordReviewStatus.pending_review,
    },
  });

  revalidatePath("/admin/enrichment");
  revalidatePath("/admin/news-mentions");
  revalidatePath(`/candidates/${row.candidateId}`);
}

export async function updateCandidateKnowledgeReviewStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  requireAdminRole(user.role);

  const enrichmentId = readRequiredString(formData, "knowledgeEnrichmentId");
  const candidateId = readRequiredString(formData, "candidateId");
  const reviewStatus = readRequiredString(formData, "reviewStatus") as ProfileEnrichmentReviewStatus;
  const notesValue = formData.get("reviewNotes");
  const reviewNotes = typeof notesValue === "string" && notesValue.trim() ? notesValue.trim() : null;
  const allowedStatuses: ProfileEnrichmentReviewStatus[] = ["PENDING_REVIEW", "APPROVED", "REJECTED", "NEEDS_MORE_SOURCES", "VERIFIED"];

  if (!allowedStatuses.includes(reviewStatus)) {
    throw new Error("Unsupported review status.");
  }

  await updateCandidateKnowledgeReviewStatus({
    enrichmentId,
    reviewStatus,
    reviewNotes,
    reviewerUserId: user.id,
  });

  revalidatePath("/admin/enrichment");
  revalidatePath(`/candidates/${candidateId}`);
}
