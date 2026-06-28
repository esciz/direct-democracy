import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-ocr-audit.json");

type SourceDocument = {
  id: string;
  meetingId: string;
  documentType: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  cachedPath: string | null;
  retrievalStatus: string;
};

type DocumentText = {
  documentId: string;
  extractionMethod: string;
  extractionQuality: string;
  textLength: number;
  confidence: number;
  ocrAttempted: boolean;
  ocrAvailable: boolean;
  failureReason: string | null;
};

type CacheIndexRecord = {
  documentId: string;
  stableLocalPath: string;
  contentType: string | null;
};

type VerificationRecord = {
  documentId: string;
  meetingId: string;
  documentType: string;
  sourceUrl: string | null;
  localPath: string;
  detectedMimeType: string;
  classification: string;
  ocrNeeded: boolean;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function commandAvailable(command: string) {
  try {
    execFileSync("sh", ["-lc", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
const textRows = readJson<{ records?: DocumentText[] }>("public-meeting-document-text.json", { records: [] }).records ?? [];
const cacheRows = readJson<{ records?: CacheIndexRecord[] }>("public-meeting-document-cache-index.json", { records: [] }).records ?? [];
const verificationRows = readJson<{ records?: VerificationRecord[] }>("public-meeting-content-verification.json", { records: [] }).records ?? [];
const textByDocument = new Map(textRows.map((row) => [row.documentId, row]));
const cacheByDocument = new Map(cacheRows.map((row) => [row.documentId, row]));
const documentById = new Map(documents.map((document) => [document.id, document]));
const tesseractAvailable = commandAvailable("tesseract");
const pdftoppmAvailable = commandAvailable("pdftoppm");
const ocrAvailable = tesseractAvailable && pdftoppmAvailable;

const pdfDocumentIds = new Set([
  ...documents.filter((document) => /\.(pdf)(?:$|\?)/i.test(`${document.sourcePath ?? ""} ${document.sourceUrl ?? ""}`)).map((document) => document.id),
  ...cacheRows.filter((record) => record.contentType?.toLowerCase().includes("pdf")).map((record) => record.documentId),
  ...verificationRows.filter((record) => record.detectedMimeType === "application/pdf" || record.classification === "verified_pdf" || record.classification === "ocr_candidate").map((record) => record.documentId),
]);

const records = [...pdfDocumentIds]
  .map((documentId) => {
    const document = documentById.get(documentId);
    const verified = verificationRows.find((record) => record.documentId === documentId);
    const text = textByDocument.get(documentId);
    const cache = cacheByDocument.get(documentId);
    const cachedPath = cache?.stableLocalPath ?? document?.cachedPath ?? verified?.localPath;
    const cachedBinaryExists = Boolean(cachedPath && existsSync(path.isAbsolute(cachedPath) ? cachedPath : path.join(process.cwd(), cachedPath)));
    const verifiedPdf = Boolean(cache?.contentType?.toLowerCase().includes("pdf") || verified?.detectedMimeType === "application/pdf" || verified?.classification === "verified_pdf" || verified?.classification === "ocr_candidate");
    const localCached = document?.retrievalStatus === "local_cached" || cachedBinaryExists;
    const nativeThin = localCached && verifiedPdf && (!text || text.extractionMethod === "failed" || text.textLength < 300 || text.extractionQuality === "insufficient");
    const scannedPdfLikely = nativeThin;
    const ocrStatus = !cachedBinaryExists
      ? "no_cached_binary_available"
      : scannedPdfLikely
        ? ocrAvailable
          ? "ready"
          : "blocked_missing_ocr_runtime"
        : "not_required";
    return {
      documentId,
      meetingId: document?.meetingId ?? verified?.meetingId ?? "unknown",
      documentType: document?.documentType ?? verified?.documentType ?? "unknown",
      sourceUrl: document?.sourceUrl ?? verified?.sourceUrl ?? null,
      sourcePath: document?.sourcePath ?? null,
      localCached,
      cachedBinaryExists,
      cachedPath: cachedPath ?? null,
      verifiedPdf,
      contentClassification: verified?.classification ?? null,
      nativeTextLength: text?.textLength ?? 0,
      nativeExtractionQuality: text?.extractionQuality ?? "insufficient",
      scannedPdfLikely,
      ocrRequired: scannedPdfLikely,
      ocrAvailable,
      ocrStatus,
      extractionMethod: text?.extractionMethod ?? "failed",
      extractionConfidence: text?.confidence ?? 0,
      pageLevelProvenance: !cachedBinaryExists
        ? [{ pageStart: 1, pageEnd: null, status: "no_cached_binary_available" }]
        : scannedPdfLikely
          ? [{ pageStart: 1, pageEnd: null, status: ocrAvailable ? "pending_ocr" : "ocr_runtime_unavailable" }]
          : [{ pageStart: 1, pageEnd: null, status: "native_text_available" }],
      failureReason: !cachedBinaryExists
        ? "No cached binary is available for OCR."
        : scannedPdfLikely && !ocrAvailable
          ? "OCR requires both pdftoppm and tesseract in the runtime."
          : text?.failureReason ?? null,
    };
  });

const audit = {
  generatedAt: new Date().toISOString(),
  runtime: {
    tesseractAvailable,
    pdftoppmAvailable,
    ocrAvailable,
  },
  totals: {
    pdfDocuments: records.length,
    localPdfDocuments: records.filter((record) => record.localCached).length,
    noCachedBinaryAvailable: records.filter((record) => record.ocrStatus === "no_cached_binary_available").length,
    scannedPdfLikely: records.filter((record) => record.scannedPdfLikely).length,
    ocrRequired: records.filter((record) => record.ocrRequired).length,
    ocrReady: records.filter((record) => record.ocrStatus === "ready").length,
    ocrBlocked: records.filter((record) => record.ocrStatus === "blocked_missing_ocr_runtime").length,
    ocrSucceeded: records.filter((record) => record.extractionMethod === "ocr_text" || record.extractionMethod === "mixed").length,
    ocrFailed: records.filter((record) => record.ocrStatus === "blocked_missing_ocr_runtime").length,
    nativeTextAvailable: records.filter((record) => record.ocrStatus === "not_required").length,
  },
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt: audit.generatedAt, records, audit }, null, 2)}\n`);
console.log(`Generated OCR audit for ${records.length} PDF documents at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
