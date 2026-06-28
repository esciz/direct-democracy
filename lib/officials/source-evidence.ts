import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, environmentSlug, type AuditEnvironment, type AuditProvenance, type NetworkCapability } from "@/lib/audit/provenance";
import {
  getOfficialDirectorySources,
  getSeededCurrentOfficeholders,
  normalizeOfficialName,
  toCurrentOfficialRuntime,
  type CurrentOfficeholderRecord,
  type CurrentOfficialRuntimeRecord,
  type OfficialDirectorySource,
} from "@/lib/officials/current-officeholders";
import { normalizeWhitespace } from "@/lib/public-meetings/shared";

export type OfficialsRetrievalStatus =
  | "retrieved_verified"
  | "unchanged"
  | "changed"
  | "blocked_by_environment"
  | "source_unavailable"
  | "probable_error_page"
  | "content_mismatch"
  | "parse_failed";

export type OfficialsSourceDiagnosticClassification =
  | "network_available"
  | "environment_dns_blocked"
  | "source_dns_failure"
  | "timeout"
  | "tls_failure"
  | "http_403"
  | "http_404"
  | "http_429"
  | "http_error"
  | "redirect_loop"
  | "probable_error_page"
  | "content_mismatch"
  | "verified_retrieval"
  | "unchanged"
  | "changed"
  | "unknown_error";

export type OfficialHtmlParserEligibility = "eligible" | "needs_playwright" | "rejected";

export type OfficialHtmlVerification = {
  verified: boolean;
  actualContentType: "html" | "text" | "binary" | "empty" | "unknown";
  status: "retrieved_verified" | "probable_error_page" | "content_mismatch";
  rejectionReason: string | null;
  classifierReason: string;
  pageTitle: string | null;
  positiveSignals: string[];
  negativeSignals: string[];
  parserEligibility: OfficialHtmlParserEligibility;
  expectedHostMatched: boolean | null;
  redirectCount: number;
  responseHash: string;
  quarantinePath?: string | null;
};

export type OfficialsSourceEvidenceRecord = {
  sourceId: string;
  jurisdictionId: string;
  jurisdictionName: string;
  sourceName: string;
  sourceUrl: string;
  finalUrl: string | null;
  status: OfficialsRetrievalStatus;
  diagnosticClassification: OfficialsSourceDiagnosticClassification;
  httpStatus: number | null;
  declaredContentType: string | null;
  actualContentType: "html" | "text" | "binary" | "empty" | "unknown";
  verified: boolean;
  cachedPath: string | null;
  versionedCachedPath: string | null;
  contentHash: string | null;
  previousContentHash: string | null;
  bytes: number;
  verification: OfficialHtmlVerification;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  lastCheckedAt: string;
  lastChangedAt: string | null;
  errorMessage: string | null;
  rejectionReason: string | null;
};

export type OfficialsNetworkDiagnostics = {
  generatedAt: string;
  environment: AuditEnvironment;
  runnerType: string;
  commitSha: string | null;
  triggerType: string;
  actor: string;
  dns: "available" | "blocked" | "unknown";
  https: "available" | "blocked" | "unknown";
  networkCapability: NetworkCapability;
  checkedUrls: Array<{
    url: string;
    ok: boolean;
    status: string;
    message: string | null;
  }>;
};

export type OfficialsEvidenceArtifact = {
  generatedAt: string;
  runId: string;
  provenance: AuditProvenance & {
    actor: string;
    trigger: string;
    sourceRetrievalCount: number;
    cacheCount: number;
    parseCount: number;
    promotionStatus: "not_requested" | "eligible" | "not_eligible" | "promoted" | "blocked";
  };
  jurisdiction: "carson-city";
  networkDiagnostics: OfficialsNetworkDiagnostics;
  evidencePersistence: {
    mode: "local_cache" | "github_artifact_handoff" | "durable_public_source_cache";
    status: "cache_available" | "artifact_only_pending_import" | "durable_cache_available" | "not_cached";
    durableObjectReferences: string[];
    importRequiredBeforePromotion: boolean;
  };
  sources: OfficialsSourceEvidenceRecord[];
  totals: {
    attempted: number;
    retrievedVerified: number;
    unchanged: number;
    changed: number;
    cachedFiles: number;
    blockedByEnvironment: number;
    sourceUnavailable: number;
    probableErrorPages: number;
    contentMismatch: number;
  };
  policy: {
    rawHtmlPublic: false;
    publicArtifactsContainRawHtml: false;
    canonicalPromotionRequired: true;
    zeroDownloadSandboxCanPromote: false;
  };
  sensitiveValuesIncluded: false;
};

export type OfficialsParsedRecord = CurrentOfficeholderRecord & {
  evidenceSourceId: string;
  evidenceContentHash: string;
  evidenceCachePath: string;
  parserEvidence: "exact_snippet" | "name_and_title_nearby" | "alternate_source_name_and_title_nearby" | "name_only_needs_review";
};

export type OfficialsReconciliationArtifact = {
  generatedAt: string;
  runId: string;
  provenance: OfficialsEvidenceArtifact["provenance"];
  jurisdiction: "carson-city";
  sourceEvidenceRunId: string;
  parser: {
    recordsParsed: number;
    promotedCandidateRecords: number;
    reviewQueueRecords: number;
    sourceFilesParsed: number;
  };
  comparisons: {
    exactMatches: Array<{ name: string; title: string; sourceId: string }>;
    titleDifferences: Array<{ name: string; previousTitle: string; sourceTitle: string; sourceId: string }>;
    nameDifferences: Array<{ previousName: string; sourceName: string; title: string; sourceId: string }>;
    recordsAbsentFromLiveSource: Array<{ name: string; title: string; sourceId: string; reason: string }>;
    newRecords: Array<{ name: string; title: string; sourceId: string }>;
    duplicateCandidates: Array<{ key: string; records: Array<{ name: string; title: string }> }>;
    actingInterimChanges: Array<{ name: string; title: string; actingOrInterim: boolean }>;
    governingBodyConflicts: string[];
  };
  reviewQueue: Array<{
    id: string;
    severity: "critical" | "warning" | "info";
    type:
      | "missing_source_support"
      | "title_mismatch"
      | "name_mismatch"
      | "duplicate_candidate"
      | "governing_body_conflict"
      | "low_confidence_parse";
    name: string | null;
    title: string | null;
    sourceId: string | null;
    message: string;
  }>;
  promotedRecords: CurrentOfficeholderRecord[];
  runtimeRecords: CurrentOfficialRuntimeRecord[];
  promotion: {
    eligible: boolean;
    status: "eligible" | "blocked";
    blockers: string[];
    requiredCommand: string;
  };
  sensitiveValuesIncluded: false;
};

export type OfficialsPromotionAudit = {
  generatedAt: string;
  runId: string;
  promotedAt: string | null;
  promotedFromRunId: string | null;
  jurisdiction: "carson-city";
  status: "not_promoted" | "promoted" | "blocked";
  recordsPromoted: number;
  conflictsRemaining: number;
  sourceHashes: Array<{ sourceId: string; contentHash: string | null; cachedPath: string | null }>;
  canonicalArtifacts: string[];
  blockers: string[];
  provenance: OfficialsReconciliationArtifact["provenance"];
  sensitiveValuesIncluded: false;
};

