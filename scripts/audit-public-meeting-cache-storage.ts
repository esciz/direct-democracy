import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { list } from "@vercel/blob";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const INDEX_PATH = path.join(GENERATED_DIR, "public-meeting-document-cache-index.json");
const AUDIT_PATH = path.join(GENERATED_DIR, "public-meeting-cache-storage-audit.json");
const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), "data", "private", "public-meeting-cache-objects");
const BLOB_PREFIX = "public-meeting-cache/sha256";

type StorageBackend = "local_filesystem" | "vercel_blob";

type CacheRecord = {
  documentId: string;
  stableLocalPath: string;
  contentHash: string;
  fileSize: number;
};

type CacheIndex = {
  records?: CacheRecord[];
};

type PriorAudit = {
  generatedAt?: string;
  status?: string;
  totals?: Record<string, number>;
};

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function objectKey(contentHash: string): string {
  return path.posix.join(BLOB_PREFIX, contentHash.slice(0, 2), contentHash);
}

function storageConfig() {
  const rawBackend = process.env.PUBLIC_MEETING_CACHE_STORAGE_BACKEND ?? "local_filesystem";
  const backend: StorageBackend | "unsupported" = rawBackend === "local_filesystem" || rawBackend === "vercel_blob" ? rawBackend : "unsupported";
  return {
    backend,
    rawBackend,
    root: process.env.PUBLIC_MEETING_CACHE_STORAGE_ROOT ?? DEFAULT_STORAGE_ROOT,
    bucketConfigured: Boolean(process.env.PUBLIC_MEETING_CACHE_STORAGE_BUCKET ?? process.env.BLOB_STORE_ID),
    tokenConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)),
  };
}

function outputPath(rawBackend: string): string {
  if (rawBackend === "local_filesystem") return AUDIT_PATH;
  return path.join(GENERATED_DIR, `public-meeting-cache-storage-audit.${rawBackend}.json`);
}

async function listVercelBlobObjects(): Promise<Map<string, number>> {
  const objects = new Map<string, number>();
  let cursor: string | undefined;
  do {
    const result = await list({ prefix: `${BLOB_PREFIX}/`, cursor, limit: 1000 });
    for (const blob of result.blobs) {
      objects.set(blob.pathname, blob.size);
    }
    cursor = result.cursor;
    if (!result.hasMore) break;
  } while (cursor);
  return objects;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const config = storageConfig();
  const index = readJson<CacheIndex>(INDEX_PATH, { records: [] });
  const records = index.records ?? [];
  const priorAudit = readJson<PriorAudit>(outputPath(config.rawBackend), {});

  let sourceFilesPresent = 0;
  let objectsPresent = 0;
  let bytesPresent = 0;
  let objectSizeMismatches = 0;
  let providerErrors = 0;
  const missingObjectSamples: Array<{ documentId: string; objectKey: string }> = [];
  const mismatchSamples: Array<{ documentId: string; objectKey: string; expectedBytes: number; actualBytes: number }> = [];
  const providerErrorSamples: string[] = [];

  if (config.backend === "local_filesystem") {
    for (const record of records) {
      const sourcePath = path.isAbsolute(record.stableLocalPath) ? record.stableLocalPath : path.join(process.cwd(), record.stableLocalPath);
      if (existsSync(sourcePath)) sourceFilesPresent += 1;

      const key = objectKey(record.contentHash);
      const objectPath = path.join(config.root, key);
      if (!existsSync(objectPath)) {
        if (missingObjectSamples.length < 25) missingObjectSamples.push({ documentId: record.documentId, objectKey: key });
        continue;
      }

      const size = statSync(objectPath).size;
      if (size !== record.fileSize) {
        objectSizeMismatches += 1;
        if (mismatchSamples.length < 25) mismatchSamples.push({ documentId: record.documentId, objectKey: key, expectedBytes: record.fileSize, actualBytes: size });
        continue;
      }
      objectsPresent += 1;
      bytesPresent += size;
    }
  } else if (config.backend === "vercel_blob" && config.tokenConfigured) {
    let blobObjects = new Map<string, number>();
    try {
      blobObjects = await listVercelBlobObjects();
    } catch (error) {
      providerErrors += 1;
      providerErrorSamples.push(error instanceof Error ? error.message : String(error));
    }

    if (!providerErrors) {
      for (const record of records) {
        const sourcePath = path.isAbsolute(record.stableLocalPath) ? record.stableLocalPath : path.join(process.cwd(), record.stableLocalPath);
        if (existsSync(sourcePath)) sourceFilesPresent += 1;

        const key = objectKey(record.contentHash);
        const size = blobObjects.get(key);
        if (typeof size !== "number") {
          if (missingObjectSamples.length < 25) missingObjectSamples.push({ documentId: record.documentId, objectKey: key });
          continue;
        }
        if (size !== record.fileSize) {
          objectSizeMismatches += 1;
          if (mismatchSamples.length < 25) mismatchSamples.push({ documentId: record.documentId, objectKey: key, expectedBytes: record.fileSize, actualBytes: size });
          continue;
        }
        objectsPresent += 1;
        bytesPresent += size;
      }
    }
  }

  const status =
    config.backend === "unsupported"
      ? "unsupported_backend"
      : config.backend === "vercel_blob" && !config.tokenConfigured
        ? "storage_unconfigured"
        : providerErrors
          ? "provider_error"
          : objectsPresent === records.length && objectSizeMismatches === 0
            ? "object_cache_complete"
            : objectsPresent > 0
              ? "object_cache_partial"
              : "object_cache_empty";

  const audit = {
    generatedAt,
    status,
    backend: config.rawBackend,
    storageRootFingerprint: config.backend === "local_filesystem" ? path.relative(process.cwd(), config.root) : null,
    bucketConfigured: config.bucketConfigured,
    tokenConfigured: config.backend === "vercel_blob" ? config.tokenConfigured : null,
    priorExport: {
      generatedAt: priorAudit.generatedAt ?? null,
      status: priorAudit.status ?? null,
      objectsWritten: priorAudit.totals?.objectsWritten ?? 0,
      objectsAlreadyPresent: priorAudit.totals?.objectsAlreadyPresent ?? 0,
    },
    totals: {
      cacheRecords: records.length,
      runtimeSourceFilesPresent: sourceFilesPresent,
      objectsPresent,
      bytesPresent,
      missingObjects: Math.max(0, records.length - objectsPresent - objectSizeMismatches),
      objectSizeMismatches,
      providerErrors,
    },
    samples: {
      missingObjects: missingObjectSamples,
      mismatches: mismatchSamples,
      providerErrors: providerErrorSamples,
    },
    operatorCommands: {
      smokeExport: "npm run meetings:cache-storage:smoke",
      fullExport: "npm run meetings:cache-storage:export -- --limit=all",
      audit: "npm run meetings:cache-storage:audit",
      vercelBlobSmoke: "npm run meetings:cache-storage:blob-smoke",
      vercelBlobExport: "npm run meetings:cache-storage:blob-export",
      vercelBlobAudit: "npm run meetings:cache-storage:blob-audit",
    },
    notes: [
      "Use local_filesystem for local durable handoff, or vercel_blob after configuring BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN plus BLOB_STORE_ID.",
      "This audit never prints provider tokens or source document contents.",
    ],
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(outputPath(config.rawBackend), `${JSON.stringify(audit, null, 2)}\n`);
  console.log("Public meeting cache storage audit complete.");
  console.log(JSON.stringify({ status: audit.status, backend: audit.backend, ...audit.totals }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
