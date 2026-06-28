import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getOfficialDirectorySources } from "@/lib/officials/current-officeholders";
import { canonicalPromotionExists, createOfficialsProvenance, writeEnvironmentArtifact } from "@/lib/officials/source-evidence";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REGISTRY_PATH = path.join(GENERATED_DIR, "officials-source-registry.json");
const HEALTH_PATH = path.join(GENERATED_DIR, "officials-source-health.json");
const RETRIEVAL_RUN_PATH = path.join(GENERATED_DIR, "officials-retrieval-run.json");

type RetrievalRunRecord = {
  sourceId: string;
  status: string;
  cachedPath: string | null;
  contentHash: string | null;
  completedAt?: string;
  lastCheckedAt?: string;
  lastSeenAt?: string | null;
  lastChangedAt?: string | null;
};

function readRetrievalRun() {
  if (!existsSync(RETRIEVAL_RUN_PATH)) return new Map<string, RetrievalRunRecord>();
  try {
    const run = JSON.parse(readFileSync(RETRIEVAL_RUN_PATH, "utf8")) as { records?: RetrievalRunRecord[] };
    return new Map((run.records ?? []).map((record) => [record.sourceId, record]));
  } catch {
    return new Map<string, RetrievalRunRecord>();
  }
}

const generatedAt = new Date().toISOString();
const latestRetrieval = readRetrievalRun();
const records = getOfficialDirectorySources(generatedAt).map((source) => {
  const retrieval = latestRetrieval.get(source.id);
  if (!retrieval) return source;
  const checkedAt = retrieval.completedAt ?? retrieval.lastCheckedAt ?? generatedAt;
  const verifiedAt = retrieval.lastSeenAt ?? checkedAt;
  if (["retrieved_verified", "changed", "unchanged", "downloaded"].includes(retrieval.status) && retrieval.cachedPath) {
    return {
      ...source,
      retrievalStatus: "retrieved" as const,
      cachedPath: retrieval.cachedPath,
      contentHash: retrieval.contentHash,
      lastCheckedAt: checkedAt,
      lastSuccessfulRetrievalAt: verifiedAt,
      lastChangedAt: retrieval.lastChangedAt ?? verifiedAt,
      lastParsedAt: generatedAt,
      lastVerifiedAt: generatedAt,
      sourceHealth: "healthy" as const,
    };
  }
  if (retrieval.status === "blocked_by_network" || retrieval.status === "blocked_by_environment") {
    return {
      ...source,
      retrievalStatus: "blocked_by_network" as const,
      cachedPath: null,
      contentHash: null,
      lastCheckedAt: checkedAt,
      lastSuccessfulRetrievalAt: null,
      lastChangedAt: null,
      lastParsedAt: null,
      lastVerifiedAt: null,
      sourceHealth: "blocked" as const,
    };
  }
  return {
    ...source,
    retrievalStatus: "not_retrieved" as const,
    cachedPath: null,
    contentHash: null,
    lastCheckedAt: checkedAt,
    lastSuccessfulRetrievalAt: null,
    lastChangedAt: null,
    lastParsedAt: null,
    lastVerifiedAt: null,
    sourceHealth: "unknown" as const,
  };
});
const healthRecords = records.map((source) => ({
  sourceId: source.id,
  jurisdictionId: source.jurisdictionId,
  jurisdictionName: source.jurisdictionName,
  sourceUrl: source.sourceUrl,
  sourceType: source.sourceType,
  parserStatus: source.parserStatus,
  retrievalStatus: source.retrievalStatus,
  cachedPath: source.cachedPath,
  contentHash: source.contentHash,
  lastCheckedAt: source.lastCheckedAt,
  lastSuccessfulRetrievalAt: source.lastSuccessfulRetrievalAt,
  lastChangedAt: source.lastChangedAt,
  lastParsedAt: source.lastParsedAt,
  lastVerifiedAt: source.lastVerifiedAt,
  nextDueAt: source.nextDueAt,
  sourceHealth: source.sourceHealth,
  currentOfficialCount: 0,
  changedOfficeholders: 0,
  titlesChanged: 0,
  possibleVacancies: 0,
  parseFailures: 0,
  manualFallback: source.cachedPath ? "cached_official_html" : "network_enabled_retrieval_or_reviewed_manual_source",
}));
const healthArtifact = {
  generatedAt,
  records: healthRecords,
  audit: {
    totals: {
      sources: healthRecords.length,
      healthy: healthRecords.filter((source) => source.sourceHealth === "healthy").length,
      partial: healthRecords.filter((source) => source.sourceHealth === "partial").length,
      blocked: healthRecords.filter((source) => source.sourceHealth === "blocked").length,
      unknown: healthRecords.filter((source) => source.sourceHealth === "unknown").length,
      withCachedHtml: healthRecords.filter((source) => Boolean(source.cachedPath)).length,
    },
  },
  provenance: createOfficialsProvenance({
    artifactName: "officials-source-health",
    generatedAt,
    downloads: healthRecords.filter((source) => Boolean(source.cachedPath)).length,
    cacheCount: healthRecords.filter((source) => Boolean(source.cachedPath)).length,
    promotionStatus: "not_requested",
  }),
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(
  REGISTRY_PATH,
  `${JSON.stringify(
    {
      generatedAt,
      records,
      audit: {
        totals: {
          sources: records.length,
          carsonCitySources: records.filter((source) => source.jurisdictionId === "carson-city").length,
          retrievedSources: records.filter((source) => source.retrievalStatus === "retrieved" || source.retrievalStatus === "manual_cache_available").length,
          reviewedBaselineSources: records.filter((source) => source.retrievalStatus === "reviewed_baseline").length,
        },
      },
    },
    null,
    2,
  )}\n`,
);
if (canonicalPromotionExists()) {
  writeEnvironmentArtifact("officials-source-health", healthArtifact.provenance, healthArtifact);
} else {
  writeFileSync(HEALTH_PATH, `${JSON.stringify(healthArtifact, null, 2)}\n`);
}

console.log(`Generated ${records.length} official directory sources.`);
console.log(`Wrote ${path.relative(process.cwd(), REGISTRY_PATH)} and ${canonicalPromotionExists() ? "environment-scoped officials source health" : path.relative(process.cwd(), HEALTH_PATH)}`);
