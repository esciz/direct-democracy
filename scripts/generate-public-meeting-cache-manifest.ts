import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const CACHE_INDEX_PATH = path.join(GENERATED_DIR, "public-meeting-document-cache-index.json");
const DOCUMENT_TEXT_PATH = path.join(GENERATED_DIR, "public-meeting-document-text.json");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-cache-manifest.json");

type CacheRecord = {
  documentId: string;
  meetingId: string;
  meetingItemIds: string[];
  organizationId: string | null;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  stableLocalPath: string;
  contentHash: string;
  contentType: string | null;
  fileSize: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSuccessfulRetrievalAt: string;
  sourceVersion: number;
  previousHash: string | null;
  extractionStatus: string;
  ocrStatus: string;
};

type TextRecord = {
  documentId: string;
  extractedTextPath: string | null;
  extractionMethod: string;
  extractionQuality: string;
  textLength: number;
  confidence: number;
};

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

const generatedAt = new Date().toISOString();
const cacheIndex = readJson<{ records?: CacheRecord[] }>(CACHE_INDEX_PATH, { records: [] });
const textRecords = readJson<{ records?: TextRecord[] }>(DOCUMENT_TEXT_PATH, { records: [] }).records ?? [];
const textByDocument = new Map(textRecords.map((record) => [record.documentId, record]));

const records = (cacheIndex.records ?? []).map((record) => {
  const text = textByDocument.get(record.documentId);
  return {
    documentId: record.documentId,
    meetingId: record.meetingId,
    meetingItemIds: record.meetingItemIds,
    organizationId: record.organizationId,
    jurisdiction: record.jurisdiction,
    documentType: record.documentType,
    sourceUrl: record.sourceUrl,
    sourceHost: record.sourceHost,
    sourcePlatform: record.sourcePlatform,
    contentHash: record.contentHash,
    contentType: record.contentType,
    fileSize: record.fileSize,
    sourceVersion: record.sourceVersion,
    previousHash: record.previousHash,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    lastSuccessfulRetrievalAt: record.lastSuccessfulRetrievalAt,
    extractionStatus: record.extractionStatus,
    ocrStatus: record.ocrStatus,
    extractedTextAvailable: Boolean(text?.extractedTextPath),
    extractionMethod: text?.extractionMethod ?? "failed",
    extractionQuality: text?.extractionQuality ?? "insufficient",
    textLength: text?.textLength ?? 0,
    extractionConfidence: text?.confidence ?? 0,
    binaryCacheLocation: "runtime_cache_not_committed",
    localPathFingerprint: record.stableLocalPath.split("/").slice(-2).join("/"),
  };
});

const audit = {
  generatedAt,
  totals: {
    cachedDocuments: records.length,
    cachedBytes: records.reduce((sum, record) => sum + record.fileSize, 0),
    extractedTextAvailable: records.filter((record) => record.extractedTextAvailable).length,
    pdfDocuments: records.filter((record) => record.contentType?.includes("pdf") || /\.pdf$/i.test(record.localPathFingerprint)).length,
    htmlDocuments: records.filter((record) => record.contentType?.includes("html") || /\.html$/i.test(record.localPathFingerprint)).length,
    runtimeBinaryCacheCommitted: false,
  },
  retentionPolicy: {
    commitBinaryCacheToGit: false,
    commitManifestAndHashes: true,
    storageExportAudit: "data/generated/public-meeting-cache-storage-audit.json",
    blobStorageExportAudit: "data/generated/public-meeting-cache-storage-audit.vercel_blob.json",
    runtimeCacheDirectories: [
      "data/generated/public-meeting-document-cache/",
      "data/generated/public-meeting-document-text-cache/",
      "data/generated/public-meeting-ocr-text-cache/",
    ],
    recommendedDurableStorage: "object_or_blob_storage_with_content_hash_keys",
    operatorCommands: {
      smokeExport: "npm run meetings:cache-storage:smoke",
      fullExport: "npm run meetings:cache-storage:export -- --limit=all",
      audit: "npm run meetings:cache-storage:audit",
      vercelBlobSmoke: "npm run meetings:cache-storage:blob-smoke",
      vercelBlobExport: "npm run meetings:cache-storage:blob-export",
      vercelBlobAudit: "npm run meetings:cache-storage:blob-audit",
    },
  },
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, records, audit }, null, 2)}\n`);
console.log(`Generated public meeting cache manifest at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
