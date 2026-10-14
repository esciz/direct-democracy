import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "dataops-freshness-audit.json");

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

type DocumentReference = { id?: string; documentId?: string; sourcePath?: string; cachedPath?: string; cachePath?: string };
const queue = readJson<{ records?: Array<DocumentReference & { retrievalState?: string }> }>("public-meeting-retrieval-queue.json", {});
const documents = readJson<{ records?: DocumentReference[] }>("public-meeting-source-documents.json", {});
const meetings = readJson<Array<{ id?: string; meeting_alias_ids?: string[] }> | null>("public-meetings.json", null);
const cache = readJson<{ records?: Array<{ documentId?: string; meetingId?: string; documentType?: string; sourceUrl?: string | null; sourcePath?: string; stableLocalPath?: string; contentHash?: string; sourceVersion?: number }> }>("public-meeting-document-cache-index.json", { records: [] });
const monitor = readJson<{ records?: Array<{ healthStatus?: string; freshnessStatus?: string }> }>("dataops-monitoring-status.json", { records: [] });
const rss = readJson<{ records?: unknown[] }>("rss-source-registry.json", { records: [] });
const reprocessing = readJson<{ runs?: unknown[] }>("dataops-reprocessing-runs.json", { runs: [] });

const failures: string[] = [];
const runningInGithubActions = process.env.GITHUB_ACTIONS === "true";
const allowExternalCache = runningInGithubActions || process.env.DATAOPS_ALLOW_EXTERNAL_MEETING_CACHE === "true";
let missingLocalCacheFiles = 0;
let excludedMetadataCacheRecords = 0;
const referencesAvailable = Array.isArray(documents.records) && Array.isArray(queue.records) && Array.isArray(meetings);
const currentReferences = [...(documents.records ?? []), ...(queue.records ?? [])];
const currentDocumentIds = new Set(currentReferences.flatMap(record => [record.id, record.documentId]).filter(Boolean));
const currentDocumentPaths = new Set(currentReferences.flatMap(record => [record.sourcePath, record.cachedPath, record.cachePath]).filter(Boolean));
const currentMeetingIds = new Set((meetings ?? []).flatMap(meeting => [meeting.id, ...(meeting.meeting_alias_ids ?? [])]).filter(Boolean));

for (const record of cache.records ?? []) {
  // A historical browser capture also indexed the website's font-size setting
  // endpoint as a document. It is not meeting evidence and is deliberately not
  // checkpointed. Exclude only this known metadata shape after proving it has
  // no current document, queue, or meeting reference; unknown documents and
  // other policy-rejected paths must still report missing evidence.
  const obsoleteFontSizeMetadata = referencesAvailable && record.documentType === "unknown" && !record.sourceUrl
    && Boolean(record.documentId && record.meetingId && record.stableLocalPath && record.sourcePath === record.stableLocalPath)
    && /^data\/manual-sources\/public-meetings\/[a-z0-9-]+\/metadata\/undated-api-json-\d+-shared-getfontsizecookie\.json$/i.test(record.stableLocalPath ?? "")
    && !currentDocumentIds.has(record.documentId) && !currentDocumentPaths.has(record.stableLocalPath) && !currentMeetingIds.has(record.meetingId);
  if (obsoleteFontSizeMetadata) {
    excludedMetadataCacheRecords += 1;
    continue;
  }
  if (!record.stableLocalPath) failures.push(`Cached document ${record.documentId ?? "unknown"} missing local path`);
  const localPathExists = Boolean(record.stableLocalPath && existsSync(path.isAbsolute(record.stableLocalPath) ? record.stableLocalPath : path.join(process.cwd(), record.stableLocalPath)));
  if (record.stableLocalPath && !localPathExists) {
    missingLocalCacheFiles += 1;
  }
  if (record.stableLocalPath && !localPathExists && !allowExternalCache) {
    failures.push(`Cached document ${record.documentId ?? "unknown"} local path does not exist`);
  }
  if (!record.contentHash) failures.push(`Cached document ${record.documentId ?? "unknown"} missing hash`);
  if (!record.sourceVersion) failures.push(`Cached document ${record.documentId ?? "unknown"} missing source version`);
}
if (!(rss.records ?? []).length) failures.push("RSS source registry is empty");
if (!(monitor.records ?? []).length) failures.push("DataOps monitoring status is empty");
if (!(reprocessing.runs ?? []).length) failures.push("No reprocessing run has been recorded");

const audit = {
  generatedAt: new Date().toISOString(),
  environment: {
    githubActions: runningInGithubActions,
    allowExternalCache,
  },
  totals: {
    queueRecords: queue.records?.length ?? 0,
    downloadedOrCached: (queue.records ?? []).filter((record) => ["downloaded", "cached", "unchanged", "changed", "extraction_ready", "ocr_required", "extracted"].includes(record.retrievalState ?? "")).length,
    blockedByNetwork: (queue.records ?? []).filter((record) => record.retrievalState === "blocked_by_network").length,
    cacheRecords: cache.records?.length ?? 0,
    auditedCacheRecords: (cache.records?.length ?? 0) - excludedMetadataCacheRecords,
    excludedMetadataCacheRecords,
    missingLocalCacheFiles,
    externalCacheMissingFilesSuppressed: allowExternalCache ? missingLocalCacheFiles : 0,
    cacheRecordsWithHashes: (cache.records ?? []).filter((record) => Boolean(record.contentHash)).length,
    changedDocumentsTracked: (cache.records ?? []).filter((record) => (record.sourceVersion ?? 1) > 1).length,
    sourcesMonitored: monitor.records?.length ?? 0,
    staleSources: (monitor.records ?? []).filter((record) => record.healthStatus === "stale").length,
    failingSources: (monitor.records ?? []).filter((record) => record.healthStatus === "failing").length,
    rssSources: rss.records?.length ?? 0,
    reprocessingRuns: reprocessing.runs?.length ?? 0,
    failures: failures.length,
  },
  failures,
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

if (failures.length) {
  console.error("DataOps freshness audit failed:");
  for (const failure of failures.slice(0, 40)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("DataOps freshness audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