export const OFFICIALS_GENERATED_DIR = path.join(process.cwd(), "data", "generated");
export const OFFICIALS_RAW_DIR = path.join(process.cwd(), "data", "raw", "official-directories");
export const CURRENT_FULL_PATH = path.join(OFFICIALS_GENERATED_DIR, "current-officials.json");
export const CURRENT_RUNTIME_PATH = path.join(OFFICIALS_GENERATED_DIR, "current-officials-runtime.json");
export const CURRENT_COMMUNITY_PATH = path.join(OFFICIALS_GENERATED_DIR, "nevada-community-officials.json");
export const CURRENT_CANONICAL_PATH = path.join(OFFICIALS_GENERATED_DIR, "current-officials-canonical.json");
export const OFFICIALS_SOURCE_HEALTH_PATH = path.join(OFFICIALS_GENERATED_DIR, "officials-source-health.json");
export const CARSON_EVIDENCE_PATH = path.join(OFFICIALS_GENERATED_DIR, "carson-city-officials-source-evidence.json");
export const CARSON_SOURCE_MANIFEST_PATH = path.join(OFFICIALS_GENERATED_DIR, "carson-city-officials-source-manifest.json");
export const CARSON_SOURCE_VERIFICATION_DIAGNOSTIC_PATH = path.join(OFFICIALS_GENERATED_DIR, "carson-city-source-verification-diagnostic.json");
export const CARSON_RECONCILIATION_PATH = path.join(OFFICIALS_GENERATED_DIR, "carson-city-officials-source-reconciliation.json");
export const CARSON_PROMOTION_AUDIT_PATH = path.join(OFFICIALS_GENERATED_DIR, "carson-city-officials-promotion-audit.json");
export const OFFICIALS_QUARANTINE_DIR = path.join(process.cwd(), "data", "raw", "official-directories-quarantine");

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function archiveIfExists(filePath: string, label: string) {
  if (!existsSync(filePath)) return null;
  const archiveDir = path.join(OFFICIALS_GENERATED_DIR, "audits", "canonical-archive");
  mkdirSync(archiveDir, { recursive: true });
  const archivePath = path.join(archiveDir, `${new Date().toISOString().replace(/[-.\u003ATZ]/g, "").slice(0, 14)}-${label}.json`);
  renameSync(filePath, archivePath);
  return archivePath;
}

export function officialExecutionEnvironment(downloads = 0): AuditEnvironment {
  const explicit = process.env.OFFICIALS_EXECUTION_ENVIRONMENT;
  if (explicit === "codex_sandbox" || explicit === "local_network_enabled" || explicit === "github_actions" || explicit === "production" || explicit === "unknown") return explicit;
  if (process.env.CODEX_SANDBOX || process.env.CODEX_SANDBOX_NETWORK_DISABLED) return "codex_sandbox";
  if (process.env.GITHUB_ACTIONS === "true") return "github_actions";
  if (process.env.VERCEL_ENV === "production") return "production";
  if (downloads > 0) return "local_network_enabled";
  return "unknown";
}

