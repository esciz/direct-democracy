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

const queue = readJson<{ records?: Array<{ retrievalState?: string; documentId?: string }> }>("public-meeting-retrieval-queue.json", { records: [] });
const cache = readJson<{ records?: Array<{ documentId?: string; stableLocalPath?: string; contentHash?: string; sourceVersion?: number }> }>("public-meeting-document-cache-index.json", { records: [] });
const monitor = readJson<{ records?: Array<{ healthStatus?: string; freshnessStatus?: string }> }>("dataops-monitoring-status.json", { records: [] });
const rss = readJson<{ records?: unknown[] }>("rss-source-registry.json", { records: [] });
const reprocessing = readJson<{ runs?: unknown[] }>("dataops-reprocessing-runs.json", { runs: [] });

const failures: string[] = [];
const runningInGithubActions = process.env.GITHUB_ACTIONS === "true";
const allowExternalCache = runningInGithubActions || process.env.DATAOPS_ALLOW_EXTERNAL_MEETING_CACHE === "true";
let missingLocalCacheFiles = 0;

for (const record of cache.records ?? []) {
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
