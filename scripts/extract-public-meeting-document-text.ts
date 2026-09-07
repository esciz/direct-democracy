import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeWhitespace, summarizeText } from "@/lib/public-meetings/shared";
import { extractPdfTextIsolated, NATIVE_PDF_EXTRACTOR_VERSION, preferredNativePdfBackend, type PdfNativeTextResult } from "@/lib/public-meetings/pdf-native-text";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const TEXT_DIR = path.join(GENERATED_DIR, "public-meeting-document-text-cache");
const DOCUMENTS_PATH = path.join(GENERATED_DIR, "public-meeting-source-documents.json");
const CACHE_INDEX_PATH = path.join(GENERATED_DIR, "public-meeting-document-cache-index.json");
const OCR_RESULTS_PATH = path.join(GENERATED_DIR, "public-meeting-ocr-results.json");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-document-text.json");
const MAX_TEXT_CHARS = 450_000;
const PDF_WORKER_PATH = fileURLToPath(new URL("./workers/public-meeting-pdf-text.mjs", import.meta.url));
const PDF_TIMEOUT_MS = Number(process.argv.find((arg) => arg.startsWith("--pdf-timeout-ms="))?.split("=")[1] ?? process.env.PUBLIC_MEETING_PDF_TIMEOUT_MS ?? "15000");
const PDF_MAX_BYTES = Number(process.argv.find((arg) => arg.startsWith("--max-pdf-bytes="))?.split("=")[1] ?? process.env.PUBLIC_MEETING_PDF_MAX_BYTES ?? String(50 * 1024 * 1024));
const MAX_DOCUMENTS = Number(process.argv.find((arg) => arg.startsWith("--max-documents="))?.split("=")[1] ?? "Infinity");
const MAX_DURATION_MS = Number(process.argv.find((arg) => arg.startsWith("--max-duration-ms="))?.split("=")[1] ?? "Infinity");

type ExtractionMethod = "native_text" | "ocr_text" | "mixed" | "failed";

type SourceDocumentRecord = {
  id: string;
  meetingId: string;
  meetingItemIds: string[];
  bodyId: string | null;
  organizationId: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  cachedPath: string | null;
  retrievalStatus: string;
  priorityBody: boolean;
  contentHash: string | null;
};

type CacheIndexRecord = {
  documentId: string;
  stableLocalPath: string;
  contentHash: string;
  contentType: string | null;
  fileSize: number;
  extractionStatus?: "pending" | "extracted" | "failed";
};

type DocumentTextRecord = {
  id: string;
  documentId: string;
  meetingId: string;
  meetingItemIds: string[];
  documentType: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  extractedTextPath: string | null;
  extractionMethod: ExtractionMethod;
  extractionQuality: "high" | "medium" | "low" | "insufficient";
  textLength: number;
  confidence: number;
  sourceSnippet: string | null;
  ocrAttempted: boolean;
  ocrAvailable: boolean;
  failureReason: string | null;
  extractedAt: string | null;
  lastAttemptAt?: string;
  sourceContentHash?: string | null;
  ocrTextHash?: string | null;
  evaluatedOcrTextHash?: string | null;
  nativeTextFailureReason?: string | null;
  nativeTextExtractorVersion?: number;
  nativeTextExtractor?: "poppler" | "pdf-parse";
  nativeTextEvaluationVersion?: number;
  nativeTextEvaluationBackend?: "poppler" | "pdf-parse";
  nativeTextCoverage?: "complete" | "partial" | "unknown";
  nativePagesDetected?: number | null;
  nativePagesWithText?: number | null;
  textCompleteness?: "complete" | "partial" | "unknown";
};

type OcrResultRecord = {
  documentId: string;
  extractedTextPath: string | null;
  textLength: number;
  ocrStatus: string;
  confidence: number | null;
  failureReason: string | null;
  sourceContentHash?: string | null;
  processedAt?: string;
  pagesDetected?: number;
  pagesSucceeded?: number;
  pagesFailed?: number;
  pagesTruncated?: boolean;
};

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeAtomically(filePath: string, value: string) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, value);
  renameSync(temporaryPath, filePath);
}