export function officialNetworkCapability(downloads = 0): NetworkCapability {
  if (process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1" || process.env.CODEX_SANDBOX_NETWORK_DISABLED === "true" || process.env.CODEX_SANDBOX) return "unavailable";
  if (process.env.OFFICIALS_NETWORK_ENABLED === "true" || downloads > 0) return "available";
  return "unknown";
}

export function createOfficialsProvenance(input: {
  artifactName: string;
  generatedAt: string;
  downloads?: number;
  parseCount?: number;
  cacheCount?: number;
  actor?: string;
  trigger?: string;
  workerBackend?: string;
  promotionStatus?: OfficialsEvidenceArtifact["provenance"]["promotionStatus"];
}) {
  const provenance = createAuditProvenance({
    artifactName: input.artifactName,
    generatedAt: input.generatedAt,
    databaseReachability: process.env.DATABASE_URL ? "database_configured_not_checked" : "not_configured",
    storageBackend: "generated_artifact_cache",
    workerBackend: input.workerBackend ?? process.env.OFFICIALS_WORKER_BACKEND ?? "local_or_github_actions_worker",
    executionEnvironment: officialExecutionEnvironment(input.downloads ?? 0),
    networkCapability: officialNetworkCapability(input.downloads ?? 0),
  });
  return {
    ...provenance,
    actor: input.actor ?? process.env.GITHUB_ACTOR ?? process.env.USER ?? "unknown",
    trigger: input.trigger ?? process.env.GITHUB_EVENT_NAME ?? "manual",
    sourceRetrievalCount: input.downloads ?? 0,
    cacheCount: input.cacheCount ?? 0,
    parseCount: input.parseCount ?? 0,
    promotionStatus: input.promotionStatus ?? "not_requested",
  };
}

function versionCachePath(sourceId: string, contentHash: string, generatedAt: string) {
  const stamp = generatedAt.replace(/[-.\u003ATZ]/g, "").slice(0, 14);
  return path.join(OFFICIALS_RAW_DIR, sourceId, `${stamp}-${contentHash.slice(0, 16)}.html`);
}

function currentCachePath(sourceId: string) {
  return path.join(OFFICIALS_RAW_DIR, sourceId, "current.html");
}

function quarantineCachePath(sourceId: string, contentHash: string, generatedAt: string) {
  const stamp = generatedAt.replace(/[-.\u003ATZ]/g, "").slice(0, 14);
  return path.join(OFFICIALS_QUARANTINE_DIR, sourceId, `${stamp}-${contentHash.slice(0, 16)}.html`);
}

function actualContentType(body: string): OfficialsSourceEvidenceRecord["actualContentType"] {
  if (!body.trim()) return "empty";
  const start = body.slice(0, 500).toLowerCase();
  if (start.includes("<!doctype html") || start.includes("<html") || /<body[\s>]/i.test(body)) return "html";
  if (/^[\s\S]{1,5000}$/.test(body) && /[a-z0-9]/i.test(body)) return "text";
  return "binary";
}

function extractPageTitle(body: string) {
  const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? null;
  return title ? normalizeWhitespace(title.replace(/<[^>]+>/g, " ")).slice(0, 200) : null;
}

function expectedHostMatched(source: OfficialDirectorySource | undefined, finalUrl: string | null | undefined) {
  if (!source?.sourceUrl || !finalUrl) return null;
  try {
    const expected = new URL(source.sourceUrl).hostname.replace(/^www\./, "");
    const actual = new URL(finalUrl).hostname.replace(/^www\./, "");
    return actual === expected || actual.endsWith(`.${expected}`);
  } catch {
    return null;
  }
}

function addSignal(signals: string[], signal: string, condition: boolean) {
  if (condition && !signals.includes(signal)) signals.push(signal);
}

function sourceSpecificPositiveSignals(source: OfficialDirectorySource | undefined, text: string, title: string | null) {
  const signals: string[] = [];
  const haystack = normalizedSearchText(`${title ?? ""} ${text}`);
  const sourceType = source?.sourceType;

  addSignal(signals, "carson_city_source_identity", haystack.includes("carson city"));
  addSignal(signals, "department_directory_identity", sourceType === "department_directory" && haystack.includes("department directory"));
  addSignal(signals, "department_directory_department_markers", sourceType === "department_directory" && ["assessor", "city manager", "district attorney", "sheriff", "treasurer", "public works"].filter((needle) => haystack.includes(needle)).length >= 3);
  addSignal(signals, "department_directory_governing_marker", sourceType === "department_directory" && haystack.includes("board of supervisors"));

  addSignal(signals, "board_of_supervisors_identity", sourceType === "governing_body_page" && haystack.includes("board of supervisors"));
  addSignal(signals, "board_members_language", sourceType === "governing_body_page" && haystack.includes("members"));
  addSignal(signals, "board_mayor_supervisor_language", sourceType === "governing_body_page" && haystack.includes("mayor") && haystack.includes("supervisor"));
  addSignal(signals, "board_ward_language", sourceType === "governing_body_page" && /ward\s+[1-4]/.test(haystack));

  addSignal(signals, "staff_directory_identity", sourceType === "staff_directory" && haystack.includes("staff directory"));
  addSignal(signals, "staff_directory_search_controls", sourceType === "staff_directory" && (haystack.includes("search") || haystack.includes("first name") || haystack.includes("last name")));
  addSignal(signals, "staff_directory_department_records", sourceType === "staff_directory" && haystack.includes("department"));
  addSignal(signals, "staff_directory_pagination_or_count", sourceType === "staff_directory" && (haystack.includes("page") || haystack.includes("items") || haystack.includes("results")));

  return signals;
}

function classifyErrorSignals(text: string, httpStatus: number | null) {
  const negativeSignals: string[] = [];
  const fatalSignals: string[] = [];
  addSignal(negativeSignals, `http_${httpStatus}`, Boolean(httpStatus && httpStatus >= 400));
  if (httpStatus && httpStatus >= 400) fatalSignals.push(`http_${httpStatus}`);

  const lowered = text.toLowerCase();
  addSignal(negativeSignals, "generic_javascript_notice", /please enable javascript|enable javascript|javascript must be enabled/.test(lowered));
  addSignal(negativeSignals, "cookie_or_browser_experience_notice", /cookie notice|browser experience|free viewers are required/.test(lowered));
  addSignal(negativeSignals, "captcha_or_bot_challenge", /captcha|bot protection|request blocked|checking your browser|verify you are human/.test(lowered));
  addSignal(negativeSignals, "cloudflare_challenge", /cloudflare/.test(lowered) && /challenge|checking your browser|ray id/.test(lowered));
  addSignal(negativeSignals, "access_denied", /access denied|forbidden|not authorized/.test(lowered));
  addSignal(negativeSignals, "login_required", /login required|sign in required|please sign in/.test(lowered));
  addSignal(negativeSignals, "not_found", /page not found|404 not found|not found/.test(lowered));
  addSignal(negativeSignals, "maintenance_or_unavailable", /service unavailable|temporarily unavailable|maintenance/.test(lowered));

  for (const signal of ["captcha_or_bot_challenge", "cloudflare_challenge", "access_denied", "login_required", "not_found", "maintenance_or_unavailable"]) {
    if (negativeSignals.includes(signal)) fatalSignals.push(signal);
  }

  return { negativeSignals, fatalSignals };
}

export function verifyOfficialHtml(
  body: string,
  declaredContentType: string | null,
  httpStatus: number | null,
  options: { source?: OfficialDirectorySource; finalUrl?: string | null; redirectCount?: number } = {},
): OfficialHtmlVerification {
  const actual = actualContentType(body);
  const declared = declaredContentType ?? "";
  const responseHash = sha256(body);
  const title = extractPageTitle(body);
  const text = htmlToText(body).slice(0, 80_000);
  const expectedHost = expectedHostMatched(options.source, options.finalUrl);
  const { negativeSignals, fatalSignals } = classifyErrorSignals(text, httpStatus);
  const positiveSignals: string[] = [];

  addSignal(positiveSignals, "http_success", Boolean(httpStatus && httpStatus >= 200 && httpStatus < 400));
  addSignal(positiveSignals, "html_content_type_or_magic", actual === "html" || declared.includes("text/html"));
  addSignal(positiveSignals, "meaningful_body_size", body.trim().length >= 5000);
  addSignal(positiveSignals, "recognizable_page_title_or_heading", Boolean(title));
  addSignal(positiveSignals, "expected_host_matched", expectedHost === true);
  positiveSignals.push(...sourceSpecificPositiveSignals(options.source, text, title));

  const sourceMarkers = positiveSignals.filter((signal) => !["http_success", "html_content_type_or_magic", "meaningful_body_size", "recognizable_page_title_or_heading", "expected_host_matched"].includes(signal));
  const contentTypeOk = actual === "html" || declared.includes("text/html");
  const minimalBody = body.trim().length < 500;
  if (minimalBody) fatalSignals.push("content_too_short");
  if (expectedHost === false) fatalSignals.push("unexpected_final_host");

  if (!contentTypeOk) {
    return {
      verified: false,
      actualContentType: actual,
      status: "content_mismatch",
      rejectionReason: `declared_${declared || "unknown"}_actual_${actual}`,
      classifierReason: "content_type_mismatch",
      pageTitle: title,
      positiveSignals,
      negativeSignals,
      parserEligibility: "rejected",
      expectedHostMatched: expectedHost,
      redirectCount: options.redirectCount ?? 0,
      responseHash,
    };
  }

  const genericOnlyNegative = negativeSignals.length > 0 && negativeSignals.every((signal) => signal === "generic_javascript_notice" || signal === "cookie_or_browser_experience_notice");
  const hasSourceIdentity = sourceMarkers.length > 0;
  const strongPositiveScore = positiveSignals.length + sourceMarkers.length;
  const verified = Boolean(httpStatus && httpStatus >= 200 && httpStatus < 400)
    && !minimalBody
    && fatalSignals.length === 0
    && strongPositiveScore >= (options.source ? 5 : 4)
    && (!options.source || hasSourceIdentity)
    && (genericOnlyNegative || negativeSignals.length === 0 || positiveSignals.length > negativeSignals.length + 3);

  if (verified) {
    return {
      verified: true,
      actualContentType: actual,
      status: "retrieved_verified",
      rejectionReason: null,
      classifierReason: genericOnlyNegative ? "verified_with_generic_browser_notice" : "verified_source_signatures",
      pageTitle: title,
      positiveSignals,
      negativeSignals,
      parserEligibility: "eligible",
      expectedHostMatched: expectedHost,
      redirectCount: options.redirectCount ?? 0,
      responseHash,
    };
  }

  const looksLikeJavascriptShell = actual === "html" && body.trim().length >= 500 && sourceMarkers.length === 0 && /<script|__next|app-root|root|please enable javascript/i.test(body);
  const classifierReason = fatalSignals[0] ?? (looksLikeJavascriptShell ? "javascript_shell_without_meaningful_source_content" : "expected_source_markers_absent");
  return {
    verified: false,
    actualContentType: actual,
    status: "probable_error_page",
    rejectionReason: classifierReason,
    classifierReason,
    pageTitle: title,
    positiveSignals,
    negativeSignals,
    parserEligibility: looksLikeJavascriptShell && fatalSignals.length === 0 ? "needs_playwright" : "rejected",
    expectedHostMatched: expectedHost,
    redirectCount: options.redirectCount ?? 0,
    responseHash,
  };
}

type PriorOfficialSourceRecord = {
  sourceId?: string;
  id?: string;
  contentHash?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  lastChangedAt?: string | null;
  cachedPath?: string | null;
  versionedCachedPath?: string | null;
};

function priorSourceById(sourceId: string): PriorOfficialSourceRecord | null {
  const canonical = readJson<{
    sources?: Array<{ sourceId?: string; id?: string; contentHash?: string | null; firstSeenAt?: string | null; lastSeenAt?: string | null; lastChangedAt?: string | null; cachedPath?: string | null; versionedCachedPath?: string | null }>;
    promotion?: { sourceHashes?: Array<{ sourceId?: string; contentHash?: string | null }> };
  }>(CURRENT_CANONICAL_PATH, {});
  const canonicalSource = canonical.sources?.find((record) => (record.sourceId ?? record.id) === sourceId);
  if (canonicalSource?.contentHash) {
    return {
      ...canonicalSource,
      sourceId: canonicalSource.sourceId ?? canonicalSource.id ?? sourceId,
    };
  }
  const canonicalHash = canonical.promotion?.sourceHashes?.find((record) => record.sourceId === sourceId);
  if (canonicalHash?.contentHash) return canonicalHash;

  const evidence = readJson<OfficialsEvidenceArtifact | null>(CARSON_EVIDENCE_PATH, null);
  const source = evidence?.sources.find((record) => record.sourceId === sourceId);
  if (source) return source;
  const health = readJson<{ records?: Array<{ sourceId?: string; contentHash?: string | null; firstSeenAt?: string | null; lastSeenAt?: string | null; lastChangedAt?: string | null }> }>(OFFICIALS_SOURCE_HEALTH_PATH, {});
  return health.records?.find((record) => record.sourceId === sourceId) ?? null;
}

export function buildRetrievedEvidenceRecord(input: {
  source: OfficialDirectorySource;
  generatedAt: string;
  finalUrl: string;
  httpStatus: number;
  declaredContentType: string | null;
  body: string;
  redirectCount?: number;
}) {
  const contentHash = sha256(input.body);
  const previous = priorSourceById(input.source.id);
  const previousHash = previous?.contentHash ?? null;
  const verification = verifyOfficialHtml(input.body, input.declaredContentType, input.httpStatus, {
    source: input.source,
    finalUrl: input.finalUrl,
    redirectCount: input.redirectCount ?? 0,
  });
  const status: OfficialsRetrievalStatus = verification.verified
    ? previousHash && previousHash === contentHash
      ? "unchanged"
      : previousHash
        ? "changed"
        : "retrieved_verified"
    : verification.status;
  const previousVersionedPath = previous && "versionedCachedPath" in previous && typeof previous.versionedCachedPath === "string" ? previous.versionedCachedPath : null;
  const versionedPath = verification.verified && status !== "unchanged" ? versionCachePath(input.source.id, contentHash, input.generatedAt) : null;
  const currentPath = verification.verified ? currentCachePath(input.source.id) : null;
  if (versionedPath) {
    mkdirSync(path.dirname(versionedPath), { recursive: true });
    writeFileSync(versionedPath, input.body);
  }
  if (currentPath && (status !== "unchanged" || !existsSync(currentPath))) {
    mkdirSync(path.dirname(currentPath), { recursive: true });
    writeFileSync(currentPath, input.body);
  }
  let quarantinePath: string | null = null;
  if (!verification.verified && input.body.trim()) {
    const quarantine = quarantineCachePath(input.source.id, contentHash, input.generatedAt);
    mkdirSync(path.dirname(quarantine), { recursive: true });
    writeFileSync(quarantine, input.body);
    quarantinePath = path.relative(process.cwd(), quarantine);
  }
  const relativeVersion = versionedPath ? path.relative(process.cwd(), versionedPath) : null;
  const retainedVersion = relativeVersion ?? (status === "unchanged" ? previousVersionedPath : null);
  const relativeCurrent = currentPath ? path.relative(process.cwd(), currentPath) : null;
  const diagnosticClassification: OfficialsSourceDiagnosticClassification = verification.verified
    ? status === "changed"
      ? "changed"
      : status === "unchanged"
        ? "unchanged"
        : "verified_retrieval"
    : input.httpStatus === 403
      ? "http_403"
      : input.httpStatus === 404
        ? "http_404"
        : input.httpStatus === 429
          ? "http_429"
          : input.httpStatus >= 400
            ? "http_error"
            : verification.status === "probable_error_page"
      ? "probable_error_page"
      : "content_mismatch";
  return {
    sourceId: input.source.id,
    jurisdictionId: input.source.jurisdictionId,
    jurisdictionName: input.source.jurisdictionName,
    sourceName: input.source.sourceName,
    sourceUrl: input.source.sourceUrl,
    finalUrl: input.finalUrl,
    status,
    diagnosticClassification,
    httpStatus: input.httpStatus,
    declaredContentType: input.declaredContentType,
    actualContentType: verification.actualContentType,
    verified: verification.verified,
    cachedPath: relativeCurrent,
    versionedCachedPath: retainedVersion,
    contentHash: verification.verified ? contentHash : null,
    previousContentHash: previousHash,
    bytes: Buffer.byteLength(input.body),
    verification: {
      ...verification,
      quarantinePath,
    },
    firstSeenAt: previous?.firstSeenAt ?? (verification.verified ? input.generatedAt : null),
    lastSeenAt: verification.verified ? input.generatedAt : previous?.lastSeenAt ?? null,
    lastCheckedAt: input.generatedAt,
    lastChangedAt: verification.verified && previousHash !== contentHash ? input.generatedAt : previous?.lastChangedAt ?? null,
    errorMessage: null,
    rejectionReason: verification.rejectionReason,
  } satisfies OfficialsSourceEvidenceRecord;
}

export function buildFailedEvidenceRecord(input: {
  source: OfficialDirectorySource;
  generatedAt: string;
  status: OfficialsRetrievalStatus;
  httpStatus?: number | null;
  declaredContentType?: string | null;
  errorMessage?: string | null;
  rejectionReason?: string | null;
  diagnosticClassification?: OfficialsSourceDiagnosticClassification;
}) {
  const previous = priorSourceById(input.source.id);
  const responseHash = sha256(input.errorMessage ?? `${input.source.id}:${input.status}:${input.rejectionReason ?? "failed"}`);
  return {
    sourceId: input.source.id,
    jurisdictionId: input.source.jurisdictionId,
    jurisdictionName: input.source.jurisdictionName,
    sourceName: input.source.sourceName,
    sourceUrl: input.source.sourceUrl,
    finalUrl: null,
    status: input.status,
    diagnosticClassification: input.diagnosticClassification ?? "unknown_error",
    httpStatus: input.httpStatus ?? null,
    declaredContentType: input.declaredContentType ?? null,
    actualContentType: "unknown",
    verified: false,
    cachedPath: null,
    versionedCachedPath: null,
    contentHash: null,
    previousContentHash: previous?.contentHash ?? null,
    bytes: 0,
    verification: {
      verified: false,
      actualContentType: "unknown",
      status: input.status === "content_mismatch" ? "content_mismatch" : "probable_error_page",
      rejectionReason: input.rejectionReason ?? input.status,
      classifierReason: input.rejectionReason ?? input.diagnosticClassification ?? input.status,
      pageTitle: null,
      positiveSignals: [],
      negativeSignals: [input.diagnosticClassification ?? input.status],
      parserEligibility: "rejected",
      expectedHostMatched: null,
      redirectCount: 0,
      responseHash,
      quarantinePath: null,
    },
    firstSeenAt: previous?.firstSeenAt ?? null,
    lastSeenAt: previous?.lastSeenAt ?? null,
    lastCheckedAt: input.generatedAt,
    lastChangedAt: previous?.lastChangedAt ?? null,
    errorMessage: input.errorMessage ?? null,
    rejectionReason: input.rejectionReason ?? null,
  } satisfies OfficialsSourceEvidenceRecord;
}

export function buildEvidenceArtifact(input: {
  generatedAt: string;
  records: OfficialsSourceEvidenceRecord[];
  networkDiagnostics: OfficialsNetworkDiagnostics;
  actor?: string;
  trigger?: string;
  workerBackend?: string;
}) {
  const downloads = input.records.filter((record) => record.verified).length;
  const cacheCount = input.records.filter((record) => Boolean(record.cachedPath && record.contentHash)).length;
  const provenance = createOfficialsProvenance({
    artifactName: "carson-city-officials-source-evidence",
    generatedAt: input.generatedAt,
    downloads,
    cacheCount,
    actor: input.actor,
    trigger: input.trigger,
    workerBackend: input.workerBackend,
  });
  const artifact: OfficialsEvidenceArtifact = {
    generatedAt: input.generatedAt,
    runId: provenance.runId,
    provenance,
    jurisdiction: "carson-city",
    networkDiagnostics: input.networkDiagnostics,
    evidencePersistence: process.env.PUBLIC_CIVIC_SOURCE_STORAGE === "configured"
      ? {
          mode: "durable_public_source_cache",
          status: cacheCount ? "durable_cache_available" : "not_cached",
          durableObjectReferences: [],
          importRequiredBeforePromotion: false,
        }
      : process.env.GITHUB_ACTIONS === "true"
        ? {
            mode: "github_artifact_handoff",
            status: cacheCount ? "artifact_only_pending_import" : "not_cached",
            durableObjectReferences: [],
            importRequiredBeforePromotion: cacheCount > 0,
          }
        : {
            mode: "local_cache",
            status: cacheCount ? "cache_available" : "not_cached",
            durableObjectReferences: [],
            importRequiredBeforePromotion: false,
          },
    sources: input.records,
    totals: {
      attempted: input.records.length,
      retrievedVerified: input.records.filter((record) => record.status === "retrieved_verified").length,
      unchanged: input.records.filter((record) => record.status === "unchanged").length,
      changed: input.records.filter((record) => record.status === "changed").length,
      cachedFiles: cacheCount,
      blockedByEnvironment: input.records.filter((record) => record.status === "blocked_by_environment").length,
      sourceUnavailable: input.records.filter((record) => record.status === "source_unavailable").length,
      probableErrorPages: input.records.filter((record) => record.status === "probable_error_page").length,
      contentMismatch: input.records.filter((record) => record.status === "content_mismatch").length,
    },
    policy: {
      rawHtmlPublic: false,
      publicArtifactsContainRawHtml: false,
      canonicalPromotionRequired: true,
      zeroDownloadSandboxCanPromote: false,
    },
    sensitiveValuesIncluded: false,
  };
  return artifact;
}

export function sourceVerificationDiagnosticFromEvidence(
  evidence: OfficialsEvidenceArtifact,
  retrievalRun: Record<string, unknown> | null = null,
) {
  const records = evidence.sources.map((record) => ({
    sourceId: record.sourceId,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    status: record.status,
    httpStatus: record.httpStatus,
    finalUrl: record.finalUrl,
    declaredContentType: record.declaredContentType,
    actualContentType: record.actualContentType,
    bytes: record.bytes,
    responseHash: record.verification?.responseHash ?? record.contentHash ?? null,
    contentHash: record.contentHash,
    sourceHashesPresent: Boolean(record.contentHash),
    pageTitle: record.verification?.pageTitle ?? null,
    redirectCount: record.verification?.redirectCount ?? 0,
    positiveSignals: record.verification?.positiveSignals ?? [],
    negativeSignals: record.verification?.negativeSignals ?? [],
    verifierClassification: record.diagnosticClassification,
    classifierReason: record.verification?.classifierReason ?? record.rejectionReason,
    exactClassifierReasonCode: record.verification?.rejectionReason ?? record.rejectionReason,
    parserEligibility: record.verification?.parserEligibility ?? (record.verified ? "eligible" : "rejected"),
    cachedPath: record.cachedPath,
    quarantinePath: record.verification?.quarantinePath ?? null,
    rawHtmlIncluded: false,
  }));
  const rejected = records.filter((record) => record.status === "probable_error_page");
  const legacyFalsePositive = rejected.some((record) => record.exactClassifierReasonCode === "probable_bot_or_login_page" || record.negativeSignals.includes("generic_javascript_notice"));
  return {
    generatedAt: new Date().toISOString(),
    runId: evidence.runId,
    jurisdiction: evidence.jurisdiction,
    retrievalRunId: typeof retrievalRun?.runId === "string" ? retrievalRun.runId : evidence.runId,
    policy: {
      rawHtmlPublic: false,
      publicArtifactsContainRawHtml: false,
      rejectedHtmlStoredOnlyInRawQuarantine: true,
    },
    falsePositiveRule: legacyFalsePositive
      ? {
          status: "identified",
          exactRule: "/captcha|cloudflare|access denied|bot protection|forbidden|request blocked|enable javascript|login required|sign in/i",
          exactToken: "enable javascript",
          finding: "The previous verifier treated a generic JavaScript/browser-experience notice as a fatal bot/login signal even when HTTP status, content type, body size, host, title, and Carson City source markers indicated a valid public HTML page.",
        }
      : {
          status: "not_observed_in_current_records",
          exactRule: "/captcha|cloudflare|access denied|bot protection|forbidden|request blocked|enable javascript|login required|sign in/i",
          exactToken: "enable javascript",
          finding: "Current records did not include enough retained response signals to re-score the previous false positive; future runs preserve source signals and quarantine rejected HTML outside generated artifacts.",
        },
    sources: records,
    totals: {
      attempted: records.length,
      verified: records.filter((record) => record.status === "retrieved_verified" || record.status === "changed" || record.status === "unchanged").length,
      cached: records.filter((record) => Boolean(record.cachedPath && record.contentHash)).length,
      rejected: records.filter((record) => record.status === "probable_error_page").length,
      needsPlaywright: records.filter((record) => record.parserEligibility === "needs_playwright").length,
      sourceHashesPresent: records.filter((record) => record.sourceHashesPresent).length,
    },
    limitations: records.some((record) => !record.pageTitle && record.bytes > 0 && !record.quarantinePath)
      ? ["Previous failed run did not retain raw HTML, so page title and signal matching are available only for new retrievals after this hotfix."]
      : [],
    sensitiveValuesIncluded: false,
  };
}

export function writeSourceVerificationDiagnostic(evidence: OfficialsEvidenceArtifact, retrievalRun: Record<string, unknown> | null = null) {
  const diagnostic = sourceVerificationDiagnosticFromEvidence(evidence, retrievalRun);
  writeJson(CARSON_SOURCE_VERIFICATION_DIAGNOSTIC_PATH, diagnostic);
  writeRunArtifact("carson-city-source-verification-diagnostic", evidence.runId, diagnostic);
  writeEnvironmentArtifact("carson-city-source-verification-diagnostic", evidence.provenance, diagnostic);
  return diagnostic;
}

export function writeRunArtifact(artifactName: string, runId: string, value: unknown) {
  const runPath = path.join(OFFICIALS_GENERATED_DIR, "audits", runId, `${artifactName}.json`);
  writeJson(runPath, value);
  return runPath;
}

export function writeEnvironmentArtifact(artifactName: string, provenance: Pick<AuditProvenance, "executionEnvironment">, value: unknown) {
  const envPath = path.join(OFFICIALS_GENERATED_DIR, `${artifactName}.${environmentSlug(provenance.executionEnvironment)}.json`);
  writeJson(envPath, value);
  return envPath;
}

export function writeEvidenceArtifacts(evidence: OfficialsEvidenceArtifact) {
  const runPath = writeRunArtifact("carson-city-officials-source-evidence", evidence.runId, evidence);
  const envPath = writeEnvironmentArtifact("carson-city-officials-source-evidence", evidence.provenance, evidence);
  if (!canonicalPromotionExists()) writeJson(CARSON_EVIDENCE_PATH, evidence);
  return { runPath, envPath, canonicalPath: canonicalPromotionExists() ? null : CARSON_EVIDENCE_PATH };
}

function htmlToText(html: string) {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"'),
  );
}

