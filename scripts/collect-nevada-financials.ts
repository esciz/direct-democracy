import "dotenv/config";

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { atomicFinancialWrite, fetchFinancialCache, fetchFinancialBuffer, finiteMoney, sourceDate, type FinancialSourceAttempt } from "../lib/financials/source-cache";
import path from "node:path";

import {
  CampaignFinanceContributorType,
  CampaignFinanceFilingType,
  CivicEntityType,
  CivicRecordReviewStatus,
  PrismaClient,
  SourceSyncStatus,
  SourceType,
} from "@prisma/client";

const prisma = new PrismaClient();

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "data", "seed", "nevada-financial-source-catalog.json");
const OUTPUT_PATH = path.join(ROOT, "data", "generated", "nevada-financial-coverage.json");
const RAW_ROOT = path.join(ROOT, "data", "raw", "nevada-financials");
const FEC_CACHE_DIR = path.join(RAW_ROOT, "fec");
const TRANSPARENCY_CACHE_DIR = path.join(RAW_ROOT, "transparency-usa");
const TRANSPARENCY_SITEMAP_CACHE = path.join(TRANSPARENCY_CACHE_DIR, "sitemap-nv-candidates.xml");
const NV_SOS_STRUCTURED_PATH = path.join(ROOT, "data", "generated", "nv-sos-structured-documents.json");

const CURRENT_CYCLE = 2026;
const FEC_CYCLES = [2018, 2020, 2022, 2024, 2026];
const AUTO_IMPORT_METHOD = "nevada_financial_coverage_v1";
const sourceAttempts: FinancialSourceAttempt[] = [];
let entityInventory = { source: "database", checkedAt: new Date().toISOString(), warning: null as string | null };

type CatalogSource = {
  id: string;
  name: string;
  authority: "primary" | "derived_cross_check";
  categories: string[];
  url: string;
  apiUrl?: string;
  sitemapUrl?: string;
  accessMethod: string;
  directCadenceDays: number;
  advancedCadenceDays: number;
  notes: string;
};

type Catalog = {
  version: number;
  sources: CatalogSource[];
  transparencyIdentityAliases?: Record<string, string>;
};

type CandidateEntity = {
  entityType: "candidate";
  id: string;
  name: string;
  ballotName: string | null;
  office: string;
  jurisdiction: string;
  jurisdictionId: string;
  district: string | null;
  electionYear: number;
  electionTitle: string;
  status: string;
};

type OfficialEntity = {
  entityType: "official";
  id: string;
  name: string;
  ballotName: null;
  office: string;
  jurisdiction: string;
  jurisdictionId: string;
  district: string | null;
  electionYear: number;
  electionTitle: null;
  status: string;
};

type FinancialEntity = CandidateEntity | OfficialEntity;

type FecTotal = {
  sourceCheckedAt?: string | null;
  candidate_id: string;
  name: string;
  office: string;
  office_full: string;
  state: string;
  district: string | null;
  district_number?: number | null;
  party_full?: string | null;
  cycle: number;
  receipts: number | null;
  disbursements: number | null;
  cash_on_hand_end_period?: string | number | null;
  coverage_start_date?: string | null;
  coverage_end_date?: string | null;
  individual_itemized_contributions?: number | null;
  other_political_committee_contributions?: number | null;
  candidate_contribution?: number | null;
  has_raised_funds?: boolean;
  last_file_date?: string | null;
};

type TransparencyContributor = {
  name: string;
  amount: number;
  type: "INDIVIDUAL" | "ENTITY";
};

type TransparencySnapshot = {
  candidateName: string;
  sourceUrl: string;
  cycle: number | "all";
  totalRaised: number;
  totalSpent: number;
  cashOnHand: null;
  coverageStart: string | null;
  coverageEnd: string | null;
  reportingPeriod: string;
  topContributors: TransparencyContributor[];
  availableCycleLabels: string[];
  checkedAt: string;
};

type FinancialSnapshot = {
  sourceCheckedAt: string | null;
  sourceKind: "fec" | "transparency_usa";
  sourceName: string;
  sourceUrl: string;
  cycleYear: number;
  totalRaised: number;
  totalSpent: number;
  cashOnHand: number | null;
  reportingPeriod: string;
  periodStart: string | null;
  periodEnd: string | null;
  topContributors: TransparencyContributor[];
};

type FinancialCycle = FinancialSnapshot & {
  displayLabel: string;
  isCurrentCycle: boolean;
};

type DisclosureSummary = {
  name: string;
  filedAt: string | null;
  url: string;
};

type EntityCoverage = {
  entityType: FinancialEntity["entityType"];
  entityId: string;
  name: string;
  office: string;
  jurisdiction: string;
  electionYear: number;
  campaignFinance: {
    primarySourceId: string;
    primarySourceName: string;
    primarySourceUrl: string;
    aggregateSourceUrl: string | null;
    fecCandidateId: string | null;
    matchConfidence: number | null;
    status: "verified_totals" | "derived_totals" | "source_matched_pending_extraction" | "source_registered";
    snapshot: FinancialSnapshot | null;
    cycleHistory: FinancialCycle[];
    allReportedTotals: {
      label: string;
      reportingPeriod: string;
      totalRaised: number;
      totalSpent: number;
      cycleCount: number;
      sourceName: string;
      sourceUrl: string;
      aggregationMethod: string;
    } | null;
    topContributors: TransparencyContributor[];
  };
  personalFinancialDisclosure: {
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    applicability: "required_or_likely" | "eligibility_review";
    status: "matched_filings" | "source_registered";
    filings: DisclosureSummary[];
    note: string;
  };
};

type NvSosStructuredDocument = {
  source_url?: string | null;
  candidate_name?: string | null;
  filing_report_type?: string | null;
  election_year?: number | null;
  parsed_at?: string | null;
};