function cleanText(value: string, html = false) {
  // Preserve numbered headings and paragraph boundaries for the downstream topic parser.
  // PDF/OCR text can contain literal angle brackets separated by many pages.
  // Only remove markup from a source actually stored as HTML.
  const content = html ? value.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/?(?:p|div|li|tr|h[1-6])\b[^>]*>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    : value;
  return content.replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/[\t ]+/g, " ").trim())
    .filter(Boolean).join("\n").slice(0, MAX_TEXT_CHARS);
}

function qualityFor(text: string): DocumentTextRecord["extractionQuality"] {
  if (text.length >= 3000 && /\b(?:motion|second|vote|approved|adopted|roll call|present|absent)\b/i.test(text)) return "high";
  if (text.length >= 1200) return "medium";
  if (text.length >= 300) return "low";
  return "insufficient";
}

function confidenceFor(text: string, method: ExtractionMethod) {
  if (method === "failed") return 0;
  const quality = qualityFor(text);
  const base = method === "native_text" ? 0.72 : method === "ocr_text" ? 0.62 : 0.68;
  const bump = quality === "high" ? 0.2 : quality === "medium" ? 0.12 : quality === "low" ? 0.04 : 0;
  return Number(Math.min(0.95, base + bump).toFixed(2));
}

function readOptionalText(relativePath: string | null | undefined) {
  if (!relativePath) return { text: "", missing: false };
  const absolute = path.isAbsolute(relativePath) ? relativePath : path.join(process.cwd(), relativePath);
  if (!existsSync(absolute)) return { text: "", missing: true };
  try { return { text: cleanText(readFileSync(absolute, "utf8")), missing: false }; }
  catch { return { text: "", missing: true }; }
}

const cacheByDocument = new Map(
  readJson<{ records?: CacheIndexRecord[] }>(CACHE_INDEX_PATH, { records: [] }).records?.map((record) => [record.documentId, record]) ?? [],
);
const existingTextByDocument = new Map(
  readJson<{ records?: DocumentTextRecord[] }>(OUTPUT_PATH, { records: [] }).records?.map((record) => [record.documentId, record]) ?? [],
);
const ocrByDocument = new Map(
  readJson<{ records?: OcrResultRecord[] }>(OCR_RESULTS_PATH, { records: [] }).records?.filter((record) => record.ocrStatus === "succeeded" && record.extractedTextPath).map((record) => [record.documentId, record]) ?? [],
);
const sourceHashes = new Map<string, string | null>();
const eligibleOcrByDocument = new Map<string, { record: OcrResultRecord | undefined; text: string; missing: boolean; textHash: string | null }>();

function sourceHashFor(document: SourceDocumentRecord) {
  const cache = cacheByDocument.get(document.id);
  const localPath = cache?.stableLocalPath ?? document.cachedPath ?? document.sourcePath;
  if (!localPath) return null;
  const absolute = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), localPath);
  if (!sourceHashes.has(absolute)) {
    // Compare OCR against actual current bytes, including manually replaced PDFs.
    let descriptor: number | undefined;
    try {
      descriptor = openSync(absolute, "r");
      const digest = createHash("sha256");
      const chunk = Buffer.allocUnsafe(1024 * 1024);
      let length: number;
      while ((length = readSync(descriptor, chunk, 0, chunk.length, null)) > 0) digest.update(chunk.subarray(0, length));
      sourceHashes.set(absolute, digest.digest("hex"));
    }
    catch { sourceHashes.set(absolute, null); }
    finally { if (descriptor !== undefined) closeSync(descriptor); }
  }
  return sourceHashes.get(absolute) ?? null;
}

function eligibleOcrFor(document: SourceDocumentRecord) {
  const cached = eligibleOcrByDocument.get(document.id);
  if (cached) return cached;
  const sourceHash = sourceHashFor(document);
  const candidate = ocrByDocument.get(document.id);
  // Legacy unversioned OCR has no proof that it belongs to this revision.
  const record = sourceHash && candidate?.sourceContentHash === sourceHash ? candidate : undefined;
  const sidecar = readOptionalText(record?.extractedTextPath);
  const result = { record, ...sidecar, textHash: sidecar.text ? createHash("sha256").update(sidecar.text).digest("hex") : null };
  eligibleOcrByDocument.set(document.id, result);
  return result;
}

function hasUsableExistingText(record: DocumentTextRecord | undefined) {
  if (!record) return false;
  if (record.extractionMethod === "failed") return false;
  if (!record.extractedTextPath) return false;
  try {
    const absolute = path.isAbsolute(record.extractedTextPath) ? record.extractedTextPath : path.join(process.cwd(), record.extractedTextPath);
    return readFileSync(absolute, "utf8").replace(/\n$/, "").length === record.textLength;
  } catch { return false; }
}