function normalizedSearchText(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/"([^"]+)"/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactNormalizedSearchText(value: string) {
  return normalizedSearchText(value).replace(/\band\b/g, "").replace(/\s+/g, " ").trim();
}

function nearbyWindow(text: string, needle: string, radius = 500) {
  const lower = text.toLowerCase();
  const index = lower.indexOf(needle.toLowerCase());
  if (index < 0) return null;
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + needle.length + radius));
}

function titleSupported(record: CurrentOfficeholderRecord, windowText: string) {
  const normalized = normalizedSearchText(windowText);
  const title = normalizedSearchText(record.sourceTitle);
  if (normalized.includes(title)) return true;
  if (record.sourceTitle === "Mayor") return normalized.includes("mayor");
  const ward = record.wardOrDistrict ? normalizedSearchText(record.wardOrDistrict) : null;
  if (record.roleCategory === "governing_body" && ward) return normalized.includes("supervisor") && normalized.includes(ward);
  if (record.roleCategory === "judiciary" && record.wardOrDistrict) {
    const district = normalizedSearchText(record.wardOrDistrict);
    const abbreviated = district.replace(/\bdepartment\b/g, "dept");
    return normalized.includes("justice of the peace") && (normalized.includes(district) || normalized.includes(abbreviated));
  }
  if (/chief financial officer/i.test(record.sourceTitle)) return normalized.includes("chief financial officer") || normalized.includes("cfo");
  if (record.roleCategory === "department_leadership") {
    const department = record.department ? compactNormalizedSearchText(record.department) : "";
    const compactWindow = compactNormalizedSearchText(windowText);
    const titleHasChief = /\bchief\b/i.test(record.sourceTitle);
    const titleHasDirector = /\bdirector\b/i.test(record.sourceTitle);
    if (department && compactWindow.includes(department)) {
      if (titleHasChief && normalized.includes("chief")) return true;
      if (titleHasDirector && normalized.includes("director")) return true;
      if (record.sourceTitle === "Public Guardian" && normalized.includes("public guardian")) return true;
    }
  }
  return false;
}

