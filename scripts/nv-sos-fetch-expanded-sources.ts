import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  ensureNvSosDirs,
  isAccessDeniedBlocked,
  isIncapsulaBlocked,
  isNevadaSosNotFoundPage,
  NV_SOS_PATHS,
  readJsonFile,
  readNvSosSources,
  safeFileStem,
  sha256,
  type NvSosExpandedSource,
  type NvSosFetchLogEntry,
  type NvSosFetchStatus,
  type NvSosSource,
} from "../lib/nv-sos/pipeline";

type CookieExport = {
  cookies?: Array<{ name?: string; value?: string; domain?: string; path?: string }>;
};

type FetchableSource = {
  source_id: string;
  source_type: NvSosSource["source_type"];
  source_url: string;
  enabled: boolean;
  source_stage: "seed" | "expanded";
  referer: string | null;
};

function cookieHeaderFromExport(value: CookieExport) {
  return (Array.isArray(value.cookies) ? value.cookies : [])
    .filter((cookie) => cookie.name && typeof cookie.value === "string" && (!cookie.domain || cookie.domain.includes("nvsos.gov")))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function readCookieHeader() {
  for (const filePath of [NV_SOS_PATHS.cookieFile, NV_SOS_PATHS.storageStateFile]) {
    const cookieExport = await readJsonFile<CookieExport | null>(filePath, null);
    if (!cookieExport) continue;
    const header = cookieHeaderFromExport(cookieExport);
    if (header) return { header, usedCookieFile: true };
  }
  return { header: null, usedCookieFile: false };
}

function classifyContent(contentType: string | null, body: Buffer, httpStatus: number | null): NvSosFetchStatus {
  if (httpStatus === 404) return "not_found";
  if (httpStatus === 403) {
    const bodyStart = body.subarray(0, Math.min(body.length, 4096)).toString("utf8");
    if (isIncapsulaBlocked(bodyStart)) return "blocked_incapsula";
    if (isAccessDeniedBlocked(bodyStart)) return "blocked_access_denied";
    return "forbidden";
  }
  const bodyStart = body.subarray(0, Math.min(body.length, 4096)).toString("utf8");
  if (isIncapsulaBlocked(bodyStart)) return "blocked_incapsula";
  if (isAccessDeniedBlocked(bodyStart)) return "blocked_access_denied";
  if (isNevadaSosNotFoundPage(bodyStart)) return "not_found";
  if (httpStatus !== null && (httpStatus < 200 || httpStatus >= 300)) return "error_http";
  if (contentType?.toLowerCase().includes("application/pdf") || body.subarray(0, 5).toString("utf8") === "%PDF-") return "success_pdf";
  if (contentType?.toLowerCase().includes("text/html") || /<html|<!doctype html/i.test(bodyStart)) return "success_html";
  return "error_http";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSource(source: FetchableSource, cookieHeader: string | null, usedCookieFile: boolean): Promise<NvSosFetchLogEntry> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(source.source_url, {
      redirect: "follow",
      headers: {
        "User-Agent": "DirectDemocracySourceIngestion/0.1 (+https://directdemocracy.local; public-record-cache)",
        Accept: "text/html,application/pdf,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(source.referer ? { Referer: source.referer } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
    const body = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type");
    const status = classifyContent(contentType, body, response.status);
    const digest = sha256(body);
    const stem = `${safeFileStem(source.source_id)}-${digest.slice(0, 12)}`;
    const cachedPath =
      status === "success_pdf"
        ? path.join(NV_SOS_PATHS.pdfDir, `${stem}.pdf`)
        : status === "success_html"
          ? path.join(NV_SOS_PATHS.htmlDir, `${stem}.html`)
          : status.startsWith("blocked_") || status === "forbidden"
            ? path.join(NV_SOS_PATHS.blockedDir, `${stem}.html`)
            : null;

    if (cachedPath) await writeFile(cachedPath, body);

    return {
      source_id: source.source_id,
      source_type: source.source_type,
      source_url: source.source_url,
      source_stage: source.source_stage,
      fetched_at: fetchedAt,
      status,
      http_status: response.status,
      content_type: contentType,
      sha256: digest,
      bytes: body.length,
      cached_path: cachedPath ? path.relative(process.cwd(), cachedPath) : null,
      required_cookies: status.startsWith("blocked_") || status === "forbidden" ? ["valid browser/session state accepted by the SoS edge protection layer"] : [],
      used_cookie_file: usedCookieFile,
      error: status === "error_http" ? `HTTP ${response.status} with unsupported or unexpected response content-type: ${contentType ?? "unknown"}` : null,
    };
  } catch (error) {
    return {
      source_id: source.source_id,
      source_type: source.source_type,
      source_url: source.source_url,
      source_stage: source.source_stage,
      fetched_at: fetchedAt,
      status: "error_fetch",
      http_status: null,
      content_type: null,
      sha256: null,
      bytes: 0,
      cached_path: null,
      required_cookies: [],
      used_cookie_file: usedCookieFile,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    };
  }
}

async function main() {
  await ensureNvSosDirs();
  const [seedSources, expandedSources] = await Promise.all([
    readNvSosSources(),
    readJsonFile<NvSosExpandedSource[]>(NV_SOS_PATHS.expandedSources, []),
  ]);
  const fetchable: FetchableSource[] = [
    ...seedSources.map((source) => ({ source_id: source.id, source_type: source.source_type, source_url: source.source_url, enabled: source.enabled, source_stage: "seed" as const, referer: null })),
    ...expandedSources.map((source) => ({
      source_id: source.source_id,
      source_type: source.source_type,
      source_url: source.source_url,
      enabled: source.enabled,
      source_stage: "expanded" as const,
      referer: source.discovery_context.discovered_from_url,
    })),
  ].filter((source) => source.enabled);
  const deduped = [...new Map(fetchable.map((source) => [source.source_url, source])).values()];
  const { header: cookieHeader, usedCookieFile } = await readCookieHeader();
  const nextEntries: NvSosFetchLogEntry[] = [];

  for (const source of deduped) {
    const entry = await fetchSource(source, cookieHeader, usedCookieFile);
    nextEntries.push(entry);
    console.log(`${entry.status.padEnd(22)} ${source.source_stage.padEnd(8)} ${source.source_id} ${entry.http_status ?? ""}`);
    await delay(125);
  }

  await writeFile(NV_SOS_PATHS.expandedFetchLog, `${JSON.stringify(nextEntries, null, 2)}\n`, "utf8");
  const successHtml = nextEntries.filter((entry) => entry.status === "success_html").length;
  const successPdf = nextEntries.filter((entry) => entry.status === "success_pdf").length;
  const blocked = nextEntries.filter((entry) => entry.status.startsWith("blocked_") || entry.status === "forbidden").length;
  console.log(`Expanded fetch complete: ${successHtml} HTML, ${successPdf} PDFs, ${blocked} blocked, ${nextEntries.length} attempted.`);
  if (!usedCookieFile && !existsSync(NV_SOS_PATHS.cookieFile) && !existsSync(NV_SOS_PATHS.storageStateFile)) {
    console.log("No Nevada SoS cookie or storage state found; blocked pages are expected until session state is provided.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
