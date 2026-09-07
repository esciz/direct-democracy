import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OCR_TEXT_DIR = path.join(GENERATED_DIR, "public-meeting-ocr-text-cache");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-ocr-results.json");

type VerificationRecord = {
  documentId: string;
  meetingId: string;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  localPath: string;
  fileSize: number;
  classification: string;
  ocrNeeded: boolean;
};

type SourceDocument = {
  id: string;
  organizationId?: string | null;
  meetingId: string;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  cachedPath: string | null;
};

type DocumentText = {
  documentId: string;
  extractionMethod: string;
  extractionQuality: string;
  textLength: number;
  failureReason: string | null;
};

type CacheIndexRecord = {
  documentId: string;
  stableLocalPath: string;
  contentType: string | null;
  contentHash?: string;
};

type CapabilityAudit = {
  capabilities?: {
    canInspectPdfPages?: boolean;
    canExtractNativePdfText?: boolean;
    canRenderPdfPages?: boolean;
    canRunTesseract?: boolean;
    canRunPageOcr?: boolean;
  };
  limits?: {
    maxFileSizeBytes?: number;
    maxPagesPerDocument?: number;
    subprocessTimeoutMs?: number;
  };
  tools?: Array<{ command: string; version: string | null; available: boolean }>;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

function absolutePath(value: string) {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function fileSize(value: string) {
  try {
    return statSync(absolutePath(value)).size;
  } catch {
    return 0;
  }
}

function isPdfRecord(document: SourceDocument | undefined, cache: CacheIndexRecord | undefined, localPath: string | null) {
  const values = [document?.sourceUrl, document?.sourcePath, document?.cachedPath, localPath].filter(Boolean).join(" ");
  return Boolean(cache?.contentType?.toLowerCase().includes("pdf") || /\.(pdf)(?:$|\?)/i.test(values));
}

function safeRun(command: string, args: string[], timeout: number) {
  return execFileSync(command, args, { encoding: "utf8", timeout, maxBuffer: 20 * 1024 * 1024 });
}

function pageCount(pdfPath: string, timeout: number) {
  try {
    const output = safeRun("pdfinfo", [pdfPath], timeout);
    const match = output.match(/^Pages:\s+(\d+)/im);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function nativeTextLength(pdfPath: string, timeout: number) {
  try {
    return safeRun("pdftotext", ["-layout", pdfPath, "-"], timeout).replace(/\s+/g, " ").trim().length;
  } catch {
    return 0;
  }
}

function ocrPage(pdfPath: string, page: number, timeout: number) {
  const tempDir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "dd-ocr-")));
  try {
    const prefix = path.join(tempDir, "page");
    execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-singlefile", "-r", "200", "-png", pdfPath, prefix], { timeout, stdio: "ignore" });
    const imagePath = `${prefix}.png`;
    if (!existsSync(imagePath)) return { text: "", confidence: null, failureReason: "page_render_output_missing" };
    const text = safeRun("tesseract", [realpathSync(imagePath), "stdout", "--psm", "6"], timeout).replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[\t ]+/g, " ").trim()).filter(Boolean).join("\n");
    return { text, confidence: null, failureReason: null };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "ocr_page_failed";
    return { text: "", confidence: null, failureReason };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const dryRun = process.argv.includes("--dry-run");
if (!dryRun) mkdirSync(OCR_TEXT_DIR, { recursive: true });
const generatedAt = new Date().toISOString();
const capabilities = readJson<CapabilityAudit>("dataops-ocr-capabilities.json", {});
const verification = readJson<{ records?: VerificationRecord[] }>("public-meeting-content-verification.json", { records: [] }).records ?? [];
const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
const textRows = readJson<{ records?: DocumentText[] }>("public-meeting-document-text.json", { records: [] }).records ?? [];
const cacheRows = readJson<{ records?: CacheIndexRecord[] }>("public-meeting-document-cache-index.json", { records: [] }).records ?? [];
const documentById = new Map(documents.map((document) => [document.id, document]));
const cacheByDocument = new Map(cacheRows.map((row) => [row.documentId, row]));
const maxFileSize = capabilities.limits?.maxFileSizeBytes ?? 50_000_000;
const maxPagesArg = process.argv.find((arg) => arg.startsWith("--max-pages="))?.slice(12);
const maxPages = maxPagesArg ? Number(maxPagesArg) : capabilities.limits?.maxPagesPerDocument ?? 10;
if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error("--max-pages must be a positive integer");
const timeout = capabilities.limits?.subprocessTimeoutMs ?? 30_000;
const force = process.argv.includes("--force");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Number(process.env.DATAOPS_OCR_LIMIT ?? 10);
const selectedSources = process.argv.filter((arg) => arg.startsWith("--source=")).flatMap((arg) => arg.slice(9).split(",")).filter(Boolean);
const selectedDocumentIds = new Set(process.argv.filter((arg) => arg.startsWith("--document-id=")).flatMap((arg) => arg.slice(14).split(",")).filter(Boolean));
const selectedDocumentType = process.argv.find((arg) => arg.startsWith("--document-type="))?.slice(16) ?? null;
type StoredOcrRecord = VerificationRecord & { ocrStatus: string; sourceContentHash?: string; extractedTextPath: string | null; pagesDetected?: number; pagesAttempted?: number; pagesSucceeded?: number; pagesFailed?: number; textLength: number; [key: string]: unknown };
const previousRecords = readJson<{ records: StoredOcrRecord[] }>("public-meeting-ocr-results.json", { records: [] }).records;
const previousById = new Map(previousRecords.map((row) => [row.documentId, row]));
const canRunOcr = Boolean(capabilities.capabilities?.canRunPageOcr);
const candidateByDocument = new Map<string, VerificationRecord>();
const quarantinedDocuments = new Set(verification.filter((record) => record.classification === "quarantined").map((record) => record.documentId));

for (const record of verification) {
  if ((record.classification === "ocr_candidate" || record.ocrNeeded || force) && record.classification !== "quarantined" && record.fileSize <= maxFileSize) {
    candidateByDocument.set(record.documentId, record);
  }
}

for (const row of textRows) {
  if (quarantinedDocuments.has(row.documentId)) continue;
  const document = documentById.get(row.documentId);
  const cache = cacheByDocument.get(row.documentId);
  const localPath = cache?.stableLocalPath ?? document?.cachedPath ?? document?.sourcePath ?? null;
  if (!localPath || !isPdfRecord(document, cache, localPath)) continue;
  const size = fileSize(localPath);
  if (!size || size > maxFileSize) continue;
  const needsOcr =
    force ||
    row.failureReason === "native_text_too_thin_ocr_unavailable" ||
    row.extractionMethod === "failed" ||
    row.extractionQuality === "insufficient" ||
    row.textLength < 300;
  if (!needsOcr || candidateByDocument.has(row.documentId)) continue;
  candidateByDocument.set(row.documentId, {
    documentId: row.documentId,
    meetingId: document?.meetingId ?? "unknown",
    jurisdiction: document?.jurisdiction ?? null,
    documentType: document?.documentType ?? "unknown",
    sourceUrl: document?.sourceUrl ?? null,
    localPath,
    fileSize: size,
    classification: "ocr_candidate",
    ocrNeeded: true,
  });
}

const sourceHashes = new Map<string, string>();
let reusedSuccessful = 0;
const scopedCandidates = [...candidateByDocument.values()].filter((record) => {
  if (selectedDocumentIds.size && !selectedDocumentIds.has(record.documentId)) return false;
  const document = documentById.get(record.documentId);
  if (selectedSources.length && (!document?.organizationId || !selectedSources.includes(document.organizationId))) return false;
  if (selectedDocumentType && (document?.documentType ?? record.documentType) !== selectedDocumentType) return false;
  const cache = cacheByDocument.get(record.documentId);
  const localPath = cache?.stableLocalPath ?? document?.cachedPath ?? document?.sourcePath ?? record.localPath;
  if (!localPath || !isPdfRecord(document, cache, localPath) || fileSize(localPath) > maxFileSize) return false;
  record.localPath = localPath;
  record.meetingId = document?.meetingId ?? record.meetingId;
  record.documentType = document?.documentType ?? record.documentType;
  if (!existsSync(absolutePath(localPath))) return true;
  const sourceHash = createHash("sha256").update(readFileSync(absolutePath(localPath))).digest("hex");
  sourceHashes.set(record.documentId, sourceHash);
  const previous = previousById.get(record.documentId);
  if (!force && previous?.ocrStatus === "succeeded" && previous.sourceContentHash === sourceHash && previous.extractedTextPath && fileSize(previous.extractedTextPath) > 0
      && (previous.pagesSucceeded ?? 0) >= Math.min(previous.pagesDetected ?? maxPages, maxPages)) {
    reusedSuccessful += 1;
    return false;
  }
  return true;
});
const candidates = scopedCandidates.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10);
if (dryRun) {
  console.log(JSON.stringify({ dryRun, sources: selectedSources, documentIds: [...selectedDocumentIds], documentType: selectedDocumentType, maxPages, limit,
    candidatesAvailable: scopedCandidates.length, reusedSuccessful, candidates: candidates.map((row) => ({ documentId: row.documentId, meetingId: row.meetingId, localPath: row.localPath, documentType: row.documentType })) }, null, 2));
  process.exit(0);
}