function evidenceTextFor(record: OfficialsSourceEvidenceRecord) {
  if (!record.cachedPath || !record.contentHash || !existsSync(path.join(process.cwd(), record.cachedPath))) return null;
  const html = readFileSync(path.join(process.cwd(), record.cachedPath), "utf8");
  return htmlToText(html);
}

export function parseCarsonCityOfficialsFromEvidence(evidence: OfficialsEvidenceArtifact, generatedAt = new Date().toISOString()) {
  const baseline = getSeededCurrentOfficeholders(generatedAt);
  const sourceConfigById = new Map(getOfficialDirectorySources(generatedAt).map((source) => [source.id, source]));
  const sourceText = new Map<string, { record: OfficialsSourceEvidenceRecord; text: string; normalized: string }>();
  for (const source of evidence.sources.filter((record) => record.verified && record.cachedPath && record.contentHash)) {
    const text = evidenceTextFor(source);
    if (text) sourceText.set(source.sourceId, { record: source, text, normalized: normalizedSearchText(text) });
  }

  const parsed: OfficialsParsedRecord[] = [];
  const reviewQueue: OfficialsReconciliationArtifact["reviewQueue"] = [];

  function candidateSources(record: CurrentOfficeholderRecord) {
    const primary = sourceText.get(record.sourceId);
    const rest = [...sourceText.values()].filter((source) => source.record.sourceId !== record.sourceId);
    return primary ? [primary, ...rest] : rest;
  }

  function sourceSupportFor(record: CurrentOfficeholderRecord) {
    const candidates = candidateSources(record);
    let nameOnlyMatch: { source: { record: OfficialsSourceEvidenceRecord; text: string; normalized: string }; matchedName: string; window: string } | null = null;
    for (const source of candidates) {
      const names = [record.publicDisplayName, ...record.aliases].map(normalizedSearchText).filter(Boolean);
      const matchedName = names.find((name) => source.normalized.includes(name));
      if (!matchedName) continue;
      const window = nearbyWindow(source.text, record.publicDisplayName) ?? record.aliases.map((alias) => nearbyWindow(source.text, alias)).find(Boolean) ?? source.text;
      const snippetSupported = source.normalized.includes(normalizedSearchText(record.sourceSnippet ?? ""));
      const titleNearby = titleSupported(record, window);
      if (snippetSupported || titleNearby) return { source, matchedName, window, snippetSupported, titleNearby };
      nameOnlyMatch ??= { source, matchedName, window };
    }
    return nameOnlyMatch ? { ...nameOnlyMatch, snippetSupported: false, titleNearby: false } : null;
  }

  for (const record of baseline) {
    if (!candidateSources(record).length) {
      reviewQueue.push({
        id: `review-${record.id}-missing-source`,
        severity: record.roleCategory === "governing_body" ? "critical" : "warning",
        type: "missing_source_support",
        name: record.publicDisplayName,
        title: record.sourceTitle,
        sourceId: record.sourceId,
        message: "No verified cached source file is available for this current-officeholder record.",
      });
      continue;
    }
    const support = sourceSupportFor(record);
    if (!support) {
      reviewQueue.push({
        id: `review-${record.id}-name-missing`,
        severity: record.roleCategory === "governing_body" ? "critical" : "warning",
        type: "missing_source_support",
        name: record.publicDisplayName,
        title: record.sourceTitle,
        sourceId: record.sourceId,
        message: "The cached official source did not contain the expected official name.",
      });
      continue;
    }
    const { source, window, snippetSupported, titleNearby } = support;
    const parserEvidence = snippetSupported
      ? "exact_snippet"
      : titleNearby
        ? source.record.sourceId === record.sourceId
          ? "name_and_title_nearby"
          : "alternate_source_name_and_title_nearby"
        : "name_only_needs_review";
    if (parserEvidence === "name_only_needs_review") {
      reviewQueue.push({
        id: `review-${record.id}-title-low-confidence`,
        severity: record.roleCategory === "governing_body" ? "critical" : "warning",
        type: "low_confidence_parse",
        name: record.publicDisplayName,
        title: record.sourceTitle,
        sourceId: record.sourceId,
        message: "The cached official source contained the name, but the expected title was not found near it.",
      });
      continue;
    }
    const sourceConfig = sourceConfigById.get(source.record.sourceId);
    parsed.push({
      ...record,
      sourceUrl: source.record.sourceUrl,
      sourcePageTitle: source.record.sourceName,
      sourceType: sourceConfig?.sourceType ?? record.sourceType,
      sourceId: source.record.sourceId,
      sourceHash: source.record.contentHash,
      sourceSnippet: normalizeWhitespace(window).slice(0, 500),
      firstSeenAt: source.record.firstSeenAt ?? generatedAt,
      lastSeenAt: source.record.lastSeenAt ?? generatedAt,
      lastVerifiedAt: source.record.lastSeenAt ?? generatedAt,
      confidence: parserEvidence === "exact_snippet" ? 0.98 : 0.9,
      reviewStatus: "source_backed",
      evidenceSourceId: source.record.sourceId,
      evidenceContentHash: source.record.contentHash!,
      evidenceCachePath: source.record.cachedPath!,
      parserEvidence,
    });
  }

  return { parsed, reviewQueue, sourceFilesParsed: sourceText.size };
}