let preferredPdfBackend: ReturnType<typeof preferredNativePdfBackend> | undefined;
function shouldReuseExisting(document: SourceDocumentRecord, forceAll: boolean) {
  if (forceAll) return false;
  const existing = existingTextByDocument.get(document.id);
  if (!hasUsableExistingText(existing)) return false;
  const sourceHash = sourceHashFor(document);
  if (!sourceHash || existing?.sourceContentHash !== sourceHash) return false;
  const cachedPath = cacheByDocument.get(document.id)?.stableLocalPath ?? document.cachedPath ?? document.sourcePath;
  if (cachedPath && /\.pdf$/i.test(cachedPath)) {
    preferredPdfBackend ??= preferredNativePdfBackend();
    if ((existing.nativeTextEvaluationVersion ?? existing.nativeTextExtractorVersion) !== NATIVE_PDF_EXTRACTOR_VERSION
      || (existing.nativeTextEvaluationBackend ?? existing.nativeTextExtractor) !== preferredPdfBackend) return false;
  }
  const ocr = eligibleOcrFor(document);
  // Source equality alone cannot hide newly completed/improved OCR, even for high-quality caches.
  if (ocr.textHash && ocr.textHash !== existing.ocrTextHash && ocr.textHash !== existing.evaluatedOcrTextHash) return false;
  return true;
}

