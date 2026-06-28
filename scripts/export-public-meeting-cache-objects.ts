import { createHash } from "node:crypto";
import { createReadStream, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { head, put } from "@vercel/blob";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const INDEX_PATH = path.join(GENERATED_DIR, "public-meeting-document-cache-index.json");
const AUDIT_PATH = path.join(GENERATED_DIR, "public-meeting-cache-storage-audit.json");
const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), "data", "private", "public-meeting-cache-objects");
const BLOB_PREFIX = "public-meeting-cache/sha256";

type StorageBackend = "local_filesystem" | "vercel_blob";
type BlobAccess = "public" | "private";

type CacheRecord = {
  documentId: string;
  stableLocalPath: string;
  contentHash: string;
  contentType: string | null;
  fileSize: number;
  sourceUrl: string | null;
  sourceHost: string | null;
  documentType: string;
};

type CacheIndex = {
  generatedAt?: string;
  records?: CacheRecord[];
};

type ExportStatus =
  | "export_complete"
  | "export_partial"
  | "dry_run_complete"
  | "verify_complete"
  | "storage_unconfigured"
  | "unsupported_backend";

type ExportCounters = {
  cacheRecords: number;
  attempted: number;
  sourceFilesFound: number;
  objectsAlreadyPresent: number;
  objectsWritten: number;
  bytesWritten: number;
  missingSourceFiles: number;
  hashMismatches: number;
  providerErrors: number;
};

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function hasArg(name: string): boolean {
  return process.argv.includes(name);
}

function parseLimit(): number | null {
  const raw = getArgValue("--limit");
  if (!raw || raw === "all") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function storageConfig() {
  const rawBackend = process.env.PUBLIC_MEETING_CACHE_STORAGE_BACKEND ?? "local_filesystem";
  const backend: StorageBackend | "unsupported" = rawBackend === "local_filesystem" || rawBackend === "vercel_blob" ? rawBackend : "unsupported";
  const root = process.env.PUBLIC_MEETING_CACHE_STORAGE_ROOT ?? DEFAULT_STORAGE_ROOT;
  const bucket = process.env.PUBLIC_MEETING_CACHE_STORAGE_BUCKET ?? process.env.BLOB_STORE_ID ?? null;
  const tokenConfigured = Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID));
  const access = process.env.PUBLIC_MEETING_CACHE_BLOB_ACCESS === "public" ? "public" : "private";
  return {
    backend,
    rawBackend,
    root,
    access: access as BlobAccess,
    bucketConfigured: Boolean(bucket),
    bucketNameRedacted: bucket ? redact(bucket) : null,
    tokenConfigured,
  };
}

