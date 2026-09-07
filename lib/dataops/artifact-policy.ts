import { createHash } from "node:crypto";
import path from "node:path";

// Only civic collection state belongs in this namespace. Identity, sessions,
// resident submissions, browser state, environment files and logs are excluded.
const CIVIC_NAMES = /^(?:public-meeting(?:s|-)|public-civic-cases|public-cases-|public-court-cases-|nevada-(?:community-|financial-|political-ad|political-ads|public-organizations|case-|jurisdiction-meeting-|meeting-source-|rss-source-)|current-officials(?:\.|-)|officials-|carson-city-(?:officials-|source-verification-)|nv-sos-|events-runtime|event-freshness-|issues-(?:runtime|audit|report)|accountability-graph|projects-runtime|project-status-|voting-cards(?:\.|-)|citizen-vote-questions|governing-body-|minutes-extraction-|upcoming-meeting-|vote-attribution-|decision-review-|decision-title-|public-decision-|dataops-(?:source-registry|monitoring-status|freshness-audit|reprocessing-runs|pipeline-(?:run|targeted-run))|rss-source-registry|source-adapter-health|browse-preview-audit|public-site-integrity-audit|meetings-pipeline-)/;
const CACHE_DIRS = new Set(["public-meeting-document-cache", "public-meeting-document-text-cache", "public-meeting-ocr-text-cache", "public-meeting-adapter-text-cache", "nv-sos-text"]);
const RAW_DIRS = new Set(["nevada-financials", "nevada-organizations", "official-directories", "public-meetings", "nv-sos"]);
const RELEASE_EXCLUDES = /(?:document-cache|document-text|ocr-results|ocr-text|cache-|source-documents|processing-state|refresh-state|review-candidates|review-queue|fetch-log|expanded-fetch-log|extracted-documents|structured-documents|source-evidence|source-manifest|source-reconciliation)/;
const OFFICIAL_AD_IMPORTS = new Set(["data/imports/political-ads/fec-collection-state.json", "data/imports/political-ads/fec-nevada-independent-expenditures.json"]);
const RELEASE_EXACT_EXCLUDES = new Set(["accountability-graph.json", "public-meetings.json", "public-meeting-items.json", "public-meeting-voting-cards.json", "public-meeting-official-actions.json", "public-civic-cases.json"]);
const PUBLIC_MEETING_SOURCE_ROOT = /^data\/(?:generated\/public-meeting-(?:document-cache|document-text-cache|ocr-text-cache|adapter-text-cache)|raw\/public-meetings|manual-sources\/public-meetings)\//;

export function safeArtifactPath(value: string) {
  if (!value || value.includes("\\") || value.includes("\0") || path.posix.isAbsolute(value) || path.posix.normalize(value) !== value || value.split("/").some((part) => part === ".." || part.startsWith("."))) return false;
  if (/(?:private|cookie|credential|password|token|secret|identity|voter-file| 2\.|\.codex-sandbox\.|\.unknown\.|\.local-network-enabled\.)/i.test(value)) return false;
  // Public work/study/special sessions are meetings, not authentication state.
  // Permit only those phrases in dedicated public-document namespaces. Check
  // each path component independently; another "session" still rejects it.
  // Source URL slugs retain encoded spaces as "-20work-20session".
  const sessionPath = PUBLIC_MEETING_SOURCE_ROOT.test(value) ? value.split("/").map(part => part
    .replace(/%20/gi, " ")
    .replace(/(^|[-_ ])20(?=[a-z])/gi, "$1")
    .replace(/(^|[-_ ])(?:work|study|special)[-_ ]+session(?=$|[-_. ])/gi, "$1meeting")).join("/") : value;
  return !/session/i.test(sessionPath);
}

export function workerArtifactAllowed(value: string) {
  if (!safeArtifactPath(value)) return false;
  const parts = value.split("/");
  if (parts[0] !== "data") return false;
  if (OFFICIAL_AD_IMPORTS.has(value)) return true;
  if (parts[1] === "generated") {
    if (parts.length === 3) return value.endsWith(".json") && CIVIC_NAMES.test(parts[2]);
    return CACHE_DIRS.has(parts[2]) && (/\.(?:txt|pdf|html?|json|bin|docx?)$/i.test(value) || parts[2] === "public-meeting-document-cache" && /\.xml$/i.test(value));
  }
  if (parts[1] === "raw" && RAW_DIRS.has(parts[2])) return /\.(?:json|html?|pdf|txt|csv|zip|xml)$/i.test(value) && !parts.includes("blocked");
  // Only public records already referenced by the document index are selected
  // from manual-sources by the checkpoint builder; never browser session files.
  return parts[1] === "manual-sources" && parts[2] === "public-meetings" && /\.(?:pdf|html?|txt|json)$/i.test(value);
}