async function extractDocument(document: SourceDocumentRecord, extractedAt: string): Promise<DocumentTextRecord> {
  const cacheRecord = cacheByDocument.get(document.id);
  const cachedPath = cacheRecord?.stableLocalPath ?? document.cachedPath ?? document.sourcePath;
  if (!cachedPath || (document.retrievalStatus !== "local_cached" && !cacheRecord)) {
    return {
      id: `document-text-${document.id}`,
      documentId: document.id,
      meetingId: document.meetingId,
      meetingItemIds: document.meetingItemIds,
      documentType: document.documentType,
      sourceUrl: document.sourceUrl,
      sourcePath: document.sourcePath,
      extractedTextPath: null,
      extractionMethod: "failed",
      extractionQuality: "insufficient",
      textLength: 0,
      confidence: 0,
      sourceSnippet: null,
      ocrAttempted: false,
      ocrAvailable: false,
      failureReason: document.retrievalStatus === "remote_discovered" ? "remote_document_discovered_not_cached" : "source_document_not_cached",
      extractedAt,
    };
  }

  const absolutePath = path.isAbsolute(cachedPath) ? cachedPath : path.join(process.cwd(), cachedPath);
  let text = "";
  let failureReason: string | null = null;
  let native: PdfNativeTextResult | null = null;
  try {
    if (/\.pdf$/i.test(cachedPath)) {
      native = await extractPdfTextIsolated(absolutePath, { timeoutMs: PDF_TIMEOUT_MS, maxBytes: PDF_MAX_BYTES, maxTextChars: MAX_TEXT_CHARS, workerPath: PDF_WORKER_PATH });
      text = cleanText(native.text);
      failureReason = native.failureReason;
    } else text = cleanText(readFileSync(absolutePath, "utf8"), /\.html?$/i.test(cachedPath) || /text\/html/i.test(cacheRecord?.contentType ?? ""));
  } catch (error) {
    failureReason = error instanceof Error ? error.message : "native_text_extraction_failed";
  }
  const method: ExtractionMethod = text.length >= 120 ? "native_text" : "failed";
  const ocrSidecar = eligibleOcrFor(document);
  const ocr = ocrSidecar.record;
  const ocrText = ocrSidecar.text;
  const mergedText = text && ocrText ? `${text}\n\n${ocrText}` : text || ocrText;
  const mergedMethod: ExtractionMethod = text && ocrText ? "mixed" : ocrText ? "ocr_text" : method;
  const incompleteNative = native?.coverage === "partial" || native?.truncated === true;
  const textCompleteness = native?.coverage === "complete" && !native.truncated
    || ocrText && ocr?.pagesDetected && ocr.pagesSucceeded === ocr.pagesDetected && !ocr.pagesTruncated && !ocr.pagesFailed
    ? "complete" : incompleteNative || ocr?.pagesTruncated || ocr?.pagesFailed ? "partial" : "unknown";
  const extractionQuality = mergedMethod === "native_text" && incompleteNative
    ? (text.length >= 300 ? "low" : "insufficient") : qualityFor(mergedText);
  const existing = existingTextByDocument.get(document.id);
  const sourceHash = sourceHashFor(document);
  const qualityRank = { insufficient: 0, low: 1, medium: 2, high: 3 };
  // A failed/partial rerun must not overwrite good text from the same exact source version.
  if (existing && sourceHash && existing.sourceContentHash === sourceHash && hasUsableExistingText(existing)
    && (mergedMethod === "failed" || qualityRank[extractionQuality] < qualityRank[existing.extractionQuality]
      || (existing.ocrAvailable && mergedText.length < existing.textLength))) {
    return { ...existing, meetingId: document.meetingId, meetingItemIds: document.meetingItemIds, documentType: document.documentType,
      sourceUrl: document.sourceUrl, sourcePath: document.sourcePath, evaluatedOcrTextHash: ocrSidecar.textHash ?? existing.evaluatedOcrTextHash,
      nativeTextFailureReason: failureReason,
      // This branch keeps the OLD sidecar. A new complete parse that we do
      // not store cannot prove completeness of those retained bytes. Preserve
      // their prior proof; a known partial result may still downgrade it.
      ...(textCompleteness === "partial" ? { textCompleteness } : {}),
      ...(existing.extractionMethod === "native_text" && incompleteNative ? {
        extractionQuality: existing.textLength >= 300 ? "low" as const : "insufficient" as const,
        failureReason: "native_text_incomplete_pages", nativeTextCoverage: "partial" as const,
        nativePagesDetected: native?.pagesDetected, nativePagesWithText: native?.pagesWithText,
      } : {}),
      ...(native?.backend && !native.failureReason ? { nativeTextEvaluationVersion: NATIVE_PDF_EXTRACTOR_VERSION, nativeTextEvaluationBackend: native.backend } : {}) };
  }
  // Immutable content paths keep an interrupted refresh from changing the text referenced by the old ledger.
  const textPath = mergedText.length ? path.join("data", "generated", "public-meeting-document-text-cache", `${document.id}-${createHash("sha256").update(mergedText).digest("hex").slice(0, 24)}.txt`) : null;
  if (textPath) writeAtomically(path.join(process.cwd(), textPath), `${mergedText}\n`);
  return {
    id: `document-text-${document.id}`,
    documentId: document.id,
    meetingId: document.meetingId,
    meetingItemIds: document.meetingItemIds,
    documentType: document.documentType,
    sourceUrl: document.sourceUrl,
    sourcePath: document.sourcePath,
    extractedTextPath: textPath,
    extractionMethod: mergedMethod,
    extractionQuality,
    textLength: mergedText.length,
    confidence: ocrText && !text ? Number(((ocr?.confidence ?? confidenceFor(mergedText, "ocr_text"))).toFixed(2)) : confidenceFor(mergedText, mergedMethod),
    sourceSnippet: mergedText ? summarizeText(mergedText, 700) : null,
    ocrAttempted: Boolean(ocr) || (method === "failed" && Boolean(cachedPath)),
    ocrAvailable: Boolean(ocrText),
    failureReason: mergedMethod === "failed" ? failureReason ?? (ocrSidecar.missing ? "ocr_text_sidecar_missing" : "native_text_too_thin_ocr_unavailable")
      : mergedMethod === "native_text" && incompleteNative ? "native_text_incomplete_pages" : null,
    extractedAt,
    sourceContentHash: sourceHash,
    ocrTextHash: ocrSidecar.textHash,
    evaluatedOcrTextHash: ocrSidecar.textHash,
    nativeTextFailureReason: failureReason,
    ...(native?.backend ? { nativeTextExtractorVersion: NATIVE_PDF_EXTRACTOR_VERSION, nativeTextExtractor: native.backend,
      nativeTextCoverage: native.coverage ?? "unknown", nativePagesDetected: native.pagesDetected, nativePagesWithText: native.pagesWithText } : {}),
    textCompleteness,
  };
}

