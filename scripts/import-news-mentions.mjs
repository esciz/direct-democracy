#!/usr/bin/env node

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [rawKey, ...rawValue] = arg.replace(/^--/, "").split("=");
    return [rawKey, rawValue.join("=") || "true"];
  }),
);

async function probeBaseUrl(candidateUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(candidateUrl, { signal: controller.signal });
    return response.ok || response.status === 404;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveBaseUrl() {
  const explicit = args.baseUrl ?? process.env.CIVIC_IMPORT_BASE_URL;
  if (explicit) return explicit;
  const candidates = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"];
  for (const candidate of candidates) {
    if (await probeBaseUrl(candidate)) return candidate;
  }
  return "http://localhost:3000";
}

const baseUrl = await resolveBaseUrl();
const limit = args.limit ?? process.env.NEWS_MENTION_LIMIT;
const dailyCap = args.dailyCap ?? process.env.NEWS_MENTION_DAILY_CAP;
const pageSize = args.pageSize ?? process.env.NEWS_MENTION_PAGE_SIZE;
const targetType = args.targetType ?? process.env.NEWS_MENTION_TARGET_TYPE;
const targetId = args.targetId ?? process.env.NEWS_MENTION_TARGET_ID;
const dryRun = args.dryRun ?? process.env.NEWS_MENTION_DRY_RUN;
const force = args.force ?? process.env.NEWS_MENTION_FORCE;
const provider = args.provider ?? process.env.NEWS_MENTION_PROVIDER;
const source = args.source ?? args.sourceSlug ?? process.env.NEWS_MENTION_SOURCE;
const secret = args.secret ?? process.env.CIVIC_IMPORT_SECRET;
const timeoutMs = Number(args.timeoutMs ?? process.env.NEWS_MENTION_IMPORT_TIMEOUT_MS ?? "180000");
const url = new URL("/api/admin/news-mentions/import", baseUrl);

if (limit) url.searchParams.set("limit", limit);
if (dailyCap) url.searchParams.set("dailyCap", dailyCap);
if (pageSize) url.searchParams.set("pageSize", pageSize);
if (targetType) url.searchParams.set("targetType", targetType);
if (targetId) url.searchParams.set("targetId", targetId);
if (dryRun) url.searchParams.set("dryRun", dryRun);
if (force) url.searchParams.set("force", force);
if (provider) url.searchParams.set("provider", provider);
if (source) url.searchParams.set("source", source);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);
let response;

try {
  response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ limit, dailyCap, pageSize, targetType, targetId, dryRun, force, provider, source }),
    signal: controller.signal,
  });
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        error: error instanceof Error && error.name === "AbortError" ? `News mention import timed out after ${timeoutMs}ms.` : error instanceof Error ? error.message : String(error),
        url: url.toString(),
      },
      null,
      2,
    ),
  );
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
const text = await response.text();
let payload;

try {
  payload = JSON.parse(text);
} catch {
  payload = text;
}

console.log(JSON.stringify(payload, null, 2));

if (!response.ok) {
  process.exit(1);
}