export function releaseArtifactAllowed(value: string) {
  const parts = value.split("/");
  return workerArtifactAllowed(value) && parts.length === 3 && parts[1] === "generated" && !RELEASE_EXCLUDES.test(parts[2]) && !RELEASE_EXACT_EXCLUDES.has(parts[2]);
}

export const REQUIRED_RELEASE_FILES = ["accountability-graph-runtime.json", "events-runtime.json", "public-meeting-items-runtime.json", "voting-cards-runtime.json", "voting-cards.json", "issues-runtime.json", "nevada-financial-coverage.json", "nevada-political-ads.json", "nevada-public-organizations.json", "public-site-integrity-audit.json"].map((name) => `data/generated/${name}`);

export type ArtifactEntry = { path: string; sha256: string; bytes: number; objectKey: string };
export type CivicManifest = { schemaVersion: 1; kind: "worker" | "release"; id: string; createdAt: string; sourceCommit: string; sourceDirty?: boolean; files: ArtifactEntry[]; metrics: Record<string, number>; coverageComplete: boolean };

export function validateManifest(value: CivicManifest, kind: CivicManifest["kind"]) {
  if (value.schemaVersion !== 1 || value.kind !== kind || !/^[a-f0-9]{64}$/.test(value.id) || !Number.isFinite(Date.parse(value.createdAt)) || !Array.isArray(value.files) || !value.files.length || value.files.length > 50_000) throw new Error("invalid_civic_manifest");
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.sourceCommit) || (value.sourceDirty !== undefined && typeof value.sourceDirty !== "boolean") || typeof value.coverageComplete !== "boolean" || !value.metrics || Array.isArray(value.metrics) || Object.values(value.metrics).some(metric => !Number.isSafeInteger(metric) || metric < 0)) throw new Error("invalid_manifest_provenance_or_metrics");
  if (value.id !== civicManifestId(value)) throw new Error("manifest_identity_mismatch");
  const paths = new Set<string>();
  const sizes = new Map<string, number>();
  for (const entry of value.files) {
    if (!(kind === "worker" ? workerArtifactAllowed(entry.path) : releaseArtifactAllowed(entry.path)) || paths.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > 1_000_000_000) throw new Error(`invalid_artifact_entry:${entry.path}`);
    if (entry.objectKey !== `civic-data/objects/${entry.sha256}` && entry.objectKey !== `public-meeting-cache/sha256/${entry.sha256.slice(0, 2)}/${entry.sha256}`) throw new Error("invalid_artifact_object_key");
    if (sizes.has(entry.sha256) && sizes.get(entry.sha256) !== entry.bytes) throw new Error("inconsistent_content_hash_size");
    sizes.set(entry.sha256, entry.bytes);
    paths.add(entry.path);
  }
  if (kind === "release") for (const required of REQUIRED_RELEASE_FILES) if (!paths.has(required)) throw new Error(`missing_release_artifact:${required}`);
  return value;
}


export function civicManifestId(manifest: Omit<CivicManifest, "id"> | CivicManifest) {
  // Bind immutable release identity to the actual storage mapping and all public
  // provenance/coverage metadata, not just file bytes and the source commit.
  const canonical = {
    schemaVersion: manifest.schemaVersion, kind: manifest.kind, createdAt: manifest.createdAt,
    sourceCommit: manifest.sourceCommit, sourceDirty: manifest.sourceDirty ?? false,
    files: manifest.files.slice().sort((a, b) => a.path.localeCompare(b.path)).map(entry => ({ path: entry.path, sha256: entry.sha256, bytes: entry.bytes, objectKey: entry.objectKey })),
    metrics: Object.fromEntries(Object.entries(manifest.metrics).sort(([a], [b]) => a.localeCompare(b))),
    coverageComplete: manifest.coverageComplete,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
