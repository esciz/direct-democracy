import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "dataops-monitoring-status.json");

type RegistrySource = {
  id: string;
  sourceType: string;
  sourceOwner: string;
  jurisdiction: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  sourceCategory: string;
  sourceUrls: string[];
  documentTypes: string[];
  checkCadence: string;
};

type SourceHealth = {
  organizationId: string | null;
  jurisdiction: string | null;
  sourcePlatform: string;
  sourceHost: string | null;
  documents: number;
  queued: number;
  cached: number;
  extracted: number;
  ocrRequired: number;
  failed: number;
  sourceGaps: number;
};

type SourceCompleteness = {
  totals?: Record<string, number>;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function nextCheck(now: Date, cadence: string) {
  const ms = cadence === "PT1H" ? 60 * 60 * 1000 : cadence === "PT6H" ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ms).toISOString();
}

function healthStatus(source: RegistrySource, health: SourceHealth | undefined): "healthy" | "stale" | "degraded" | "failing" | "blocked" | "unknown" {
  if (!health) return source.sourceUrls.length ? "unknown" : "blocked";
  if (health.failed > 0) return "failing";
  if (health.documents > 0 && health.sourceGaps / health.documents > 0.75) return "stale";
  if (health.ocrRequired > 0 || health.sourceGaps > 0) return "degraded";
  if (health.extracted > 0) return "healthy";
  return "unknown";
}

const generatedAt = new Date();
const registry = readJson<{ records?: RegistrySource[] }>("dataops-source-registry.json", { records: [] }).records ?? [];
const sourceHealth = readJson<{ sourceHealth?: SourceHealth[] }>("public-meeting-source-health.json", { sourceHealth: [] }).sourceHealth ?? [];
const sourceCompleteness = readJson<SourceCompleteness>("public-meeting-source-completeness.json", {});
const healthByKey = new Map(sourceHealth.map((record) => [`${record.organizationId ?? "unknown"}:${record.sourcePlatform}:${record.sourceHost ?? "local"}`, record]));

const records = registry.map((source) => {
  const key = source.id.startsWith("meeting:") ? source.id.replace(/^meeting:/, "") : "";
  const health = healthByKey.get(key);
  const status = healthStatus(source, health);
  return {
    sourceId: source.id,
    sourceType: source.sourceType,
    sourceOwner: source.sourceOwner,
    jurisdiction: source.jurisdiction,
    sourceCategory: source.sourceCategory,
    sourcePlatform: source.sourcePlatform,
    sourceHost: source.sourceHost,
    lastCheckedAt: generatedAt.toISOString(),
    lastSuccessAt: health && health.cached + health.extracted > 0 ? generatedAt.toISOString() : null,
    lastChangeDetectedAt: null,
    nextCheckAt: nextCheck(generatedAt, source.checkCadence),
    healthStatus: status,
    freshnessStatus: status === "healthy" ? "current" : status === "stale" ? "stale" : status === "blocked" ? "blocked" : "limited",
    failureReason:
      status === "blocked"
        ? "No source URL or feed URL is registered yet."
        : status === "stale"
          ? "Most documents are discovered but not cached or extracted."
          : status === "failing"
            ? "One or more document retrieval or extraction failures are present."
            : null,
    documentCounts: {
      discovered: health?.documents ?? 0,
      queued: health?.queued ?? 0,
      cached: health?.cached ?? 0,
      extracted: health?.extracted ?? 0,
      ocrRequired: health?.ocrRequired ?? 0,
      failed: health?.failed ?? 0,
    },
    accountabilityReadinessImpact: {
      meetingsReadyForAccountability: sourceCompleteness.totals?.meetingsReadyForAccountability ?? 0,
      meetingsBlockedBySourceGaps: sourceCompleteness.totals?.meetingsBlockedBySourceGaps ?? 0,
      meetingsBlockedByOcr: sourceCompleteness.totals?.meetingsBlockedByOcr ?? 0,
      meetingsBlockedByParserGaps: sourceCompleteness.totals?.meetingsBlockedByParserGaps ?? 0,
    },
  };
});

const audit = {
  generatedAt: generatedAt.toISOString(),
  totals: {
    sourcesMonitored: records.length,
    healthy: records.filter((record) => record.healthStatus === "healthy").length,
    stale: records.filter((record) => record.healthStatus === "stale").length,
    degraded: records.filter((record) => record.healthStatus === "degraded").length,
    failing: records.filter((record) => record.healthStatus === "failing").length,
    blocked: records.filter((record) => record.healthStatus === "blocked").length,
    unknown: records.filter((record) => record.healthStatus === "unknown").length,
    documentsDiscovered: records.reduce((sum, record) => sum + record.documentCounts.discovered, 0),
    queuedRetrievals: records.reduce((sum, record) => sum + record.documentCounts.queued, 0),
    downloadedDocuments: records.reduce((sum, record) => sum + record.documentCounts.cached + record.documentCounts.extracted, 0),
    extractedDocuments: records.reduce((sum, record) => sum + record.documentCounts.extracted, 0),
    ocrCandidates: records.reduce((sum, record) => sum + record.documentCounts.ocrRequired, 0),
  },
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt: generatedAt.toISOString(), records, audit }, null, 2)}\n`);
console.log(`Generated DataOps monitoring status for ${records.length} sources at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
