import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const QUEUE_PATH = path.join(GENERATED_DIR, "public-meeting-retrieval-queue.json");
const HEALTH_PATH = path.join(GENERATED_DIR, "public-meeting-source-health.json");

type SourceDocument = {
  id: string;
  meetingId: string;
  meetingItemIds: string[];
  organizationId: string | null;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  cached: boolean;
  cachedPath: string | null;
  contentHash: string | null;
  retrievalStatus: "local_cached" | "remote_discovered" | "missing" | "unreadable_local";
  priorityBody: boolean;
  discoveredAt: string;
};

type DocumentText = {
  documentId: string;
  meetingId: string;
  extractionMethod: "native_text" | "ocr_text" | "mixed" | "failed";
  extractionQuality: "high" | "medium" | "low" | "insufficient";
  textLength: number;
  confidence: number;
  ocrAttempted: boolean;
  ocrAvailable: boolean;
  failureReason: string | null;
};

type CacheIndexRecord = {
  documentId: string;
  stableLocalPath: string;
  contentHash: string;
  retrievalTimestamp: string;
  sourceVersion: number;
  previousHash: string | null;
  retrievalAttemptCount: number;
  lastSuccessfulRetrievalAt: string;
  extractionStatus: string;
  ocrStatus: string;
};

type RetrievalRun = {
  attempts?: RetrievalAttempt[];
};

