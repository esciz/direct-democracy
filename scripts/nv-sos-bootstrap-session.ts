import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { isAccessDeniedBlocked, isIncapsulaBlocked, NV_SOS_PATHS, stripHtml } from "../lib/nv-sos/pipeline";

const DEFAULT_BOOTSTRAP_URL = "https://www.nvsos.gov/SOSCandidateServices/AnonymousAccess/CEFDSearchUU/CertCandList.aspx";

type BootstrapClassification = "success_html" | "blocked_incapsula" | "blocked_access_denied" | "forbidden" | "error";

type StorageState = {
  cookies?: Array<{ name?: string; value?: string; domain?: string; path?: string }>;
};

function classifyBootstrapResponse(status: number | null, contentType: string | null, body: string): BootstrapClassification {
  if (isIncapsulaBlocked(body)) return "blocked_incapsula";
  if (isAccessDeniedBlocked(body)) return "blocked_access_denied";
  if (status === 403) return "forbidden";
  if (status === null || status < 200 || status >= 300) return "error";
  if (contentType?.toLowerCase().includes("text/html") || /<html|<!doctype html/i.test(body)) return "success_html";
  return "error";
}

function extractTitle(html: string) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function bodySnippet(html: string) {
  return stripHtml(html).replace(/\s+/g, " ").slice(0, 500) || html.replace(/\s+/g, " ").slice(0, 500);
}

async function readSavedCookies() {
  const state = JSON.parse(await readFile(NV_SOS_PATHS.storageStateFile, "utf8")) as StorageState;
  return Array.isArray(state.cookies) ? state.cookies : [];
}

async function main() {
  const targetUrl = process.argv.find((arg) => arg.startsWith("https://")) ?? DEFAULT_BOOTSTRAP_URL;
  const { chromium, request } = await import("playwright");
  await mkdir(path.dirname(NV_SOS_PATHS.storageStateFile), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

  console.log("Browser opened for Nevada SoS session bootstrap.");
  console.log(`Target URL: ${targetUrl}`);
  console.log("Complete any challenge in the browser window. You may reload or navigate as needed.");
  console.log("When the page looks usable, return here and press Enter. The browser will stay open until then.");

  const rl = createInterface({ input, output });
  await rl.question("Press Enter to save and validate this session...");
  rl.close();

  await context.storageState({ path: NV_SOS_PATHS.storageStateFile });
  const cookies = await readSavedCookies();
  console.log(`Saved storage state to ${path.relative(process.cwd(), NV_SOS_PATHS.storageStateFile)}.`);
  console.log(`Cookies saved: ${cookies.length}${cookies.length ? ` (${cookies.map((cookie) => cookie.name).filter(Boolean).join(", ")})` : ""}`);

  const testContext = await request.newContext({
    storageState: NV_SOS_PATHS.storageStateFile,
    extraHTTPHeaders: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  let httpStatus: number | null = null;
  let contentType: string | null = null;
  let body = "";
  let classification: BootstrapClassification = "error";
  let fetchError: string | null = null;

  try {
    const response = await testContext.get(targetUrl, { timeout: 60000, maxRedirects: 10 });
    httpStatus = response.status();
    contentType = response.headers()["content-type"] ?? null;
    body = await response.text();
    classification = classifyBootstrapResponse(httpStatus, contentType, body);
  } catch (error) {
    fetchError = error instanceof Error ? error.message : "Unknown validation fetch error";
  } finally {
    await testContext.dispose();
    await browser.close();
  }

  console.log(`Validation HTTP status: ${httpStatus ?? "n/a"}`);
  console.log(`Validation content type: ${contentType ?? "n/a"}`);
  console.log(`Validation title: ${extractTitle(body) ?? "n/a"}`);
  console.log(`Validation body snippet: ${bodySnippet(body) || "n/a"}`);
  if (fetchError) console.log(`Validation error: ${fetchError}`);
  console.log(`Validation classification: ${classification}`);

  if (classification === "success_html") {
    console.log("Session usable. Now run nv-sos:all.");
  } else {
    console.log("Session not usable. Do not run nv-sos:all yet.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