function runtimeKey(record: Pick<CurrentOfficeholderRecord, "publicDisplayName" | "sourceTitle">) {
  return `${normalizeOfficialName(record.publicDisplayName)}:${normalizedSearchText(record.sourceTitle)}`;
}

function recordKeyFromRuntime(record: CurrentOfficialRuntimeRecord) {
  return `${normalizeOfficialName(record.name)}:${normalizedSearchText(record.title)}`;
}

export function reconcileCarsonCityOfficials(input: {
  evidence: OfficialsEvidenceArtifact;
  existingRuntime: CurrentOfficialRuntimeRecord[];
  generatedAt?: string;
}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const { parsed, reviewQueue, sourceFilesParsed } = parseCarsonCityOfficialsFromEvidence(input.evidence, generatedAt);
  const existingByKey = new Map(input.existingRuntime.map((record) => [recordKeyFromRuntime(record), record]));
  const parsedByKey = new Map(parsed.map((record) => [runtimeKey(record), record]));
  const exactMatches = parsed.filter((record) => existingByKey.has(runtimeKey(record))).map((record) => ({ name: record.publicDisplayName, title: record.sourceTitle, sourceId: record.sourceId }));
  const absent = input.existingRuntime
    .filter((record) => /carson city/i.test(`${record.jurisdiction} ${record.communityName}`) && !parsedByKey.has(recordKeyFromRuntime(record)))
    .map((record) => ({ name: record.name, title: record.title, sourceId: record.source_type ?? "unknown", reason: "No verified cached source support in this reconciliation run." }));
  const duplicateGroups = new Map<string, CurrentOfficeholderRecord[]>();
  for (const record of parsed) {
    const key = normalizeOfficialName(`${record.publicDisplayName}:${record.sourceTitle}`);
    const list = duplicateGroups.get(key) ?? [];
    list.push(record);
    duplicateGroups.set(key, list);
  }
  const duplicateCandidates = [...duplicateGroups.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([key, records]) => ({ key, records: records.map((record) => ({ name: record.publicDisplayName, title: record.sourceTitle })) }));

  for (const duplicate of duplicateCandidates) {
    reviewQueue.push({
      id: `review-duplicate-${duplicate.key}`,
      severity: "critical",
      type: "duplicate_candidate",
      name: null,
      title: null,
      sourceId: null,
      message: `Duplicate current-officeholder candidate detected for ${duplicate.key}.`,
    });
  }

  const governing = parsed.filter((record) => record.roleCategory === "governing_body");
  const mayors = governing.filter((record) => record.sourceTitle === "Mayor");
  const wardSupervisors = governing.filter((record) => /^Supervisor, Ward [1-4]$/.test(record.sourceTitle));
  const wards = new Set(wardSupervisors.map((record) => record.wardOrDistrict));
  const blockers: string[] = [];
  if (input.evidence.provenance.executionEnvironment === "codex_sandbox") blockers.push("Codex sandbox evidence cannot be promoted as canonical network evidence.");
  if (input.evidence.provenance.networkCapability !== "available") blockers.push("Promotion requires network-enabled evidence provenance.");
  if (input.evidence.sources.length < 3 || input.evidence.sources.some((source) => !source.verified || !source.cachedPath || !source.contentHash)) {
    blockers.push("All configured Carson City official sources must be verified and cached before promotion.");
  }
  if (mayors.length !== 1) blockers.push(`Expected exactly one Carson City mayor; parsed ${mayors.length}.`);
  if (wardSupervisors.length !== 4 || wards.size !== 4) blockers.push(`Expected Ward 1 through Ward 4 supervisors exactly once; parsed ${wardSupervisors.length}.`);
  const maurice = parsed.filter((record) => normalizeOfficialName(record.publicDisplayName).includes("maurice") || record.aliases.some((alias) => normalizeOfficialName(alias).includes("maurice")));
  if (maurice.length !== 1) blockers.push(`Maurice White duplicate/merge guard failed: ${maurice.length} records.`);
  if (parsed.some((record) => record.roleCategory === "department_leadership" && record.selectionMethod === "elected")) blockers.push("A department leadership record is incorrectly labeled elected.");
  if (!parsed.some((record) => record.sourceTitle === "Acting Fire Chief" && record.actingOrInterim)) blockers.push("Acting/interim title was not preserved for Acting Fire Chief.");
  if (parsed.some((record) => !record.sourceUrl || !record.lastVerifiedAt || !record.sourceHash)) blockers.push("Every promoted public official must include source URL, content hash, and last verified metadata.");
  if (reviewQueue.some((item) => item.severity === "critical")) blockers.push("Critical review items remain unresolved.");

  const reconciliation: OfficialsReconciliationArtifact = {
    generatedAt,
    runId: input.evidence.runId,
    provenance: {
      ...input.evidence.provenance,
      parseCount: parsed.length,
      promotionStatus: blockers.length ? "not_eligible" : "eligible",
    },
    jurisdiction: "carson-city",
    sourceEvidenceRunId: input.evidence.runId,
    parser: {
      recordsParsed: parsed.length,
      promotedCandidateRecords: parsed.length,
      reviewQueueRecords: reviewQueue.length,
      sourceFilesParsed,
    },
    comparisons: {
      exactMatches,
      titleDifferences: [],
      nameDifferences: [],
      recordsAbsentFromLiveSource: absent,
      newRecords: [],
      duplicateCandidates,
      actingInterimChanges: parsed.filter((record) => record.actingOrInterim).map((record) => ({ name: record.publicDisplayName, title: record.sourceTitle, actingOrInterim: true })),
      governingBodyConflicts: blockers.filter((blocker) => /mayor|Ward|Maurice|department leadership|Acting/.test(blocker)),
    },
    reviewQueue,
    promotedRecords: parsed,
    runtimeRecords: toCurrentOfficialRuntime(parsed),
    promotion: {
      eligible: blockers.length === 0,
      status: blockers.length ? "blocked" : "eligible",
      blockers,
      requiredCommand: `npm run officials:promote -- --jurisdiction=carson-city --run-id=${input.evidence.runId} --confirm=promote-carson-city-officials`,
    },
    sensitiveValuesIncluded: false,
  };
  return reconciliation;
}

