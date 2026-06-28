import "@/lib/env/load-local-env";
import { spawnSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const SUMMARY_PATH = path.join(GENERATED_DIR, "public-meeting-cache-blob-sync.json");
const LOCAL_AUDIT_PATH = path.join(GENERATED_DIR, "public-meeting-cache-storage-audit.json");
const BLOB_AUDIT_PATH = path.join(GENERATED_DIR, "public-meeting-cache-storage-audit.vercel_blob.json");
const BLOB_EXPORT_AUDIT_PATH = path.join(GENERATED_DIR, "public-meeting-cache-storage-export.vercel_blob.json");
const MANIFEST_PATH = path.join(GENERATED_DIR, "public-meeting-cache-manifest.json");

type JsonRecord = Record<string, unknown>;

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    env,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(result.error?.message ?? `${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

function envWithBackend(backend: "local_filesystem" | "vercel_blob") {
  return { ...process.env, PUBLIC_MEETING_CACHE_STORAGE_BACKEND: backend };
}

async function networkAvailable() {
  try {
    await lookup("blob.vercel-storage.com");
  } catch {
    await lookup("vercel.com");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://vercel.com", { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (!response.ok && ![301, 302, 303, 307, 308].includes(response.status)) {
      throw new Error(`HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function credentialState() {
  const hasClassicToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const hasOidcPair = Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
  return {
    hasClassicToken,
    hasOidcPair,
    canWriteBlob: hasClassicToken || hasOidcPair,
    bucketConfigured: Boolean(process.env.PUBLIC_MEETING_CACHE_STORAGE_BUCKET ?? process.env.BLOB_STORE_ID),
  };
}

function writeSummary(status: string, extra: JsonRecord = {}) {
  const manifest = readJson<JsonRecord>(MANIFEST_PATH, {});
  const localAudit = readJson<JsonRecord>(LOCAL_AUDIT_PATH, {});
  const blobAudit = readJson<JsonRecord>(BLOB_AUDIT_PATH, {});
  const blobExportAudit = readJson<JsonRecord>(BLOB_EXPORT_AUDIT_PATH, {});
  const localTotals = (localAudit.totals as JsonRecord | undefined) ?? {};
  const blobTotals = (blobAudit.totals as JsonRecord | undefined) ?? {};
  const blobExportTotals = (blobExportAudit.totals as JsonRecord | undefined) ?? {};
  const credentials = credentialState();
  const summary = {
    generatedAt: new Date().toISOString(),
    status,
    credentials: {
      classicBlobTokenConfigured: credentials.hasClassicToken,
      oidcTokenAndStoreConfigured: credentials.hasOidcPair,
      bucketConfigured: credentials.bucketConfigured,
      sensitiveValuesIncluded: false,
    },
    manifest: {
      cachedDocuments: (manifest.audit as JsonRecord | undefined)?.totals
        ? ((manifest.audit as JsonRecord).totals as JsonRecord).cachedDocuments
        : null,
      cachedBytes: (manifest.audit as JsonRecord | undefined)?.totals ? ((manifest.audit as JsonRecord).totals as JsonRecord).cachedBytes : null,
    },
    localObjectCache: {
      status: localAudit.status ?? null,
      objectsPresent: localTotals.objectsPresent ?? null,
      missingObjects: localTotals.missingObjects ?? null,
      objectSizeMismatches: localTotals.objectSizeMismatches ?? null,
      providerErrors: localTotals.providerErrors ?? null,
    },
    vercelBlob: {
      status: blobAudit.status ?? null,
      objectsPresent: blobTotals.objectsPresent ?? null,
      missingObjects: blobTotals.missingObjects ?? null,
      objectSizeMismatches: blobTotals.objectSizeMismatches ?? null,
      providerErrors: blobTotals.providerErrors ?? null,
      lastExportStatus: blobExportAudit.status ?? null,
      lastExportObjectsWritten: blobExportTotals.objectsWritten ?? null,
      lastExportProviderErrors: blobExportTotals.providerErrors ?? null,
      lastExportProviderErrorSamples: ((blobExportAudit.samples as JsonRecord | undefined)?.providerErrors as unknown[] | undefined)?.slice(0, 5) ?? [],
    },
    nextRequiredAction:
      status === "blocked_blob_credentials_missing"
        ? "Create/provision Vercel Blob and set BLOB_READ_WRITE_TOKEN, or set VERCEL_OIDC_TOKEN plus BLOB_STORE_ID, then rerun npm run meetings:cache-storage:blob-sync."
        : status === "blob_sync_incomplete"
          ? "Resolve the reported Blob provider errors, then rerun npm run meetings:cache-storage:blob-sync. The upload is content-hash idempotent."
        : null,
    ...extra,
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const smokeOnly = hasArg("--smoke-only");
  await networkAvailable();

  run("npm", ["run", "meetings:cache-manifest"]);
  run("npm", ["run", "meetings:cache-storage:audit"], envWithBackend("local_filesystem"));

  const localAudit = readJson<{ status?: string; totals?: { missingObjects?: number; objectSizeMismatches?: number; providerErrors?: number } }>(LOCAL_AUDIT_PATH, {});
  if (
    localAudit.status !== "object_cache_complete" ||
    (localAudit.totals?.missingObjects ?? 0) > 0 ||
    (localAudit.totals?.objectSizeMismatches ?? 0) > 0 ||
    (localAudit.totals?.providerErrors ?? 0) > 0
  ) {
    writeSummary("blocked_local_cache_incomplete");
    process.exitCode = 1;
    return;
  }

  const credentials = credentialState();
  if (!credentials.canWriteBlob) {
    run("npm", ["run", "meetings:cache-storage:blob-audit"], envWithBackend("vercel_blob"));
    writeSummary("blocked_blob_credentials_missing");
    process.exitCode = 1;
    return;
  }

  run("npm", ["run", "meetings:cache-storage:blob-smoke"], envWithBackend("vercel_blob"));
  const smokeAudit = readJson<{ totals?: { providerErrors?: number; hashMismatches?: number; missingSourceFiles?: number; objectsWritten?: number; objectsAlreadyPresent?: number } }>(
    BLOB_EXPORT_AUDIT_PATH,
    {},
  );
  const smokeObjectsAccountedFor = (smokeAudit.totals?.objectsWritten ?? 0) + (smokeAudit.totals?.objectsAlreadyPresent ?? 0);
  if (
    (smokeAudit.totals?.providerErrors ?? 0) > 0 ||
    (smokeAudit.totals?.hashMismatches ?? 0) > 0 ||
    (smokeAudit.totals?.missingSourceFiles ?? 0) > 0 ||
    smokeObjectsAccountedFor === 0
  ) {
    run("npm", ["run", "meetings:cache-storage:blob-audit"], envWithBackend("vercel_blob"));
    writeSummary("blocked_blob_smoke_failed");
    process.exitCode = 1;
    return;
  }

  run("npm", ["run", "meetings:cache-storage:blob-audit"], envWithBackend("vercel_blob"));
  if (smokeOnly) {
    writeSummary("blob_smoke_complete");
    return;
  }

  run("npm", ["run", "meetings:cache-storage:blob-export"], envWithBackend("vercel_blob"));
  run("npm", ["run", "meetings:cache-storage:blob-audit"], envWithBackend("vercel_blob"));

  const blobAudit = readJson<{ status?: string }>(BLOB_AUDIT_PATH, {});
  writeSummary(blobAudit.status === "object_cache_complete" ? "blob_sync_complete" : "blob_sync_incomplete");
  if (blobAudit.status !== "object_cache_complete") process.exitCode = 1;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  writeSummary("blocked_network_or_runtime_error", { error: message });
  process.exitCode = 1;
});