async function main() {
  if (![PDF_TIMEOUT_MS, PDF_MAX_BYTES].every((limit) => Number.isFinite(limit) && limit > 0)) throw new Error("PDF timeout and byte limits must be finite positive numbers");
  if (!(MAX_DOCUMENTS > 0) || (Number.isFinite(MAX_DOCUMENTS) && !Number.isInteger(MAX_DOCUMENTS)) || !(MAX_DURATION_MS > 0)) throw new Error("Extraction batch limits must be positive; document count must be an integer");
  mkdirSync(TEXT_DIR, { recursive: true });
  const startedAt = Date.now();
  const extractedAt = new Date().toISOString();
  const forceAll = process.argv.includes("--all");
  const allDocuments = readJson<{ records?: SourceDocumentRecord[] }>(DOCUMENTS_PATH, { records: [] }).records ?? [];
  const sourceIds = new Set(process.argv.filter((arg) => arg.startsWith("--source=")).flatMap((arg) => arg.slice("--source=".length).split(",")).filter(Boolean));
  const documentIds = new Set(process.argv.filter((arg) => arg.startsWith("--document-id=")).flatMap((arg) => arg.slice("--document-id=".length).split(",")).filter(Boolean));
  const documentTypes = new Set(process.argv.filter((arg) => arg.startsWith("--document-type=")).flatMap((arg) => arg.slice("--document-type=".length).split(",")).filter(Boolean));
  const scoped = sourceIds.size > 0 || documentIds.size > 0 || documentTypes.size > 0;
  const documents = allDocuments.filter((document) => (!sourceIds.size || sourceIds.has(document.organizationId ?? "")) && (!documentIds.size || documentIds.has(document.id)) && (!documentTypes.size || documentTypes.has(document.documentType)));
  if (scoped && !documents.length) throw new Error(`No source documents match the provided source/document/type filters`);
  const selectedDocumentIds = new Set(documents.map((document) => document.id));
  // Retain deferred evidence exactly as it was. New work replaces one record at a
  // time; a bounded pass must never publish a ledger containing only its batch.
  const recordsByDocument = new Map([...existingTextByDocument.entries()].filter(([id]) => scoped || selectedDocumentIds.has(id)));
  const updatedDocumentIds = new Set<string>();
  const cached = (document: SourceDocumentRecord) => Boolean(cacheByDocument.has(document.id) || (document.retrievalStatus === "local_cached" && (document.cachedPath || document.sourcePath)));
  const lastAttempt = (document: SourceDocumentRecord) => {
    const record = existingTextByDocument.get(document.id);
    return Date.parse(record?.lastAttemptAt ?? record?.extractedAt ?? "") || 0;
  };
  // Work on available minutes first. Old failures rotate behind previously
  // unattempted documents instead of consuming the same batch every run.
  documents.sort((a, b) => Number(cached(b)) - Number(cached(a)) || lastAttempt(a) - lastAttempt(b) || Number(b.documentType === "minutes") - Number(a.documentType === "minutes") || a.id.localeCompare(b.id));
  let reused = 0;
  let extracted = 0;
  let scanned = 0;
  let budgetReached = false;
  for (const [index, document] of documents.entries()) {
    if (Date.now() - startedAt >= MAX_DURATION_MS) { budgetReached = true; break; }
    scanned += 1;
    if (shouldReuseExisting(document, forceAll)) {
      const existing = existingTextByDocument.get(document.id);
      if (existing) {
        recordsByDocument.set(document.id, { ...existing, meetingId: document.meetingId, meetingItemIds: document.meetingItemIds, documentType: document.documentType, sourceUrl: document.sourceUrl, sourcePath: document.sourcePath });
        updatedDocumentIds.add(document.id);
        reused += 1;
        continue;
      }
    }
    if (extracted >= MAX_DOCUMENTS) continue;
    const attemptAt = new Date().toISOString();
    recordsByDocument.set(document.id, { ...await extractDocument(document, attemptAt), lastAttemptAt: attemptAt });
    updatedDocumentIds.add(document.id);
    extracted += 1;
    // A killed process can lose at most the in-flight batch, not an entire
    // archive pass. Immutable sidecars remain safe for the previous ledger.
    if (extracted % 20 === 0) persist(false);
    if ((index + 1) % 100 === 0) console.log(`Document text extraction progress: ${index + 1}/${documents.length} scanned, ${reused} reused, ${extracted} processed`);
  }
  // A bounded pass may discover more documents than it can attempt. Preserve
  // explicit queue state for those new rows instead of making their absence
  // indistinguishable from ledger corruption. No attempt time or text is invented.
  for (const document of documents) if (!recordsByDocument.has(document.id)) {
    recordsByDocument.set(document.id, {
      id: `document-text-${document.id}`, documentId: document.id, meetingId: document.meetingId,
      meetingItemIds: document.meetingItemIds, documentType: document.documentType, sourceUrl: document.sourceUrl,
      sourcePath: document.sourcePath, extractedTextPath: null, extractionMethod: "failed", extractionQuality: "insufficient",
      textLength: 0, confidence: 0, sourceSnippet: null, ocrAttempted: false, ocrAvailable: false,
      failureReason: "extraction_budget_deferred", extractedAt: null, textCompleteness: "unknown",
    });
  }
  const audit = persist(true);
  console.log(`Processed ${extracted}/${documents.length} selected documents, reused ${reused}, deferred ${audit.totals.documentsDeferred}; retained ${recordsByDocument.size} text ledger records at ${OUTPUT_PATH}`);
  console.log(JSON.stringify(audit.totals, null, 2));

  function persist(completed: boolean) {
    const records = [...recordsByDocument.values()];
    const audit = {
      generatedAt: extractedAt,
      scope: { sourceIds: [...sourceIds], documentIds: [...documentIds], documentTypes: [...documentTypes], documentsSelected: documents.length, pdfTimeoutMs: PDF_TIMEOUT_MS, pdfMaxBytes: PDF_MAX_BYTES, maxDocuments: Number.isFinite(MAX_DOCUMENTS) ? MAX_DOCUMENTS : null, maxDurationMs: Number.isFinite(MAX_DURATION_MS) ? MAX_DURATION_MS : null, completed, budgetReached },
      totals: {
        documentsScanned: scanned,
        documentsDeferred: documents.length - updatedDocumentIds.size,
        documentsInLedger: records.length,
        reusedExistingText: reused,
        documentsProcessed: extracted,
        textExtracted: records.filter((record) => record.extractionMethod !== "failed").length,
        nativeText: records.filter((record) => record.extractionMethod === "native_text").length,
        ocrText: records.filter((record) => record.extractionMethod === "ocr_text" || record.extractionMethod === "mixed").length,
        mixedText: records.filter((record) => record.extractionMethod === "mixed").length,
        failed: records.filter((record) => record.extractionMethod === "failed").length,
        highQuality: records.filter((record) => record.extractionQuality === "high").length,
        mediumQuality: records.filter((record) => record.extractionQuality === "medium").length,
        lowQuality: records.filter((record) => record.extractionQuality === "low").length,
        insufficient: records.filter((record) => record.extractionQuality === "insufficient").length,
      },
      failureReasons: records.reduce<Record<string, number>>((counts, record) => {
        if (record.failureReason) counts[record.failureReason] = (counts[record.failureReason] ?? 0) + 1;
        return counts;
      }, {}),
      nativeTextFailureReasons: records.reduce<Record<string, number>>((counts, record) => {
        if (record.nativeTextFailureReason) counts[record.nativeTextFailureReason] = (counts[record.nativeTextFailureReason] ?? 0) + 1;
        return counts;
      }, {}),
    };
    const cacheIndex = readJson<{ generatedAt?: string; cacheRoot?: string; records?: Array<CacheIndexRecord & { extractionStatus?: string; ocrStatus?: string }> }>(CACHE_INDEX_PATH, { records: [] });
    if (cacheIndex.records?.length) {
      const textByDocument = new Map(records.map((record) => [record.documentId, record]));
      const updatedCache = cacheIndex.records.map((record) => {
        if (!updatedDocumentIds.has(record.documentId)) return record;
        const text = textByDocument.get(record.documentId);
        if (!text) return record;
        return {
          ...record,
          extractionStatus: text.extractionMethod === "failed" ? "failed" : "extracted",
          ocrStatus: text.ocrAttempted ? (text.ocrAvailable ? "required" : "engine_unavailable") : "not_required",
        };
      });
      writeAtomically(CACHE_INDEX_PATH, `${JSON.stringify({ ...cacheIndex, generatedAt: cacheIndex.generatedAt ?? extractedAt, records: updatedCache }, null, 2)}\n`);
    }
    writeAtomically(OUTPUT_PATH, `${JSON.stringify({ generatedAt: extractedAt, records, audit }, null, 2)}\n`);
    return audit;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