function argValue(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function reorderCommaName(value: string) {
  const clean = decodeHtmlEntities(value).split("/")[0]?.trim() ?? "";
  if (!clean.includes(",")) return clean;
  const [last, ...rest] = clean.split(",");
  return `${rest.join(" ").trim()} ${last.trim()}`.trim();
}

const NICKNAME_ALIASES = new Map<string, string[]>([
  ["alexander", ["alex"]],
  ["andrew", ["andy"]],
  ["benjamin", ["ben"]],
  ["christopher", ["chris"]],
  ["daniel", ["danny", "dan"]],
  ["david", ["dave"]],
  ["donald", ["don"]],
  ["gregory", ["greg"]],
  ["james", ["jim", "jimmy"]],
  ["jennifer", ["jen", "jenny"]],
  ["joseph", ["joe"]],
  ["katherine", ["kathy", "kate"]],
  ["matthew", ["matt"]],
  ["michael", ["mike"]],
  ["nicholas", ["nick"]],
  ["patricia", ["pat"]],
  ["rebecca", ["becky"]],
  ["richard", ["rich", "rick"]],
  ["robert", ["rob", "bob"]],
  ["steven", ["steve"]],
  ["thomas", ["tom"]],
  ["william", ["bill"]],
]);

function normalizedTokens(value: string) {
  return reorderCommaName(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/["“”][^"“”]+["“”]/g, " ")
    .replace(/['’]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|mr|mrs|ms|dr)\b\.?/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function canonicalFirstName(value: string) {
  for (const [canonical, aliases] of NICKNAME_ALIASES) {
    if (value === canonical || aliases.includes(value)) return canonical;
  }
  return value;
}

function nameKey(value: string) {
  const tokens = normalizedTokens(value);
  if (!tokens.length) return "";
  const first = canonicalFirstName(tokens[0]);
  const last = tokens.at(-1) ?? "";
  return `${first}-${last}`;
}

function nameVariants(value: string) {
  const reordered = reorderCommaName(value);
  const quoted = [...reordered.matchAll(/["“”]([^"“”]+)["“”]/g)].flatMap((match) => normalizedTokens(match[1]));
  const tokens = normalizedTokens(reordered);
  if (!tokens.length) return [];
  const first = tokens[0];
  const last = tokens.at(-1) ?? "";
  const firstOptions = new Set([first, canonicalFirstName(first), ...(NICKNAME_ALIASES.get(first) ?? [])]);
  for (const [canonical, aliases] of NICKNAME_ALIASES) {
    if (aliases.includes(first)) {
      firstOptions.add(canonical);
      for (const alias of aliases) firstOptions.add(alias);
    }
  }
  for (const nickname of quoted) firstOptions.add(nickname);
  const variants = new Set<string>();
  variants.add(tokens.join("-"));
  for (const candidateFirst of firstOptions) variants.add(`${candidateFirst}-${last}`);
  return [...variants].filter(Boolean);
}

function nameMatchScore(left: string, right: string) {
  const leftTokens = normalizedTokens(left);
  const rightTokens = normalizedTokens(right);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const leftKey = nameKey(left);
  const rightKey = nameKey(right);
  if (leftKey === rightKey) {
    const leftFull = leftTokens.map((token, index) => (index === 0 ? canonicalFirstName(token) : token)).join(" ");
    const rightFull = rightTokens.map((token, index) => (index === 0 ? canonicalFirstName(token) : token)).join(" ");
    return leftFull === rightFull ? 1 : 0.92;
  }
  const overlap = leftTokens.filter((token) => rightTokens.includes(token)).length;
  return overlap / Math.max(leftTokens.length, rightTokens.length);
}

const finiteNumber = finiteMoney;

function moneyFromText(value: string) {
  const normalized = value.replace(/[$,\s]/g, "");
  return normalized && /^-?\d+(?:\.\d+)?$/.test(normalized) ? finiteMoney(normalized) : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function financialCycleDisplayLabel(cycle: FinancialSnapshot) {
  const startYear = cycle.periodStart?.match(/^\d{4}/)?.[0] ?? null;
  const endYear = cycle.periodEnd?.match(/^\d{4}/)?.[0] ?? null;
  if (cycle.sourceKind === "fec" && startYear && endYear) return `${startYear}-${endYear} FEC period`;
  return `${cycle.cycleYear - 1}-${cycle.cycleYear} cycle`;
}

function stableShard(value: string, shards = 7) {
  const digest = createHash("sha256").update(value).digest();
  return digest.readUInt32BE(0) % shards;
}

function todayShard(shards = 7) {
  const explicit = argValue("shard");
  if (explicit !== null && Number.isInteger(Number(explicit))) return Math.abs(Number(explicit)) % shards;
  const day = Math.floor(Date.now() / 86_400_000);
  return day % shards;
}

function isFederalOffice(office: string) {
  return /\b(u\.?s\.?|united states|representative in congress|president)\b/i.test(office);
}

function federalOfficeCode(office: string) {
  if (/\b(senator|senate)\b/i.test(office)) return "S";
  if (/\b(representative|house|congress)\b/i.test(office)) return "H";
  if (/\bpresident\b/i.test(office)) return "P";
  return null;
}

function officeDistrict(office: string, district: string | null) {
  const match = `${office} ${district ?? ""}`.match(/\b(?:district)\s*(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function isJudicialOffice(office: string) {
  return /\b(judge|justice|judicial|court)\b/i.test(office);
}

function disclosureSourceId(entity: FinancialEntity) {
  if (isJudicialOffice(entity.office)) return "nevada-aoc-judicial-financial-disclosures";
  if (/\bpresident\b/i.test(entity.office)) return "oge-public-financial-disclosures";
  if (/\b(senator|senate)\b/i.test(entity.office) && isFederalOffice(entity.office)) return "us-senate-financial-disclosures";
  if (/\b(representative|house|congress)\b/i.test(entity.office) && isFederalOffice(entity.office)) return "us-house-financial-disclosures";
  return "nevada-sos-financial-disclosures";
}

function auroraSearchUrl(name: string) {
  const url = new URL("https://www.nvsos.gov/elections/aurora-public-search");
  url.searchParams.set("search", reorderCommaName(name));
  return url.toString();
}

function fecSearchUrl(entity: FinancialEntity) {
  const url = new URL("https://www.fec.gov/data/candidates/");
  url.searchParams.set("cycle", String(entity.electionYear || CURRENT_CYCLE));
  url.searchParams.set("election_year", String(entity.electionYear || CURRENT_CYCLE));
  url.searchParams.set("state", "NV");
  url.searchParams.set("q", reorderCommaName(entity.name));
  return url.toString();
}

function directDisclosureUrl(source: CatalogSource, entity: FinancialEntity) {
  if (source.id === "nevada-sos-financial-disclosures") return auroraSearchUrl(entity.name);
  return source.url;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, value: unknown) {
  await atomicFinancialWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function fetchToCache(url: string, cachePath: string, allowNetwork: boolean, validate?: (buffer: Buffer) => void) {
  return fetchFinancialCache(url, cachePath, allowNetwork, { validate, attempts: sourceAttempts });
}

async function cacheCheckedAt(cachePath: string) {
  const cached = await fetchFinancialCache("https://www.transparencyusa.org/", cachePath, false);
  // The cache mtime is a truthful fallback for legacy files; matched metadata preserves the retrieval time.
  try {
    const metadata = JSON.parse(await readFile(`${cachePath}.metadata.json`, "utf8"));
    if (cached && metadata.sha256 === createHash("sha256").update(cached.buffer).digest("hex") && Number.isFinite(Date.parse(metadata.fetchedAt))) return metadata.fetchedAt as string;
  } catch { /* Legacy cache. */ }
  return cached?.fetchedAt ?? (await stat(cachePath)).mtime.toISOString();
}

function validateFecResponse(buffer: Buffer) {
  const parsed = JSON.parse(buffer.toString("utf8"));
  if (!Array.isArray(parsed.results) || parsed.results.some((record: FecTotal) => !record.candidate_id || !record.name || !record.office)) throw new Error("Invalid FEC candidate totals response");
}

async function loadDatabaseEntities(): Promise<FinancialEntity[]> {
  const [candidates, officials] = await Promise.all([
    prisma.candidate.findMany({
      include: {
        election: { select: { title: true, electionDate: true } },
        office: { select: { title: true } },
        jurisdiction: { select: { id: true, name: true } },
        district: { select: { name: true } },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    }),
    prisma.official.findMany({
      where: { status: "CURRENT" },
      include: {
        office: { select: { title: true } },
        jurisdiction: { select: { id: true, name: true } },
        district: { select: { name: true } },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    }),
  ]);

  return [
    ...candidates.map(
      (candidate): CandidateEntity => ({
        entityType: "candidate",
        id: candidate.id,
        name: candidate.fullName,
        ballotName: candidate.ballotName,
        office: candidate.office?.title ?? "Office pending",
        jurisdiction: candidate.jurisdiction.name,
        jurisdictionId: candidate.jurisdiction.id,
        district: candidate.district?.name ?? null,
        electionYear: candidate.election.electionDate.getUTCFullYear(),
        electionTitle: candidate.election.title,
        status: candidate.status,
      }),
    ),
    ...officials.map(
      (official): OfficialEntity => ({
        entityType: "official",
        id: official.id,
        name: official.fullName,
        ballotName: null,
        office: official.office.title,
        jurisdiction: official.jurisdiction.name,
        jurisdictionId: official.jurisdiction.id,
        district: official.district?.name ?? null,
        electionYear: CURRENT_CYCLE,
        electionTitle: null,
        status: official.status,
      }),
    ),
  ];
}

async function loadEntities(): Promise<FinancialEntity[]> {
  try { return await loadDatabaseEntities(); }
  catch {
    const previous = await readJson<{ generatedAt?: string; entityInventory?: { source?: string; checkedAt?: string; records?: FinancialEntity[] }; records?: EntityCoverage[] }>(OUTPUT_PATH, {});
    if (!previous.records?.length) throw new Error("Financial entity database unavailable and no last-known inventory exists");
    entityInventory = { source: "last_known_coverage", checkedAt: previous.entityInventory?.checkedAt ?? previous.generatedAt ?? "unknown", warning: "Database unavailable. Collection uses the last-known entity inventory; database publication is pending." };
    if (previous.entityInventory?.records?.length) return previous.entityInventory.records;
    return previous.records.map(record => ({
      entityType: record.entityType,
      id: record.entityId,
      name: record.name,
      ballotName: null,
      office: record.office,
      jurisdiction: record.jurisdiction,
      jurisdictionId: "", // Never used for database writes when inventory is cached.
      district: null,
      electionYear: record.electionYear,
      electionTitle: record.entityType === "candidate" ? "Last-known election" : null,
      status: "LAST_KNOWN",
    } as FinancialEntity));
  }
}

async function collectFecTotals(allowNetwork: boolean) {
  const apiKey = process.env.FEC_API_KEY?.trim() || "DEMO_KEY";
  const byCycle = new Map<number, FecTotal[]>();
  for (const cycle of FEC_CYCLES) {
    const cachePath = path.join(FEC_CACHE_DIR, `nevada-candidate-totals-${cycle}.json`);
    const url = new URL("https://api.open.fec.gov/v1/candidates/totals/");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("state", "NV");
    // Two-year reporting periods are non-overlapping; election_year would exclude active
    // Senate committees that are not up for election during this reporting cycle.
    url.searchParams.set("cycle", String(cycle));
    url.searchParams.set("election_full", "false");
    url.searchParams.set("per_page", "100");
    const validated = (buffer: Buffer) => {
      validateFecResponse(buffer);
      const parsed = JSON.parse(buffer.toString("utf8"));
      if (Number(parsed.pagination?.pages ?? 1) > 1 && parsed.complete !== true) throw new Error("Incomplete paginated FEC response");
    };
    let result;
    if (allowNetwork) {
      try {
        const pages: FecTotal[] = [];
        let totalPages = 1;
        for (let page = 1; page <= totalPages; page++) {
          url.searchParams.set("page", String(page));
          const buffer = await fetchFinancialBuffer(url.toString());
          validateFecResponse(buffer);
          const parsed = JSON.parse(buffer.toString("utf8"));
          totalPages = Math.max(1, Number(parsed.pagination?.pages ?? 1));
          if (!Number.isInteger(totalPages) || totalPages > 20) throw new Error("FEC pagination exceeds bounded 20-page limit");
          pages.push(...parsed.results);
        }
        // Commit only a complete set, preserving the last valid cache if any page fails.
        const buffer = Buffer.from(JSON.stringify({ results: [...new Map(pages.map(record => [`${record.candidate_id}:${record.cycle}`, record])).values()], pagination: { pages: 1 }, complete: true }));
        const responseFetch = async () => new Response(buffer);
        url.searchParams.delete("page");
        result = await fetchFinancialCache(url.toString(), cachePath, true, { validate: validated, attempts: sourceAttempts, fetchImpl: responseFetch });
      } catch (error) {
        url.searchParams.delete("page");
        const failingFetch = async () => { throw new Error(error instanceof Error ? error.message : "FEC fetch failed"); };
        result = await fetchFinancialCache(url.toString(), cachePath, true, { validate: validated, attempts: sourceAttempts, fetchImpl: failingFetch });
      }
    } else result = await fetchToCache(url.toString(), cachePath, false, validated);
    const parsed = result ? JSON.parse(result.buffer.toString("utf8")) as { results: FecTotal[] } : { results: [] };
    byCycle.set(cycle, parsed.results.map(record => ({ ...record, sourceCheckedAt: result?.fetchedAt ?? null })));
  }
  return byCycle;
}

export function matchFec(entity: FinancialEntity, records: FecTotal[]) {
  const officeCode = federalOfficeCode(entity.office);
  if (!officeCode) return null;
  const district = officeDistrict(entity.office, entity.district);
  const scored = records
    .filter((record) => record.office === officeCode)
    .filter((record) => officeCode !== "H" || district === null || record.district_number === district || Number(record.district) === district)
    .map((record) => ({ record, score: nameMatchScore(entity.name, record.name) }))
    .filter((entry) => entry.score >= 0.9)
    .sort((left, right) => right.score - left.score);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score && scored[0].record.candidate_id !== scored[1].record.candidate_id) return null;
  return scored[0];
}

async function collectTransparencySitemap(allowNetwork: boolean, source: CatalogSource) {
  const result = await fetchToCache(source.sitemapUrl ?? "https://www.transparencyusa.org/sitemap-nv-candidates.xml", TRANSPARENCY_SITEMAP_CACHE, allowNetwork, (buffer) => {
    if (!/<(?:urlset|sitemapindex)\b/i.test(buffer.toString("utf8"))) throw new Error("Invalid Transparency USA sitemap");
  });
  if (!result) return [] as string[];
  const xml = result.buffer.toString("utf8");
  return [...xml.matchAll(/<loc>(https:\/\/www\.transparencyusa\.org\/nv\/candidate\/[^<]+)<\/loc>/g)]
    .map((match) => decodeHtmlEntities(match[1]))
    .filter((url, index, urls) => urls.indexOf(url) === index);
}

function transparencySlug(url: string) {
  return new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
}

function matchTransparencyUrl(entity: FinancialEntity, urls: string[], identityAliases: Record<string, string>) {
  const urlBySlug = new Map(urls.map((url) => [transparencySlug(url), url]));
  const aliasSlug = identityAliases[reorderCommaName(entity.name)];
  if (aliasSlug && urlBySlug.has(aliasSlug)) return { url: urlBySlug.get(aliasSlug)!, confidence: 1 };
  const directMatches = nameVariants(entity.name).flatMap((variant) => (urlBySlug.has(variant) ? [urlBySlug.get(variant)!] : []));
  const uniqueDirect = [...new Set(directMatches)];
  if (uniqueDirect.length === 1) return { url: uniqueDirect[0], confidence: 1 };

  const targetKey = nameKey(entity.name);
  const candidates = urls.filter((url) => nameKey(transparencySlug(url).replaceAll("-", " ")) === targetKey);
  if (candidates.length === 1) return { url: candidates[0], confidence: 0.92 };
  return null;
}

function transparencyCachePath(baseUrl: string, cycle: number | "all") {
  const slug = transparencySlug(baseUrl).replace(/[^a-z0-9-]+/gi, "-");
  return path.join(TRANSPARENCY_CACHE_DIR, `${slug}-${cycle === "all" ? "2017-to-now" : `${cycle}-election-cycle`}.html`);
}

function transparencyCycleUrl(baseUrl: string, cycle: number | "all") {
  const url = new URL(baseUrl);
  url.searchParams.set("cycle", cycle === "all" ? "2017-to-now" : `${cycle}-election-cycle`);
  return url.toString();
}

export function parseTransparencyPage(html: string, sourceUrl: string, cycle: number | "all", checkedAt: string): TransparencySnapshot | null {
  const titleMatch = html.match(/<title>([\s\S]*?)\s*-\s*Nevada Candidate\s*-\s*Transparency USA<\/title>/i);
  const candidateName = titleMatch ? stripTags(titleMatch[1]) : "";
  const stats = [...html.matchAll(/<span class="user-display-stat-counter">([\s\S]*?)<\/span>\s*<span class="user-display-stat-title">([\s\S]*?)<\/span>/gi)]
    .map((match) => ({ value: moneyFromText(stripTags(match[1])), label: stripTags(match[2]).toLowerCase() }));
  const totalRaised = stats.find((stat) => stat.label.includes("contribution"))?.value ?? null;
  const totalSpent = stats.find((stat) => stat.label.includes("expenditure"))?.value ?? null;
  if (!candidateName || totalRaised === null || totalSpent === null) return null;

  const topContributorSection = html.match(/<h3>Top Contributors<\/h3>([\s\S]*?)<a[^>]+widget-button-full/i)?.[1] ?? "";
  const topContributors = [...topContributorSection.matchAll(/<tr role="row">([\s\S]*?)<\/tr>/gi)].flatMap((rowMatch) => {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripTags(match[1]));
    if (cells.length < 3) return [];
    const amount = moneyFromText(cells[0]);
    const type = cells[2].toUpperCase();
    if (amount === null || !cells[1] || (type !== "INDIVIDUAL" && type !== "ENTITY")) return [];
    return [{ name: cells[1], amount, type: type as TransparencyContributor["type"] }];
  });
  const availableCycleLabels = [
    ...html.matchAll(/href="\/nv\/candidate\/[^"?]+(?:\?cycle=[^"]+)?"[^>]*>([\s\S]*?)<\/a>/gi),
  ]
    .map((match) => stripTags(match[1]))
    .filter((label) => /(?:20\d{2}.*(?:season|cycle)|2017 to now)/i.test(label))
    .filter((label, index, labels) => labels.indexOf(label) === index);
  const checkedDate = checkedAt.slice(0, 10);
  // A retrieval date is not a filing coverage date. The aggregate page does not
  // establish an exact cutoff for the current cycle.
  const coverageEnd = cycle === "all" || cycle === CURRENT_CYCLE ? null : `${cycle}-12-31`;
  const coverageStart = cycle === "all" ? "2017-01-01" : `${cycle - 1}-01-01`;
  const reportingPeriod =
    cycle === "all"
      ? `All published Nevada campaign records since 2017; source checked ${checkedDate}`
      : cycle === CURRENT_CYCLE
        ? `${cycle - 1}-${cycle} election cycle; source checked ${checkedDate}`
        : `${cycle - 1}-${cycle} election cycle`;
  return {
    candidateName,
    sourceUrl,
    cycle,
    totalRaised,
    totalSpent,
    cashOnHand: null,
    coverageStart,
    coverageEnd,
    reportingPeriod,
    topContributors,
    availableCycleLabels,
    checkedAt,
  };
}

async function collectTransparencyPages(
  matches: Map<string, { url: string; confidence: number }>,
  entities: FinancialEntity[],
  allowNetwork: boolean,
  fullPass: boolean,
  missingOnly: boolean,
) {
  const requestedByUrl = new Map<string, Set<number | "all">>();
  for (const entity of entities) {
    const match = matches.get(`${entity.entityType}:${entity.id}`);
    if (!match) continue;
    const cycles = requestedByUrl.get(match.url) ?? new Set<number | "all">();
    cycles.add(entity.entityType === "candidate" ? entity.electionYear : CURRENT_CYCLE);
    cycles.add("all");
    requestedByUrl.set(match.url, cycles);
  }

  const shard = todayShard();
  const requestedLimit = Number(argValue("limit-pages") ?? Infinity);
  const scheduledUrls = [...requestedByUrl.keys()].filter((url) => fullPass || stableShard(url) === shard).slice(0, Number.isFinite(requestedLimit) ? Math.max(0, Math.floor(requestedLimit)) : undefined);
  let cursor = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < scheduledUrls.length) {
      const index = cursor++;
      const baseUrl = scheduledUrls[index];
      for (const cycle of requestedByUrl.get(baseUrl) ?? []) {
        const url = transparencyCycleUrl(baseUrl, cycle);
        const cachePath = transparencyCachePath(baseUrl, cycle);
        if (missingOnly && existsSync(cachePath)) continue;
        try {
          await fetchToCache(url, cachePath, allowNetwork, (buffer) => {
            if (!parseTransparencyPage(buffer.toString("utf8"), url, cycle, new Date().toISOString())) throw new Error("Invalid or blocked Transparency USA candidate page");
          });
        } catch (error) {
          console.warn(`[financials] Transparency USA fetch failed for ${url}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 125));
    }
  });
  await Promise.all(workers);

  const historicalCyclesByUrl = new Map<string, Set<number>>();
  for (const baseUrl of requestedByUrl.keys()) {
    const allCyclePath = transparencyCachePath(baseUrl, "all");
    if (!existsSync(allCyclePath)) continue;
    const allCycleHtml = await readFile(allCyclePath, "utf8");
    const allCycleSnapshot = parseTransparencyPage(
      allCycleHtml,
      transparencyCycleUrl(baseUrl, "all"),
      "all",
      await cacheCheckedAt(allCyclePath),
    );
    if (!allCycleSnapshot) continue;
    const baselineCycles = requestedByUrl.get(baseUrl) ?? new Set<number | "all">();
    const historicalCycles = new Set(
      allCycleSnapshot.availableCycleLabels
        .map((label) => Number(label.match(/\b(20\d{2})\b/)?.[1]))
        .filter((cycle) => FEC_CYCLES.includes(cycle) && !baselineCycles.has(cycle)),
    );
    historicalCyclesByUrl.set(baseUrl, historicalCycles);
    for (const cycle of historicalCycles) {
      if (existsSync(transparencyCachePath(baseUrl, cycle))) baselineCycles.add(cycle);
    }
    requestedByUrl.set(baseUrl, baselineCycles);
  }

  let historicalCursor = 0;
  const historicalWorkers = Array.from({ length: 4 }, async () => {
    while (historicalCursor < scheduledUrls.length) {
      const index = historicalCursor++;
      const baseUrl = scheduledUrls[index];
      const requestedCycles = requestedByUrl.get(baseUrl) ?? new Set<number | "all">();
      for (const cycle of historicalCyclesByUrl.get(baseUrl) ?? []) {
        requestedCycles.add(cycle);
        const url = transparencyCycleUrl(baseUrl, cycle);
        const cachePath = transparencyCachePath(baseUrl, cycle);
        if (missingOnly && existsSync(cachePath)) continue;
        try {
          await fetchToCache(url, cachePath, allowNetwork, (buffer) => {
            if (!parseTransparencyPage(buffer.toString("utf8"), url, cycle, new Date().toISOString())) throw new Error("Invalid or blocked Transparency USA candidate page");
          });
        } catch (error) {
          console.warn(`[financials] Transparency USA historical fetch failed for ${url}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      requestedByUrl.set(baseUrl, requestedCycles);
      await new Promise((resolve) => setTimeout(resolve, 125));
    }
  });
  await Promise.all(historicalWorkers);

  const snapshots = new Map<string, TransparencySnapshot>();
  for (const [baseUrl, cycles] of requestedByUrl) {
    for (const cycle of cycles) {
      const cachePath = transparencyCachePath(baseUrl, cycle);
      if (!existsSync(cachePath)) continue;
      const html = await readFile(cachePath, "utf8");
      const parsed = parseTransparencyPage(html, transparencyCycleUrl(baseUrl, cycle), cycle, await cacheCheckedAt(cachePath));
      if (parsed) snapshots.set(`${baseUrl}|${cycle}`, parsed);
    }
  }
  return { snapshots, scheduledUrls: scheduledUrls.length, shard };
}

export function fecSnapshot(record: FecTotal): FinancialSnapshot | null {
  const totalRaised = finiteMoney(record.receipts);
  const totalSpent = finiteMoney(record.disbursements);
  if (totalRaised === null || totalSpent === null) return null;
  const candidateUrl = `https://www.fec.gov/data/candidate/${record.candidate_id}/?cycle=${record.cycle}&election_full=false`;
  return {
    sourceCheckedAt: record.sourceCheckedAt ?? null,
    sourceKind: "fec",
    sourceName: "Federal Election Commission OpenFEC",
    sourceUrl: candidateUrl,
    cycleYear: record.cycle,
    totalRaised,
    totalSpent,
    cashOnHand: finiteNumber(record.cash_on_hand_end_period),
    reportingPeriod: `${record.coverage_start_date ?? `${record.cycle - 1}-01-01`} through ${record.coverage_end_date ?? "latest FEC report"}`,
    periodStart: sourceDate(record.coverage_start_date),
    periodEnd: sourceDate(record.coverage_end_date),
    topContributors: [],
  };
}

function transparencySnapshot(snapshot: TransparencySnapshot): FinancialSnapshot {
  return {
    sourceCheckedAt: snapshot.checkedAt,
    sourceKind: "transparency_usa",
    sourceName: "Transparency USA Nevada campaign finance",
    sourceUrl: snapshot.sourceUrl,
    cycleYear: snapshot.cycle === "all" ? CURRENT_CYCLE : snapshot.cycle,
    totalRaised: snapshot.totalRaised,
    totalSpent: snapshot.totalSpent,
    cashOnHand: null,
    reportingPeriod: snapshot.reportingPeriod,
    periodStart: snapshot.coverageStart,
    periodEnd: snapshot.coverageEnd,
    topContributors: snapshot.topContributors,
  };
}

function matchedDisclosureFilings(entity: FinancialEntity, documents: NvSosStructuredDocument[]) {
  return documents
    .filter((document) => /financial disclosure/i.test(document.filing_report_type ?? ""))
    .filter((document) => nameMatchScore(entity.name, document.candidate_name ?? "") >= 0.92)
    .map(
      (document): DisclosureSummary => ({
        name: document.filing_report_type ?? "Financial disclosure",
        // An election year does not establish the date a disclosure was filed.
        filedAt: null,
        url: document.source_url ?? auroraSearchUrl(entity.name),
      }),
    )
    .filter((filing, index, filings) => filings.findIndex((candidate) => candidate.name === filing.name && candidate.filedAt === filing.filedAt && candidate.url === filing.url) === index)
    .sort((left, right) => (right.filedAt ?? "").localeCompare(left.filedAt ?? ""));
}

export function transparencyIdentityMatches(entityName: string, publishedName: string, sourceUrl: string, aliases: Record<string, string>) {
  if (nameMatchScore(entityName, publishedName) >= 0.9) return true;
  // Preserve explicit source-catalog aliases and nicknames present in the person's
  // own recorded ballot name; a changed page title still has to match that identity.
  const publishedVariants = new Set(nameVariants(publishedName));
  if (nameVariants(entityName).some(variant => publishedVariants.has(variant))) return true;
  const reviewedSlug = aliases[reorderCommaName(entityName)];
  return Boolean(reviewedSlug && transparencySlug(sourceUrl) === reviewedSlug && publishedVariants.has(reviewedSlug));
}

function buildCoverage(
  entities: FinancialEntity[],
  catalog: Catalog,
  fecByCycle: Map<number, FecTotal[]>,
  transparencyMatches: Map<string, { url: string; confidence: number }>,
  transparencySnapshots: Map<string, TransparencySnapshot>,
  disclosureDocuments: NvSosStructuredDocument[],
) {
  const sourceById = new Map(catalog.sources.map((source) => [source.id, source]));
  const records: EntityCoverage[] = [];

  for (const entity of entities) {
    const federal = isFederalOffice(entity.office);
    const exactCycleMatch = federal ? matchFec(entity, fecByCycle.get(entity.electionYear) ?? []) : null;
    const historicalOfficialMatch =
      federal && entity.entityType === "official"
        ? FEC_CYCLES.slice()
            .sort((left, right) => right - left)
            .map((cycle) => matchFec(entity, fecByCycle.get(cycle) ?? []))
            .find(Boolean) ?? null
        : null;
    const fecMatch = exactCycleMatch ?? historicalOfficialMatch;
    const transparencyMatch = transparencyMatches.get(`${entity.entityType}:${entity.id}`) ?? null;
    const currentAggregate = transparencyMatch
      ? transparencySnapshots.get(`${transparencyMatch.url}|${entity.entityType === "candidate" ? entity.electionYear : CURRENT_CYCLE}`) ?? null
      : null;
    const transparencyCurrent = currentAggregate && transparencyIdentityMatches(entity.name, currentAggregate.candidateName, currentAggregate.sourceUrl, catalog.transparencyIdentityAliases ?? {}) ? currentAggregate : null;
    const allAggregate = transparencyMatch ? transparencySnapshots.get(`${transparencyMatch.url}|all`) ?? null : null;
    const transparencyAll = allAggregate && transparencyIdentityMatches(entity.name, allAggregate.candidateName, allAggregate.sourceUrl, catalog.transparencyIdentityAliases ?? {}) ? allAggregate : null;
    const transparencyHistory = transparencyMatch
      ? FEC_CYCLES.flatMap((cycle) => {
          const record = transparencySnapshots.get(`${transparencyMatch.url}|${cycle}`);
          return record && transparencyIdentityMatches(entity.name, record.candidateName, record.sourceUrl, catalog.transparencyIdentityAliases ?? {}) && (record.totalRaised > 0 || record.totalSpent > 0)
            ? [transparencySnapshot(record)]
            : [];
        })
      : [];
    const primarySourceId = federal ? "fec-open-api-nevada" : "nevada-sos-aurora-campaign-finance";
    const primarySource = sourceById.get(primarySourceId)!;
    const primarySourceUrl = fecMatch
      ? `https://www.fec.gov/data/candidate/${fecMatch.record.candidate_id}/?cycle=${fecMatch.record.cycle}&election_full=false`
      : federal
        ? fecSearchUrl(entity)
        : auroraSearchUrl(entity.name);

    const fecHistory = fecMatch
      ? FEC_CYCLES.flatMap((cycle) => {
          const record = (fecByCycle.get(cycle) ?? []).find((candidate) => candidate.candidate_id === fecMatch.record.candidate_id);
          const snapshot = record ? fecSnapshot(record) : null;
          return snapshot ? [snapshot] : [];
        })
      : [];
    const snapshot = fecMatch ? fecSnapshot(fecMatch.record) : transparencyCurrent ? transparencySnapshot(transparencyCurrent) : null;
    const cycleHistory: FinancialCycle[] = (
      fecHistory.length
        ? fecHistory
        : transparencyHistory.length
          ? transparencyHistory
          : transparencyCurrent
            ? [transparencySnapshot(transparencyCurrent)]
          : []
    )
      .map((cycle) => ({
        ...cycle,
        displayLabel: financialCycleDisplayLabel(cycle),
        isCurrentCycle: cycle.cycleYear === fecMatch?.record.cycle || (!fecMatch && cycle.cycleYear === entity.electionYear),
      }))
      .sort((left, right) => right.cycleYear - left.cycleYear);

    const allReportedTotals = fecHistory.length
      ? {
            label: "Federal campaign activity across available cycles",
            reportingPeriod: `${fecHistory.at(0)?.periodStart ?? "available history"} through ${fecHistory.at(-1)?.periodEnd ?? "latest report"}`,
            totalRaised: roundMoney(fecHistory.reduce((sum, record) => sum + record.totalRaised, 0)),
            totalSpent: roundMoney(fecHistory.reduce((sum, record) => sum + record.totalSpent, 0)),
            cycleCount: fecHistory.length,
            sourceName: "Federal Election Commission OpenFEC",
            sourceUrl: primarySourceUrl,
            aggregationMethod: "Sum of the non-overlapping OpenFEC reporting periods shown in the campaign history.",
          }
      : transparencyAll
        ? {
            label: "All published Nevada campaign activity since 2017",
            reportingPeriod: transparencyAll.reportingPeriod,
            totalRaised: transparencyAll.totalRaised,
            totalSpent: transparencyAll.totalSpent,
            cycleCount: cycleHistory.length,
            sourceName: "Transparency USA Nevada campaign finance",
            sourceUrl: transparencyAll.sourceUrl,
            aggregationMethod: "Published all-cycle aggregate derived from Nevada campaign-finance filings; official filings remain linked separately.",
          }
        : null;
    const status: EntityCoverage["campaignFinance"]["status"] = fecMatch && snapshot
      ? "verified_totals"
      : transparencyCurrent
        ? "derived_totals"
        : transparencyMatch
          ? "source_matched_pending_extraction"
          : "source_registered";

    const disclosureId = disclosureSourceId(entity);
    const disclosureSource = sourceById.get(disclosureId)!;
    const filings = matchedDisclosureFilings(entity, disclosureDocuments);
    records.push({
      entityType: entity.entityType,
      entityId: entity.id,
      name: reorderCommaName(entity.name),
      office: entity.office,
      jurisdiction: entity.jurisdiction,
      electionYear: entity.electionYear,
      campaignFinance: {
        primarySourceId,
        primarySourceName: primarySource.name,
        primarySourceUrl,
        aggregateSourceUrl: transparencyMatch?.url ?? null,
        fecCandidateId: fecMatch?.record.candidate_id ?? null,
        matchConfidence: fecMatch?.score ?? transparencyMatch?.confidence ?? null,
        status,
        snapshot,
        cycleHistory,
        allReportedTotals,
        topContributors: federal
          ? []
          : transparencyAll?.topContributors ?? transparencyCurrent?.topContributors ?? [],
      },
      personalFinancialDisclosure: {
        sourceId: disclosureId,
        sourceName: disclosureSource.name,
        sourceUrl: directDisclosureUrl(disclosureSource, entity),
        applicability:
          entity.entityType === "candidate" || /\b(assembly|senate|senator|representative|mayor|council|commissioner|trustee|governor|secretary|attorney general|controller|treasurer|regent|judge|justice)\b/i.test(entity.office)
            ? "required_or_likely"
            : "eligibility_review",
        status: filings.length ? "matched_filings" : "source_registered",
        filings,
        note:
          disclosureId === "nevada-aoc-judicial-financial-disclosures"
            ? "Judicial personal-financial disclosures are filed with the Nevada Administrative Office of the Courts and remain separate from campaign contribution reports."
            : disclosureId === "nevada-sos-financial-disclosures"
              ? "Nevada filing requirements depend on election or appointment status, office, and statutory compensation thresholds. A source registration is not proof that a filing was required or filed."
              : "Federal personal-financial disclosures are filed through the office-specific portal and remain separate from FEC campaign committee reports.",
      },
    });
  }
  return records;
}

function sourceTypeForCatalog(source: CatalogSource) {
  if (source.accessMethod === "api") return SourceType.JSON;
  if (source.id.includes("sos")) return SourceType.ELECTIONS_PORTAL;
  return SourceType.HTML;
}

function accessMethodForCatalog(source: CatalogSource) {
  if (source.accessMethod === "api") return "api" as const;
  return "html" as const;
}

async function upsertCatalogSources(catalog: Catalog, collectedAt: Date) {
  const sourceMap = new Map<string, { id: string }>();
  for (const source of catalog.sources) {
    const attempts = sourceAttempts.filter(attempt => source.id === "fec-open-api-nevada" ? attempt.url.includes("api.open.fec.gov/") : source.id === "transparency-usa-nevada" ? attempt.url.includes("transparencyusa.org/") : false);
    const successful = attempts.length > 0 && attempts.every(attempt => attempt.status === "fetched");
    const attempted = attempts.some(attempt => attempt.attemptedAt);
    const row = await prisma.source.upsert({
      where: { slug: source.id },
      create: {
        name: source.name,
        slug: source.id,
        sourceType: sourceTypeForCatalog(source),
        url: source.url,
        adapterKey: AUTO_IMPORT_METHOD,
        dataCategory: source.categories.join(","),
        accessMethod: accessMethodForCatalog(source),
        refreshFrequency: `direct every ${source.directCadenceDays} day(s); advanced every ${source.advancedCadenceDays} day(s)`,
        lastCheckedAt: attempted ? collectedAt : null,
        lastSuccessAt: successful ? collectedAt : null,
        lastSyncAt: collectedAt,
        syncStatus: successful ? SourceSyncStatus.SUCCESS : attempted ? SourceSyncStatus.ERROR : SourceSyncStatus.NEVER_SYNCED,
        notes: source.notes,
        metadata: JSON.parse(JSON.stringify({ authority: source.authority, categories: source.categories })),
      },
      update: {
        name: source.name,
        sourceType: sourceTypeForCatalog(source),
        url: source.url,
        adapterKey: AUTO_IMPORT_METHOD,
        dataCategory: source.categories.join(","),
        accessMethod: accessMethodForCatalog(source),
        refreshFrequency: `direct every ${source.directCadenceDays} day(s); advanced every ${source.advancedCadenceDays} day(s)`,
        ...(attempted ? { lastCheckedAt: collectedAt } : {}),
        ...(successful ? { lastSuccessAt: collectedAt, syncStatus: SourceSyncStatus.SUCCESS } : attempted ? { syncStatus: SourceSyncStatus.ERROR } : {}),
        lastSyncAt: collectedAt,
        notes: source.notes,
        metadata: JSON.parse(JSON.stringify({ authority: source.authority, categories: source.categories })),
      },
      select: { id: true },
    });
    sourceMap.set(source.id, row);
  }
  return sourceMap;
}

async function upsertAttribution(input: {
  entityType: CivicEntityType;
  entityId: string;
  fieldName: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  confidenceScore: number;
  reviewStatus: CivicRecordReviewStatus;
  fieldsDerived: string[];
  metadata: unknown;
  collectedAt: Date;
}) {
  const existing = await prisma.sourceAttribution.findFirst({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
      fieldName: input.fieldName,
      sourceId: input.sourceId,
    },
    select: { id: true },
  });
  const data = {
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    confidenceScore: input.confidenceScore,
    reviewStatus: input.reviewStatus,
    fieldsDerived: JSON.parse(JSON.stringify(input.fieldsDerived)),
    lastImportedAt: input.collectedAt,
    verifiedAt: input.reviewStatus === CivicRecordReviewStatus.verified ? input.collectedAt : null,
    metadata: JSON.parse(JSON.stringify(input.metadata)),
  };
  if (existing) return prisma.sourceAttribution.update({ where: { id: existing.id }, data });
  return prisma.sourceAttribution.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      fieldName: input.fieldName,
      ...data,
    },
  });
}

async function upsertCandidateSnapshot(
  entity: CandidateEntity,
  coverage: EntityCoverage,
  sourceIds: Map<string, { id: string }>,
  collectedAt: Date,
) {
  const snapshot = coverage.campaignFinance.snapshot;
  if (!snapshot) return;
  const reportingPeriod = snapshot.reportingPeriod;
  const sourceUrl = snapshot.sourceUrl;
  const reviewedCycleFilings = await prisma.campaignFinanceFiling.findMany({
    where: { candidateId: entity.id },
    select: { rawData: true },
  });
  const hasReviewedCurrentCycle = reviewedCycleFilings.some((filing) => {
    const rawData = filing.rawData && typeof filing.rawData === "object" && !Array.isArray(filing.rawData)
      ? (filing.rawData as Record<string, unknown>)
      : null;
    return (
      rawData?.recordKind === "reviewed_cycle_aggregate" &&
      rawData.isCurrentCycle === true &&
      (finiteNumber(rawData.cycleYear) ?? 0) >= snapshot.cycleYear
    );
  });
  const summaryData = {
    candidateId: entity.id,
    totalRaised: snapshot.totalRaised,
    totalSpent: snapshot.totalSpent,
    cashOnHand: snapshot.cashOnHand,
    reportingPeriod,
    sourceName: snapshot.sourceName,
    sourceUrl,
    reviewStatus:
      snapshot.sourceKind === "fec" ? CivicRecordReviewStatus.verified : CivicRecordReviewStatus.imported,
    lastUpdated: collectedAt,
  };
  const existingSummary = await prisma.campaignFinanceSummary.findFirst({
    where: { candidateId: entity.id, sourceUrl, reportingPeriod },
    select: { id: true },
  });
  if (!hasReviewedCurrentCycle) await prisma.campaignFinanceSummary.deleteMany({
    where: {
      candidateId: entity.id,
      sourceName: snapshot.sourceName,
      NOT: { reportingPeriod },
    },
  });
  if (hasReviewedCurrentCycle) {
    // A reviewed aggregate owns the display; leave its summaries intact.
  } else if (existingSummary) {
    await prisma.campaignFinanceSummary.update({ where: { id: existingSummary.id }, data: summaryData });
  } else {
    await prisma.campaignFinanceSummary.create({ data: summaryData });
  }

  const filingSourceId =
    sourceIds.get(snapshot.sourceKind === "fec" ? "fec-open-api-nevada" : "transparency-usa-nevada")?.id ??
    sourceIds.get(coverage.campaignFinance.primarySourceId)!.id;
  for (const cycle of coverage.campaignFinance.cycleHistory) {
    const externalId = `statewide-finance:${entity.id}:${cycle.sourceKind}:${cycle.cycleYear}`;
    await prisma.campaignFinanceFiling.upsert({
      where: { sourceId_externalId: { sourceId: filingSourceId, externalId } },
      create: {
        jurisdictionId: entity.jurisdictionId,
        candidateId: entity.id,
        sourceId: filingSourceId,
        externalId,
        filingType: CampaignFinanceFilingType.OTHER,
        filerName: reorderCommaName(entity.ballotName ?? entity.name),
        periodStart: cycle.periodStart ? new Date(`${cycle.periodStart}T00:00:00.000Z`) : null,
        periodEnd: cycle.periodEnd ? new Date(`${cycle.periodEnd}T23:59:59.999Z`) : null,
        amountRaised: cycle.totalRaised,
        amountSpent: cycle.totalSpent,
        filingUrl: cycle.sourceUrl,
        rawData: JSON.parse(
          JSON.stringify({
            recordKind: "statewide_cycle_aggregate",
            importMethod: AUTO_IMPORT_METHOD,
            cycleYear: cycle.cycleYear,
            cycleDisplayLabel: cycle.displayLabel,
            isCurrentCycle: cycle.isCurrentCycle,
            filingName: `${cycle.displayLabel} totals`,
            reportingPeriod: cycle.reportingPeriod,
            cashOnHand: cycle.cashOnHand,
            primaryOfficialSourceUrl: coverage.campaignFinance.primarySourceUrl,
            aggregationSourceKind: cycle.sourceKind,
          }),
        ),
      },
      update: {
        candidateId: entity.id,
        jurisdictionId: entity.jurisdictionId,
        periodStart: cycle.periodStart ? new Date(`${cycle.periodStart}T00:00:00.000Z`) : null,
        periodEnd: cycle.periodEnd ? new Date(`${cycle.periodEnd}T23:59:59.999Z`) : null,
        amountRaised: cycle.totalRaised,
        amountSpent: cycle.totalSpent,
        filingUrl: cycle.sourceUrl,
        rawData: JSON.parse(
          JSON.stringify({
            recordKind: "statewide_cycle_aggregate",
            importMethod: AUTO_IMPORT_METHOD,
            cycleYear: cycle.cycleYear,
            cycleDisplayLabel: cycle.displayLabel,
            isCurrentCycle: cycle.isCurrentCycle,
            filingName: `${cycle.displayLabel} totals`,
            reportingPeriod: cycle.reportingPeriod,
            cashOnHand: cycle.cashOnHand,
            primaryOfficialSourceUrl: coverage.campaignFinance.primarySourceUrl,
            aggregationSourceKind: cycle.sourceKind,
          }),
        ),
      },
    });
  }

  if (coverage.campaignFinance.allReportedTotals) {
    const aggregate = coverage.campaignFinance.allReportedTotals;
    const aggregateSourceId = sourceIds.get(
      aggregate.sourceName.includes("Transparency USA") ? "transparency-usa-nevada" : "fec-open-api-nevada",
    )!.id;
    const externalId = `statewide-finance:${entity.id}:all-reported`;
    await prisma.campaignFinanceFiling.upsert({
      where: { sourceId_externalId: { sourceId: aggregateSourceId, externalId } },
      create: {
        jurisdictionId: entity.jurisdictionId,
        candidateId: entity.id,
        sourceId: aggregateSourceId,
        externalId,
        filingType: CampaignFinanceFilingType.OTHER,
        filerName: reorderCommaName(entity.ballotName ?? entity.name),
        amountRaised: aggregate.totalRaised,
        amountSpent: aggregate.totalSpent,
        filingUrl: aggregate.sourceUrl,
        rawData: JSON.parse(
          JSON.stringify({
            recordKind: "statewide_all_reported_aggregate",
            importMethod: AUTO_IMPORT_METHOD,
            filingName: aggregate.label,
            reportingPeriod: aggregate.reportingPeriod,
            cycleCount: aggregate.cycleCount,
            aggregationMethod: aggregate.aggregationMethod,
            primaryOfficialSourceUrl: coverage.campaignFinance.primarySourceUrl,
          }),
        ),
      },
      update: {
        candidateId: entity.id,
        jurisdictionId: entity.jurisdictionId,
        amountRaised: aggregate.totalRaised,
        amountSpent: aggregate.totalSpent,
        filingUrl: aggregate.sourceUrl,
        rawData: JSON.parse(
          JSON.stringify({
            recordKind: "statewide_all_reported_aggregate",
            importMethod: AUTO_IMPORT_METHOD,
            filingName: aggregate.label,
            reportingPeriod: aggregate.reportingPeriod,
            cycleCount: aggregate.cycleCount,
            aggregationMethod: aggregate.aggregationMethod,
            primaryOfficialSourceUrl: coverage.campaignFinance.primarySourceUrl,
          }),
        ),
      },
    });
  }

  const reportPrefix = `statewide-auto-top-contributors:${entity.id}:`;
  await prisma.campaignFinanceContribution.deleteMany({
    where: { candidateId: entity.id, reportId: { startsWith: reportPrefix } },
  });
  if (coverage.campaignFinance.topContributors.length) {
    const reportId = `${reportPrefix}${coverage.campaignFinance.allReportedTotals?.reportingPeriod ?? snapshot.reportingPeriod}`;
    await prisma.campaignFinanceContribution.createMany({
      data: coverage.campaignFinance.topContributors.map((contributor) => ({
        candidateId: entity.id,
        contributorName: contributor.name,
        contributorType:
          contributor.type === "INDIVIDUAL"
            ? CampaignFinanceContributorType.individual
            : /\b(pac|committee|party)\b/i.test(contributor.name)
              ? CampaignFinanceContributorType.pac
              : CampaignFinanceContributorType.business,
        amount: contributor.amount,
        reportId,
        sourceName: "Transparency USA Nevada campaign finance",
        sourceUrl: coverage.campaignFinance.aggregateSourceUrl ?? snapshot.sourceUrl,
        reviewStatus: CivicRecordReviewStatus.imported,
        confidenceScore: 0.9,
      })),
    });
  }
}

async function syncCoverage(
  entities: FinancialEntity[],
  coverageRecords: EntityCoverage[],
  catalog: Catalog,
  collectedAt: Date,
) {
  const sourceRows = await upsertCatalogSources(catalog, collectedAt);
  const coverageByEntity = new Map(coverageRecords.map((record) => [`${record.entityType}:${record.entityId}`, record]));
  let synced = 0;

  for (const entity of entities) {
    const coverage = coverageByEntity.get(`${entity.entityType}:${entity.id}`)!;
    const civicEntityType = entity.entityType === "candidate" ? CivicEntityType.CANDIDATE : CivicEntityType.OFFICIAL;
    const campaignSource = sourceRows.get(coverage.campaignFinance.primarySourceId)!;
    const disclosureSource = sourceRows.get(coverage.personalFinancialDisclosure.sourceId)!;
    const hasTotals = Boolean(coverage.campaignFinance.snapshot);
    await upsertAttribution({
      entityType: civicEntityType,
      entityId: entity.id,
      fieldName: "campaign_finance",
      sourceId: campaignSource.id,
      sourceName: coverage.campaignFinance.primarySourceName,
      sourceUrl: coverage.campaignFinance.primarySourceUrl,
      confidenceScore: coverage.campaignFinance.matchConfidence ?? 0.7,
      reviewStatus:
        coverage.campaignFinance.status === "verified_totals"
          ? CivicRecordReviewStatus.verified
          : hasTotals
            ? CivicRecordReviewStatus.imported
            : CivicRecordReviewStatus.pending_review,
      fieldsDerived: hasTotals
        ? ["campaign finance source", "cycle totals", "all-reported totals", "reporting period"]
        : ["campaign finance source route"],
      metadata: {
        importMethod: AUTO_IMPORT_METHOD,
        coverageStatus: coverage.campaignFinance.status,
        sourceAuthority: coverage.campaignFinance.primarySourceId === "fec-open-api-nevada" ? "primary" : "primary_source_route",
        primaryOfficialSourceUrl: coverage.campaignFinance.primarySourceUrl,
        aggregateSourceUrl: coverage.campaignFinance.aggregateSourceUrl,
        fecCandidateId: coverage.campaignFinance.fecCandidateId,
        financialSnapshot: coverage.campaignFinance.snapshot,
        cycleHistory: coverage.campaignFinance.cycleHistory,
        allReportedTotals: coverage.campaignFinance.allReportedTotals,
        sourceLinks: [
          {
            label: coverage.campaignFinance.primarySourceName,
            url: coverage.campaignFinance.primarySourceUrl,
            note: "Primary campaign-finance authority or candidate-specific official record",
          },
          ...(coverage.campaignFinance.aggregateSourceUrl
            ? [
                {
                  label: "Transparency USA Nevada aggregate",
                  url: coverage.campaignFinance.aggregateSourceUrl,
                  note: "Derived cross-check and aggregate adapter based on Nevada filings",
                },
              ]
            : []),
        ],
        donorExtractionStatus: coverage.campaignFinance.topContributors.length
          ? `${coverage.campaignFinance.topContributors.length} published top-contributor aggregates imported; entity classifications remain reviewable.`
          : hasTotals
            ? "Official totals are available. Itemized contributor expansion is pending or not available for this source."
            : "The source route is registered. Filing discovery and reviewed total extraction remain pending.",
        campaignReportedSummary: hasTotals
          ? `Campaign totals are source-backed for ${coverage.campaignFinance.snapshot?.reportingPeriod}. Personal-financial disclosures and independent expenditures are tracked separately.`
          : "No campaign total is inferred from an empty search result. The registered source must produce a matched filing before totals appear.",
      },
      collectedAt,
    });

    await upsertAttribution({
      entityType: civicEntityType,
      entityId: entity.id,
      fieldName: "financial_disclosure",
      sourceId: disclosureSource.id,
      sourceName: coverage.personalFinancialDisclosure.sourceName,
      sourceUrl: coverage.personalFinancialDisclosure.sourceUrl,
      confidenceScore: coverage.personalFinancialDisclosure.filings.length ? 0.96 : 0.75,
      reviewStatus: coverage.personalFinancialDisclosure.filings.length
        ? CivicRecordReviewStatus.verified
        : CivicRecordReviewStatus.pending_review,
      fieldsDerived: coverage.personalFinancialDisclosure.filings.length
        ? ["personal financial disclosure source", "filing references"]
        : ["personal financial disclosure source route"],
      metadata: {
        importMethod: AUTO_IMPORT_METHOD,
        coverageStatus: coverage.personalFinancialDisclosure.status,
        applicability: coverage.personalFinancialDisclosure.applicability,
        filingSummaries: coverage.personalFinancialDisclosure.filings,
        sourceLinks: [
          {
            label: coverage.personalFinancialDisclosure.sourceName,
            url: coverage.personalFinancialDisclosure.sourceUrl,
            note: "Official personal-financial-disclosure portal",
          },
        ],
        note: coverage.personalFinancialDisclosure.note,
      },
      collectedAt,
    });

    if (entity.entityType === "candidate") {
      await upsertCandidateSnapshot(entity, coverage, sourceRows, collectedAt);
      if (hasTotals) {
        await prisma.dataQualityIssue.updateMany({
          where: {
            recordType: CivicEntityType.CANDIDATE,
            recordId: entity.id,
            issueType: "missing_campaign_finance",
            status: { in: ["open", "in_review"] },
          },
          data: {
            status: "resolved",
            resolvedAt: collectedAt,
            notes: "Resolved by the statewide Nevada financial coverage collector.",
          },
        });
      }
    }
    synced += 1;
  }
  return synced;
}

function buildAudit(records: EntityCoverage[], collection: { transparencyPagesFetched: number; transparencyShard: number }) {
  const candidates = records.filter((record) => record.entityType === "candidate");
  const officials = records.filter((record) => record.entityType === "official");
  const withTotals = records.filter((record) => Boolean(record.campaignFinance.snapshot));
  return {
    entities: records.length,
    candidates: candidates.length,
    currentOfficials: officials.length,
    campaignSourcesRegistered: records.filter((record) => Boolean(record.campaignFinance.primarySourceUrl)).length,
    campaignTotalsAvailable: withTotals.length,
    candidateTotalsAvailable: candidates.filter((record) => Boolean(record.campaignFinance.snapshot)).length,
    officialTotalsAvailable: officials.filter((record) => Boolean(record.campaignFinance.snapshot)).length,
    verifiedFecTotals: records.filter((record) => record.campaignFinance.status === "verified_totals").length,
    derivedNevadaTotals: records.filter((record) => record.campaignFinance.status === "derived_totals").length,
    aggregateSourceMatches: records.filter((record) => Boolean(record.campaignFinance.aggregateSourceUrl)).length,
    sourceMatchedPendingExtraction: records.filter((record) => record.campaignFinance.status === "source_matched_pending_extraction").length,
    sourceRegisteredOnly: records.filter((record) => record.campaignFinance.status === "source_registered").length,
    disclosureSourcesRegistered: records.filter((record) => Boolean(record.personalFinancialDisclosure.sourceUrl)).length,
    disclosureFilingsMatched: records.filter((record) => record.personalFinancialDisclosure.filings.length > 0).length,
    contributorSamplesAvailable: records.filter((record) => record.campaignFinance.topContributors.length > 0).length,
    transparencyPagesFetched: collection.transparencyPagesFetched,
    transparencyShard: collection.transparencyShard,
  };
}

async function main() {
  const fullPass = process.argv.includes("--full") || process.argv.includes("--first-pass");
  const missingOnly = process.argv.includes("--missing-only");
  const noNetwork = process.argv.includes("--no-network");
  const allowNetwork = !noNetwork;
  const noSync = process.argv.includes("--no-sync");
  const collectedAt = new Date();
  await Promise.all([
    mkdir(FEC_CACHE_DIR, { recursive: true }),
    mkdir(TRANSPARENCY_CACHE_DIR, { recursive: true }),
  ]);

  const [catalog, entities, disclosureDocuments] = await Promise.all([
    readJson<Catalog>(CATALOG_PATH, { version: 1, sources: [] }),
    loadEntities(),
    readJson<NvSosStructuredDocument[]>(NV_SOS_STRUCTURED_PATH, []),
  ]);
  if (!catalog.sources.length) throw new Error("Nevada financial source catalog is empty.");

  const transparencySource = catalog.sources.find((source) => source.id === "transparency-usa-nevada");
  if (!transparencySource) throw new Error("Transparency USA source is missing from the financial catalog.");

  const [fecByCycle, transparencyUrls] = await Promise.all([
    collectFecTotals(allowNetwork),
    collectTransparencySitemap(allowNetwork, transparencySource),
  ]);
  const transparencyMatches = new Map<string, { url: string; confidence: number }>();
  for (const entity of entities) {
    const match = matchTransparencyUrl(entity, transparencyUrls, catalog.transparencyIdentityAliases ?? {});
    if (match) transparencyMatches.set(`${entity.entityType}:${entity.id}`, match);
  }
  const transparency = await collectTransparencyPages(
    transparencyMatches,
    entities,
    allowNetwork,
    fullPass,
    missingOnly,
  );
  const coverage = buildCoverage(
    entities,
    catalog,
    fecByCycle,
    transparencyMatches,
    transparency.snapshots,
    disclosureDocuments,
  );
  // Publish the valid collected artifact even if a later database write fails.
  let syncedEntities = 0;
  let syncError: string | null = null;
  if (!noSync && entityInventory.source !== "database") syncError = "Database publication deferred because the entity inventory is cached";
  if (!noSync && entityInventory.source === "database") {
    try { syncedEntities = await syncCoverage(entities, coverage, catalog, collectedAt); }
    catch (error) { syncError = error instanceof Error ? error.message.split("\n").slice(-3).join(" ") : "Financial database sync failed"; }
  }
  const audit = buildAudit(coverage, {
    transparencyPagesFetched: transparency.scheduledUrls,
    transparencyShard: transparency.shard,
  });
  const output = {
    generatedAt: collectedAt.toISOString(),
    catalogVersion: catalog.version,
    mode: fullPass ? "full" : noNetwork ? "cache_only" : "scheduled",
    cadence: {
      direct: "once daily",
      advanced: "one deterministic seventh of matched aggregate pages daily; every matched entity within seven days",
    },
    audit: {
      ...audit,
      syncedEntities,
    },
    sourceHealth: {
      checkedAt: collectedAt.toISOString(),
      attempted: sourceAttempts.filter(attempt => attempt.attemptedAt).length,
      fetched: sourceAttempts.filter(attempt => attempt.status === "fetched").length,
      cachedAfterError: sourceAttempts.filter(attempt => attempt.status === "cached_after_error").length,
      unavailable: sourceAttempts.filter(attempt => attempt.status === "unavailable").length,
      attempts: sourceAttempts,
    },
    entityInventory: { ...entityInventory, records: entities },
    databaseSync: { requested: !noSync, succeeded: !noSync && !syncError, error: syncError },
    records: coverage,
  };
  await writeJson(OUTPUT_PATH, output);
  console.log(JSON.stringify(output.audit, null, 2));
  console.log(`Wrote statewide financial coverage to ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(JSON.stringify({ sourceHealth: { ...output.sourceHealth, attempts: undefined }, databaseSync: output.databaseSync }, null, 2));
  if (syncError) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
