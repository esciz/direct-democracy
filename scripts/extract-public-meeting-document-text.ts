import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeWhitespace, summarizeText } from "@/lib/public-meetings/shared";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const TEXT_DIR = path.join(GENERATED_DIR, "public-meeting-document-text-cache");
const DOCUMENTS_PATH = path.join(GENERATED_DIR, "public-meeting-source-documents.json");
const CACHE_INDEX_PATH = path.join(GENERATED_DIR, "public-meeting-document-cache-index.json");
const OCR_RESULTS_PATH = path.join(GENERATED_DIR, "public-meeting-ocr-results.json");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-document-text.json");
const MAX_TEXT_CHARS = 450_000;

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
  extractedAt: string;
};

type OcrResultRecord = {
  documentId: string;
  extractedTextPath: string | null;
  textLength: number;
  ocrStatus: string;
  confidence: number | null;
  failureReason: string | null;
};

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function cleanText(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\b(?:font-family|font-size|Times New Roman|Helvetica|Arial|serif|sans-serif)\b/gi, " ")
      .replace(/\s+/g, " "),
  ).slice(0, MAX_TEXT_CHARS);
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

const cacheByDocument = new Map(
  readJson<{ records?: CacheIndexRecord[] }>(CACHE_INDEX_PATH, { records: [] }).records?.map((record) => [record.documentId, record]) ?? [],
);
const existingTextByDocument = new Map(
  readJson<{ records?: DocumentTextRecord[] }>(OUTPUT_PATH, { records: [] }).records?.map((record) => [record.documentId, record]) ?? [],
);
const ocrByDocument = new Map(
  readJson<{ records?: OcrResultRecord[] }>(OCR_RESULTS_PATH, { records: [] }).records?.filter((record) => record.ocrStatus === "succeeded" && record.extractedTextPath).map((record) => [record.documentId, record]) ?? [],
);

function hasUsableExistingText(record: DocumentTextRecord | undefined) {
  if (!record) return false;
  if (record.extractionMethod === "failed") return false;
  if (!record.extractedTextPath) return false;
  return existsSync(path.join(process.cwd(), record.extractedTextPath));
}

function shouldReuseExisting(document: SourceDocumentRecord, forceAll: boolean) {
  if (forceAll) return false;
  const existing = existingTextByDocument.get(document.id);
  const cacheRecord = cacheByDocument.get(document.id);
  if (!hasUsableExistingText(existing)) return false;
  if (!cacheRecord) return true;
  return cacheRecord.extractionStatus === "extracted";
}

async function extractPdfText(filePath: string) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: readFileSync(filePath) });
  const result = await parser.getText();
  return cleanText(result.text ?? "");
}

async function extractDocument(document: SourceDocumentRecord, extractedAt: string): Promise<DocumentTextRecord> {
  const cacheRecord = cacheByDocument.get(document.id);
  const cachedPath = document.cachedPath ?? cacheRecord?.stableLocalPath ?? document.sourcePath;
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
  try {
    text = /\.pdf$/i.test(cachedPath) ? await extractPdfText(absolutePath) : cleanText(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    failureReason = error instanceof Error ? error.message : "native_text_extraction_failed";
  }
  const method: ExtractionMethod = text.length >= 120 ? "native_text" : "failed";
  const ocr = ocrByDocument.get(document.id);
  const ocrText = ocr?.extractedTextPath ? cleanText(readFileSync(path.join(process.cwd(), ocr.extractedTextPath), "utf8")) : "";
  const mergedText = text && ocrText ? `${text}\n\n${ocrText}` : text || ocrText;
  const mergedMethod: ExtractionMethod = text && ocrText ? "mixed" : ocrText ? "ocr_text" : method;
  const textPath = text.length
    ? path.join("data", "generated", "public-meeting-document-text-cache", `${document.id}.txt`)
    : mergedText.length
      ? path.join("data", "generated", "public-meeting-document-text-cache", `${document.id}.txt`)
    : null;
  if (textPath) writeFileSync(path.join(process.cwd(), textPath), `${mergedText}\n`);
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
    extractionQuality: qualityFor(mergedText),
    textLength: mergedText.length,
    confidence: ocrText && !text ? Number(((ocr?.confidence ?? confidenceFor(mergedText, "ocr_text"))).toFixed(2)) : confidenceFor(mergedText, mergedMethod),
    sourceSnippet: mergedText ? summarizeText(mergedText, 700) : null,
    ocrAttempted: Boolean(ocr) || (method === "failed" && Boolean(cachedPath)),
    ocrAvailable: Boolean(ocr),
    failureReason: mergedMethod === "failed" ? failureReason ?? "native_text_too_thin_ocr_unavailable" : null,
    extractedAt,
  };
}

async function main() {
  mkdirSync(TEXT_DIR, { recursive: true });
  const extractedAt = new Date().toISOString();
  const forceAll = process.argv.includes("--all");
  const documents = readJson<{ records?: SourceDocumentRecord[] }>(DOCUMENTS_PATH, { records: [] }).records ?? [];
  const records: DocumentTextRecord[] = [];
  let reused = 0;
  let extracted = 0;
  for (const [index, document] of documents.entries()) {
    if (shouldReuseExisting(document, forceAll)) {
      const existing = existingTextByDocument.get(document.id);
      if (existing) {
        records.push(existing);
        reused += 1;
        continue;
      }
    }
    records.push(await extractDocument(document, extractedAt));
    extracted += 1;
    if ((index + 1) % 100 === 0) console.log(`Document text extraction progress: ${index + 1}/${documents.length} scanned, ${reused} reused, ${extracted} processed`);
  }
  const audit = {
    generatedAt: extractedAt,
    totals: {
      documentsScanned: records.length,
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
  };
  const cacheIndex = readJson<{ generatedAt?: string; cacheRoot?: string; records?: Array<CacheIndexRecord & { extractionStatus?: string; ocrStatus?: string }> }>(CACHE_INDEX_PATH, { records: [] });
  if (cacheIndex.records?.length) {
    const textByDocument = new Map(records.map((record) => [record.documentId, record]));
    const updatedCache = cacheIndex.records.map((record) => {
      const text = textByDocument.get(record.documentId);
      if (!text) return record;
      return {
        ...record,
        extractionStatus: text.extractionMethod === "failed" ? "failed" : "extracted",
        ocrStatus: text.ocrAttempted ? (text.ocrAvailable ? "required" : "engine_unavailable") : "not_required",
      };
    });
    writeFileSync(CACHE_INDEX_PATH, `${JSON.stringify({ ...cacheIndex, generatedAt: cacheIndex.generatedAt ?? extractedAt, records: updatedCache }, null, 2)}\n`);
  }
  writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt: extractedAt, records, audit }, null, 2)}\n`);
  console.log(`Extracted text for ${audit.totals.textExtracted}/${audit.totals.documentsScanned} public meeting documents at ${OUTPUT_PATH}`);
  console.log(JSON.stringify(audit.totals, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