const runRecords = candidates.map((candidate, index) => {
  const record = { ...candidate, sourceContentHash: sourceHashes.get(candidate.documentId), processedAt: generatedAt };
  console.log(`OCR ${index + 1}/${candidates.length}: ${record.documentId}`);
  const pdfPath = absolutePath(record.localPath);
  if (!existsSync(pdfPath)) {
    return { ...record, ocrStatus: "failed", pagesAttempted: 0, pagesSucceeded: 0, pagesFailed: 0, textLength: 0, confidence: null, extractedTextPath: null, failureReason: "cached_pdf_missing" };
  }
  if (!canRunOcr) {
    return { ...record, ocrStatus: "ocr_engine_unavailable", pagesAttempted: 0, pagesSucceeded: 0, pagesFailed: 0, textLength: 0, confidence: null, extractedTextPath: null, failureReason: "Install Poppler pdftoppm and Tesseract, then rerun OCR." };
  }
  const pages = pageCount(pdfPath, timeout);
  if (!pages || pages < 1) {
    return { ...record, ocrStatus: "failed", pagesAttempted: 0, pagesSucceeded: 0, pagesFailed: 0, textLength: 0, confidence: null, extractedTextPath: null, failureReason: "pdf_page_count_unavailable" };
  }
  const nativeLength = capabilities.capabilities?.canExtractNativePdfText ? nativeTextLength(pdfPath, timeout) : 0;
  if (!force && nativeLength >= 300) {
    return { ...record, ocrStatus: "not_required_native_text_available", pagesAttempted: 0, pagesSucceeded: 0, pagesFailed: 0, textLength: 0, confidence: null, extractedTextPath: null, failureReason: null };
  }
  const pageLimit = Math.min(pages, maxPages);
  const pageResults = [];
  for (let page = 1; page <= pageLimit; page += 1) pageResults.push({ page, ...ocrPage(pdfPath, page, timeout) });
  const text = pageResults.map((page) => page.text).filter(Boolean).join("\n\n");
  const textPath = text ? path.join("data", "generated", "public-meeting-ocr-text-cache", `${record.documentId}.txt`) : null;
  if (textPath) writeFileSync(path.join(process.cwd(), textPath), `${text}\n`);
  return {
    ...record,
    ocrStatus: text ? "succeeded" : "failed",
    ocrEngine: "tesseract",
    ocrEngineVersion: capabilities.tools?.find((tool) => tool.command === "tesseract")?.version ?? null,
    pagesDetected: pages,
    pagesTruncated: pages > pageLimit,
    pagesAttempted: pageResults.length,
    pagesSucceeded: pageResults.filter((page) => page.text.length > 0).length,
    pagesFailed: pageResults.filter((page) => !page.text.length).length,
    textLength: text.length,
    confidence: null,
    extractedTextPath: textPath,
    pageResults,
    failureReason: text ? null : pageResults.find((page) => page.failureReason)?.failureReason ?? "ocr_produced_no_text",
  };
});

