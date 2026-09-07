import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type FinancialSourceAttempt = {
  url: string;
  attemptedAt: string | null;
  fetchedAt: string | null;
  status: "fetched" | "cached" | "cached_after_error" | "unavailable";
  error: string | null;
  timestampBasis: "retrieval_metadata" | "legacy_file_mtime" | null;
};

export function redactFinancialUrl(value: string) {
  const url = new URL(value);
  for (const key of ["api_key", "access_token", "token", "key"]) url.searchParams.delete(key);
  return url.toString();
}

export function finiteMoney(value: unknown): number | null {
  if (value == null || typeof value === "boolean" || (typeof value === "string" && !value.trim())) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function sourceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  if (!match || !Number.isFinite(Date.parse(`${match[1]}T00:00:00Z`))) return null;
  return match[1];
}

export async function atomicFinancialWrite(file: string, value: string | Buffer) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, file);
}

export async function fetchFinancialBuffer(url: string, options: { timeoutMs?: number; maxBytes?: number; fetchImpl?: typeof fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Financial source request timed out")), options.timeoutMs ?? 20_000);
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: { "User-Agent": "DirectDemocracyDataOps/0.2 (+https://directyourdemocracy.com; public-source-cache)", Accept: "application/json,text/html,application/xml,text/csv;q=0.9,*/*;q=0.8" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > maxBytes) throw new Error(`Financial source exceeds ${maxBytes} byte limit`);
    if (!response.body) throw new Error("Empty financial source response");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        controller.abort();
        throw new Error(`Financial source exceeds ${maxBytes} byte limit`);
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFinancialCache(url: string, cachePath: string, allowNetwork: boolean, options: {
  validate?: (buffer: Buffer) => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  attempts?: FinancialSourceAttempt[];
} = {}) {
  const safeUrl = redactFinancialUrl(url);
  const attemptedAt = allowNetwork ? new Date().toISOString() : null;
  let error: string | null = null;
  if (allowNetwork) {
    try {
      const buffer = await fetchFinancialBuffer(url, options);
      options.validate?.(buffer);
      const fetchedAt = new Date().toISOString();
      await atomicFinancialWrite(cachePath, buffer);
      await atomicFinancialWrite(`${cachePath}.metadata.json`, JSON.stringify({ url: safeUrl, fetchedAt, sha256: createHash("sha256").update(buffer).digest("hex") }));
      const attempt: FinancialSourceAttempt = { url: safeUrl, attemptedAt, fetchedAt, status: "fetched", error: null, timestampBasis: "retrieval_metadata" };
      options.attempts?.push(attempt);
      return { buffer, fetched: true, ...attempt };
    } catch (caught) {
      // Never include request URLs (which may contain credentials) in a fetch error.
      const message = caught instanceof Error ? caught.message : "Financial source retrieval failed";
      error = message.replace(/https?:\/\/\S+/g, "[source URL]");
    }
  }
  try {
    const [buffer, info] = await Promise.all([readFile(cachePath), stat(cachePath)]);
    options.validate?.(buffer);
    let fetchedAt = info.mtime.toISOString();
    let timestampBasis: FinancialSourceAttempt["timestampBasis"] = "legacy_file_mtime";
    try {
      const metadata = JSON.parse(await readFile(`${cachePath}.metadata.json`, "utf8"));
      if (metadata.url === safeUrl && metadata.sha256 === createHash("sha256").update(buffer).digest("hex") && Number.isFinite(Date.parse(metadata.fetchedAt))) {
        fetchedAt = metadata.fetchedAt;
        timestampBasis = "retrieval_metadata";
      }
    } catch { /* Legacy caches retain their actual file timestamp; never use the current check time. */ }
    const attempt: FinancialSourceAttempt = { url: safeUrl, attemptedAt, fetchedAt, status: error ? "cached_after_error" : "cached", error, timestampBasis };
    options.attempts?.push(attempt);
    return { buffer, fetched: false, ...attempt };
  } catch {
    options.attempts?.push({ url: safeUrl, attemptedAt, fetchedAt: null, status: "unavailable", error: error ?? "No valid cached source", timestampBasis: null });
    return null;
  }
}
