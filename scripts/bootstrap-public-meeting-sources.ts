import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { chromium, type BrowserContext, type Page } from "playwright";

type ManifestEntry = {
  providerId: string;
  sourceName: string;
  officialSourceUrl: string | null;
  downloadedAt: string | null;
  fileType: string;
  meetingDate: string | null;
  meetingTitle: string | null;
  governingBody: string | null;
  sourceKind: "agenda" | "packet" | "minutes" | "video" | "vote" | "bill" | "journal" | "rawHtml" | "apiJson";
  localPath: string;
  notes: string | null;
  parserStatus: "cached" | "parsed" | "partially_parsed" | "needs_review" | "needs_parser" | "source_missing" | "unavailable" | "skip";
};

type ManifestFailure = {
  url: string;
  label: string;
  sourceKind: ManifestEntry["sourceKind"] | null;
  reason: string;
  attemptedAt: string;
};

type ProviderConfig = {
  id: string;
  sourceName: string;
  governingBody: string;
  officialSourceUrl: string;
  folderMap: Record<ManifestEntry["sourceKind"], string>;
  pages: Array<{
    url: string;
    sourceKind: ManifestEntry["sourceKind"];
    titleHint: string;
    notes: string;
  }>;
  includeHosts: string[];
};

type SavedStats = {
  pagesSaved: number;
  filesSaved: number;
  jsonSaved: number;
  manifestEntries: number;
  skipped: number;
  failed: number;
  needsReview: number;
};

const ROOT = process.cwd();
const CACHE_ROOT = path.join(ROOT, "data/manual-sources/public-meetings");
const FORCE = process.argv.includes("--force");
const INTERACTIVE = process.argv.includes("--interactive");
const HEADED = process.argv.includes("--headed") || INTERACTIVE;
const SAVE_STORAGE_STATE = process.argv.includes("--save-storage-state") || INTERACTIVE;
const BLOCKED_RETRY = process.argv.includes("--blocked-retry") || INTERACTIVE;
const storageStateArg = process.argv.find((arg) => arg.startsWith("--storage-state="))?.split("=").slice(1).join("=");
const DEFAULT_STORAGE_STATE = path.join(CACHE_ROOT, "_browser-state", "public-meetings-storage-state.json");
const STORAGE_STATE = path.resolve(ROOT, storageStateArg ?? DEFAULT_STORAGE_STATE);
const MAX_LINK_DOWNLOADS_PER_PROVIDER = Number(process.env.PLAYWRIGHT_MEETING_BOOTSTRAP_MAX_DOWNLOADS ?? "16");

const CIVIC_FOLDER_MAP: Record<ManifestEntry["sourceKind"], string> = {
  agenda: "agendas",
  packet: "agenda-packets",
  minutes: "minutes",
  video: "raw-pages",
  vote: "metadata",
  bill: "metadata",
  journal: "metadata",
  rawHtml: "raw-pages",
  apiJson: "metadata",
};

const LEGISLATIVE_FOLDER_MAP: Record<ManifestEntry["sourceKind"], string> = {
  agenda: "raw-pages",
  packet: "raw-pages",
  minutes: "minutes",
  video: "raw-pages",
  vote: "votes",
  bill: "bills",
  journal: "journals",
  rawHtml: "raw-pages",
  apiJson: "metadata",
};