type RetrievalAttempt = {
  documentId: string;
  status: string;
  failureReason: string | null;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function documentState(document: SourceDocument, text: DocumentText | undefined, cache: CacheIndexRecord | undefined, latestAttempt: RetrievalAttempt | undefined) {
  if (latestAttempt?.status === "blocked_by_network") return "blocked_by_network";
  if (latestAttempt?.status === "unavailable") return "unavailable";
  if (latestAttempt?.status === "failed") return "failed";
  if (text?.extractionMethod === "ocr_text" || text?.extractionMethod === "mixed") return "extracted";
  if (text?.extractionMethod === "native_text" && text.extractionQuality !== "insufficient") return "extracted";
  if ((document.retrievalStatus === "local_cached" || cache) && text?.failureReason?.includes("ocr")) return "ocr_required";
  if ((document.retrievalStatus === "local_cached" || cache) && text?.extractionMethod === "failed") return "extraction_ready";
  if (latestAttempt?.status === "changed") return "changed";
  if (latestAttempt?.status === "unchanged") return "unchanged";
  if (latestAttempt?.status === "downloaded") return "downloaded";
  if (cache) return "cached";
  if (document.retrievalStatus === "local_cached") return "cached";
  if (document.retrievalStatus === "remote_discovered" && document.priorityBody) return "queued";
  if (document.retrievalStatus === "remote_discovered") return "discovered";
  if (document.retrievalStatus === "missing") return "unavailable";
  return "failed";
}

function retryAfterFor(state: string, priorityBody: boolean) {
  if (state === "queued") return priorityBody ? "PT6H" : "P1D";
  if (state === "failed" || state === "ocr_required" || state === "blocked_by_network") return "P1D";
  return null;
}

function recommendedActionFor(state: string) {
  if (state === "queued") return "download_public_document";
  if (state === "discovered") return "queue_after_priority_sources";
  if (state === "cached" || state === "downloaded" || state === "changed" || state === "unchanged" || state === "extraction_ready") return "extract_text";
  if (state === "ocr_required") return "run_ocr_or_manual_review";
  if (state === "blocked_by_network") return "retry_when_network_available";
  if (state === "failed") return "manual_source_review";
  if (state === "unavailable") return "confirm_source_availability";
  return "none";
}

function generateQueue() {
  const generatedAt = new Date().toISOString();
  const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
  const textRows = readJson<{ records?: DocumentText[] }>("public-meeting-document-text.json", { records: [] }).records ?? [];
  const cacheRows = readJson<{ records?: CacheIndexRecord[] }>("public-meeting-document-cache-index.json", { records: [] }).records ?? [];
  const retrievalRun = readJson<RetrievalRun>("dataops-retrieval-run.json", { attempts: [] });
  const textByDocument = new Map(textRows.map((row) => [row.documentId, row]));
  const cacheByDocument = new Map(cacheRows.map((row) => [row.documentId, row]));
  const attemptByDocument = new Map((retrievalRun.attempts ?? []).map((row) => [row.documentId, row]));
  const records = documents.map((document) => {
    const text = textByDocument.get(document.id);
    const cache = cacheByDocument.get(document.id);
    const latestAttempt = attemptByDocument.get(document.id);
    const state = documentState(document, text, cache, latestAttempt);
    return {
      id: `retrieval-${document.id}`,
      documentId: document.id,
      meetingId: document.meetingId,
      meetingItemIds: document.meetingItemIds,
      organizationId: document.organizationId,
      jurisdiction: document.jurisdiction,
      documentType: document.documentType,
      sourceUrl: document.sourceUrl,
      sourcePath: document.sourcePath,
      sourceHost: document.sourceHost,
      sourcePlatform: document.sourcePlatform,
      retrievalState: state,
      retrievalStatus: document.retrievalStatus,
      cachePath: cache?.stableLocalPath ?? document.cachedPath,
      contentHash: cache?.contentHash ?? document.contentHash,
      sourceVersion: cache?.sourceVersion ?? 1,
      previousHash: cache?.previousHash ?? null,
      priorityBody: document.priorityBody,
      queuedAt: state === "queued" ? generatedAt : null,
      lastRetrievedAt: cache?.lastSuccessfulRetrievalAt ?? (document.retrievalStatus === "local_cached" ? document.discoveredAt : null),
      nextRetryAfter: retryAfterFor(state, document.priorityBody),
      retryCount: cache?.retrievalAttemptCount ?? (latestAttempt ? 1 : 0),
      cacheRefreshAfter: cache || document.retrievalStatus === "local_cached" ? "P30D" : null,
      extractionMethod: text?.extractionMethod ?? "failed",
      extractionQuality: text?.extractionQuality ?? "insufficient",
      extractionConfidence: text?.confidence ?? 0,
      textLength: text?.textLength ?? 0,
      ocrRequired: state === "ocr_required",
      failureReason: latestAttempt?.failureReason ?? text?.failureReason ?? (document.retrievalStatus === "remote_discovered" ? "remote_document_not_cached_in_current_environment" : null),
      recommendedNextAction: recommendedActionFor(state),
      provenance: {
        sourceUrl: document.sourceUrl,
        sourcePath: document.sourcePath,
        documentType: document.documentType,
        jurisdiction: document.jurisdiction,
        meetingId: document.meetingId,
      },
    };
  });

  const healthBySource = Array.from(
    records.reduce((map, record) => {
      const key = `${record.organizationId ?? "unknown"}|${record.sourcePlatform}|${record.sourceHost ?? "local"}`;
      const current = map.get(key) ?? {
        organizationId: record.organizationId,
        jurisdiction: record.jurisdiction,
        sourcePlatform: record.sourcePlatform,
        sourceHost: record.sourceHost,
        documents: 0,
        queued: 0,
        cached: 0,
        extracted: 0,
        ocrRequired: 0,
        failed: 0,
        sourceGaps: 0,
        retrievalHealth: 0,
        extractionHealth: 0,
        ocrHealth: 0,
      };
      current.documents += 1;
      if (record.retrievalState === "queued") current.queued += 1;
      if (["cached", "downloaded", "changed", "unchanged", "extraction_ready"].includes(record.retrievalState)) current.cached += 1;
      if (record.retrievalState === "extracted") current.extracted += 1;
      if (record.retrievalState === "ocr_required") current.ocrRequired += 1;
      if (record.retrievalState === "failed") current.failed += 1;
      if (record.retrievalState === "queued" || record.retrievalState === "discovered" || record.retrievalState === "unavailable" || record.retrievalState === "blocked_by_network") current.sourceGaps += 1;
      map.set(key, current);
      return map;
    }, new Map<string, any>()).values(),
  ).map((entry) => ({
    ...entry,
    retrievalHealth: Number(((entry.cached + entry.extracted) / Math.max(1, entry.documents)).toFixed(2)),
    extractionHealth: Number((entry.extracted / Math.max(1, entry.documents)).toFixed(2)),
    ocrHealth: entry.ocrRequired ? 0 : 1,
  }));

  const audit = {
    generatedAt,
    totals: {
      documents: records.length,
      discovered: records.filter((record) => record.retrievalState === "discovered").length,
      queued: records.filter((record) => record.retrievalState === "queued").length,
      downloaded: records.filter((record) => record.retrievalStatus === "local_cached").length,
      cachedByDataops: records.filter((record) => Boolean(record.cachePath)).length,
      cached: records.filter((record) => record.retrievalState === "cached").length,
      attempted: records.filter((record) => record.retryCount > 0).length,
      changed: records.filter((record) => record.retrievalState === "changed").length,
      unchanged: records.filter((record) => record.retrievalState === "unchanged").length,
      extracted: records.filter((record) => record.retrievalState === "extracted").length,
      ocrRequired: records.filter((record) => record.retrievalState === "ocr_required").length,
      failed: records.filter((record) => record.retrievalState === "failed").length,
      unavailable: records.filter((record) => record.retrievalState === "unavailable").length,
      blockedByNetwork: records.filter((record) => record.retrievalState === "blocked_by_network").length,
      priorityQueued: records.filter((record) => record.priorityBody && record.retrievalState === "queued").length,
    },
    stateCounts: records.reduce<Record<string, number>>((counts, record) => {
      counts[record.retrievalState] = (counts[record.retrievalState] ?? 0) + 1;
      return counts;
    }, {}),
  };

  return { generatedAt, records, audit, healthBySource };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const result = generateQueue();
writeFileSync(QUEUE_PATH, `${JSON.stringify({ generatedAt: result.generatedAt, records: result.records, audit: result.audit }, null, 2)}\n`);
writeFileSync(HEALTH_PATH, `${JSON.stringify({ generatedAt: result.generatedAt, sourceHealth: result.healthBySource, audit: result.audit }, null, 2)}\n`);
console.log(`Generated retrieval queue with ${result.records.length} documents at ${QUEUE_PATH}`);
console.log(JSON.stringify(result.audit.totals, null, 2));
