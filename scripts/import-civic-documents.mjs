#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  CandidateKnowledgeSourceType,
  CivicDocumentRelatedEntityType,
  CivicDocumentType,
  CivicDocumentUploadMethod,
  CivicEntityType,
  CivicRecordReviewStatus,
  CampaignFinanceFilingType,
  DocumentExtractionMethod,
  DocumentExtractionStatus,
  DocumentFieldReviewStatus,
  DocumentReviewIssueSeverity,
  DocumentReviewIssueStatus,
  DocumentReviewIssueType,
  PrismaClient,
  ProfileEnrichmentReviewStatus,
} from "@prisma/client";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const prisma = new PrismaClient();
const ROOT = process.cwd();
const DEFAULT_DIRS = [
  "data/imports/documents",
  "data/imports/nvsos-candidate-media",
  "data/imports/campaign-finance",
  "data/imports/meeting-documents",
];
const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([".pdf", ".txt", ".text", ".html", ".htm", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".webp"]);
const MANIFEST_EXTENSIONS = new Set([".csv", ".json"]);
const SOURCE_NVSOS_MEDIA = "Nevada Secretary of State Candidate Public Media Information";
const SOURCE_NVSOS_MEDIA_URL =
  "https://www.nvsos.gov/elections/election-information/2026-election-information/2026-candidate-public-media-information";