const mergedById = new Map(previousRecords.map((row) => [row.documentId, row]));
for (const row of runRecords) mergedById.set(row.documentId, row);
const records = [...mergedById.values()];
const audit = {
  generatedAt,
  totals: {
    candidates: candidates.length,
    candidatesAvailable: scopedCandidates.length,
    reusedSuccessful,
    storedResults: records.length,
    preservedPriorResults: previousRecords.filter((row) => !candidates.some((candidate) => candidate.documentId === row.documentId)).length,
    ocrSucceeded: runRecords.filter((record) => record.ocrStatus === "succeeded").length,
    ocrFailed: runRecords.filter((record) => record.ocrStatus === "failed").length,
    ocrEngineUnavailable: runRecords.filter((record) => record.ocrStatus === "ocr_engine_unavailable").length,
    notRequiredNativeTextAvailable: runRecords.filter((record) => record.ocrStatus === "not_required_native_text_available").length,
    pagesAttempted: runRecords.reduce((sum, record) => sum + (record.pagesAttempted ?? 0), 0),
    pagesSucceeded: runRecords.reduce((sum, record) => sum + (record.pagesSucceeded ?? 0), 0),
  },
};

writeFileSync(`${OUTPUT_PATH}.${process.pid}.tmp`, `${JSON.stringify({ generatedAt, filters: { sources: selectedSources, documentIds: [...selectedDocumentIds], documentType: selectedDocumentType, maxPages }, records, audit }, null, 2)}\n`);
renameSync(`${OUTPUT_PATH}.${process.pid}.tmp`, OUTPUT_PATH);
console.log(`Generated OCR results for ${records.length} documents at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
