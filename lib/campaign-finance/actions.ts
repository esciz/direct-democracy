"use server";

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFParse } from "pdf-parse";
import {
  CampaignFinanceFilingType,
  CampaignFinanceContributorType,
  CivicDocumentRelatedEntityType,
  CivicDocumentType,
  CivicDocumentUploadMethod,
  CivicEntityType,
  CivicRecordReviewStatus,
  DocumentExtractionMethod,
  DocumentExtractionStatus,
  DocumentFieldReviewStatus,
  DocumentReviewIssueSeverity,
  DocumentReviewIssueStatus,
  DocumentReviewIssueType,
  SourceSyncStatus,
  SourceType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

const IMPORT_DIR = "data/imports/campaign-finance";
const MANIFEST_PATH = path.join(IMPORT_DIR, "manifest.csv");

async function requireFinanceAdmin() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }
  return user;
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function csvEscape(value: string | null | undefined) {
  const clean = String(value ?? "");
  return `"${clean.replace(/"/g, '""')}"`;
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

async function getOrCreateManualSource(sourceUrl: string | null) {
  return prisma.source.upsert({
    where: { slug: "manual-campaign-finance-source-intake" },
    create: {
      name: "Manual campaign finance source intake",
      slug: "manual-campaign-finance-source-intake",
      sourceType: SourceType.MANUAL,
      url: sourceUrl ?? "https://directdemocracy.local/admin/data-factory/campaign-finance",
      adapterKey: "manual-campaign-finance-source-intake",
      dataCategory: "campaign_finance_manual",
      accessMethod: "manual_download",
      syncStatus: SourceSyncStatus.SUCCESS,
      lastCheckedAt: new Date(),
      lastSuccessAt: new Date(),
    },
    update: {
      url: sourceUrl ?? "https://directdemocracy.local/admin/data-factory/campaign-finance",
      syncStatus: SourceSyncStatus.SUCCESS,
      lastCheckedAt: new Date(),
      lastSuccessAt: new Date(),
    },
  });
}

async function resolveTarget(targetType: string, targetId: string) {
  if (targetType === "candidate") {
    const candidate = await prisma.candidate.findUnique({
      where: { id: targetId },
      include: { office: { select: { title: true } }, jurisdiction: { select: { name: true } } },
    });
    return candidate ? { civicEntityType: CivicEntityType.CANDIDATE, documentEntityType: CivicDocumentRelatedEntityType.CANDIDATE, candidate, official: null } : null;
  }
  if (targetType === "official") {
    const official = await prisma.official.findUnique({
      where: { id: targetId },
      include: { office: { select: { title: true } }, jurisdiction: { select: { name: true } } },
    });
    return official ? { civicEntityType: CivicEntityType.OFFICIAL, documentEntityType: CivicDocumentRelatedEntityType.OFFICIAL, candidate: null, official } : null;
  }
  return null;
}

async function upsertProfileFinanceSource({
  targetType,
  targetId,
  sourceUrl,
  sourceName,
  reportName,
  reportYear,
  filingDate,
  documentUrl,
  notes,
  civicDocumentId,
}: {
  targetType: "candidate" | "official";
  targetId: string;
  sourceUrl: string;
  sourceName: string;
  reportName: string;
  reportYear: number | null;
  filingDate: Date | null;
  documentUrl: string | null;
  notes: string | null;
  civicDocumentId?: string | null;
}) {
  const target = await resolveTarget(targetType, targetId);
  if (!target) throw new Error("Target profile was not found.");
  const source = await getOrCreateManualSource(sourceUrl);
  const displayName = target.candidate?.fullName ?? target.official?.fullName ?? "Public profile";

  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: target.civicEntityType,
        entityId: targetId,
        fieldName: "campaign_finance",
        sourceUrl,
      },
    },
    create: {
      entityType: target.civicEntityType,
      entityId: targetId,
      fieldName: "campaign_finance",
      sourceId: source.id,
      sourceName,
      sourceUrl,
      fieldsDerived: ["campaign finance source link", reportName ? "filing metadata" : "source link fallback"],
      confidenceScore: 0.65,
      reviewStatus: CivicRecordReviewStatus.pending_review,
      lastImportedAt: new Date(),
      metadata: {
        filingSummaries: reportName ? [{ name: reportName, filedAt: filingDate?.toISOString() ?? null, url: documentUrl ?? sourceUrl }] : [],
        sourceLinks: [{ label: sourceName, url: sourceUrl, note: notes }],
        donorExtractionStatus: "Detailed donor extraction pending",
        civicDocumentId: civicDocumentId ?? null,
      },
    },
    update: {
      sourceId: source.id,
      sourceName,
      sourceUrl,
      fieldsDerived: ["campaign finance source link", reportName ? "filing metadata" : "source link fallback"],
      confidenceScore: 0.65,
      reviewStatus: CivicRecordReviewStatus.pending_review,
      lastImportedAt: new Date(),
      metadata: {
        filingSummaries: reportName ? [{ name: reportName, filedAt: filingDate?.toISOString() ?? null, url: documentUrl ?? sourceUrl }] : [],
        sourceLinks: [{ label: sourceName, url: sourceUrl, note: notes }],
        donorExtractionStatus: "Detailed donor extraction pending",
        civicDocumentId: civicDocumentId ?? null,
      },
    },
  });

  if (target.candidate && reportName) {
    await prisma.campaignFinanceFiling.upsert({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: `manual:${targetId}:${sourceUrl}:${reportName}`,
        },
      },
      create: {
        jurisdictionId: target.candidate.jurisdictionId,
        candidateId: target.candidate.id,
        sourceId: source.id,
        externalId: `manual:${targetId}:${sourceUrl}:${reportName}`,
        filingType: CampaignFinanceFilingType.CONTRIBUTION_EXPENSE,
        filerName: displayName,
        filedAt: filingDate,
        filingUrl: documentUrl ?? sourceUrl,
        rawData: {
          filingName: reportName,
          reportName,
          reportYear,
          sourceName,
          sourceUrl,
          documentUrl,
          extractionStatus: "Detailed donor extraction pending",
          reviewStatus: "pending_review",
          civicDocumentId: civicDocumentId ?? null,
        },
      },
      update: {
        filedAt: filingDate,
        filingUrl: documentUrl ?? sourceUrl,
        rawData: {
          filingName: reportName,
          reportName,
          reportYear,
          sourceName,
          sourceUrl,
          documentUrl,
          extractionStatus: "Detailed donor extraction pending",
          reviewStatus: "pending_review",
          civicDocumentId: civicDocumentId ?? null,
        },
      },
    });
  }
}

