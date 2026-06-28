import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  CARSON_EVIDENCE_PATH,
  CARSON_SOURCE_MANIFEST_PATH,
  OFFICIALS_GENERATED_DIR,
  OFFICIALS_RAW_DIR,
  sha256,
  writeEnvironmentArtifact,
  writeEvidenceArtifacts,
  writeJson,
  writeRunArtifact,
  type OfficialsEvidenceArtifact,
} from "@/lib/officials/source-evidence";

function argValue(name: string) {
  const flag = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return flag?.split("=").slice(1).join("=");
}

function requireSafeRelativePath(value: string | null | undefined) {
  if (!value) throw new Error("officials_import_missing_cache_path");
  if (path.isAbsolute(value) || value.includes("..") || value.includes("\0")) throw new Error(`officials_import_unsafe_path:${value}`);
  return value;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function firstExisting(root: string, candidates: string[]) {
  for (const candidate of candidates) {
    const filePath = path.join(root, candidate);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}

const artifactRoot = argValue("--path");
if (!artifactRoot) throw new Error("officials_import_requires_--path=<downloaded-artifact-directory>");
const root = path.resolve(process.cwd(), artifactRoot);
if (!existsSync(root)) throw new Error(`officials_import_path_not_found:${artifactRoot}`);

const evidencePath = firstExisting(root, [
  "data/generated/carson-city-officials-source-evidence.json",
  "carson-city-officials-source-evidence.json",
]);
const manifestPath = firstExisting(root, [
  "data/generated/carson-city-officials-source-manifest.json",
  "carson-city-officials-source-manifest.json",
]);
if (!evidencePath) throw new Error("officials_import_missing_evidence_manifest");

const evidence = readJson<OfficialsEvidenceArtifact>(evidencePath);
const manifest = manifestPath ? readJson<{ runId?: string; sources?: Array<{ sourceId?: string; contentHash?: string | null; cachedPath?: string | null }> }>(manifestPath) : null;
if (manifest?.runId && manifest.runId !== evidence.runId) throw new Error("officials_import_manifest_run_mismatch");
if (!evidence.sources.length) throw new Error("officials_import_empty_sources");

const importedSources = evidence.sources.map((source) => {
  if (!source.verified || !source.contentHash) throw new Error(`officials_import_unverified_source:${source.sourceId}`);
  const cachedRelative = requireSafeRelativePath(source.cachedPath);
  const versionedRelative = source.versionedCachedPath ? requireSafeRelativePath(source.versionedCachedPath) : cachedRelative;
  const sourceFile = firstExisting(root, [cachedRelative, versionedRelative]);
  if (!sourceFile) throw new Error(`officials_import_missing_cached_file:${source.sourceId}`);
  const bytes = readFileSync(sourceFile);
  const actualHash = sha256(bytes);
  if (actualHash !== source.contentHash) throw new Error(`officials_import_hash_mismatch:${source.sourceId}`);
  const manifestRecord = manifest?.sources?.find((record) => record.sourceId === source.sourceId);
  if (manifestRecord?.contentHash && manifestRecord.contentHash !== actualHash) throw new Error(`officials_import_manifest_hash_mismatch:${source.sourceId}`);

  const destinationCurrent = path.join(process.cwd(), cachedRelative);
  const destinationVersioned = path.join(process.cwd(), versionedRelative);
  if (!destinationCurrent.startsWith(OFFICIALS_RAW_DIR) || !destinationVersioned.startsWith(OFFICIALS_RAW_DIR)) {
    throw new Error(`officials_import_destination_outside_cache:${source.sourceId}`);
  }
  mkdirSync(path.dirname(destinationCurrent), { recursive: true });
  mkdirSync(path.dirname(destinationVersioned), { recursive: true });
  copyFileSync(sourceFile, destinationCurrent);
  copyFileSync(sourceFile, destinationVersioned);
  return {
    ...source,
    cachedPath: path.relative(process.cwd(), destinationCurrent),
    versionedCachedPath: path.relative(process.cwd(), destinationVersioned),
  };
});

const importedEvidence: OfficialsEvidenceArtifact = {
  ...evidence,
  sources: importedSources,
  evidencePersistence: {
    mode: "local_cache",
    status: "cache_available",
    durableObjectReferences: [],
    importRequiredBeforePromotion: false,
  },
  provenance: {
    ...evidence.provenance,
    storageBackend: "local_imported_official_source_cache",
    promotionStatus: "eligible",
  },
};

writeJson(CARSON_EVIDENCE_PATH, importedEvidence);
writeJson(CARSON_SOURCE_MANIFEST_PATH, {
  generatedAt: new Date().toISOString(),
  runId: importedEvidence.runId,
  jurisdiction: importedEvidence.jurisdiction,
  evidencePersistence: importedEvidence.evidencePersistence,
  sources: importedSources.map((source) => ({
    sourceId: source.sourceId,
    sourceUrl: source.sourceUrl,
    finalUrl: source.finalUrl,
    cachedPath: source.cachedPath,
    versionedCachedPath: source.versionedCachedPath,
    contentHash: source.contentHash,
    bytes: source.bytes,
    lastSeenAt: source.lastSeenAt,
  })),
  sensitiveValuesIncluded: false,
});
writeRunArtifact("carson-city-officials-source-evidence", importedEvidence.runId, importedEvidence);
writeEnvironmentArtifact("carson-city-officials-source-evidence", importedEvidence.provenance, importedEvidence);
writeJson(path.join(OFFICIALS_GENERATED_DIR, "officials-evidence-import-run.json"), {
  generatedAt: new Date().toISOString(),
  runId: importedEvidence.runId,
  importedSources: importedSources.length,
  sourceHashes: importedSources.map((source) => ({ sourceId: source.sourceId, contentHash: source.contentHash })),
  output: [
    "data/generated/carson-city-officials-source-evidence.json",
    "data/generated/carson-city-officials-source-manifest.json",
  ],
  sensitiveValuesIncluded: false,
});

console.log(JSON.stringify({
  status: "imported",
  runId: importedEvidence.runId,
  importedSources: importedSources.length,
  hashesVerified: importedSources.length,
}, null, 2));