export function writeReconciliationArtifacts(reconciliation: OfficialsReconciliationArtifact) {
  writeRunArtifact("carson-city-officials-source-reconciliation", reconciliation.runId, reconciliation);
  writeEnvironmentArtifact("carson-city-officials-source-reconciliation", reconciliation.provenance, reconciliation);
  if (!canonicalPromotionExists()) writeJson(CARSON_RECONCILIATION_PATH, reconciliation);
}

export function officialSourceHealthFromEvidence(input: {
  generatedAt: string;
  sources: OfficialsSourceEvidenceRecord[];
  currentOfficialCount: number;
  canonicalPromotion?: Record<string, unknown> | null;
  provenance?: OfficialsEvidenceArtifact["provenance"];
}) {
  const records = input.sources.map((source) => ({
    sourceId: source.sourceId,
    jurisdictionId: source.jurisdictionId,
    jurisdictionName: source.jurisdictionName,
    sourceUrl: source.sourceUrl,
    sourceType: getOfficialDirectorySources(input.generatedAt).find((item) => item.id === source.sourceId)?.sourceType ?? "reviewed_manual_source",
    parserStatus: "implemented",
    retrievalStatus: source.verified ? source.status : source.status,
    cachedPath: source.cachedPath,
    contentHash: source.contentHash,
    lastCheckedAt: source.lastCheckedAt,
    lastSuccessfulRetrievalAt: source.verified ? source.lastSeenAt : null,
    lastChangedAt: source.lastChangedAt,
    lastParsedAt: input.generatedAt,
    lastVerifiedAt: source.verified ? source.lastSeenAt : null,
    nextDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    sourceHealth: source.verified ? "healthy" : source.status === "blocked_by_environment" ? "blocked" : "unknown",
    currentOfficialCount: source.jurisdictionId === "carson-city" ? input.currentOfficialCount : 0,
    changedOfficeholders: 0,
    titlesChanged: 0,
    possibleVacancies: 0,
    parseFailures: source.status === "parse_failed" ? 1 : 0,
    manualFallback: source.verified ? "verified_cached_source" : "network_enabled_retrieval_or_reviewed_manual_source",
  }));
  return {
    generatedAt: input.generatedAt,
    records,
    audit: {
      totals: {
        sources: records.length,
        healthy: records.filter((record) => record.sourceHealth === "healthy").length,
        partial: 0,
        blocked: records.filter((record) => record.sourceHealth === "blocked").length,
        unknown: records.filter((record) => record.sourceHealth === "unknown").length,
        withCachedHtml: records.filter((record) => Boolean(record.cachedPath)).length,
      },
    },
    provenance: input.provenance,
    canonicalPromotion: input.canonicalPromotion ?? null,
  };
}