export async function addCampaignFinanceSourceAction(formData: FormData) {
  await requireFinanceAdmin();
  const targetType = readString(formData, "targetType") === "official" ? "official" : "candidate";
  const targetId = readString(formData, "targetId");
  const sourceUrl = safeUrl(readString(formData, "sourceUrl"));
  if (!targetId || !sourceUrl) throw new Error("Target and source URL are required.");

  const reportName = readString(formData, "reportName");
  const reportYear = Number(readString(formData, "reportYear")) || null;
  const filingDate = parseDate(readString(formData, "filingDate"));
  const documentUrl = safeUrl(readString(formData, "documentUrl"));
  const notes = readString(formData, "notes") || null;

  await upsertProfileFinanceSource({
    targetType,
    targetId,
    sourceUrl,
    sourceName: readString(formData, "sourceName") || "Manual campaign finance source",
    reportName,
    reportYear,
    filingDate,
    documentUrl,
    notes,
  });

  revalidatePath(`/admin/data-factory/campaign-finance`);
  revalidatePath(`/admin/data-factory/campaign-finance/add-source`);
  revalidatePath(targetType === "candidate" ? `/candidates/${targetId}` : `/officials/${targetId}`);
  redirect(`/admin/data-factory/campaign-finance/add-source?added=1&targetType=${targetType}&targetId=${targetId}`);
}