const BASE_PROVIDERS: ProviderConfig[] = [
  {
    id: "reno-city-council",
    sourceName: "Reno City Council",
    governingBody: "Reno City Council",
    officialSourceUrl: "https://reno.primegov.com/public/portal",
    includeHosts: ["reno.primegov.com"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://reno.primegov.com/public/portal",
        sourceKind: "rawHtml",
        titleHint: "Reno City Council PrimeGov public portal",
        notes: "Rendered public PrimeGov portal page. Review for City Council regular meeting archive links.",
      },
    ],
  },
  {
    id: "nv-legislature",
    sourceName: "Nevada Legislature",
    governingBody: "Nevada Legislature",
    officialSourceUrl: "https://www.leg.state.nv.us/App/Calendar/A/",
    includeHosts: ["www.leg.state.nv.us", "leg.state.nv.us"],
    folderMap: LEGISLATIVE_FOLDER_MAP,
    pages: [
      {
        url: "https://www.leg.state.nv.us/App/Calendar/A/",
        sourceKind: "agenda",
        titleHint: "Nevada Legislature meeting calendar",
        notes: "Rendered public legislative calendar page.",
      },
      {
        url: "https://www.leg.state.nv.us/App/NELIS/REL/83rd2025",
        sourceKind: "bill",
        titleHint: "Nevada Legislature 83rd Session NELIS",
        notes: "Rendered public NELIS session page for bill actions and session materials.",
      },
    ],
  },
  {
    id: "nv-senate",
    sourceName: "Nevada Senate",
    governingBody: "Nevada Senate",
    officialSourceUrl: "https://www.leg.state.nv.us/",
    includeHosts: ["www.leg.state.nv.us", "leg.state.nv.us"],
    folderMap: LEGISLATIVE_FOLDER_MAP,
    pages: [
      {
        url: "https://www.leg.state.nv.us/App/NELIS/REL/83rd2025/House/Senate",
        sourceKind: "rawHtml",
        titleHint: "Nevada Senate 83rd Session page",
        notes: "Rendered public Senate session page if available; otherwise saved for review.",
      },
      {
        url: "https://www.leg.state.nv.us/App/Legislator/A/Senate/Current",
        sourceKind: "rawHtml",
        titleHint: "Nevada Senate current public page",
        notes: "Rendered public Senate page for session/source discovery.",
      },
    ],
  },
  {
    id: "nv-assembly",
    sourceName: "Nevada Assembly",
    governingBody: "Nevada Assembly",
    officialSourceUrl: "https://www.leg.state.nv.us/",
    includeHosts: ["www.leg.state.nv.us", "leg.state.nv.us"],
    folderMap: LEGISLATIVE_FOLDER_MAP,
    pages: [
      {
        url: "https://www.leg.state.nv.us/App/NELIS/REL/83rd2025/House/Assembly",
        sourceKind: "rawHtml",
        titleHint: "Nevada Assembly 83rd Session page",
        notes: "Rendered public Assembly session page if available; otherwise saved for review.",
      },
      {
        url: "https://www.leg.state.nv.us/App/Legislator/A/Assembly/Current",
        sourceKind: "rawHtml",
        titleHint: "Nevada Assembly current public page",
        notes: "Rendered public Assembly page for session/source discovery.",
      },
    ],
  },
];

