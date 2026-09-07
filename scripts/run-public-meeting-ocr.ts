import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OCR_TEXT_DIR = path.join(GENERATED_DIR, "public-meeting-ocr-text-cache");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-ocr-results.json");
const startedAt = Date.now();
const maxDurationMs = Number(process.argv.find(arg => arg.startsWith("--max-duration-ms="))?.slice("--max-duration-ms=".length) ?? process.env.DATAOPS_OCR_MAX_DURATION_MS ?? 720_000);
if (!Number.isInteger(maxDurationMs) || maxDurationMs < 1 || maxDurationMs > 840_000) throw new Error("OCR duration must be a positive integer at most 840000 ms, below the pipeline command deadline");
const checkpointReserveMs = Math.min(5_000, Math.max(25, Math.floor(maxDurationMs * 0.02)));
const workDeadline = startedAt + maxDurationMs - checkpointReserveMs;
let budgetReached = false;
function hasWorkTime() {
  if (Date.now() < workDeadline) return true;
  budgetReached = true;
  return false;
}

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
  sourceContentHash?: string | null;
  extractedTextPath?: string | null;
  nativeTextFailureReason?: string | null;
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
  if (!hasWorkTime()) throw new Error("ocr_budget_exhausted");
  const remaining = Math.max(1, workDeadline - Date.now());
  try {
    return execFileSync(command, args, { encoding: "utf8", timeout: Math.min(timeout, remaining), killSignal: "SIGKILL", maxBuffer: 20 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } catch (error) {
    if (!hasWorkTime() || remaining < timeout && (error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
      budgetReached = true;
      throw new Error("ocr_budget_exhausted");
    }
    throw error;
  }
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

function substantiveNativeText(text: string, minimumLength = 300) {
  if (/\0|^\s*%PDF-/i.test(text)) return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  const words = normalized.toLowerCase().match(/\p{L}[\p{L}\p{M}'’-]{2,}/gu) ?? [];
  return normalized.length >= minimumLength && words.length >= 40 && new Set(words).size >= 20;
}

function readTextSidecar(localPath: string | null | undefined, expectedLength: number) {
  if (!localPath) return null;
  try {
    const text = readFileSync(absolutePath(localPath), "utf8").replace(/\n$/, "");
    return text.length === expectedLength ? text : null;
  } catch { return null; }
}

function ocrPage(pdfPath: string, page: number, timeout: number) {
  const tempDir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "dd-ocr-")));
  try {
    const prefix = path.join(tempDir, "page");
    safeRun("pdftoppm", ["-f", String(page), "-l", String(page), "-singlefile", "-r", "200", "-png", pdfPath, prefix], timeout);
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
if (!Number.isInteger(timeout) || timeout < 1) throw new Error("OCR subprocess timeout must be a positive integer");
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
type NativeCoverage = { pages: number | null; complete: boolean };
const nativeCoverageByHash = new Map<string, NativeCoverage>();
function nativeCoverage(localPath: string, sourceHash: string | undefined) {
  if (sourceHash && nativeCoverageByHash.has(sourceHash)) return nativeCoverageByHash.get(sourceHash)!;
  const pages = pageCount(absolutePath(localPath), timeout);
  let complete = false;
  if (!force && pages && capabilities.capabilities?.canExtractNativePdfText) {
    try {
      // Poppler emits a form feed after each page. Whole-document length or a
      // high extraction label cannot prove that later scanned pages have text.
      const nativePages = safeRun("pdftotext", ["-layout", absolutePath(localPath), "-"], timeout).split("\f");
      if (nativePages.at(-1)?.trim() === "") nativePages.pop();
      complete = nativePages.length === pages && nativePages.every(page => substantiveNativeText(page));
    } catch { /* Failed or truncated native extraction must remain OCR-eligible. */ }
  }
  const coverage = { pages, complete };
  if (sourceHash) nativeCoverageByHash.set(sourceHash, coverage);
  return coverage;
}
function usablePreviousOcr(previous: StoredOcrRecord | undefined, sourceHash: string | undefined) {
  return previous?.ocrStatus === "succeeded" && sourceHash && previous.sourceContentHash === sourceHash
    && previous.textLength > 0 && Boolean(readTextSidecar(previous.extractedTextPath, previous.textLength)?.trim());
}
function requestedPagesComplete(previous: StoredOcrRecord) {
  if (!Number.isInteger(previous.pagesDetected) || (previous.pagesDetected ?? 0) < 1) return false;
  const required = Math.min(previous.pagesDetected!, maxPages);
  if ((previous.pagesSucceeded ?? 0) < required) return false;
  if (Array.isArray(previous.pageResults)) {
    const succeeded = new Set(previous.pageResults.filter(page => page && typeof page.page === "number" && typeof page.text === "string" && page.text.trim()).map(page => page.page));
    return Array.from({ length: required }, (_, index) => index + 1).every(page => succeeded.has(page));
  }
  // Legacy full-prefix results can be reused only when no page failed.
  return previous.pagesFailed === 0 && (previous.pagesAttempted ?? 0) >= required;
}
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
    row.failureReason === "native_text_incomplete_pages" ||
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
let reusedNativeText = 0;
const readableNativeHashes = new Set(textRows.filter((row) => {
  if (!hasWorkTime()) return false;
  if (row.extractionMethod !== "native_text" || row.extractionQuality !== "high" || row.failureReason || row.nativeTextFailureReason
    || row.textLength < 3000 || !row.sourceContentHash) return false;
  const text = readTextSidecar(row.extractedTextPath, row.textLength);
  return text !== null && substantiveNativeText(text, 3000);
}).map((row) => row.sourceContentHash));
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
  if (!hasWorkTime()) return true;
  const sourceHash = createHash("sha256").update(readFileSync(absolutePath(localPath))).digest("hex");
  sourceHashes.set(record.documentId, sourceHash);
  if (!force && readableNativeHashes.has(sourceHash) && nativeCoverage(localPath, sourceHash).complete) {
    reusedNativeText += 1;
    return false;
  }
  const previous = previousById.get(record.documentId);
  if (!force && usablePreviousOcr(previous, sourceHash) && requestedPagesComplete(previous!)) {
    reusedSuccessful += 1;
    return false;
  }
  return true;
});
// Rotate failures behind unattempted/older attempts so one bad PDF cannot keep
// consuming the first slot. Source/type/ID scope still applies before budgets.
const attemptedAt = (id: string) => Date.parse(String(previousById.get(id)?.lastAttemptAt ?? previousById.get(id)?.processedAt ?? "")) || 0;
scopedCandidates.sort((left, right) => attemptedAt(left.documentId) - attemptedAt(right.documentId) || left.documentId.localeCompare(right.documentId));
const candidates = scopedCandidates.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10);
if (dryRun) {
  console.log(JSON.stringify({ dryRun, sources: selectedSources, documentIds: [...selectedDocumentIds], documentType: selectedDocumentType, maxPages, limit,
    candidatesAvailable: scopedCandidates.length, reusedSuccessful, reusedNativeText, candidates: candidates.map((row) => ({ documentId: row.documentId, meetingId: row.meetingId, localPath: row.localPath, documentType: row.documentType })) }, null, 2));
  process.exit(0);
}

const attemptedPages: Array<{ succeeded: number; attempted: number }> = [];
let preservedAfterWeakerRetry = 0;
const preservedOcrIds = new Set<string>();
function processCandidate(candidate: VerificationRecord, index: number): StoredOcrRecord | undefined {
  const record = { ...candidate, sourceContentHash: sourceHashes.get(candidate.documentId), processedAt: new Date().toISOString() };
  const previous = previousById.get(record.documentId);
  const preservePrevious = (reason: string) => {
    preservedOcrIds.add(record.documentId);
    if (reason !== "complete_native_text_available") preservedAfterWeakerRetry += 1;
    return { ...previous!, lastAttemptAt: record.processedAt, lastAttemptStatus: reason,
      lastAttemptFailureReason: reason === "complete_native_text_available" ? null : reason };
  };
  console.log(`OCR ${index + 1}/${candidates.length}: ${record.documentId}`);
  const pdfPath = absolutePath(record.localPath);
  if (!existsSync(pdfPath)) {
    return { ...record, ocrStatus: "failed", pagesAttempted: 0, pagesSucceeded: 0, pagesFailed: 0, textLength: 0, confidence: null, extractedTextPath: null, failureReason: "cached_pdf_missing" };
  }
  const coverage = nativeCoverage(record.localPath, record.sourceContentHash);
  // Inspection alone must not label an unattempted document failed when this
  // batch runs out of time. Its prior record is left unchanged for the next run.
  if (budgetReached || !hasWorkTime()) return undefined;
  const pages = coverage.pages;
  if (!pages || pages < 1) {
    if (usablePreviousOcr(previous, record.sourceContentHash)) return preservePrevious("pdf_page_count_unavailable");
    return { ...record, ocrStatus: "failed", pagesAttempted: 0, pagesSucceeded: 0, pagesFailed: 0, textLength: 0, confidence: null, extractedTextPath: null, failureReason: "pdf_page_count_unavailable" };
  }
  if (!force && coverage.complete) {
    // Complete native evidence can avoid new work, but must not erase an
    // existing OCR sidecar or its recorded page coverage.
    if (usablePreviousOcr(previous, record.sourceContentHash)) return preservePrevious("complete_native_text_available");
    return { ...record, ocrStatus: "not_required_native_text_available", pagesAttempted: 0, pagesSucceeded: 0, pagesFailed: 0, textLength: 0, confidence: null, extractedTextPath: null, failureReason: null };
  }
  if (!canRunOcr) {
    if (usablePreviousOcr(previous, record.sourceContentHash)) return preservePrevious("ocr_engine_unavailable");
    return { ...record, ocrStatus: "ocr_engine_unavailable", pagesAttempted: 0, pagesSucceeded: 0, pagesFailed: 0, textLength: 0, confidence: null, extractedTextPath: null, failureReason: "Install Poppler pdftoppm and Tesseract, then rerun OCR." };
  }
  const pageLimit = Math.min(pages, maxPages);
  const pageResults = [];
  for (let page = 1; page <= pageLimit; page += 1) {
    if (!hasWorkTime()) break;
    pageResults.push({ page, ...ocrPage(pdfPath, page, timeout) });
    if (budgetReached) break;
  }
  if (!pageResults.length) return undefined;
  const newlySucceeded = pageResults.filter(page => page.text.length > 0).length;
  attemptedPages.push({ attempted: pageResults.length, succeeded: newlySucceeded });
  const previousUsable = usablePreviousOcr(previous, record.sourceContentHash);
  if (previousUsable && newlySucceeded === 0) return preservePrevious(budgetReached ? "ocr_budget_exhausted" : "ocr_retry_retained_previous_evidence");
  let combinedPages = pageResults;
  if (previousUsable && Array.isArray(previous!.pageResults)) {
    const previousPages = previous!.pageResults.filter(page => page && Number.isInteger(page.page) && page.page >= 1 && page.page <= pages && typeof page.text === "string");
    const previousText = previousPages.map(page => page.text).filter(Boolean).join("\n\n");
    // Reuse individual pages only when their text exactly reconstructs the
    // verified prior sidecar for these same source bytes.
    if (previousText === readTextSidecar(previous!.extractedTextPath, previous!.textLength)) {
      const byPage = new Map(pageResults.map(page => [page.page, page]));
      for (const page of previousPages) {
        const current = byPage.get(page.page);
        if (!current || !current.text && page.text) byPage.set(page.page, { page: page.page, text: page.text, confidence: null, failureReason: page.text ? null : "prior_page_produced_no_text" });
      }
      combinedPages = [...byPage.values()].sort((left, right) => left.page - right.page);
    }
  }
  const text = combinedPages.map(page => page.text).filter(Boolean).join("\n\n");
  const pagesSucceeded = combinedPages.filter(page => page.text.length > 0).length;
  if (previousUsable && (!text || pagesSucceeded < (previous!.pagesSucceeded ?? 0)
    || pagesSucceeded === (previous!.pagesSucceeded ?? 0) && text.length < previous!.textLength)) {
    return preservePrevious(budgetReached ? "ocr_budget_exhausted" : "ocr_retry_retained_previous_evidence");
  }
  // Sidecars are immutable revisions of the TEXT bytes: the same source PDF
  // may yield more pages on a later pass. An interrupted ledger write must
  // never alter text still referenced by its previous committed record.
  const textBytes = `${text}\n`;
  const extractedTextHash = text ? createHash("sha256").update(textBytes).digest("hex") : null;
  const textPath = extractedTextHash ? path.join("data", "generated", "public-meeting-ocr-text-cache", `${extractedTextHash}.txt`) : null;
  if (textPath) {
    const destination = absolutePath(textPath);
    if (existsSync(destination)) {
      if (readFileSync(destination, "utf8") !== textBytes) throw new Error("immutable_ocr_sidecar_hash_mismatch");
    } else {
      const temporary = `${destination}.${process.pid}.tmp`;
      writeFileSync(temporary, textBytes);
      renameSync(temporary, destination);
    }
  }
  return {
    ...record,
    ocrStatus: text ? "succeeded" : "failed",
    ocrEngine: "tesseract",
    ocrEngineVersion: capabilities.tools?.find((tool) => tool.command === "tesseract")?.version ?? null,
    pagesDetected: pages,
    pagesTruncated: pages > combinedPages.length,
    pagesAttempted: combinedPages.length,
    pagesSucceeded,
    pagesFailed: combinedPages.filter((page) => !page.text.length).length,
    coverageStatus: pagesSucceeded === pages ? "complete" : text ? "partial" : "failed",
    textLength: text.length,
    confidence: null,
    extractedTextPath: textPath,
    extractedTextHash,
    lastAttemptStatus: budgetReached ? "ocr_budget_exhausted" : "completed",
    lastAttemptAt: record.processedAt,
    pageResults: combinedPages,
    failureReason: text ? null : pageResults.find((page) => page.failureReason)?.failureReason ?? "ocr_produced_no_text",
  };
}

const mergedById = new Map(previousRecords.map((row) => [row.documentId, row]));
const runRecords: StoredOcrRecord[] = [];
for (const [index, candidate] of candidates.entries()) {
  if (!hasWorkTime()) break;
  const row = processCandidate(candidate, index);
  if (!row) break;
  runRecords.push(row);
  mergedById.set(row.documentId, row);
  persist(false);
}
const audit = persist(true);
console.log(`Generated OCR results for ${mergedById.size} documents at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));

function persist(completed: boolean) {
const records = [...mergedById.values()];
const audit = {
  generatedAt,
  completed,
  maxDurationMs,
  checkpointReserveMs,
  budgetReached,
  totals: {
    candidates: candidates.length,
    documentsProcessed: runRecords.length,
    documentsDeferred: candidates.length - runRecords.length,
    candidatesAvailable: scopedCandidates.length,
    reusedSuccessful,
    reusedNativeText,
    preservedAfterWeakerRetry,
    preservedPriorOcr: preservedOcrIds.size,
    storedResults: records.length,
    preservedPriorResults: previousRecords.filter((row) => !runRecords.some((candidate) => candidate.documentId === row.documentId)).length,
    ocrSucceeded: runRecords.filter((record) => record.ocrStatus === "succeeded" && !preservedOcrIds.has(record.documentId)).length,
    ocrFailed: runRecords.filter((record) => record.ocrStatus === "failed").length,
    ocrEngineUnavailable: runRecords.filter((record) => record.ocrStatus === "ocr_engine_unavailable").length,
    notRequiredNativeTextAvailable: runRecords.filter((record) => record.ocrStatus === "not_required_native_text_available").length,
    pagesAttempted: attemptedPages.reduce((sum, record) => sum + record.attempted, 0),
    pagesSucceeded: attemptedPages.reduce((sum, record) => sum + record.succeeded, 0),
  },
};

writeFileSync(`${OUTPUT_PATH}.${process.pid}.tmp`, `${JSON.stringify({ generatedAt, filters: { sources: selectedSources, documentIds: [...selectedDocumentIds], documentType: selectedDocumentType, maxPages }, records, audit }, null, 2)}\n`);
renameSync(`${OUTPUT_PATH}.${process.pid}.tmp`, OUTPUT_PATH);
return audit;
}
