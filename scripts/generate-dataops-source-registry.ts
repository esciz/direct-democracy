import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getOfficialDirectorySources } from "@/lib/officials/current-officeholders";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "dataops-source-registry.json");

type SourceDocument = {
  organizationId: string | null;
  jurisdiction: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  sourceUrl: string | null;
  documentType: string;
};

type RssSource = {
  id: string;
  feedUrl: string | null;
  sourceOwner: string;
  jurisdiction: string;
  sourceCategory: string;
  status: string;
};

function hostFor(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

const generatedAt = new Date().toISOString();
const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
const rss = readJson<{ records?: RssSource[] }>("rss-source-registry.json", { records: [] }).records ?? [];
const sourceMap = new Map<string, any>();

for (const document of documents) {
  const key = `meeting:${document.organizationId ?? "unknown"}:${document.sourcePlatform}:${document.sourceHost ?? "local"}`;
  const existing = sourceMap.get(key) ?? {
    id: key,
    sourceType: "meeting_system",
    sourceOwner: document.organizationId ?? document.sourceHost ?? "Unknown meeting source",
    jurisdiction: document.jurisdiction,
    sourceHost: document.sourceHost,
    sourcePlatform: document.sourcePlatform,
    sourceCategory: "meetings",
    sourceUrls: new Set<string>(),
    documentTypes: new Set<string>(),
    checkCadence: document.sourcePlatform === "nevada_legislature" ? "PT1H" : "PT6H",
    productionCadenceRecommendation: document.sourcePlatform === "nevada_legislature" ? "15-60 minutes" : "1-6 hours",
  };
  if (document.sourceUrl) existing.sourceUrls.add(document.sourceUrl);
  existing.documentTypes.add(document.documentType);
  sourceMap.set(key, existing);
}

for (const source of rss) {
  sourceMap.set(`rss:${source.id}`, {
    id: `rss:${source.id}`,
    sourceType: "rss",
    sourceOwner: source.sourceOwner,
    jurisdiction: source.jurisdiction,
    sourceHost: hostFor(source.feedUrl),
    sourcePlatform: "rss",
    sourceCategory: source.sourceCategory,
    sourceUrls: new Set(source.feedUrl ? [source.feedUrl] : []),
    documentTypes: new Set(["feed_item"]),
    checkCadence: "PT1H",
    productionCadenceRecommendation: "15-60 minutes for official updates; hourly/daily for community news",
    rssStatus: source.status,
  });
}

for (const source of getOfficialDirectorySources(generatedAt)) {
  sourceMap.set(`official-directory:${source.id}`, {
    id: `official-directory:${source.id}`,
    sourceType: "official_directory",
    sourceOwner: source.sourceName,
    jurisdiction: source.jurisdictionName,
    sourceHost: hostFor(source.sourceUrl),
    sourcePlatform: "official_directory",
    sourceCategory: "officials",
    sourceUrls: new Set([source.sourceUrl]),
    documentTypes: new Set([source.sourceType]),
    checkCadence: source.checkCadence,
    productionCadenceRecommendation: source.monitoringCadence,
    officialDirectoryStatus: source.parserStatus,
    retrievalStatus: source.retrievalStatus,
    lastCheckedAt: source.lastCheckedAt,
    lastSuccessAt: source.lastSuccessfulRetrievalAt,
    lastChangeDetectedAt: source.lastChangedAt,
    nextCheckAt: source.nextDueAt,
    healthStatus: source.sourceHealth,
    freshnessStatus: source.lastVerifiedAt ? "verified_baseline" : "not_checked",
    failureReason: source.retrievalStatus === "blocked_by_network" ? "Network unavailable in current environment." : null,
  });
}

const records = [...sourceMap.values()].map((record) => ({
  ...record,
  sourceUrls: [...record.sourceUrls].slice(0, 25),
  documentTypes: [...record.documentTypes].sort(),
  lastCheckedAt: record.lastCheckedAt ?? null,
  lastSuccessAt: record.lastSuccessAt ?? null,
  lastChangeDetectedAt: record.lastChangeDetectedAt ?? null,
  nextCheckAt: record.nextCheckAt ?? null,
  healthStatus: record.healthStatus ?? "unknown",
  freshnessStatus: record.freshnessStatus ?? "not_checked",
  failureReason: record.failureReason ?? null,
  accountabilityReadinessImpact: "not_scored_until_monitor_runs",
}));

const audit = {
  generatedAt,
  totals: {
    sources: records.length,
    meetingSources: records.filter((record) => record.sourceType === "meeting_system").length,
    rssSources: records.filter((record) => record.sourceType === "rss").length,
    officialDirectorySources: records.filter((record) => record.sourceType === "official_directory").length,
    jurisdictions: new Set(records.map((record) => record.jurisdiction).filter(Boolean)).size,
  },
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, records, audit }, null, 2)}\n`);
console.log(`Generated DataOps source registry with ${records.length} sources at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