function argValue(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg === `--${name}` || arg.startsWith(prefix));
  if (!found) return fallback;
  return found === `--${name}` ? "true" : found.slice(prefix.length);
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripHtml(value) {
  return normalizeWhitespace(
    String(value ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"'),
  );
}

function summarizeText(value, maxLength = 900) {
  const text = normalizeWhitespace(value);
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trimEnd()}...` : text;
}

function normalizeName(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function reorderCommaName(value) {
  const normalized = normalizeName(value);
  if (!normalized.includes(",")) return normalized;
  const [last, ...rest] = normalized.split(",");
  return normalizeWhitespace(`${rest.join(" ").trim()} ${last}`).toLowerCase();
}

function nameKeys(value) {
  return [...new Set([normalizeName(value), reorderCommaName(value)].filter(Boolean))];
}

function titleCaseName(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
    .replace(/\bIi\b/g, "II")
    .replace(/\bIii\b/g, "III")
    .replace(/\bIv\b/g, "IV");
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

async function listFilesRecursive(dir) {
  try {
    const entries = await fs.readdir(path.join(ROOT, dir), { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const relativePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listFilesRecursive(relativePath)));
      } else {
        files.push(relativePath);
      }
    }
    return files;
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

async function readCsvManifest(filePath) {
  const text = await fs.readFile(path.join(ROOT, filePath), "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

async function readJsonManifest(filePath) {
  const raw = JSON.parse(await fs.readFile(path.join(ROOT, filePath), "utf8"));
  return Array.isArray(raw) ? raw : raw.documents ?? [];
}

function inferDocumentType(value, filePath) {
  const normalized = normalizeWhitespace(value).toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized && normalized in CivicDocumentType) return normalized;
  const lower = `${filePath} ${value ?? ""}`.toLowerCase();
  if (lower.includes("candidate") && lower.includes("media")) return CivicDocumentType.CANDIDATE_PUBLIC_MEDIA_FORM;
  if (lower.includes("campaign-finance") || lower.includes("finance") || lower.includes("contribution")) return CivicDocumentType.CAMPAIGN_FINANCE_FILING;
  if (lower.includes("agenda")) return CivicDocumentType.MEETING_AGENDA;
  if (lower.includes("minutes")) return CivicDocumentType.MEETING_MINUTES;
  if (lower.includes("public-comment") || lower.includes("comment")) return CivicDocumentType.PUBLIC_COMMENT;
  if (lower.includes("ballot")) return CivicDocumentType.BALLOT_MEASURE_DOCUMENT;
  if (lower.includes("declaration")) return CivicDocumentType.CANDIDACY_DECLARATION;
  if (/\.(html|htm)$/i.test(filePath)) return CivicDocumentType.SAVED_HTML;
  if (/\.(png|jpg|jpeg|tif|tiff|webp)$/i.test(filePath)) return CivicDocumentType.SCANNED_FORM;
  return CivicDocumentType.OTHER;
}

function inferEntityType(value, documentType) {
  const normalized = normalizeWhitespace(value).toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized && normalized in CivicDocumentRelatedEntityType) return normalized;
  if (documentType === CivicDocumentType.CANDIDATE_PUBLIC_MEDIA_FORM || documentType === CivicDocumentType.CANDIDATE_STATEMENT) {
    return CivicDocumentRelatedEntityType.CANDIDATE;
  }
  if (documentType === CivicDocumentType.CAMPAIGN_FINANCE_FILING) return CivicDocumentRelatedEntityType.CAMPAIGN_FINANCE;
  if (documentType === CivicDocumentType.MEETING_AGENDA || documentType === CivicDocumentType.MEETING_MINUTES) return CivicDocumentRelatedEntityType.MEETING;
  if (documentType === CivicDocumentType.BALLOT_MEASURE_DOCUMENT) return CivicDocumentRelatedEntityType.BALLOT_MEASURE;
  return CivicDocumentRelatedEntityType.UNKNOWN;
}

function sourceDefaultsForPath(filePath) {
  if (filePath.includes("nvsos-candidate-media")) {
    return { sourceName: SOURCE_NVSOS_MEDIA, sourceUrl: SOURCE_NVSOS_MEDIA_URL };
  }
  if (filePath.includes("campaign-finance")) {
    return { sourceName: "Manual campaign finance document import", sourceUrl: null };
  }
  if (filePath.includes("meeting-documents")) {
    return { sourceName: "Manual meeting document import", sourceUrl: null };
  }
  return { sourceName: "Manual civic document import", sourceUrl: null };
}

function manifestEntryToDocument(entry, manifestPath) {
  const localFilePath = normalizeWhitespace(entry.local_file_path || entry.localFilePath);
  const filePath = localFilePath ? path.normalize(localFilePath) : manifestPath;
  const documentType = inferDocumentType(entry.document_type || entry.documentType || entry.report_name || entry.reportName, filePath);
  const defaults = sourceDefaultsForPath(filePath);
  const sourceName = normalizeWhitespace(entry.source_name || entry.sourceName) || defaults.sourceName;
  const sourceUrl = safeUrl(entry.source_url || entry.sourceUrl) ?? safeUrl(entry.document_url || entry.documentUrl) ?? defaults.sourceUrl;
  const entityName = normalizeWhitespace(entry.civic_entity_name || entry.civicEntityName || entry.candidate_name || entry.candidateName);
  const reportName = normalizeWhitespace(entry.report_name || entry.reportName);
  const titleParts = [entityName, entry.office_or_topic || entry.officeOrTopic || entry.office, reportName || entry.document_type || entry.documentType].filter(Boolean);
  const relatedEntityType =
    entityName && documentType === CivicDocumentType.CAMPAIGN_FINANCE_FILING
      ? CivicDocumentRelatedEntityType.CANDIDATE
      : inferEntityType(entry.civic_entity_type || entry.civicEntityType, documentType);
  return {
    manifestId: normalizeWhitespace(entry.document_id || entry.documentId) || null,
    title: normalizeWhitespace(entry.title) || normalizeWhitespace(titleParts.join(" - ")) || path.basename(filePath),
    documentType,
    relatedEntityType,
    relatedEntityName: entityName || null,
    officeOrTopic: normalizeWhitespace(entry.office_or_topic || entry.officeOrTopic || entry.office) || null,
    jurisdiction: normalizeWhitespace(entry.jurisdiction) || null,
    sourceName,
    sourceUrl,
    localFilePath: localFilePath || null,
    electionYear: Number(entry.election_year || entry.electionYear || entry.report_year || entry.reportYear) || null,
    notes: normalizeWhitespace(entry.notes) || null,
    reportName: reportName || null,
    reportYear: Number(entry.report_year || entry.reportYear) || null,
    filingDate: normalizeWhitespace(entry.filing_date || entry.filingDate) || null,
    committeeName: normalizeWhitespace(entry.committee_name || entry.committeeName) || null,
    documentUrl: safeUrl(entry.document_url || entry.documentUrl),
  };
}

async function fileToDocument(filePath) {
  const defaults = sourceDefaultsForPath(filePath);
  const documentType = inferDocumentType("", filePath);
  const fileName = path.basename(filePath);
  return {
    manifestId: null,
    title: fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
    documentType,
    relatedEntityType: inferEntityType("", documentType),
    relatedEntityName: null,
    officeOrTopic: null,
    jurisdiction: filePath.includes("nvsos") || filePath.includes("campaign-finance") ? "Nevada" : null,
    sourceName: defaults.sourceName,
    sourceUrl: defaults.sourceUrl,
    localFilePath: filePath,
    electionYear: filePath.includes("2026") ? 2026 : null,
    notes: null,
  };
}

async function collectInputs(importDirs) {
  const files = (await Promise.all(importDirs.map(listFilesRecursive))).flat();
  const manifestFiles = files.filter((file) => MANIFEST_EXTENSIONS.has(path.extname(file).toLowerCase()) && /manifest/i.test(path.basename(file)));
  const manifestDocuments = [];
  for (const manifestPath of manifestFiles) {
    const entries = path.extname(manifestPath).toLowerCase() === ".json" ? await readJsonManifest(manifestPath) : await readCsvManifest(manifestPath);
    manifestDocuments.push(...entries.map((entry) => manifestEntryToDocument(entry, manifestPath)));
  }
  const manifestPaths = new Set(manifestDocuments.map((entry) => entry.localFilePath).filter(Boolean).map((entry) => path.normalize(entry)));
  const discoveredDocuments = await Promise.all(
    files
      .filter((file) => SUPPORTED_DOCUMENT_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .filter((file) => !MANIFEST_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .filter((file) => !manifestPaths.has(path.normalize(file)))
      .map(fileToDocument),
  );
  return [...manifestDocuments, ...discoveredDocuments];
}

async function extractText(document) {
  const localFilePath = document.localFilePath;
  if (!localFilePath) {
    return { text: "", method: DocumentExtractionMethod.MANUAL_REVIEW, status: DocumentExtractionStatus.NEEDS_REVIEW, pages: 0 };
  }
  const absolutePath = path.join(ROOT, localFilePath);
  const extension = path.extname(localFilePath).toLowerCase();
  const buffer = await fs.readFile(absolutePath);
  if (extension === ".pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      const text = normalizeWhitespace(parsed.text);
      return {
        text,
        method: DocumentExtractionMethod.PDF_TEXT,
        status: text.length > 40 ? DocumentExtractionStatus.COMPLETED : DocumentExtractionStatus.NEEDS_OCR,
        pages: parsed.total ?? 0,
      };
    } finally {
      await parser.destroy();
    }
  }
  if ([".html", ".htm"].includes(extension)) {
    return { text: stripHtml(buffer.toString("utf8")), method: DocumentExtractionMethod.HTML_TEXT, status: DocumentExtractionStatus.COMPLETED, pages: 1 };
  }
  if ([".txt", ".text"].includes(extension)) {
    return { text: normalizeWhitespace(buffer.toString("utf8")), method: DocumentExtractionMethod.PLAIN_TEXT, status: DocumentExtractionStatus.COMPLETED, pages: 1 };
  }
  return { text: "", method: DocumentExtractionMethod.OCR_STUB, status: DocumentExtractionStatus.NEEDS_OCR, pages: 0 };
}

function extractBetweenLabels(text, labels, stopLabels, maxLength = 900) {
  const clean = normalizeWhitespace(text);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?:^|\\b)${escaped}\\s*[:\\-]?\\s+(.{3,4000})`, "i").exec(clean);
    if (!match) continue;
    let value = match[1];
    for (const stop of stopLabels) {
      const stopMatch = new RegExp(`\\b${stop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-]`, "i").exec(value);
      if (stopMatch?.index) value = value.slice(0, stopMatch.index);
    }
    const summary = summarizeText(value, maxLength);
    if (summary) return summary;
  }
  return null;
}

