import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const CACHE_DIR = path.join(GENERATED_DIR, "public-meeting-document-cache");
const INDEX_PATH = path.join(GENERATED_DIR, "public-meeting-document-cache-index.json");
const RUN_PATH = path.join(GENERATED_DIR, "dataops-retrieval-run.json");
const CHANGE_LOG_PATH = path.join(GENERATED_DIR, "dataops-change-log.json");
const DEFAULT_LIMIT = 25;

type SourceDocument = {
  id: string;
  meetingId: string;
  meetingItemIds?: string[];
  organizationId: string | null;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  cachedPath: string | null;
  contentHash: string | null;
  sizeBytes: number | null;
  retrievalStatus: string;
  priorityBody: boolean;
};

type CacheVersion = {
  sourceVersion: number;
  contentHash: string;
  previousHash: string | null;
  localPath: string;
  contentType: string | null;
  fileSize: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastChangedAt: string | null;
  retrievalAttemptCount: number;
  lastSuccessfulRetrievalAt: string;
  retrievalStatus: "downloaded" | "cached" | "unchanged" | "changed";
};

type CacheRecord = {
  documentId: string;
  meetingId: string;
  meetingItemIds: string[];
  organizationId: string | null;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  stableLocalPath: string;
  contentHash: string;
  contentType: string | null;
  fileSize: number;
  retrievalTimestamp: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastChangedAt: string | null;
  sourceVersion: number;
  previousHash: string | null;
  retrievalAttemptCount: number;
  lastSuccessfulRetrievalAt: string;
  extractionStatus: "pending" | "extracted" | "failed";
  ocrStatus: "not_checked" | "not_required" | "required" | "succeeded" | "failed" | "engine_unavailable";
  versions: CacheVersion[];
};

type RetrievalAttempt = {
  documentId: string;
  sourceUrl: string | null;
  previousHash: string | null;
  currentHash: string | null;
  status:
    | "attempted"
    | "downloaded"
    | "newly_cached"
    | "cached"
    | "unchanged"
    | "updated_content"
    | "metadata_only_change"
    | "superseded"
    | "failed"
    | "unavailable"
    | "blocked_by_network"
    | "security_rejected"
    | "skipped";
  localPath: string | null;
  contentType: string | null;
  fileSize: number | null;
  failureReason: string | null;
};

type SourceWaitDecision = {
  agendaItemId: string;
  meetingDate: string | null;
  nextAction: string;
  sourceRecoveryStatus?: string;
};

