import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REGISTRY_PATH = path.join(GENERATED_DIR, "ingestion-capability-registry.json");
const COVERAGE_PATH = path.join(GENERATED_DIR, "ingestion-coverage-report.json");
const ADAPTER_HEALTH_PATH = path.join(GENERATED_DIR, "source-adapter-health.json");

type DataopsSource = {
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
  productionCadenceRecommendation: string;
};

type MonitoringRecord = {
  sourceId: string;
  healthStatus: string;
  freshnessStatus: string;
  failureReason: string | null;
  nextCheckAt: string | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  documentCounts: Record<string, number>;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function adapterFor(source: DataopsSource) {
  if (source.sourceType === "official_directory" || source.sourceCategory === "officials") return "official_directory_html";
  if (source.sourceType === "rss" || source.sourcePlatform === "rss") return "rss_atom_feed";
  if (source.sourceUrls.some((url) => /\.pdf(?:$|\?)/i.test(url))) return "direct_pdf_attachment";
  if (source.sourcePlatform === "legistar") return "direct_http_documents";
  if (source.sourcePlatform === "granicus") return "public_html_discovery";
  if (source.sourcePlatform === "nevada_legislature") return "public_html_or_api";
  if (source.sourcePlatform === "primegov" || source.sourcePlatform === "boarddocs") return "playwright_public_fallback";
  return "direct_http_documents";
}

function acquisitionMode(source: DataopsSource, adapter: string, health: MonitoringRecord | undefined) {
  if (!source.sourceUrls.length) return "manual_import";
  if (adapter.includes("playwright")) return "admin_guided";
  if (health?.healthStatus === "blocked") return "blocked";
  if (health?.healthStatus === "degraded" || health?.healthStatus === "stale") return "automated_with_fallback";
  return "automated";
}

const generatedAt = new Date().toISOString();
const sources = readJson<{ records?: DataopsSource[] }>("dataops-source-registry.json", { records: [] }).records ?? [];
const monitoring = readJson<{ records?: MonitoringRecord[] }>("dataops-monitoring-status.json", { records: [] }).records ?? [];
const monitorById = new Map(monitoring.map((record) => [record.sourceId, record]));

const records = sources.map((source) => {
  const health = monitorById.get(source.id);
  const adapter = adapterFor(source);
  const mode = acquisitionMode(source, adapter, health);
  const browserRequired = adapter.includes("playwright");
  const networkRequirement = source.sourceUrls.length ? "network_enabled_worker_or_local_terminal" : "none_for_manual_file";
  return {
    sourceId: source.id,
    sourceOwner: source.sourceOwner,
    jurisdiction: source.jurisdiction,
    provider: source.sourcePlatform,
    sourceCategory: source.sourceCategory,
    canonicalLocation: source.sourceUrls[0] ?? null,
    documentTypes: source.documentTypes,
    acquisitionAdapter: adapter,
    authenticationMode: browserRequired ? "public_browser_or_authorized_session_if_required" : "none_public_source",
    networkRequirement,
    browserRequirement: browserRequired ? "playwright_public_adapter" : "not_required",
    ocrLikelihood: source.documentTypes.includes("packet") || source.sourceUrls.some((url) => /\.pdf(?:$|\?)/i.test(url)) ? "medium" : "low",
    supportedTriggerModes: mode === "manual_import" ? ["manual_file_import", "manual_url_import"] : browserRequired ? ["guided_source_trigger", "manual_import"] : ["scheduled", "admin_run_now", "retry_recovery"],
    preferredExecutionBackend: browserRequired ? "local_or_worker_playwright" : "local_process_or_github_actions",
    scheduleCadence: source.checkCadence,
    enabledState: "enabled",
    priority: source.sourceCategory === "meetings" || source.sourceCategory === "officials" ? "high" : "normal",
    lastCheckedAt: health?.lastCheckedAt ?? null,
    lastSuccessfulRetrievalAt: health?.lastSuccessAt ?? null,
    lastChangedAt: null,
    nextDueAt: health?.nextCheckAt ?? null,
    health: health?.healthStatus ?? "unknown",
    freshnessStatus: health?.freshnessStatus ?? "not_checked",
    sessionHealth: browserRequired ? "session_not_required_for_public_adapter" : "not_applicable",
    manualFallback: browserRequired ? "guided public browser run or official file upload" : "manual official URL/file import",
    reviewRequirement: "parser_outputs_and_quarantine_require_review_before_public_promotion",
    publicRuntimeEligibility: source.sourceCategory === "officials" ? "current-officials-runtime.json compact records only" : "compact_reviewed_runtime_artifacts_only",
    legalTechnicalRestrictions: "Do not bypass CAPTCHA, paywalls, access controls, bot protection, or private endpoints.",
    acquisitionMode: mode,
    triggerPath: mode === "automated" || mode === "automated_with_fallback" ? "scheduled_or_admin_run_now" : mode === "admin_guided" ? "guided_browser_or_manual_import" : "manual_review",
    reviewReason: mode === "blocked" ? health?.failureReason ?? "Source blocked." : null,
  };
});

const unknown = records.filter((record) => record.acquisitionMode === "unknown" || !record.triggerPath);
const coverage = {
  generatedAt,
  totals: {
    sources: records.length,
    sourcesWithAcquisitionMode: records.filter((record) => Boolean(record.acquisitionMode)).length,
    sourcesWithTriggerPath: records.filter((record) => Boolean(record.triggerPath)).length,
    automated: records.filter((record) => record.acquisitionMode === "automated").length,
    automatedWithFallback: records.filter((record) => record.acquisitionMode === "automated_with_fallback").length,
    adminGuided: records.filter((record) => record.acquisitionMode === "admin_guided").length,
    manualImport: records.filter((record) => record.acquisitionMode === "manual_import").length,
    blocked: records.filter((record) => record.acquisitionMode === "blocked").length,
    unknown: unknown.length,
    playwrightRequired: records.filter((record) => record.browserRequirement !== "not_required").length,
  },
  unknown,
};

const health = {
  generatedAt,
  records: records.map((record) => ({
    sourceId: record.sourceId,
    provider: record.provider,
    acquisitionAdapter: record.acquisitionAdapter,
    acquisitionMode: record.acquisitionMode,
    triggerPath: record.triggerPath,
    health: record.health,
    sessionHealth: record.sessionHealth,
    manualFallback: record.manualFallback,
  })),
  totals: coverage.totals,
};

writeFileSync(REGISTRY_PATH, `${JSON.stringify({ generatedAt, records }, null, 2)}\n`);
writeFileSync(COVERAGE_PATH, `${JSON.stringify(coverage, null, 2)}\n`);
writeFileSync(ADAPTER_HEALTH_PATH, `${JSON.stringify(health, null, 2)}\n`);

if (unknown.length) {
  console.error(`Ingestion registry has ${unknown.length} unknown sources.`);
  process.exit(1);
}

console.log(`Generated ingestion capability registry with ${records.length} sources.`);
console.log(JSON.stringify(coverage.totals, null, 2));