const BLOCKED_RETRY_PROVIDERS: ProviderConfig[] = [
  {
    id: "nv-governor-executive-boards",
    sourceName: "Nevada Governor Boards and Commissions",
    governingBody: "Nevada Boards and Commissions",
    officialSourceUrl: "https://gov.nv.gov/Boards/",
    includeHosts: ["gov.nv.gov"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://gov.nv.gov/Boards/",
        sourceKind: "rawHtml",
        titleHint: "Nevada Governor boards and commissions",
        notes: "Rendered public executive boards page for manual review and archive discovery.",
      },
    ],
  },
  {
    id: "sparks-city-council",
    sourceName: "Sparks City Council",
    governingBody: "Sparks City Council",
    officialSourceUrl: "https://www.cityofsparks.us/your_government/departments/city_clerk_and_records_management/city_council_meeting_agendas_and_minutes/index.php",
    includeHosts: ["www.cityofsparks.us", "cityofsparks.us"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://www.cityofsparks.us/your_government/departments/city_clerk_and_records_management/city_council_meeting_agendas_and_minutes/index.php",
        sourceKind: "rawHtml",
        titleHint: "Sparks City Council agendas and minutes",
        notes: "Rendered public Sparks agenda/minutes archive page.",
      },
    ],
  },
  {
    id: "clark-county-commission",
    sourceName: "Clark County Commission",
    governingBody: "Clark County Commission",
    officialSourceUrl: "https://clark.legistar.com/Calendar.aspx",
    includeHosts: ["clark.legistar.com"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://clark.legistar.com/Calendar.aspx",
        sourceKind: "rawHtml",
        titleHint: "Clark County Legistar calendar",
        notes: "Rendered public Legistar calendar page for commission meeting discovery.",
      },
    ],
  },
  {
    id: "las-vegas-city-council",
    sourceName: "Las Vegas City Council",
    governingBody: "Las Vegas City Council",
    officialSourceUrl: "https://lasvegas.primegov.com/public/portal",
    includeHosts: ["lasvegas.primegov.com"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://lasvegas.primegov.com/public/portal",
        sourceKind: "rawHtml",
        titleHint: "Las Vegas PrimeGov public portal",
        notes: "Rendered public PrimeGov portal page for council meeting discovery.",
      },
    ],
  },
  {
    id: "henderson-city-council",
    sourceName: "Henderson City Council",
    governingBody: "Henderson City Council",
    officialSourceUrl: "https://www.cityofhenderson.com/government/public-meeting-agendas",
    includeHosts: ["www.cityofhenderson.com", "cityofhenderson.com"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://www.cityofhenderson.com/government/public-meeting-agendas",
        sourceKind: "rawHtml",
        titleHint: "Henderson public meeting agendas",
        notes: "Rendered public Henderson meeting agenda archive page.",
      },
    ],
  },
  {
    id: "north-las-vegas-city-council",
    sourceName: "North Las Vegas City Council",
    governingBody: "North Las Vegas City Council",
    officialSourceUrl: "https://cityofnorthlasvegas.primegov.com/public/portal",
    includeHosts: ["cityofnorthlasvegas.primegov.com"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://cityofnorthlasvegas.primegov.com/public/portal",
        sourceKind: "rawHtml",
        titleHint: "North Las Vegas PrimeGov public portal",
        notes: "Rendered public PrimeGov portal page for council meeting discovery.",
      },
    ],
  },
  {
    id: "clark-county-school-district",
    sourceName: "Clark County School District Board",
    governingBody: "Clark County School District Board of Trustees",
    officialSourceUrl: "https://go.boarddocs.com/nv/ccsdlv/Board.nsf/Public",
    includeHosts: ["go.boarddocs.com"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://go.boarddocs.com/nv/ccsdlv/Board.nsf/Public",
        sourceKind: "rawHtml",
        titleHint: "Clark County School District BoardDocs public page",
        notes: "Rendered public BoardDocs page for board agenda and minutes discovery.",
      },
    ],
  },
  {
    id: "carson-city-school-district",
    sourceName: "Carson City School District Board",
    governingBody: "Carson City School District Board of Trustees",
    officialSourceUrl: "https://go.boarddocs.com/nv/carson/Board.nsf/Public",
    includeHosts: ["go.boarddocs.com"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://go.boarddocs.com/nv/carson/Board.nsf/Public",
        sourceKind: "rawHtml",
        titleHint: "Carson City School District BoardDocs public page",
        notes: "Rendered public BoardDocs page for board agenda and minutes discovery.",
      },
    ],
  },
  {
    id: "nshe-board-of-regents",
    sourceName: "NSHE Board of Regents",
    governingBody: "Nevada System of Higher Education Board of Regents",
    officialSourceUrl: "https://nshe.nevada.edu/regents/archive/",
    includeHosts: ["nshe.nevada.edu"],
    folderMap: CIVIC_FOLDER_MAP,
    pages: [
      {
        url: "https://nshe.nevada.edu/regents/archive/",
        sourceKind: "rawHtml",
        titleHint: "NSHE Board of Regents archive",
        notes: "Rendered public Board of Regents archive page.",
      },
    ],
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function safeFileBase(value: string) {
  return slugify(value) || "saved-source";
}

function providerRoot(providerId: string) {
  return path.join(CACHE_ROOT, providerId);
}

function manifestPath(providerId: string) {
  return path.join(providerRoot(providerId), "manifest.json");
}

async function readManifest(providerId: string): Promise<{ entries: ManifestEntry[]; failures: ManifestFailure[]; [key: string]: unknown }> {
  const filePath = manifestPath(providerId);
  if (!existsSync(filePath)) return { entries: [], failures: [] };
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  return { ...parsed, entries: Array.isArray(parsed.entries) ? parsed.entries : [], failures: Array.isArray(parsed.failures) ? parsed.failures : [] };
}

async function writeManifest(providerId: string, manifest: { entries: ManifestEntry[]; failures?: ManifestFailure[]; [key: string]: unknown }) {
  await writeFile(manifestPath(providerId), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function ensureProviderFolders(provider: ProviderConfig) {
  await mkdir(providerRoot(provider.id), { recursive: true });
  for (const folder of new Set(Object.values(provider.folderMap))) {
    await mkdir(path.join(providerRoot(provider.id), folder), { recursive: true });
  }
}

function relativeProviderPath(provider: ProviderConfig, sourceKind: ManifestEntry["sourceKind"], filename: string) {
  return path.join(provider.folderMap[sourceKind], filename);
}

function absoluteProviderPath(provider: ProviderConfig, localPath: string) {
  return path.join(providerRoot(provider.id), localPath);
}

async function writeIfNeeded(filePath: string, content: Buffer | string, stats: SavedStats) {
  if (existsSync(filePath) && !FORCE) {
    stats.skipped += 1;
    return false;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
  return true;
}

function upsertManifestEntry(manifest: { entries: ManifestEntry[] }, entry: ManifestEntry, stats: SavedStats) {
  const existingIndex = manifest.entries.findIndex((candidate) => candidate.localPath === entry.localPath);
  if (existingIndex >= 0) {
    manifest.entries[existingIndex] = { ...manifest.entries[existingIndex], ...entry };
  } else {
    manifest.entries.push(entry);
    stats.manifestEntries += 1;
  }
}

function recordManifestFailure(manifest: { failures?: ManifestFailure[] }, failure: ManifestFailure) {
  const failures = manifest.failures ?? [];
  const existingIndex = failures.findIndex((candidate) => candidate.url === failure.url && candidate.sourceKind === failure.sourceKind);
  if (existingIndex >= 0) failures[existingIndex] = failure;
  else failures.push(failure);
  manifest.failures = failures.slice(-120);
}

function inferDateFromText(value: string) {
  const text = value.replace(/\s+/g, " ");
  const iso = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])(?:[T\s]+(\d{1,2}):(\d{2}))?/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}${iso[4] ? `T${iso[4].padStart(2, "0")}:${iso[5] ?? "00"}:00-07:00` : "T09:00:00-07:00"}`;
  const longDate = text.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+20\d{2}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?/i);
  if (!longDate) return null;
  const parsed = Date.parse(`${longDate[0]} GMT-0700`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function classifyLink(url: string, label: string): ManifestEntry["sourceKind"] | null {
  const haystack = `${url} ${label}`.toLowerCase();
  if (/\bminutes?\b/.test(haystack)) return "minutes";
  if (/\bagenda\s*packet|packet|supporting\s+material|aada\b/.test(haystack)) return "packet";
  if (/\bagenda|meeting\/\d+/.test(haystack)) return "agenda";
  if (/\bjournal\b/.test(haystack)) return "journal";
  if (/\broll\s*call|vote|voting|votes\b/.test(haystack)) return "vote";
  if (/\bbill|nelis|bdrapi|legislation\b/.test(haystack)) return "bill";
  return null;
}

function isOutOfRequestedDateScope(url: string, label = "") {
  const text = `${url} ${label}`;
  if (/\b(?:75th2009|76th2011|77th2013|78th2015|79th2017|80th2019|81st2021|82nd2023)\b/i.test(text)) return true;
  const year = text.match(/\b(20\d{2})\b/)?.[1];
  return Boolean(year && Number(year) < 2024);
}

function markOutOfScopeManifestEntries(manifest: { entries: ManifestEntry[] }) {
  for (const entry of manifest.entries) {
    if (!isOutOfRequestedDateScope(`${entry.officialSourceUrl ?? ""} ${entry.localPath}`, entry.meetingTitle ?? "")) continue;
    entry.parserStatus = "skip";
    entry.notes = `${entry.notes ?? "Saved public source."} Skipped by Playwright bootstrap because it is outside the requested 2024-present collection window.`;
  }
}

function fileTypeFromUrl(url: string, contentType = "") {
  const lower = `${url} ${contentType}`.toLowerCase();
  if (lower.includes("pdf")) return "pdf";
  if (lower.includes("json")) return "json";
  if (lower.includes("xml")) return "xml";
  if (lower.includes("csv")) return "csv";
  if (lower.includes("text/plain")) return "txt";
  if (lower.includes("html")) return "html";
  const extension = path.extname(new URL(url).pathname).replace(/^\./, "").toLowerCase();
  if (extension) return extension;
  if (/boarddocs\.com/i.test(url) && /BD-GET/i.test(url)) return "json";
  return "html";
}

function filenameFor(provider: ProviderConfig, sourceKind: ManifestEntry["sourceKind"], title: string, url: string, extension: string) {
  const year = inferDateFromText(`${title} ${url}`)?.slice(0, 10) ?? "undated";
  return `${year}-${safeFileBase(title)}-${safeFileBase(new URL(url).pathname).slice(0, 32)}.${extension || "html"}`;
}

async function saveRenderedPage(provider: ProviderConfig, page: Page, pageConfig: ProviderConfig["pages"][number], manifest: { entries: ManifestEntry[] }, stats: SavedStats) {
  await page.goto(pageConfig.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  const title = (await page.title().catch(() => "")) || pageConfig.titleHint;
  const text = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
  const html = await page.content();
  const meetingDate = inferDateFromText(`${title} ${text}`);
  const filename = filenameFor(provider, pageConfig.sourceKind, title || pageConfig.titleHint, pageConfig.url, "html");
  const localPath = relativeProviderPath(provider, pageConfig.sourceKind, filename);
  const saved = await writeIfNeeded(absoluteProviderPath(provider, localPath), html, stats);
  if (saved) stats.pagesSaved += 1;
  if (!text || text.length < 200) stats.needsReview += 1;
  upsertManifestEntry(
    manifest,
    {
      providerId: provider.id,
      sourceName: provider.sourceName,
      officialSourceUrl: pageConfig.url,
      downloadedAt: new Date().toISOString(),
      fileType: "html",
      meetingDate,
      meetingTitle: title || pageConfig.titleHint,
      governingBody: provider.governingBody,
      sourceKind: pageConfig.sourceKind,
      localPath,
      notes: pageConfig.notes,
      parserStatus: text.length >= 200 ? "cached" : "needs_review",
    },
    stats,
  );
}

function sameAllowedHost(provider: ProviderConfig, rawUrl: string) {
  try {
    const host = new URL(rawUrl).host;
    return provider.includeHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function normalizePublicUrl(provider: ProviderConfig, rawUrl: string) {
  const url = new URL(rawUrl, provider.officialSourceUrl);
  if (url.host === "www.boarddocs.com") url.host = "go.boarddocs.com";
  url.hash = "";
  return url.toString();
}

async function discoverLinks(provider: ProviderConfig, page: Page) {
  const links = await page.$$eval("a[href]", (anchors) =>
    anchors.map((anchor) => ({
      href: (anchor as HTMLAnchorElement).href,
      label: (anchor.textContent ?? "").replace(/\s+/g, " ").trim(),
    })),
  );
  const seen = new Set<string>();
  return links
    .map((link) => ({ ...link, href: normalizePublicUrl(provider, link.href) }))
    .filter((link) => link.href && sameAllowedHost(provider, link.href))
    .filter((link) => !isOutOfRequestedDateScope(link.href, link.label))
    .map((link) => ({ ...link, sourceKind: classifyLink(link.href, link.label) }))
    .filter((link): link is { href: string; label: string; sourceKind: ManifestEntry["sourceKind"] } => Boolean(link.sourceKind))
    .filter((link) => {
      const key = `${link.sourceKind}:${link.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_LINK_DOWNLOADS_PER_PROVIDER);
}

async function fetchPublicLinkedFile(provider: ProviderConfig, context: BrowserContext, link: { href: string; label: string; sourceKind: ManifestEntry["sourceKind"] }) {
  const href = normalizePublicUrl(provider, link.href);
  const requestOptions = {
    headers: {
      "user-agent": "Direct Democracy Playwright public-record preservation",
      accept: "application/pdf,application/json,text/html,text/plain,*/*",
    },
    timeout: 45000,
  };
  const first = await context.request.get(href, requestOptions);
  if (first.ok()) return first;
  await new Promise((resolve) => setTimeout(resolve, 750));
  const second = await context.request.get(href, requestOptions);
  return second.ok() ? second : first;
}

async function saveLinkedFile(provider: ProviderConfig, context: BrowserContext, link: { href: string; label: string; sourceKind: ManifestEntry["sourceKind"] }, manifest: { entries: ManifestEntry[]; failures?: ManifestFailure[] }, stats: SavedStats) {
  const href = normalizePublicUrl(provider, link.href);
  const response = await fetchPublicLinkedFile(provider, context, { ...link, href });
  if (!response.ok()) {
    stats.failed += 1;
    recordManifestFailure(manifest, {
      url: href,
      label: link.label,
      sourceKind: link.sourceKind,
      reason: `HTTP ${response.status()} ${response.statusText()}`.trim(),
      attemptedAt: new Date().toISOString(),
    });
    return;
  }
  const contentType = response.headers()["content-type"] ?? "";
  const fileType = fileTypeFromUrl(href, contentType);
  const body = await response.body();
  const title = link.label || new URL(href).pathname.split("/").filter(Boolean).at(-1) || provider.sourceName;
  const filename = filenameFor(provider, link.sourceKind, title, href, fileType === "pdf" ? "pdf" : fileType === "json" ? "json" : fileType === "xml" ? "xml" : fileType === "csv" ? "csv" : "html");
  const localPath = relativeProviderPath(provider, link.sourceKind, filename);
  const saved = await writeIfNeeded(absoluteProviderPath(provider, localPath), body, stats);
  if (saved) stats.filesSaved += 1;
  upsertManifestEntry(
    manifest,
    {
      providerId: provider.id,
      sourceName: provider.sourceName,
      officialSourceUrl: href,
      downloadedAt: new Date().toISOString(),
      fileType,
      meetingDate: inferDateFromText(`${link.label} ${link.href}`),
      meetingTitle: title,
      governingBody: provider.governingBody,
      sourceKind: link.sourceKind,
      localPath,
      notes: "Downloaded from a public link visible on an official source page.",
      parserStatus: fileType === "pdf" ? "needs_parser" : "cached",
    },
    stats,
  );
}

function shouldCaptureJson(provider: ProviderConfig, url: string, contentType: string) {
  return sameAllowedHost(provider, url) && /\bjson\b/i.test(contentType) && !/sockjs|hot-update|_next|favicon/i.test(url);
}

async function collectProvider(provider: ProviderConfig, context: BrowserContext) {
  await ensureProviderFolders(provider);
  const manifest = await readManifest(provider.id);
  const stats: SavedStats = { pagesSaved: 0, filesSaved: 0, jsonSaved: 0, manifestEntries: 0, skipped: 0, failed: 0, needsReview: 0 };
  const page = await context.newPage();
  const capturedJson = new Set<string>();
  page.on("response", async (response) => {
    try {
      const url = response.url();
      const contentType = response.headers()["content-type"] ?? "";
      if (!response.ok() || !shouldCaptureJson(provider, url, contentType) || capturedJson.has(url)) return;
      capturedJson.add(url);
      const body = await response.body();
      const filename = filenameFor(provider, "apiJson", `api-json-${capturedJson.size}`, url, "json");
      const localPath = relativeProviderPath(provider, "apiJson", filename);
      const saved = await writeIfNeeded(absoluteProviderPath(provider, localPath), body, stats);
      if (saved) stats.jsonSaved += 1;
      upsertManifestEntry(
        manifest,
        {
          providerId: provider.id,
          sourceName: provider.sourceName,
          officialSourceUrl: url,
          downloadedAt: new Date().toISOString(),
          fileType: "json",
          meetingDate: inferDateFromText(url),
          meetingTitle: `${provider.sourceName} public JSON response`,
          governingBody: provider.governingBody,
          sourceKind: "apiJson",
          localPath,
          notes: "Captured from a public JSON response loaded naturally by the official page.",
          parserStatus: "cached",
        },
        stats,
      );
    } catch {
      stats.failed += 1;
    }
  });

  for (const pageConfig of provider.pages) {
    try {
      await saveRenderedPage(provider, page, pageConfig, manifest, stats);
      const links = await discoverLinks(provider, page);
      for (const link of links) {
        await saveLinkedFile(provider, context, link, manifest, stats).catch((error) => {
          stats.failed += 1;
          recordManifestFailure(manifest, {
            url: normalizePublicUrl(provider, link.href),
            label: link.label,
            sourceKind: link.sourceKind,
            reason: error instanceof Error ? error.message : String(error),
            attemptedAt: new Date().toISOString(),
          });
        });
      }
    } catch (error) {
      stats.failed += 1;
      console.error(`[${provider.id}] failed ${pageConfig.url}:`, error instanceof Error ? error.message : String(error));
    }
  }
  markOutOfScopeManifestEntries(manifest);
  await writeManifest(provider.id, manifest);
  await page.close();
  return stats;
}

function providersForRun() {
  if (!BLOCKED_RETRY) return BASE_PROVIDERS;
  const byId = new Map<string, ProviderConfig>();
  for (const provider of [...BLOCKED_RETRY_PROVIDERS, ...BASE_PROVIDERS]) byId.set(provider.id, provider);
  return [...byId.values()];
}

async function pauseForInteractiveSession(context: BrowserContext, providers: ProviderConfig[]) {
  if (!INTERACTIVE) return;
  const rl = createInterface({ input, output });
  const page = await context.newPage();
  const firstUrl = providers[0]?.officialSourceUrl ?? "about:blank";
  await page.goto(firstUrl, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => undefined);
  console.log(`Interactive public-record bootstrap opened ${firstUrl}`);
  console.log("Complete any normal browser session step, then press Enter in terminal to continue.");
  await rl.question("");
  rl.close();
  await page.close().catch(() => undefined);
}

async function main() {
  const providers = providersForRun();
  await mkdir(path.dirname(STORAGE_STATE), { recursive: true });
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    acceptDownloads: true,
    ...(existsSync(STORAGE_STATE) ? { storageState: STORAGE_STATE } : {}),
  });
  const totals: SavedStats = { pagesSaved: 0, filesSaved: 0, jsonSaved: 0, manifestEntries: 0, skipped: 0, failed: 0, needsReview: 0 };
  try {
    await pauseForInteractiveSession(context, providers);
    if (SAVE_STORAGE_STATE) {
      await context.storageState({ path: STORAGE_STATE });
      console.log(`Saved Playwright storage state: ${path.relative(ROOT, STORAGE_STATE)}`);
    }
    for (const provider of providers) {
      console.log(`Collecting ${provider.sourceName}...`);
      const stats = await collectProvider(provider, context);
      for (const key of Object.keys(totals) as Array<keyof SavedStats>) totals[key] += stats[key];
      console.log(
        `- ${provider.id}: pages=${stats.pagesSaved} files=${stats.filesSaved} json=${stats.jsonSaved} manifest=${stats.manifestEntries} skipped=${stats.skipped} failed=${stats.failed} needsReview=${stats.needsReview}`,
      );
    }
    if (SAVE_STORAGE_STATE) await context.storageState({ path: STORAGE_STATE });
  } finally {
    await context.close();
    await browser.close();
  }
  console.log("Playwright public meeting bootstrap complete");
  console.log(`Pages saved: ${totals.pagesSaved}`);
  console.log(`PDF/files saved: ${totals.filesSaved}`);
  console.log(`JSON responses saved: ${totals.jsonSaved}`);
  console.log(`Manifest entries created: ${totals.manifestEntries}`);
  console.log(`Skipped existing files: ${totals.skipped}`);
  console.log(`Failed downloads/pages: ${totals.failed}`);
  console.log(`Needs review: ${totals.needsReview}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
