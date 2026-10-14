import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const VERIFICATION_PATH = path.join(GENERATED_DIR, "public-meeting-content-verification.json");
const RECONCILIATION_PATH = path.join(GENERATED_DIR, "public-meeting-cache-reconciliation.json");
const QUARANTINE_PATH = path.join(GENERATED_DIR, "public-meeting-cache-quarantine.json");

type CacheRecord = {
  documentId: string;
  meetingId: string;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  stableLocalPath: string;
  contentHash: string | null;
  contentType: string | null;
  fileSize: number | null;
  sourceVersion: number;
  previousHash: string | null;
  extractionStatus: string;
  ocrStatus: string;
};

type QueueRecord = {
  documentId: string;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourceHost: string | null;
  retrievalState: string;
  retrievalStatus: string;
  cachePath?: string | null;
  contentHash?: string | null;
};

type TextRecord = {
  documentId: string;
  extractionMethod: string;
  extractionQuality: string;
  textLength: number;
  failureReason: string | null;
};

type OcrRecord = {
  documentId: string;
  ocrStatus: string;
  ocrRequired: boolean;
  cachedBinaryExists: boolean;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function absolutePath(value: string) {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function printablePrefix(buffer: Buffer) {
  return buffer.subarray(0, Math.min(buffer.length, 2048)).toString("utf8").replace(/\0/g, "");
}

function sniff(buffer: Buffer) {
  const prefix = printablePrefix(buffer).trimStart();
  if (buffer.length === 0) return { detectedMimeType: "application/octet-stream", payloadType: "empty", magicSignature: "empty" };
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return { detectedMimeType: "application/pdf", payloadType: "pdf", magicSignature: "%PDF-" };
  if (buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return { detectedMimeType: "image/png", payloadType: "image", magicSignature: "png" };
  if (buffer.subarray(0, 3).toString("hex") === "ffd8ff") return { detectedMimeType: "image/jpeg", payloadType: "image", magicSignature: "jpeg" };
  if (/^<!doctype html\b|^<html\b|<html[\s>]/i.test(prefix)) return { detectedMimeType: "text/html", payloadType: "html", magicSignature: "html" };
  if (/^\s*[{[]/.test(prefix)) return { detectedMimeType: "application/json", payloadType: "json", magicSignature: "json" };
  if (/^[\t\n\r -~]+$/.test(prefix) && prefix.length > 0) return { detectedMimeType: "text/plain", payloadType: "text", magicSignature: "text" };
  return { detectedMimeType: "application/octet-stream", payloadType: "binary", magicSignature: "unknown_binary" };
}

function isProbableErrorPage(buffer: Buffer, payloadType: string) {
  if (payloadType !== "html" && payloadType !== "text") return false;
  const text = printablePrefix(buffer).toLowerCase();
  return /\b(access denied|forbidden|captcha|cloudflare|bot protection|temporarily unavailable|not found|page not found|login|required|enable javascript|request blocked)\b/.test(text);
}

function classificationFor(input: {
  exists: boolean;
  size: number;
  hashMatches: boolean;
  declaredContentType: string | null;
  detectedMimeType: string;
  payloadType: string;
  extension: string;
  probableErrorPage: boolean;
  extractionSucceeded: boolean;
  extractionAttempted: boolean;
}) {
  if (!input.exists) return "quarantined";
  if (input.size === 0) return "empty_file";
  if (!input.hashMatches) return "quarantined";
  if (input.probableErrorPage) return "probable_error_page";
  if (input.extension === ".pdf" && input.payloadType === "html") return "html_saved_as_pdf";
  if (input.declaredContentType?.includes("pdf") && input.payloadType === "html") return "mime_mismatch";
  if (input.payloadType === "pdf") return input.extractionSucceeded ? "verified_pdf" : "ocr_candidate";
  if (input.payloadType === "html") return "verified_html";
  if (input.payloadType === "text" || input.payloadType === "json") return input.payloadType === "text" ? "verified_text" : "verified_json";
  return "unsupported_binary";
}

mkdirSync(GENERATED_DIR, { recursive: true });
const generatedAt = new Date().toISOString();
const cacheRecords = readJson<{ records?: CacheRecord[] }>("public-meeting-document-cache-index.json", { records: [] }).records ?? [];
const queueRecords = readJson<{ records?: QueueRecord[] }>("public-meeting-retrieval-queue.json", { records: [] }).records ?? [];
const textRows = readJson<{ records?: TextRecord[] }>("public-meeting-document-text.json", { records: [] }).records ?? [];
const ocrRows = readJson<{ records?: OcrRecord[] }>("public-meeting-ocr-audit.json", { records: [] }).records ?? [];
const textByDocument = new Map(textRows.map((record) => [record.documentId, record]));
const ocrByDocument = new Map(ocrRows.map((record) => [record.documentId, record]));
const cacheByDocument = new Map(cacheRecords.map((record) => [record.documentId, record]));

const records = cacheRecords.map((record) => {
  const localPath = absolutePath(record.stableLocalPath);
  const fileExists = existsSync(localPath);
  const buffer = fileExists ? readFileSync(localPath) : Buffer.alloc(0);
  const computedHash = fileExists ? sha256(buffer) : null;
  const sniffed = sniff(buffer);
  const extension = path.extname(record.stableLocalPath).toLowerCase();
  const text = textByDocument.get(record.documentId);
  const ocr = ocrByDocument.get(record.documentId);
  const extractionAttempted = Boolean(text);
  const extractionSucceeded = Boolean(text && text.extractionMethod !== "failed" && text.textLength > 0);
  const probableErrorPage = isProbableErrorPage(buffer, sniffed.payloadType);
  const hashMatches = Boolean(computedHash && computedHash === record.contentHash);
  const classification = classificationFor({
    exists: fileExists,
    size: buffer.length,
    hashMatches,
    declaredContentType: record.contentType,
    detectedMimeType: sniffed.detectedMimeType,
    payloadType: sniffed.payloadType,
    extension,
    probableErrorPage,
    extractionSucceeded,
    extractionAttempted,
  });
  const ocrNeeded = sniffed.payloadType === "pdf" && (!extractionSucceeded || (text?.textLength ?? 0) < 300);
  return {
    documentId: record.documentId,
    meetingId: record.meetingId,
    jurisdiction: record.jurisdiction,
    documentType: record.documentType,
    sourceUrl: record.sourceUrl,
    sourceHost: record.sourceHost,
    sourcePlatform: record.sourcePlatform,
    localPath: record.stableLocalPath,
    fileExists,
    fileSize: buffer.length,
    declaredFileSize: record.fileSize,
    contentHash: record.contentHash,
    computedHash,
    hashMatches,
    declaredContentType: record.contentType,
    detectedMimeType: sniffed.detectedMimeType,
    payloadType: sniffed.payloadType,
    fileExtension: extension,
    magicSignature: sniffed.magicSignature,
    probableErrorPage,
    extractionAttempted,
    extractionSucceeded,
    extractionMethod: text?.extractionMethod ?? "not_attempted",
    extractionQuality: text?.extractionQuality ?? "unknown",
    extractionTextLength: text?.textLength ?? 0,
    extractionFailureReason: text?.failureReason ?? null,
    ocrStatus: ocr?.ocrStatus ?? record.ocrStatus,
    ocrNeeded,
    classification,
    quarantine: ["quarantined", "empty_file", "probable_error_page", "html_saved_as_pdf", "mime_mismatch", "unsupported_binary"].includes(classification),
    sourceVersion: record.sourceVersion,
    previousHash: record.previousHash,
  };
});

const queueCacheBacked = queueRecords.filter((record) => Boolean(record.cachePath) || ["cached", "downloaded", "changed", "unchanged", "extraction_ready", "ocr_required", "extracted"].includes(record.retrievalState));
const queueMissingCacheIndex = queueCacheBacked.filter((record) => !cacheByDocument.has(record.documentId));
const cacheMissingQueue = cacheRecords.filter((record) => !queueRecords.some((queueRecord) => queueRecord.documentId === record.documentId));
const pdfLikeQueue = queueCacheBacked.filter((record) => /\.pdf(?:$|\?)/i.test(`${record.sourceUrl ?? ""} ${record.cachePath ?? ""}`));
const verifiedPdfRecords = records.filter((record) => record.classification === "verified_pdf" || record.classification === "ocr_candidate");
const extractedByDocument = new Set(textRows.filter((record) => record.extractionMethod !== "failed").map((record) => record.documentId));
const cacheNotExtracted = records.filter((record) => !extractedByDocument.has(record.documentId));

const audit = {
  generatedAt,
  totals: {
    cacheRecords: records.length,
    localFilesPresent: records.filter((record) => record.fileExists).length,
    recordsWithHashes: records.filter((record) => Boolean(record.contentHash)).length,
    hashMismatches: records.filter((record) => !record.hashMatches).length,
    verifiedPdf: records.filter((record) => record.classification === "verified_pdf").length,
    verifiedHtml: records.filter((record) => record.classification === "verified_html").length,
    verifiedText: records.filter((record) => record.classification === "verified_text").length,
    mimeMismatch: records.filter((record) => record.classification === "mime_mismatch").length,
    htmlSavedAsPdf: records.filter((record) => record.classification === "html_saved_as_pdf").length,
    probableErrorPage: records.filter((record) => record.classification === "probable_error_page").length,
    unsupportedBinary: records.filter((record) => record.classification === "unsupported_binary").length,
    ocrCandidates: records.filter((record) => record.classification === "ocr_candidate" || record.ocrNeeded).length,
    quarantined: records.filter((record) => record.quarantine).length,
    extractedCachedDocuments: records.filter((record) => record.extractionSucceeded).length,
    cachedDocumentsNotExtracted: cacheNotExtracted.length,
  },
};

const reconciliation = {
  generatedAt,
  counts: {
    cacheIndexRecords: cacheRecords.length,
    queueCacheBackedOrDownloadedRecords: queueCacheBacked.length,
    queueCacheBackedMissingCacheIndex: queueMissingCacheIndex.length,
    cacheIndexMissingQueueRecord: cacheMissingQueue.length,
    pdfLikeQueueRecords: pdfLikeQueue.length,
    verifiedPdfCacheRecords: verifiedPdfRecords.length,
    ocrAuditCachedPdfRecords: ocrRows.filter((record) => record.cachedBinaryExists).length,
    cacheRecordsNotExtracted: cacheNotExtracted.length,
  },
  queueCacheBackedMissingCacheIndex: queueMissingCacheIndex.map((record) => ({
    documentId: record.documentId,
    jurisdiction: record.jurisdiction,
    documentType: record.documentType,
    sourceUrl: record.sourceUrl,
    retrievalState: record.retrievalState,
    cachePath: record.cachePath ?? null,
  })),
  cacheIndexMissingQueueRecord: cacheMissingQueue.map((record) => ({
    documentId: record.documentId,
    jurisdiction: record.jurisdiction,
    documentType: record.documentType,
    sourceUrl: record.sourceUrl,
    localPath: record.stableLocalPath,
  })),
  downloadedNotExtracted: cacheNotExtracted.map((record) => ({
    documentId: record.documentId,
    sourceUrl: record.sourceUrl,
    jurisdiction: record.jurisdiction,
    documentType: record.documentType,
    localPath: record.localPath,
    detectedMimeType: record.detectedMimeType,
    fileSize: record.fileSize,
    extractionFailureReason: record.extractionFailureReason,
    requiresOcr: record.ocrNeeded,
    classification: record.classification,
  })),
};

const quarantine = {
  generatedAt,
  records: records.filter((record) => record.quarantine),
  totals: {
    quarantined: records.filter((record) => record.quarantine).length,
    probableErrorPage: records.filter((record) => record.classification === "probable_error_page").length,
    mimeMismatch: records.filter((record) => record.classification === "mime_mismatch").length,
    htmlSavedAsPdf: records.filter((record) => record.classification === "html_saved_as_pdf").length,
    unsupportedBinary: records.filter((record) => record.classification === "unsupported_binary").length,
    emptyFile: records.filter((record) => record.classification === "empty_file").length,
  },
};

writeFileSync(VERIFICATION_PATH, `${JSON.stringify({ generatedAt, records, audit }, null, 2)}\n`);
writeFileSync(RECONCILIATION_PATH, `${JSON.stringify(reconciliation, null, 2)}\n`);
writeFileSync(QUARANTINE_PATH, `${JSON.stringify(quarantine, null, 2)}\n`);
console.log(`Verified ${records.length} cached public meeting documents at ${VERIFICATION_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