function readJson<T>(fileNameOrPath: string, fallback: T): T {
  try {
    const filePath = path.isAbsolute(fileNameOrPath) ? fileNameOrPath : path.join(GENERATED_DIR, fileNameOrPath);
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function hashBuffer(value: Buffer | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extensionFor(document: SourceDocument, contentType: string | null) {
  const source = `${document.sourceUrl ?? ""} ${document.sourcePath ?? ""}`.toLowerCase();
  if (source.includes(".pdf") || contentType?.includes("pdf")) return ".pdf";
  if (source.includes(".json") || contentType?.includes("json")) return ".json";
  if (source.includes(".xml") || contentType?.includes("xml")) return ".xml";
  if (source.includes(".txt") || contentType?.includes("text/plain")) return ".txt";
  return ".html";
}

function absoluteLocalPath(value: string) {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function relativeToWorkspace(value: string) {
  return path.relative(process.cwd(), value);
}

function existingLocalPayload(document: SourceDocument) {
  const local = document.cachedPath ?? document.sourcePath;
  if (!local) return null;
  const absolutePath = absoluteLocalPath(local);
  if (!existsSync(absolutePath)) return null;
  const buffer = readFileSync(absolutePath);
  const stat = statSync(absolutePath);
  return {
    buffer,
    localPath: local,
    contentType: /\.pdf$/i.test(local) ? "application/pdf" : /\.txt$/i.test(local) ? "text/plain" : "text/html",
    fileSize: stat.size,
    contentHash: hashBuffer(buffer),
  };
}

function upsertCacheRecord(input: {
  previous: CacheRecord | undefined;
  document: SourceDocument;
  localPath: string;
  contentHash: string;
  contentType: string | null;
  fileSize: number;
  now: string;
  attemptIncrement: number;
  statusHint: "downloaded" | "cached";
}): CacheRecord {
  const previous = input.previous;
  const previousHash = previous?.contentHash ?? null;
  const changed = Boolean(previousHash && previousHash !== input.contentHash);
  const unchanged = previousHash === input.contentHash;
  const sourceVersion = previous ? (changed ? previous.sourceVersion + 1 : previous.sourceVersion) : 1;
  const firstSeenAt = previous?.firstSeenAt ?? input.now;
  const lastChangedAt = changed ? input.now : previous?.lastChangedAt ?? (previous ? null : input.now);
  const retrievalStatus: CacheVersion["retrievalStatus"] = previous
    ? changed
      ? "changed"
      : unchanged
        ? "unchanged"
        : input.statusHint
    : input.statusHint;
  const version: CacheVersion = {
    sourceVersion,
    contentHash: input.contentHash,
    previousHash,
    localPath: input.localPath,
    contentType: input.contentType,
    fileSize: input.fileSize,
    firstSeenAt,
    lastSeenAt: input.now,
    lastChangedAt,
    retrievalAttemptCount: (previous?.retrievalAttemptCount ?? 0) + input.attemptIncrement,
    lastSuccessfulRetrievalAt: input.now,
    retrievalStatus,
  };
  const versions = previous?.versions?.some((item) => item.contentHash === input.contentHash)
    ? previous.versions.map((item) => (item.contentHash === input.contentHash ? version : item))
    : [...(previous?.versions ?? []), version];
  return {
    documentId: input.document.id,
    meetingId: input.document.meetingId,
    meetingItemIds: input.document.meetingItemIds ?? [],
    organizationId: input.document.organizationId,
    jurisdiction: input.document.jurisdiction,
    documentType: input.document.documentType,
    sourceUrl: input.document.sourceUrl,
    sourcePath: input.document.sourcePath,
    sourceHost: input.document.sourceHost,
    sourcePlatform: input.document.sourcePlatform,
    stableLocalPath: input.localPath,
    contentHash: input.contentHash,
    contentType: input.contentType,
    fileSize: input.fileSize,
    retrievalTimestamp: input.now,
    firstSeenAt,
    lastSeenAt: input.now,
    lastChangedAt,
    sourceVersion,
    previousHash,
    retrievalAttemptCount: (previous?.retrievalAttemptCount ?? 0) + input.attemptIncrement,
    lastSuccessfulRetrievalAt: input.now,
    extractionStatus: previous?.extractionStatus ?? "pending",
    ocrStatus: previous?.ocrStatus ?? "not_checked",
    versions,
  };
}

function argValue(name: string) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

function isPrivateHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  const ipVersion = net.isIP(lower);
  if (!ipVersion) return false;
  if (ipVersion === 4) {
    const parts = lower.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 169 && parts[1] === 254) || parts[0] === 0;
  }
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

function validatePublicHttpUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false as const, reason: "invalid_url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false as const, reason: "unsupported_protocol" };
  if (parsed.username || parsed.password) return { ok: false as const, reason: "credentials_in_url_rejected" };
  if (isPrivateHostname(parsed.hostname)) return { ok: false as const, reason: "private_or_loopback_host_rejected" };
  return { ok: true as const, url: parsed };
}

async function fetchWithTimeout(url: string, timeoutMs: number, maxRedirects: number, userAgent: string) {
  let currentUrl = url;
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const validation = validatePublicHttpUrl(currentUrl);
    if (!validation.ok) throw new Error(`security_rejected:${validation.reason}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": userAgent,
          Accept: "application/pdf,text/html,text/plain,application/json,*/*;q=0.8",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) return response;
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("redirect_loop_or_limit_exceeded");
}

function sourceWaitFilters() {
  if (!process.argv.includes("--source-wait-only")) return null;
  const queue = readJson<{ records?: SourceWaitDecision[]; priorityQueue?: SourceWaitDecision[] }>("decision-review-queue.json", { records: [], priorityQueue: [] });
  const agendaItemIds = new Set<string>();
  for (const item of queue.records?.length ? queue.records : queue.priorityQueue ?? []) {
    if (item.nextAction !== "await_minutes_or_result_source") continue;
    agendaItemIds.add(item.agendaItemId);
  }
  return { agendaItemIds };
}

function matchesSourceWait(document: SourceDocument, sourceWait: ReturnType<typeof sourceWaitFilters>) {
  if (!sourceWait) return true;
  return (document.meetingItemIds ?? []).some((itemId) => sourceWait.agendaItemIds.has(itemId));
}

function matchesFilters(document: SourceDocument, filters: { jurisdiction: string | null; host: string | null; documentType: string | null; priorityOnly: boolean; retryOnly: boolean }, previous: CacheRecord | undefined, sourceWait: ReturnType<typeof sourceWaitFilters>) {
  if (filters.jurisdiction && document.jurisdiction !== filters.jurisdiction) return false;
  if (filters.host && document.sourceHost !== filters.host) return false;
  if (filters.documentType && document.documentType !== filters.documentType) return false;
  if (filters.priorityOnly && !document.priorityBody) return false;
  if (filters.retryOnly && previous) return false;
  if (!matchesSourceWait(document, sourceWait)) return false;
  return true;
}

async function fetchDocument(url: string, timeoutMs: number, maxRedirects: number, userAgent: string, maxBytes: number) {
  const response = await fetchWithTimeout(url, timeoutMs, maxRedirects, userAgent);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength && contentLength > maxBytes) throw new Error("download_size_limit_exceeded");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error("download_size_limit_exceeded");
  return { response, bytes };
}

async function main() {
  const now = new Date().toISOString();
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : DEFAULT_LIMIT;
  const timeoutMs = Number(argValue("timeout-ms") ?? process.env.DATAOPS_RETRIEVAL_TIMEOUT_MS ?? 10_000);
  const maxBytes = Number(argValue("max-bytes") ?? process.env.DATAOPS_MAX_DOWNLOAD_BYTES ?? 50_000_000);
  const maxRedirects = Number(argValue("max-redirects") ?? process.env.DATAOPS_MAX_REDIRECTS ?? 5);
  const userAgent = argValue("user-agent") ?? process.env.DATAOPS_USER_AGENT ?? "DirectDemocracyDataOps/0.1 (+https://directdemocracy.local)";
  const filters = {
    jurisdiction: argValue("jurisdiction") ?? null,
    host: argValue("host") ?? null,
    documentType: argValue("document-type") ?? null,
    priorityOnly: process.argv.includes("--priority-only"),
    retryOnly: process.argv.includes("--retry-only"),
  };
  const sourceWait = sourceWaitFilters();
  const forceRefresh = process.argv.includes("--force-refresh");
  mkdirSync(CACHE_DIR, { recursive: true });

  const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
  const previousIndex = readJson<{ records?: CacheRecord[] }>(INDEX_PATH, { records: [] }).records ?? [];
  const previousByDocument = new Map(previousIndex.map((record) => [record.documentId, record]));
  const recordsByDocument = new Map(previousByDocument);
  const attempts: RetrievalAttempt[] = [];

  for (const document of documents) {
    const localPayload = existingLocalPayload(document);
    if (!localPayload) continue;
    const previous = recordsByDocument.get(document.id);
    const record = upsertCacheRecord({
      previous,
      document,
      localPath: localPayload.localPath,
      contentHash: localPayload.contentHash,
      contentType: localPayload.contentType,
      fileSize: localPayload.fileSize,
      now,
      attemptIncrement: 0,
      statusHint: "cached",
    });
    recordsByDocument.set(document.id, record);
  }

  const candidates = documents
    .filter((document) => {
      if (!document.sourceUrl || existingLocalPayload(document)) return false;
      if (!forceRefresh && previousByDocument.has(document.id)) return false;
      return matchesFilters(document, filters, previousByDocument.get(document.id), sourceWait);
    })
    .sort((left, right) => Number(right.priorityBody) - Number(left.priorityBody) || left.documentType.localeCompare(right.documentType))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_LIMIT);

  for (const document of candidates) {
    const previous = recordsByDocument.get(document.id);
    const attemptBase = {
      documentId: document.id,
      sourceUrl: document.sourceUrl,
      previousHash: previous?.contentHash ?? null,
    };
    try {
      const validation = validatePublicHttpUrl(document.sourceUrl!);
      if (!validation.ok) {
        attempts.push({ ...attemptBase, currentHash: null, status: "security_rejected", localPath: null, contentType: null, fileSize: null, failureReason: validation.reason });
        continue;
      }
      const { response, bytes } = await fetchDocument(document.sourceUrl!, timeoutMs, maxRedirects, userAgent, maxBytes);
      if (response.status === 404 || response.status === 410) {
        attempts.push({ ...attemptBase, currentHash: null, status: "unavailable", localPath: null, contentType: null, fileSize: null, failureReason: `HTTP ${response.status}` });
        continue;
      }
      if (!response.ok) {
        attempts.push({ ...attemptBase, currentHash: null, status: "failed", localPath: null, contentType: response.headers.get("content-type"), fileSize: null, failureReason: `HTTP ${response.status}` });
        continue;
      }
      if (!bytes.length) {
        attempts.push({ ...attemptBase, currentHash: null, status: "failed", localPath: null, contentType: response.headers.get("content-type"), fileSize: 0, failureReason: "empty_response_body" });
        continue;
      }
      const contentType = response.headers.get("content-type");
      const currentHash = hashBuffer(bytes);
      const ext = extensionFor(document, contentType);
      const sourceSlug = slugify(document.sourceUrl! || document.id) || document.id;
      const documentDir = path.join(CACHE_DIR, sourceSlug);
      mkdirSync(documentDir, { recursive: true });
      const absolutePath = path.join(documentDir, `${currentHash}${ext}`);
      if (!existsSync(absolutePath)) writeFileSync(absolutePath, bytes);
      const localPath = relativeToWorkspace(absolutePath);
      const record = upsertCacheRecord({
        previous,
        document,
        localPath,
        contentHash: currentHash,
        contentType,
        fileSize: bytes.length,
        now,
        attemptIncrement: 1,
        statusHint: "downloaded",
      });
      recordsByDocument.set(document.id, record);
      const status = previous?.contentHash === currentHash ? "unchanged" : previous ? "updated_content" : "newly_cached";
      attempts.push({ ...attemptBase, currentHash, status, localPath, contentType, fileSize: bytes.length, failureReason: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "fetch_failed";
      if (message.startsWith("security_rejected:")) {
        attempts.push({ ...attemptBase, currentHash: null, status: "security_rejected", localPath: null, contentType: null, fileSize: null, failureReason: message.replace("security_rejected:", "") });
        continue;
      }
      const blocked = /fetch failed|ENOTFOUND|ECONNREFUSED|network|abort|operation not permitted|not permitted/i.test(message);
      attempts.push({ ...attemptBase, currentHash: null, status: blocked ? "blocked_by_network" : "failed", localPath: null, contentType: null, fileSize: null, failureReason: message });
    }
  }

  const records = [...recordsByDocument.values()].sort((left, right) => left.documentId.localeCompare(right.documentId));
  const changedRecords = records.filter((record) => {
    const previous = previousByDocument.get(record.documentId);
    return Boolean(previous && previous.contentHash !== record.contentHash);
  });
  const audit = {
    generatedAt: now,
    totals: {
      documentsKnown: documents.length,
      cacheRecords: records.length,
      retrievalCandidates: candidates.length,
      attempts: attempts.length,
      downloaded: attempts.filter((attempt) => attempt.status === "downloaded" || attempt.status === "newly_cached").length,
      newlyCached: attempts.filter((attempt) => attempt.status === "newly_cached").length,
      cachedFromLocalSources: records.filter((record) => record.sourcePath || !record.sourceUrl).length,
      unchanged: attempts.filter((attempt) => attempt.status === "unchanged").length,
      changed: attempts.filter((attempt) => attempt.status === "updated_content").length,
      updatedContent: attempts.filter((attempt) => attempt.status === "updated_content").length,
      unavailable: attempts.filter((attempt) => attempt.status === "unavailable").length,
      failed: attempts.filter((attempt) => attempt.status === "failed").length,
      blockedByNetwork: attempts.filter((attempt) => attempt.status === "blocked_by_network").length,
      securityRejected: attempts.filter((attempt) => attempt.status === "security_rejected").length,
      changedCacheRecords: changedRecords.length,
    },
  };

  const changeLog = readJson<{ generatedAt?: string; changes?: unknown[] }>(CHANGE_LOG_PATH, { changes: [] });
  const changes = [
    ...(changeLog.changes ?? []),
    ...attempts
      .filter((attempt) => attempt.status === "downloaded" || attempt.status === "newly_cached" || attempt.status === "updated_content" || attempt.status === "unavailable")
      .map((attempt) => ({ ...attempt, detectedAt: now })),
  ].slice(-1000);

  writeFileSync(INDEX_PATH, `${JSON.stringify({ generatedAt: now, cacheRoot: path.relative(process.cwd(), CACHE_DIR), records, audit }, null, 2)}\n`);
  writeFileSync(RUN_PATH, `${JSON.stringify({ generatedAt: now, runId: `retrieval-${now}`, limit, timeoutMs, maxBytes, maxRedirects, userAgent, filters: { ...filters, forceRefresh, sourceWaitOnly: Boolean(sourceWait), sourceWaitAgendaItems: sourceWait?.agendaItemIds.size ?? 0 }, attempts, audit }, null, 2)}\n`);
  writeFileSync(CHANGE_LOG_PATH, `${JSON.stringify({ generatedAt: now, changes }, null, 2)}\n`);
  console.log(`Retrieved/cached ${records.length} public meeting documents at ${INDEX_PATH}`);
  console.log(JSON.stringify(audit.totals, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
