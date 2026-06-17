import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
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
  type NvSosFetchLogEntry,
} from "../lib/nv-sos/pipeline";

type CookieExport = {
  cookies?: Array<{
    name?: string;
    value?: string;
    domain?: string;
    path?: string;
  }>;
};

function cookieHeaderFromExport(value: CookieExport) {
  const cookies = Array.isArray(value.cookies) ? value.cookies : [];
  return cookies
    .filter((cookie) => cookie.name && typeof cookie.value === "string" && (!cookie.domain || cookie.domain.includes("nvsos.gov")))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function readCookieHeader() {
  const cookieExport = await readJsonFile<CookieExport | null>(NV_SOS_PATHS.cookieFile, null);
  if (cookieExport) {
    const header = cookieHeaderFromExport(cookieExport);
    if (header) return { header, usedCookieFile: true };
  }

  const storageState = await readJsonFile<CookieExport | null>(NV_SOS_PATHS.storageStateFile, null);
  if (storageState) {
    const header = cookieHeaderFromExport(storageState);
    if (header) return { header, usedCookieFile: true };
  }

  return { header: null, usedCookieFile: false };
}

function classifyContent(contentType: string | null, body: Buffer, httpStatus: number | null): NvSosFetchLogEntry["status"] {
  if (httpStatus === 404) return "not_found";
  const bodyStart = body.subarray(0, Math.min(body.length, 4096)).toString("utf8");
  if (isIncapsulaBlocked(bodyStart)) return "blocked_incapsula";
  if (isAccessDeniedBlocked(bodyStart)) return "blocked_access_denied";
  if (isNevadaSosNotFoundPage(bodyStart)) return "not_found";
  if (httpStatus !== null && (httpStatus < 200 || httpStatus >= 300)) return "error";
  if (contentType?.toLowerCase().includes("application/pdf") || body.subarray(0, 5).toString("utf8") === "%PDF-") return "success_pdf";
  if (contentType?.toLowerCase().includes("text/html") || /<html|<!doctype html/i.test(bodyStart)) return "success_html";
  return "error";
}

async function fetchSource(source: Awaited<ReturnType<typeof readNvSosSources>>[number], cookieHeader: string | null, usedCookieFile: boolean): Promise<NvSosFetchLogEntry> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(source.source_url, {
      redirect: "follow",
      headers: {
        "User-Agent": "DirectDemocracySourceIngestion/0.1 (+https://directdemocracy.local; public-record-cache)",
        Accept: "text/html,application/pdf,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });
    const arrayBuffer = await response.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type");
    const status = classifyContent(contentType, body, response.status);
    const digest = sha256(body);
    const stem = `${safeFileStem(source.id)}-${digest.slice(0, 12)}`;
    const cachedPath =
      status === "success_pdf"
        ? path.join(NV_SOS_PATHS.pdfDir, `${stem}.pdf`)
        : status === "blocked_incapsula" || status === "blocked_access_denied"
          ? path.join(NV_SOS_PATHS.blockedDir, `${stem}.html`)
          : status === "success_html"
            ? path.join(NV_SOS_PATHS.htmlDir, `${stem}.html`)
            : null;

    if (cachedPath) {
      await writeFile(cachedPath, body);
    }

    return {
      source_id: source.id,
      source_type: source.source_type,
      source_url: source.source_url,
      fetched_at: fetchedAt,
      status,
      http_status: response.status,
      content_type: contentType,
      sha256: digest,
      bytes: body.length,
      cached_path: cachedPath ? path.relative(process.cwd(), cachedPath) : null,
      required_cookies:
        status === "blocked_incapsula"
          ? ["visid_incap_2376352", "incap_ses_413_2376352", "valid Imperva/Incapsula browser challenge state"]
          : status === "blocked_access_denied"
            ? ["valid browser/session state accepted by the SoS edge protection layer"]
            : [],
      used_cookie_file: usedCookieFile,
      error:
        status === "error"
          ? `HTTP ${response.status} with unsupported or unexpected response content-type: ${contentType ?? "unknown"}`
          : status === "blocked_access_denied"
            ? "Access denied by edge protection; response was not cached as successful source HTML."
            : null,
    };
  } catch (error) {
    return {
      source_id: source.id,
      source_type: source.source_type,
      source_url: source.source_url,
      fetched_at: fetchedAt,
      status: "error",
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
  const includeDiscovered = process.argv.includes("--include-discovered");
  const sources = (await readNvSosSources({ includeDiscovered })).filter((source) => source.enabled);
  const { header: cookieHeader, usedCookieFile } = await readCookieHeader();
  const nextEntries: NvSosFetchLogEntry[] = [];

  for (const source of sources) {
    const entry = await fetchSource(source, cookieHeader, usedCookieFile);
    nextEntries.push(entry);
    console.log(`${entry.status.padEnd(18)} ${source.id} ${entry.http_status ?? ""}`);
  }

  await writeFile(NV_SOS_PATHS.fetchLog, `${JSON.stringify(nextEntries, null, 2)}\n`, "utf8");
  const blocked = nextEntries.filter((entry) => entry.status.startsWith("blocked_")).length;
  const success = nextEntries.filter((entry) => entry.status === "success_html" || entry.status === "success_pdf").length;
  console.log(`Nevada SoS fetch complete: ${success} successful, ${blocked} blocked, ${nextEntries.length} attempted.`);
  if (!usedCookieFile && !existsSync(NV_SOS_PATHS.cookieFile) && !existsSync(NV_SOS_PATHS.storageStateFile)) {
    console.log("No data/private/nv-sos-cookies.json or nv-sos-storage-state.json found; blocked pages are expected until session state is provided.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
