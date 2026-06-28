import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  } catch {
    return fallback;
  }
}

function absolutePath(value: string) {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function fileSize(value: string) {
  try {
    return readFileSync(absolutePath(value)).byteLength;
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
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "dd-ocr-"));
  try {
    const prefix = path.join(tempDir, "page");
    execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-r", "200", "-png", pdfPath, prefix], { timeout, stdio: "ignore" });
    const imagePath = `${prefix}-${page}.png`;
    if (!existsSync(imagePath)) return { text: "", confidence: null, failureReason: "page_render_output_missing" };
    const text = safeRun("tesseract", [imagePath, "stdout", "--psm", "6"], timeout).replace(/\s+/g, " ").trim();
    return { text, confidence: null, failureReason: null };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "ocr_page_failed";
    return { text: "", confidence: null, failureReason };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

mkdirSync(OCR_TEXT_DIR, { recursive: true });
const generatedAt = new Date().toISOString();
const capabilities = readJson<CapabilityAudit>("dataops-ocr-capabilities.json", {});
const verification = readJson<{ records?: VerificationRecord[] }>("public-meeting-content-verification.json", { records: [] }).records ?? [];
const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
const textRows = readJson<{ records?: DocumentText[] }>("public-meeting-document-text.json", { records: [] }).records ?? [];
const cacheRows = readJson<{ records?: CacheIndexRecord[] }>("public-meeting-document-cache-index.json", { records: [] }).records ?? [];
const documentById = new Map(documents.map((document) => [document.id, document]));
const cacheByDocument = new Map(cacheRows.map((row) => [row.documentId, row]));
const maxFileSize = capabilities.limits?.maxFileSizeBytes ?? 50_000_000;
const maxPages = capabilities.limits?.maxPagesPerDocument ?? 10;
const timeout = capabilities.limits?.subprocessTimeoutMs ?? 30_000;
const force = process.argv.includes("--force");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Number(process.env.DATAOPS_OCR_LIMIT ?? 10);
const canRunOcr = Boolean(capabilities.capabilities?.canRunPageOcr);
const candidateByDocument = new Map<string, VerificationRecord>();

for (const record of verification) {
  if ((record.classification === "ocr_candidate" || record.ocrNeeded || force) && record.classification !== "quarantined" && record.fileSize <= maxFileSize) {
    candidateByDocument.set(record.documentId, record);
  }
}

for (const row of textRows) {
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

const candidates = [...candidateByDocument.values()].slice(0, Number.isFinite(limit) && limit > 0 ? limit : 10);

const records = candidates.map((record) => {
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

const audit = {
  generatedAt,
  totals: {
    candidates: candidates.length,
    ocrSucceeded: records.filter((record) => record.ocrStatus === "succeeded").length,
    ocrFailed: records.filter((record) => record.ocrStatus === "failed").length,
    ocrEngineUnavailable: records.filter((record) => record.ocrStatus === "ocr_engine_unavailable").length,
    notRequiredNativeTextAvailable: records.filter((record) => record.ocrStatus === "not_required_native_text_available").length,
    pagesAttempted: records.reduce((sum, record) => sum + (record.pagesAttempted ?? 0), 0),
    pagesSucceeded: records.reduce((sum, record) => sum + (record.pagesSucceeded ?? 0), 0),
  },
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, records, audit }, null, 2)}\n`);
console.log(`Generated OCR results for ${records.length} documents at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