function redact(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

function objectKey(contentHash: string): string {
  return path.posix.join(BLOB_PREFIX, contentHash.slice(0, 2), contentHash);
}

function localObjectPath(root: string, contentHash: string): string {
  return path.join(root, objectKey(contentHash));
}

function resolveLocalPath(stableLocalPath: string): string {
  return path.isAbsolute(stableLocalPath) ? stableLocalPath : path.join(process.cwd(), stableLocalPath);
}

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function writeAudit(audit: unknown) {
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(outputPath(), `${JSON.stringify(audit, null, 2)}\n`);
}

function outputPath(): string {
  if (config.backend === "local_filesystem") return AUDIT_PATH;
  return path.join(GENERATED_DIR, `public-meeting-cache-storage-audit.${config.rawBackend}.json`);
}

function baseAudit(status: ExportStatus, totals: ExportCounters, extra: Record<string, unknown> = {}) {
  return {
    generatedAt,
    status,
    backend: config.rawBackend,
    access: config.backend === "vercel_blob" ? config.access : null,
    storageRootFingerprint: config.backend === "local_filesystem" ? path.relative(process.cwd(), config.root) : null,
    bucketConfigured: config.bucketConfigured,
    bucketNameRedacted: config.bucketNameRedacted,
    tokenConfigured: config.backend === "vercel_blob" ? config.tokenConfigured : null,
    objectKeyScheme: "public-meeting-cache/sha256/<first-two-hex>/<sha256>",
    runMode: { dryRun, verifyOnly, limit: limit ?? "all" },
    totals,
    ...extra,
  };
}

async function blobObjectExists(key: string, fileSize: number): Promise<"present" | "mismatch" | "missing"> {
  try {
    const result = await head(key);
    return result.size === fileSize ? "present" : "mismatch";
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return "missing";
    throw error;
  }
}

async function exportRecord(record: CacheRecord, counters: ExportCounters, samples: Samples) {
  const sourcePath = resolveLocalPath(record.stableLocalPath);
  const key = objectKey(record.contentHash);
  if (!existsSync(sourcePath)) {
    counters.missingSourceFiles += 1;
    if (samples.missing.length < 25) {
      samples.missing.push({
        documentId: record.documentId,
        localPathFingerprint: record.stableLocalPath.split("/").slice(-2).join("/"),
      });
    }
    return;
  }

  counters.sourceFilesFound += 1;
  const sourceSize = statSync(sourcePath).size;
  if (sourceSize !== record.fileSize) {
    counters.hashMismatches += 1;
    if (samples.mismatches.length < 25) {
      samples.mismatches.push({ documentId: record.documentId, reason: `source size ${sourceSize} did not match index size ${record.fileSize}` });
    }
    return;
  }

  if (config.backend === "local_filesystem") {
    const destinationPath = localObjectPath(config.root, record.contentHash);
    if (existsSync(destinationPath)) {
      const objectSize = statSync(destinationPath).size;
      if (objectSize === record.fileSize) {
        counters.objectsAlreadyPresent += 1;
        return;
      }
      counters.hashMismatches += 1;
      if (samples.mismatches.length < 25) {
        samples.mismatches.push({ documentId: record.documentId, reason: `object size ${objectSize} did not match index size ${record.fileSize}` });
      }
      return;
    }

    if (verifyOnly || dryRun) return;

    mkdirSync(path.dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
    const copiedHash = sha256(destinationPath);
    if (copiedHash !== record.contentHash) {
      counters.hashMismatches += 1;
      if (samples.mismatches.length < 25) samples.mismatches.push({ documentId: record.documentId, reason: "copied object hash did not match index hash" });
      return;
    }
    counters.objectsWritten += 1;
    counters.bytesWritten += record.fileSize;
    if (samples.exported.length < 25) samples.exported.push({ documentId: record.documentId, objectKey: key, bytes: record.fileSize });
    return;
  }

  if (config.backend === "vercel_blob") {
    try {
      const state = await blobObjectExists(key, record.fileSize);
      if (state === "present") {
        counters.objectsAlreadyPresent += 1;
        return;
      }
      if (state === "mismatch") {
        counters.hashMismatches += 1;
        if (samples.mismatches.length < 25) samples.mismatches.push({ documentId: record.documentId, reason: "Vercel Blob object exists but size does not match index size" });
        return;
      }
    } catch (error) {
      counters.providerErrors += 1;
      if (samples.providerErrors.length < 25) samples.providerErrors.push({ documentId: record.documentId, reason: error instanceof Error ? error.message : String(error) });
      return;
    }

    if (verifyOnly || dryRun) return;

    try {
      await put(key, createReadStream(sourcePath), {
        access: config.access,
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: record.contentType ?? "application/octet-stream",
        multipart: record.fileSize > 100_000_000,
      });
      counters.objectsWritten += 1;
      counters.bytesWritten += record.fileSize;
      if (samples.exported.length < 25) samples.exported.push({ documentId: record.documentId, objectKey: key, bytes: record.fileSize });
    } catch (error) {
      counters.providerErrors += 1;
      if (samples.providerErrors.length < 25) samples.providerErrors.push({ documentId: record.documentId, reason: error instanceof Error ? error.message : String(error) });
    }
  }
}

type Samples = {
  exported: Array<{ documentId: string; objectKey: string; bytes: number }>;
  missing: Array<{ documentId: string; localPathFingerprint: string }>;
  mismatches: Array<{ documentId: string; reason: string }>;
  providerErrors: Array<{ documentId: string; reason: string }>;
};

const generatedAt = new Date().toISOString();
const dryRun = hasArg("--dry-run");
const verifyOnly = hasArg("--verify-only");
const limit = parseLimit();
const config = storageConfig();
const index = readJson<CacheIndex>(INDEX_PATH, { records: [] });
const records = index.records ?? [];
const selected = limit ? records.slice(0, limit) : records;
const counters: ExportCounters = {
  cacheRecords: records.length,
  attempted: selected.length,
  sourceFilesFound: 0,
  objectsAlreadyPresent: 0,
  objectsWritten: 0,
  bytesWritten: 0,
  missingSourceFiles: 0,
  hashMismatches: 0,
  providerErrors: 0,
};
const samples: Samples = { exported: [], missing: [], mismatches: [], providerErrors: [] };

async function main() {
  if (config.backend === "unsupported") {
    const audit = baseAudit("unsupported_backend", counters, {
      notes: [`Unsupported backend "${config.rawBackend}". Use local_filesystem or vercel_blob.`],
    });
    writeAudit(audit);
    console.log(JSON.stringify(audit, null, 2));
    process.exitCode = 1;
    return;
  }

  if (config.backend === "vercel_blob" && !config.tokenConfigured) {
    const audit = baseAudit("storage_unconfigured", counters, {
      notes: [
        "Vercel Blob export requires BLOB_READ_WRITE_TOKEN, or VERCEL_OIDC_TOKEN plus BLOB_STORE_ID.",
        "No files were uploaded.",
      ],
    });
    writeAudit(audit);
    console.log(JSON.stringify(audit, null, 2));
    process.exitCode = 1;
    return;
  }

  if (config.backend === "local_filesystem") mkdirSync(config.root, { recursive: true });
  for (const record of selected) {
    await exportRecord(record, counters, samples);
  }

  const status: ExportStatus = dryRun
    ? "dry_run_complete"
    : verifyOnly
      ? "verify_complete"
      : counters.missingSourceFiles || counters.hashMismatches || counters.providerErrors
        ? "export_partial"
        : "export_complete";

  const audit = baseAudit(status, counters, {
    samples,
    notes: [
      "This export is additive and does not delete runtime cache files.",
      config.backend === "local_filesystem"
        ? "The local_filesystem backend is a durable object-store-shaped handoff boundary for local development and later cloud upload."
        : "The vercel_blob backend uploads content-hash-addressed meeting evidence to Vercel Blob.",
    ],
  });
  writeAudit(audit);
  console.log(`Public meeting cache storage export wrote ${outputPath()}`);
  console.log(JSON.stringify(counters, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