export function writeEnvironmentSourceHealth(evidence: OfficialsEvidenceArtifact, currentOfficialCount: number) {
  const health = officialSourceHealthFromEvidence({
    generatedAt: evidence.generatedAt,
    sources: evidence.sources,
    currentOfficialCount,
    provenance: evidence.provenance,
  });
  writeEnvironmentArtifact("officials-source-health", evidence.provenance, health);
  return health;
}

export function readCanonicalOfficials() {
  return readJson<{ generatedAt?: string; records?: CurrentOfficeholderRecord[]; sources?: OfficialDirectorySource[] | OfficialsSourceEvidenceRecord[]; promotion?: Record<string, unknown> } | null>(CURRENT_CANONICAL_PATH, null);
}

export function canonicalPromotionExists() {
  const canonical = readCanonicalOfficials();
  return Boolean(canonical?.promotion);
}

export function writeCurrentOfficialsArtifacts(input: {
  generatedAt: string;
  records: CurrentOfficeholderRecord[];
  sources: OfficialDirectorySource[] | Array<Record<string, unknown>>;
  sourcePolicy: string;
  promotion?: Record<string, unknown> | null;
  relatedActionCounts?: (records: CurrentOfficialRuntimeRecord[]) => CurrentOfficialRuntimeRecord[];
}) {
  const runtime = input.relatedActionCounts ? input.relatedActionCounts(toCurrentOfficialRuntime(input.records)) : toCurrentOfficialRuntime(input.records);
  const full = {
    generatedAt: input.generatedAt,
    schemaVersion: 2,
    sourcePolicy: input.sourcePolicy,
    sources: input.sources,
    records: input.records,
    promotion: input.promotion ?? null,
  };
  writeJson(CURRENT_FULL_PATH, full);
  writeJson(CURRENT_RUNTIME_PATH, { generatedAt: input.generatedAt, schemaVersion: 2, records: runtime, promotion: input.promotion ?? null });
  writeJson(CURRENT_COMMUNITY_PATH, { generatedAt: input.generatedAt, schemaVersion: 2, source: "data/generated/current-officials-runtime.json", records: runtime, promotion: input.promotion ?? null });
  return { full, runtime };
}