function extractUrls(text) {
  return [...new Set((text.match(/https?:\/\/[^\s<>)"']+/gi) ?? []).map((url) => url.replace(/[),.;]+$/g, "")))];
}

function extractEmail(text) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function extractPhone(text) {
  return text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] ?? null;
}

function moneyValue(value) {
  const match = String(value ?? "").match(/\$?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/);
  return match ? match[1].replace(/,/g, "") : null;
}

function field(name, value, confidenceScore = 0.65, sourceTextExcerpt = null) {
  const clean = normalizeWhitespace(value);
  if (!clean) return null;
  return {
    fieldName: name,
    fieldValue: clean,
    normalizedValue: clean,
    confidenceScore,
    reviewStatus: DocumentFieldReviewStatus.PENDING_REVIEW,
    sourceTextExcerpt: sourceTextExcerpt ? summarizeText(sourceTextExcerpt, 300) : summarizeText(clean, 300),
  };
}

function extractCandidateFields(document, text) {
  const fields = [];
  const candidateName =
    extractBetweenLabels(text, ["Candidate Name", "Name of Candidate", "Name"], ["Office", "Party", "Website", "Email"], 140) ??
    document.relatedEntityName;
  fields.push(field("candidate_name", candidateName ? titleCaseName(candidateName) : null, candidateName ? 0.75 : 0.45));
  fields.push(field("office_or_race", extractBetweenLabels(text, ["Office Sought", "Office", "Race"], ["Party", "Website", "Email", "Phone", "Biography"], 220) ?? document.officeOrTopic, 0.65));
  fields.push(field("party", extractBetweenLabels(text, ["Political Party", "Party", "Affiliation"], ["Office", "Website", "Email", "Phone", "Biography"], 90), 0.6));
  fields.push(field("biography", extractBetweenLabels(text, ["Biography", "Bio", "Background", "Candidate Statement"], ["Issues", "Priorities", "Website", "Email", "Phone"], 1200), 0.58));
  fields.push(field("campaign_website", extractBetweenLabels(text, ["Campaign Website", "Website", "Web Site"], ["Email", "Phone", "Biography"], 260)?.match(/https?:\/\/[^\s]+/i)?.[0] ?? extractUrls(text)[0], 0.7));
  fields.push(field("email", extractEmail(text), 0.75));
  fields.push(field("phone", extractPhone(text), 0.7));
  fields.push(field("social_links", extractUrls(text).filter((url) => /x\.com|twitter\.com|facebook\.com|instagram\.com|threads\.net|youtube\.com|tiktok\.com|linkedin\.com/i.test(url)).join(", "), 0.7));
  fields.push(field("occupation", extractBetweenLabels(text, ["Occupation", "Current Occupation"], ["Experience", "Biography", "Issues"], 260), 0.58));
  fields.push(field("experience", extractBetweenLabels(text, ["Experience", "Work Experience", "Public Service"], ["Issues", "Priorities", "Website"], 900), 0.55));
  fields.push(field("issues_priorities", extractBetweenLabels(text, ["Issues", "Priorities", "Top Priorities", "Platform"], ["Biography", "Occupation", "Experience", "Website", "Email"], 1200), 0.55));
  return fields.filter(Boolean);
}

function extractCampaignFinanceFields(document, text) {
  const fields = [];
  fields.push(field("candidate_or_committee_name", extractBetweenLabels(text, ["Candidate Name", "Committee Name", "Filer Name", "Name"], ["Office", "Report", "Period"], 180) ?? document.relatedEntityName, 0.58));
  fields.push(field("office_or_race", extractBetweenLabels(text, ["Office", "Office Sought", "Race"], ["Report", "Period", "Contributions"], 180) ?? document.officeOrTopic, 0.55));
  fields.push(field("report_name", extractBetweenLabels(text, ["Report Name", "Report Type", "Filing"], ["Period", "Filed", "Candidate"], 180) ?? document.reportName, document.reportName ? 0.8 : 0.5));
  fields.push(field("reporting_period", extractBetweenLabels(text, ["Reporting Period", "Period Covered", "Report Period"], ["Total", "Contributions", "Expenditures"], 220), 0.55));
  fields.push(field("total_contributions", moneyValue(extractBetweenLabels(text, ["Total Contributions", "Contributions Received"], ["Total Expenditures", "Expenditures", "Cash"], 90)), 0.5));
  fields.push(field("total_expenditures", moneyValue(extractBetweenLabels(text, ["Total Expenditures", "Expenditures Made"], ["Cash", "Balance", "Contributions"], 90)), 0.5));
  fields.push(field("cash_on_hand", moneyValue(extractBetweenLabels(text, ["Cash On Hand", "Ending Cash", "Cash Balance"], ["Certification", "Signature", "Filed"], 90)), 0.5));
  fields.push(field("filing_date", extractBetweenLabels(text, ["Filing Date", "Filed Date", "Date Filed"], ["Amended", "Report", "Candidate"], 90), 0.55));
  fields.push(field("amended_filing", /\bamended\b/i.test(text) ? "Possible amended filing" : null, 0.45));
  return fields.filter(Boolean);
}

function extractMeetingFields(document, text) {
  const fields = [];
  fields.push(field("meeting_title", extractBetweenLabels(text, ["Meeting", "Agenda", "Minutes"], ["Date", "Time", "Location"], 220) ?? document.title, 0.55));
  fields.push(field("meeting_date", extractBetweenLabels(text, ["Date", "Meeting Date"], ["Time", "Location", "Agenda"], 120), 0.5));
  fields.push(field("agenda_summary", document.documentType === CivicDocumentType.MEETING_AGENDA ? summarizeText(text, 1000) : null, 0.45));
  fields.push(field("minutes_summary", document.documentType === CivicDocumentType.MEETING_MINUTES ? summarizeText(text, 1000) : null, 0.45));
  return fields.filter(Boolean);
}

function extractFields(document, text) {
  if (!text) return [];
  if ([CivicDocumentType.CANDIDATE_PUBLIC_MEDIA_FORM, CivicDocumentType.CANDIDATE_STATEMENT, CivicDocumentType.CANDIDACY_DECLARATION].includes(document.documentType)) {
    return extractCandidateFields(document, text);
  }
  if (document.documentType === CivicDocumentType.CAMPAIGN_FINANCE_FILING) return extractCampaignFinanceFields(document, text);
  if ([CivicDocumentType.MEETING_AGENDA, CivicDocumentType.MEETING_MINUTES, CivicDocumentType.PUBLIC_COMMENT].includes(document.documentType)) {
    return extractMeetingFields(document, text);
  }
  return [field("plain_text_summary", summarizeText(text, 1000), 0.45)].filter(Boolean);
}

async function matchCandidate(document, fields) {
  if (![CivicDocumentRelatedEntityType.CANDIDATE, CivicDocumentRelatedEntityType.CAMPAIGN_FINANCE].includes(document.relatedEntityType)) return null;
  const candidateName =
    fields.find((item) => item.fieldName === "candidate_name")?.fieldValue ??
    fields.find((item) => item.fieldName === "candidate_or_committee_name")?.fieldValue ??
    document.relatedEntityName;
  if (!candidateName) return null;
  const candidates = await prisma.candidate.findMany({
    where: {
      OR: [
        { fullName: { contains: candidateName, mode: "insensitive" } },
        { ballotName: { contains: candidateName, mode: "insensitive" } },
      ],
    },
    include: { office: { select: { title: true } } },
    take: 12,
  });
  if (!candidates.length) {
    const keys = nameKeys(candidateName);
    const allCandidates = await prisma.candidate.findMany({
      include: { office: { select: { title: true } } },
      take: 500,
    });
    return (
      allCandidates.find((candidate) => keys.some((key) => nameKeys(candidate.ballotName ?? candidate.fullName).includes(key))) ?? null
    );
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getOrCreateManualCampaignFinanceSource(document) {
  const sourceUrl = document.sourceUrl ?? document.documentUrl ?? "local-document:campaign-finance";
  return prisma.source.upsert({
    where: { slug: "manual-campaign-finance-document-import" },
    create: {
      name: "Manual campaign finance document import",
      slug: "manual-campaign-finance-document-import",
      sourceType: "MANUAL",
      url: sourceUrl,
      adapterKey: "manual-campaign-finance-document-import",
      dataCategory: "campaign_finance_document",
      accessMethod: "pdf",
      syncStatus: "SUCCESS",
      lastCheckedAt: new Date(),
      lastSuccessAt: new Date(),
    },
    update: {
      url: sourceUrl,
      lastCheckedAt: new Date(),
      lastSuccessAt: new Date(),
      syncStatus: "SUCCESS",
    },
  });
}

async function upsertCampaignFinanceFilingFromDocument(documentRow, document, fields, candidate) {
  if (!candidate || document.documentType !== CivicDocumentType.CAMPAIGN_FINANCE_FILING) return false;
  const source = await getOrCreateManualCampaignFinanceSource(document);
  const reportName = document.reportName ?? fields.find((item) => item.fieldName === "report_name")?.fieldValue ?? document.title;
  const filedAt = parseDate(document.filingDate ?? fields.find((item) => item.fieldName === "filing_date")?.fieldValue);
  const externalId = `document:${documentRow.id}:campaign-finance`;
  const filingUrl = document.documentUrl ?? document.sourceUrl ?? (document.localFilePath ? `/${document.localFilePath}` : null);
  const attributionUrl = document.sourceUrl ?? filingUrl ?? `local-document:${documentRow.id}`;

  await prisma.campaignFinanceFiling.upsert({
    where: { sourceId_externalId: { sourceId: source.id, externalId } },
    create: {
      jurisdictionId: candidate.jurisdictionId,
      candidateId: candidate.id,
      sourceId: source.id,
      externalId,
      filingType: CampaignFinanceFilingType.CONTRIBUTION_EXPENSE,
      filerName: document.committeeName ?? candidate.fullName,
      filedAt,
      filingUrl,
      rawData: {
        filingName: reportName,
        reportName,
        reportYear: document.reportYear ?? document.electionYear,
        committeeName: document.committeeName,
        reportingPeriod: fields.find((item) => item.fieldName === "reporting_period")?.fieldValue ?? null,
        civicDocumentId: documentRow.id,
        sourceName: document.sourceName,
        sourceUrl: document.sourceUrl,
        documentUrl: document.documentUrl,
        localFilePath: document.localFilePath,
        extractionStatus: "Detailed donor extraction pending",
        reviewStatus: "pending_review",
      },
    },
    update: {
      candidateId: candidate.id,
      jurisdictionId: candidate.jurisdictionId,
      filedAt,
      filingUrl,
      rawData: {
        filingName: reportName,
        reportName,
        reportYear: document.reportYear ?? document.electionYear,
        committeeName: document.committeeName,
        reportingPeriod: fields.find((item) => item.fieldName === "reporting_period")?.fieldValue ?? null,
        civicDocumentId: documentRow.id,
        sourceName: document.sourceName,
        sourceUrl: document.sourceUrl,
        documentUrl: document.documentUrl,
        localFilePath: document.localFilePath,
        extractionStatus: "Detailed donor extraction pending",
        reviewStatus: "pending_review",
      },
    },
  });

  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: CivicEntityType.CANDIDATE,
        entityId: candidate.id,
        fieldName: "campaign_finance",
        sourceUrl: attributionUrl,
      },
    },
    create: {
      entityType: CivicEntityType.CANDIDATE,
      entityId: candidate.id,
      fieldName: "campaign_finance",
      sourceId: source.id,
      sourceName: document.sourceName,
      sourceUrl: attributionUrl,
      fieldsDerived: ["campaign finance source link", "filing metadata", "document intake"],
      confidenceScore: 0.65,
      reviewStatus: CivicRecordReviewStatus.pending_review,
      lastImportedAt: new Date(),
      metadata: {
        filingSummaries: [{ name: reportName, filedAt: filedAt?.toISOString() ?? null, url: filingUrl }],
        sourceLinks: [{ label: document.sourceName, url: attributionUrl, note: "Manual campaign finance document/source intake" }],
        donorExtractionStatus: "Detailed donor extraction pending",
        civicDocumentId: documentRow.id,
      },
    },
    update: {
      sourceId: source.id,
      sourceName: document.sourceName,
      sourceUrl: attributionUrl,
      fieldsDerived: ["campaign finance source link", "filing metadata", "document intake"],
      confidenceScore: 0.65,
      reviewStatus: CivicRecordReviewStatus.pending_review,
      lastImportedAt: new Date(),
      metadata: {
        filingSummaries: [{ name: reportName, filedAt: filedAt?.toISOString() ?? null, url: filingUrl }],
        sourceLinks: [{ label: document.sourceName, url: attributionUrl, note: "Manual campaign finance document/source intake" }],
        donorExtractionStatus: "Detailed donor extraction pending",
        civicDocumentId: documentRow.id,
      },
    },
  });
  return true;
}

async function upsertCandidateKnowledge(documentRow, document, fields, candidate) {
  if (!candidate) return false;
  if (![CivicDocumentType.CANDIDATE_PUBLIC_MEDIA_FORM, CivicDocumentType.CANDIDATE_STATEMENT].includes(document.documentType)) return false;
  const sourceUrl = document.sourceUrl ?? `local-document:${documentRow.fileHash ?? documentRow.id}`;
  const get = (name) => fields.find((item) => item.fieldName === name)?.fieldValue ?? null;
  await prisma.candidateKnowledgeEnrichment.upsert({
    where: { candidateId_sourceUrl: { candidateId: candidate.id, sourceUrl } },
    create: {
      candidateId: candidate.id,
      sourceUrl,
      sourceName: document.sourceName,
      sourceType: CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA,
      sourcePriority: 2,
      title: document.title,
      aboutSummary: get("biography"),
      ownWordsSummary: get("biography") ?? get("issues_priorities"),
      issues: get("issues_priorities")
        ? [{ label: "Candidate priorities", summary: get("issues_priorities"), sourceUrl }]
        : undefined,
      experienceSummary: [get("occupation"), get("experience")].filter(Boolean).join(" ") || null,
      financeContext: null,
      newsItems: undefined,
      socialLinks: get("social_links") ? get("social_links").split(",").map((url) => url.trim()).filter(Boolean) : undefined,
      sourceAttribution: {
        sourceName: document.sourceName,
        sourceUrl,
        documentTitle: document.title,
        civicDocumentId: documentRow.id,
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      },
      confidenceScore: Math.min(0.85, fields.reduce((sum, item) => sum + item.confidenceScore, 0) / Math.max(fields.length, 1)),
      reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      fetchedAt: new Date(),
      lastUpdatedAt: new Date(),
    },
    update: {
      title: document.title,
      aboutSummary: get("biography"),
      ownWordsSummary: get("biography") ?? get("issues_priorities"),
      experienceSummary: [get("occupation"), get("experience")].filter(Boolean).join(" ") || null,
      sourceAttribution: {
        sourceName: document.sourceName,
        sourceUrl,
        documentTitle: document.title,
        civicDocumentId: documentRow.id,
        reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      },
      confidenceScore: Math.min(0.85, fields.reduce((sum, item) => sum + item.confidenceScore, 0) / Math.max(fields.length, 1)),
      reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      lastUpdatedAt: new Date(),
    },
  });
  return true;
}

async function registerDocument(document) {
  let fileHash = null;
  let originalFilename = null;
  if (document.localFilePath) {
    const buffer = await fs.readFile(path.join(ROOT, document.localFilePath));
    fileHash = hashBuffer(buffer);
    originalFilename = path.basename(document.localFilePath);
  } else {
    fileHash = hashText(JSON.stringify(document));
  }
  return prisma.civicDocument.upsert({
    where: { fileHash },
    create: {
      title: document.title,
      documentType: document.documentType,
      sourceName: document.sourceName,
      sourceUrl: document.sourceUrl,
      localFilePath: document.localFilePath,
      jurisdiction: document.jurisdiction,
      electionYear: document.electionYear,
      relatedEntityType: document.relatedEntityType,
      uploadMethod: document.manifestId ? CivicDocumentUploadMethod.MANIFEST : CivicDocumentUploadMethod.LOCAL_IMPORT,
      originalFilename,
      fileHash,
    },
    update: {
      title: document.title,
      documentType: document.documentType,
      sourceName: document.sourceName,
      sourceUrl: document.sourceUrl,
      localFilePath: document.localFilePath,
      jurisdiction: document.jurisdiction,
      electionYear: document.electionYear,
      relatedEntityType: document.relatedEntityType,
      originalFilename,
    },
  });
}

async function createIssue(civicDocumentId, issueType, severity, notes) {
  await prisma.documentReviewIssue.create({
    data: {
      civicDocumentId,
      issueType,
      severity,
      notes,
      status: DocumentReviewIssueStatus.OPEN,
    },
  });
}

async function importOne(document) {
  const row = await registerDocument(document);
  const run = await prisma.documentExtractionRun.create({
    data: {
      civicDocumentId: row.id,
      status: DocumentExtractionStatus.RUNNING,
      extractionMethod: DocumentExtractionMethod.MANUAL_REVIEW,
    },
  });

  try {
    const extraction = await extractText(document);
    const fields = extractFields(document, extraction.text);
    const candidate = await matchCandidate(document, fields);
    await prisma.civicDocument.update({
      where: { id: row.id },
      data: {
        pageCount: extraction.pages || null,
        relatedEntityId: candidate?.id ?? row.relatedEntityId,
        relatedEntityType: candidate ? CivicDocumentRelatedEntityType.CANDIDATE : row.relatedEntityType,
      },
    });
    await prisma.documentExtractedField.deleteMany({ where: { civicDocumentId: row.id } });
    if (fields.length) {
      await prisma.documentExtractedField.createMany({
        data: fields.map((item) => ({ ...item, civicDocumentId: row.id })),
      });
    }
    await prisma.documentExtractionRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: extraction.status === DocumentExtractionStatus.COMPLETED && fields.some((item) => item.confidenceScore < 0.6)
          ? DocumentExtractionStatus.NEEDS_REVIEW
          : extraction.status,
        extractionMethod: extraction.method,
        pagesProcessed: extraction.pages || 0,
        confidenceScore: fields.length ? fields.reduce((sum, item) => sum + item.confidenceScore, 0) / fields.length : 0,
      },
    });
    if (extraction.status === DocumentExtractionStatus.NEEDS_OCR) {
      await createIssue(row.id, DocumentReviewIssueType.OCR_NEEDED, DocumentReviewIssueSeverity.WARNING, "No embedded text was found. OCR/manual review is required.");
    }
    if (!candidate && document.relatedEntityType === CivicDocumentRelatedEntityType.CANDIDATE) {
      await createIssue(row.id, DocumentReviewIssueType.UNMATCHED_ENTITY, DocumentReviewIssueSeverity.WARNING, "Candidate document could not be confidently matched to an existing candidate record.");
    }
    if (fields.some((item) => item.confidenceScore < 0.6)) {
      await createIssue(row.id, DocumentReviewIssueType.LOW_CONFIDENCE, DocumentReviewIssueSeverity.INFO, "One or more extracted fields require reviewer confirmation.");
    }
    const knowledgeCreated = await upsertCandidateKnowledge(row, document, fields, candidate);
    const financeFilingCreated = await upsertCampaignFinanceFilingFromDocument(row, document, fields, candidate);
    return { id: row.id, status: extraction.status, fields: fields.length, matchedCandidate: Boolean(candidate), knowledgeCreated, financeFilingCreated };
  } catch (error) {
    await prisma.documentExtractionRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: DocumentExtractionStatus.FAILED,
        errorLog: error instanceof Error ? error.stack ?? error.message : String(error),
      },
    });
    await createIssue(row.id, DocumentReviewIssueType.PARSE_ERROR, DocumentReviewIssueSeverity.ERROR, error instanceof Error ? error.message : String(error));
    return { id: row.id, status: DocumentExtractionStatus.FAILED, fields: 0, matchedCandidate: false, knowledgeCreated: false };
  }
}

async function main() {
  const importDir = argValue("dir");
  const importDirs = importDir ? [importDir] : DEFAULT_DIRS;
  const inputs = await collectInputs(importDirs);
  const results = [];
  for (const input of inputs) {
    results.push(await importOne(input));
  }
  const summary = {
    documentsFound: inputs.length,
    documentsRegistered: results.length,
    fieldsExtracted: results.reduce((sum, result) => sum + result.fields, 0),
    candidatesMatched: results.filter((result) => result.matchedCandidate).length,
    candidateKnowledgePendingReview: results.filter((result) => result.knowledgeCreated).length,
    ocrNeeded: results.filter((result) => result.status === DocumentExtractionStatus.NEEDS_OCR).length,
    failed: results.filter((result) => result.status === DocumentExtractionStatus.FAILED).length,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