function extractMoney(text: string, labels: string[]) {
  for (const label of labels) {
    const match = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-]?\\s*\\$?\\s*([0-9][0-9,]*(?:\\.[0-9]{2})?)`, "i").exec(text);
    if (match) return match[1].replace(/,/g, "");
  }
  return null;
}

async function extractPdfFields(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    const text = parsed.text.replace(/\s+/g, " ").trim();
    const fields = [
      ["plain_text_summary", text.slice(0, 1200), 0.45],
      ["total_contributions", extractMoney(text, ["Total Contributions", "Contributions Received"]), 0.5],
      ["total_expenditures", extractMoney(text, ["Total Expenditures", "Expenditures Made"]), 0.5],
      ["cash_on_hand", extractMoney(text, ["Cash On Hand", "Ending Cash", "Cash Balance"]), 0.5],
    ] as const;
    return {
      text,
      pages: parsed.total ?? 0,
      status: text.length > 40 ? DocumentExtractionStatus.NEEDS_REVIEW : DocumentExtractionStatus.NEEDS_OCR,
      fields: fields
        .filter(([, value]) => Boolean(value))
        .map(([fieldName, fieldValue, confidenceScore]) => ({
          fieldName,
          fieldValue: String(fieldValue),
          normalizedValue: String(fieldValue),
          confidenceScore,
          reviewStatus: DocumentFieldReviewStatus.PENDING_REVIEW,
          sourceTextExcerpt: String(fieldValue).slice(0, 300),
        })),
    };
  } finally {
    await parser.destroy();
  }
}

function moneyNumber(value: string | null | undefined) {
  if (!value) return null;
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function possibleContributionRows(text: string) {
  const rows: Array<{ contributorName: string; amount: number; contributionDate: Date | null; confidenceScore: number }> = [];
  const lineLikeMatches = text.match(/[A-Z][A-Za-z0-9 .,&'-]{3,90}\s+(?:\d{1,2}\/\d{1,2}\/\d{2,4}\s+)?\$[0-9][0-9,]*(?:\.[0-9]{2})?/g) ?? [];
  for (const raw of lineLikeMatches.slice(0, 100)) {
    const amountMatch = raw.match(/\$([0-9][0-9,]*(?:\.[0-9]{2})?)/);
    if (!amountMatch) continue;
    const amount = moneyNumber(amountMatch[1]);
    if (!amount) continue;
    const dateMatch = raw.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    const contributionDate = dateMatch ? new Date(dateMatch[1]) : null;
    const contributorName = raw.slice(0, amountMatch.index).replace(dateMatch?.[1] ?? "", "").replace(/\s+/g, " ").trim();
    if (contributorName.length < 3 || /total|subtotal|balance|cash on hand|expenditure/i.test(contributorName)) continue;
    rows.push({
      contributorName,
      amount,
      contributionDate: contributionDate && !Number.isNaN(contributionDate.getTime()) ? contributionDate : null,
      confidenceScore: dateMatch ? 0.5 : 0.42,
    });
  }
  return rows;
}

async function stageFinanceExtractionRows({
  candidateId,
  sourceName,
  sourceUrl,
  documentUrl,
  reportId,
  fields,
  text,
}: {
  candidateId: string | null;
  sourceName: string;
  sourceUrl: string;
  documentUrl: string | null;
  reportId: string;
  fields: Array<{ fieldName: string; fieldValue: string }>;
  text: string;
}) {
  if (!candidateId) return;
  try {
    const get = (name: string) => moneyNumber(fields.find((field) => field.fieldName === name)?.fieldValue);
    const totalRaised = get("total_contributions");
    const totalSpent = get("total_expenditures");
    const cashOnHand = get("cash_on_hand");
    if (totalRaised != null || totalSpent != null || cashOnHand != null) {
      await prisma.campaignFinanceSummary.create({
        data: {
          candidateId,
          totalRaised,
          totalSpent,
          cashOnHand,
          sourceName,
          sourceUrl,
          reviewStatus: CivicRecordReviewStatus.pending_review,
          lastUpdated: new Date(),
        },
      });
    }

    const contributionRows = possibleContributionRows(text);
    if (contributionRows.length) {
      await prisma.campaignFinanceContribution.createMany({
        data: contributionRows.map((row) => ({
          candidateId,
          contributorName: row.contributorName,
          contributorType: CampaignFinanceContributorType.unknown,
          amount: row.amount,
          contributionDate: row.contributionDate,
          reportId,
          sourceName,
          sourceUrl,
          documentUrl,
          reviewStatus: CivicRecordReviewStatus.pending_review,
          confidenceScore: row.confidenceScore,
        })),
      });
    }
  } catch (error) {
    console.warn("[campaign-finance] staged PDF extraction rows unavailable", error);
  }
}

export async function uploadCampaignFinancePdfAction(formData: FormData) {
  await requireFinanceAdmin();
  const targetType = readString(formData, "targetType") === "official" ? "official" : "candidate";
  const targetId = readString(formData, "targetId");
  const target = await resolveTarget(targetType, targetId);
  if (!target) throw new Error("Target profile was not found.");

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) throw new Error("PDF upload is required.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const originalFilename = file.name || "campaign-finance.pdf";
  const savedFilename = `${Date.now()}-${safeFilename(originalFilename) || "campaign-finance.pdf"}`;
  const localFilePath = path.join(IMPORT_DIR, savedFilename);
  await fs.mkdir(IMPORT_DIR, { recursive: true });
  await fs.writeFile(localFilePath, buffer);

  const reportName = readString(formData, "reportName") || originalFilename.replace(/\.[^.]+$/, "");
  const reportYear = Number(readString(formData, "reportYear")) || null;
  const filingDate = parseDate(readString(formData, "filingDate"));
  const sourceUrl = safeUrl(readString(formData, "sourceUrl"));
  const documentUrl = safeUrl(readString(formData, "documentUrl"));
  const notes = readString(formData, "notes") || null;
  const candidateName = target.candidate?.fullName ?? target.official?.fullName ?? readString(formData, "candidateName");

  const extraction = await extractPdfFields(buffer).catch(() => ({
    text: "",
    pages: 0,
    status: DocumentExtractionStatus.NEEDS_OCR,
    fields: [],
  }));
  const fileHash = hashBuffer(buffer);
  const document = await prisma.civicDocument.upsert({
    where: { fileHash },
    create: {
      title: reportName,
      documentType: CivicDocumentType.CAMPAIGN_FINANCE_FILING,
      sourceName: readString(formData, "sourceName") || "Manual campaign finance PDF upload",
      sourceUrl: sourceUrl ?? documentUrl,
      localFilePath,
      jurisdiction: target.candidate?.jurisdiction.name ?? target.official?.jurisdiction.name ?? null,
      electionYear: reportYear,
      relatedEntityType: target.documentEntityType,
      relatedEntityId: targetId,
      uploadMethod: CivicDocumentUploadMethod.MANUAL_UPLOAD,
      originalFilename,
      fileHash,
      pageCount: extraction.pages || null,
    },
    update: {
      title: reportName,
      sourceUrl: sourceUrl ?? documentUrl,
      localFilePath,
      relatedEntityType: target.documentEntityType,
      relatedEntityId: targetId,
      pageCount: extraction.pages || null,
    },
  });

  await prisma.documentExtractionRun.create({
    data: {
      civicDocumentId: document.id,
      completedAt: new Date(),
      status: extraction.status,
      extractionMethod: DocumentExtractionMethod.PDF_TEXT,
      pagesProcessed: extraction.pages || 0,
      confidenceScore: extraction.fields.length ? extraction.fields.reduce((sum, field) => sum + field.confidenceScore, 0) / extraction.fields.length : 0,
    },
  });
  await prisma.documentExtractedField.deleteMany({ where: { civicDocumentId: document.id } });
  if (extraction.fields.length) {
    await prisma.documentExtractedField.createMany({
      data: extraction.fields.map((field) => ({ ...field, civicDocumentId: document.id })),
    });
  }
  if (extraction.status === DocumentExtractionStatus.NEEDS_OCR) {
    await prisma.documentReviewIssue.create({
      data: {
        civicDocumentId: document.id,
        issueType: DocumentReviewIssueType.OCR_NEEDED,
        severity: DocumentReviewIssueSeverity.WARNING,
        notes: "No embedded PDF text was found. OCR/manual review is required before extracting totals.",
        status: DocumentReviewIssueStatus.OPEN,
      },
    });
  }

  const sourceForCard = sourceUrl ?? documentUrl ?? `local-document:${document.id}`;
  await upsertProfileFinanceSource({
    targetType,
    targetId,
    sourceUrl: sourceForCard,
    sourceName: readString(formData, "sourceName") || "Manual campaign finance PDF upload",
    reportName,
    reportYear,
    filingDate,
    documentUrl: documentUrl ?? `/admin/data-factory/campaign-finance/download/${document.id}`,
    notes,
    civicDocumentId: document.id,
  });
  await stageFinanceExtractionRows({
    candidateId: target.candidate?.id ?? null,
    sourceName: readString(formData, "sourceName") || "Manual campaign finance PDF upload",
    sourceUrl: sourceForCard,
    documentUrl: documentUrl ?? `/admin/data-factory/campaign-finance/download/${document.id}`,
    reportId: document.id,
    fields: extraction.fields,
    text: extraction.text,
  });

  const manifestExists = await fs
    .access(MANIFEST_PATH)
    .then(() => true)
    .catch(() => false);
  const header = "candidate_name,office,jurisdiction,committee_name,report_name,report_year,filing_date,source_url,document_url,local_file_path,notes\n";
  const row = [
    candidateName,
    target.candidate?.office?.title ?? target.official?.office.title ?? "",
    target.candidate?.jurisdiction.name ?? target.official?.jurisdiction.name ?? "",
    readString(formData, "committeeName"),
    reportName,
    reportYear ? String(reportYear) : "",
    filingDate ? filingDate.toISOString().slice(0, 10) : "",
    sourceUrl ?? "",
    documentUrl ?? "",
    localFilePath,
    notes ?? "",
  ]
    .map(csvEscape)
    .join(",");
  await fs.appendFile(MANIFEST_PATH, `${manifestExists ? "" : header}${row}\n`);

  revalidatePath(`/admin/data-factory/campaign-finance`);
  revalidatePath(`/admin/data-factory/campaign-finance/upload`);
  revalidatePath("/admin/documents/review");
  revalidatePath(targetType === "candidate" ? `/candidates/${targetId}` : `/officials/${targetId}`);
  redirect(`/admin/data-factory/campaign-finance/upload?uploaded=1&targetType=${targetType}&targetId=${targetId}`);
}

export async function updateCampaignFinanceSourceReviewAction(formData: FormData) {
  await requireFinanceAdmin();
  const attributionId = readString(formData, "attributionId");
  const statusValue = readString(formData, "reviewStatus");
  const reviewStatus = statusValue in CivicRecordReviewStatus ? (statusValue as CivicRecordReviewStatus) : CivicRecordReviewStatus.pending_review;
  if (!attributionId) return;

  await prisma.sourceAttribution.update({
    where: { id: attributionId },
    data: {
      reviewStatus,
      verifiedAt: reviewStatus === CivicRecordReviewStatus.verified ? new Date() : undefined,
    },
  });
  revalidatePath("/admin/data-factory/campaign-finance");
}
