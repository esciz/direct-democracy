import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "dataops-reprocessing-runs.json");

type CacheRecord = {
  documentId: string;
  jurisdiction: string | null;
  documentType: string;
  sourcePlatform: string;
  stableLocalPath: string;
};

type TextRecord = {
  documentId: string;
  extractionMethod: string;
  extractedAt: string;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function argValue(name: string) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

const startedAt = new Date().toISOString();
const scope = {
  source: argValue("source") ?? null,
  jurisdiction: argValue("jurisdiction") ?? null,
  documentType: argValue("document-type") ?? null,
  extractionMethod: argValue("extraction-method") ?? null,
  allCachedDocuments: process.argv.includes("--all-cached") || !process.argv.some((arg) => arg.startsWith("--")),
  accountabilityOutputs: process.argv.includes("--accountability"),
};
const cache = readJson<{ records?: CacheRecord[] }>("public-meeting-document-cache-index.json", { records: [] }).records ?? [];
const text = readJson<{ records?: TextRecord[] }>("public-meeting-document-text.json", { records: [] }).records ?? [];
const textByDocument = new Map(text.map((record) => [record.documentId, record]));
const selected = cache.filter((record) => {
  if (scope.source && record.sourcePlatform !== scope.source && record.documentId !== scope.source) return false;
  if (scope.jurisdiction && record.jurisdiction !== scope.jurisdiction) return false;
  if (scope.documentType && record.documentType !== scope.documentType) return false;
  if (scope.extractionMethod && textByDocument.get(record.documentId)?.extractionMethod !== scope.extractionMethod) return false;
  return true;
});
const previous = readJson<{ runs?: unknown[] }>(OUTPUT_PATH, { runs: [] }).runs ?? [];
const completedAt = new Date().toISOString();
const run = {
  runId: `reprocess-${startedAt}`,
  startedAt,
  completedAt,
  scope,
  inputCounts: {
    cachedDocuments: cache.length,
    selectedDocuments: selected.length,
    existingTextRows: text.length,
  },
  changedOutputs: [],
  failures: [],
  generatedArtifacts: [
    "public-meeting-document-text.json",
    "minutes-extraction-audit.json",
    "public-meeting-action-results.json",
    "public-meeting-attendance.json",
    "public-meeting-votes.json",
    "accountability-graph.json",
  ],
  status: "planned_no_recollection",
  note: "This run records a reprocessing scope. Use dataops:daily or targeted extraction scripts to apply parser improvements to cached source material.",
};

const runs = [...previous, run].slice(-250);
const audit = {
  generatedAt: completedAt,
  totals: {
    runs: runs.length,
    selectedDocuments: selected.length,
    failures: 0,
  },
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt: completedAt, runs, audit }, null, 2)}\n`);
console.log(`Recorded reprocessing run ${run.runId} with ${selected.length} cached documents at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
