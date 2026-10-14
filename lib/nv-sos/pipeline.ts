import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type NvSosSourceType =
  | "candidate_public_media"
  | "candidate_detail"
  | "campaign_finance_report"
  | "campaign_finance_archive"
  | "show_document"
  | "candidate_filing"
  | "other";

export type NvSosExpectedContentType = "html" | "pdf" | "unknown";

export type NvSosSource = {
  id: string;
  source_type: NvSosSourceType;
  source_url: string;
  candidate_name: string | null;
  office_name: string | null;
  jurisdiction: string | null;
  election_year: number | null;
  expected_content_type: NvSosExpectedContentType;
  notes: string | null;
  enabled: boolean;
};

export type NvSosFetchStatus = "success_html" | "success_pdf" | "blocked_incapsula" | "blocked_access_denied" | "forbidden" | "not_found" | "error_http" | "error_fetch" | "error";

export type NvSosFetchLogEntry = {
  source_id: string;
  source_type: NvSosSourceType;
  source_url: string;
  source_stage?: "seed" | "expanded";
  fetched_at: string;
  status: NvSosFetchStatus;
  http_status: number | null;
  content_type: string | null;
  sha256: string | null;
  bytes: number;
  cached_path: string | null;
  required_cookies: string[];
  used_cookie_file: boolean;
  error: string | null;
};

export type NvSosDiscoveredSource = NvSosSource & {
  discovered_from_source_id: string;
  discovered_from_url: string;
  discovered_at: string;
  link_text: string | null;
};

export type NvSosExpandedSource = {
  id: string;
  source_id: string;
  source_type: NvSosSourceType;
  source_url: string;
  parent_source_id: string | null;
  candidate_name: string | null;
  office_name: string | null;
  jurisdiction: string | null;
  election_year: number | null;
  expected_content_type: NvSosExpectedContentType;
  discovery_context: {
    discovered_from_url: string | null;
    link_text: string | null;
    notes: string | null;
  };
  enabled: boolean;
};

export type NvSosExtractedDocument = {
  source_id: string;
  source_url: string;
  source_type: NvSosSourceType;
  content_kind: "html" | "pdf";
  sha256: string;
  cached_path: string;
  text_path: string;
  extracted_at: string;
  title: string | null;
  text_length: number;
  extraction_method: "pdf_embedded_text" | "pdf_ocr_text" | "pdf_text_pending_ocr" | "html_text";
  needs_ocr: boolean;
};

export type NvSosStructuredDocument = {
  source_id: string;
  source_url: string;
  source_type: NvSosSourceType;
  cached_path: string;
  text_path: string;
  parsed_at: string;
  candidate_name: string | null;
  office: string | null;
  jurisdiction: string | null;
  election_year: number | null;
  filing_report_type: string | null;
  report_period: string | null;
  contribution_total: number | null;
  expense_total: number | null;
  cash_on_hand: number | null;
  itemized_contributors: Array<{ name: string; amount: number | null; date: string | null }>;
  itemized_payees: Array<{ name: string; amount: number | null; date: string | null }>;
  parse_confidence: number;
  unmatched: boolean;
};

export type NvSosCampaignFinanceRecord = {
  source_id: string;
  source_url: string;
  cached_path: string;
  candidate_name: string | null;
  office: string | null;
  report_name: string | null;
  report_year: number | null;
  report_period: string | null;
  total_contributions: number | null;
  total_expenses: number | null;
  cash_on_hand: number | null;
  itemized_contributors: Array<{ name: string; amount: number | null; date: string | null }>;
  itemized_expenses: Array<{ name: string; amount: number | null; date: string | null }>;
  parse_confidence: number;
  unmatched: boolean;
};

export type NvSosCandidateRecord = {
  source_id: string;
  source_url: string;
  cached_path: string;
  candidate_name: string | null;
  office: string | null;
  jurisdiction: string | null;
  district: string | null;
  party: string | null;
  election_year: number | null;
  filing_status: string | null;
  mailing_address: string | null;
  public_contact: {
    website: string | null;
    email: string | null;
    phone: string | null;
  };
  parse_confidence: number;
  unmatched: boolean;
};

export type NvSosDataQualityReport = {
  generated_at: string;
  total_records: number;
  matched_records: number;
  unmatched_records: number;
  records_missing_candidate_name: number;
  records_missing_office: number;
  records_missing_totals: number;
  duplicate_candidate_report_records: Array<{
    key: string;
    count: number;
    source_urls: string[];
  }>;
  blocked_urls: Array<{
    source_id: string;
    source_stage: "seed" | "expanded" | null;
    source_url: string;
    status: NvSosFetchStatus;
    http_status: number | null;
    fetched_at: string;
  }>;
  parser_confidence_summary: {
    min: number | null;
    max: number | null;
    average: number | null;
    low_count: number;
    medium_count: number;
    high_count: number;
  };
  breakdown: {
    candidate_records: number;
    campaign_finance_records: number;
    structured_documents: number;
    successful_html: number;
    successful_pdfs: number;
    blocked_or_forbidden: number;
  };
};

export type NvSosOperationalStatus = {
  generated_at: string;
  live_fetch_status: "not_run" | "active" | "mixed" | "blocked" | "error";
  session_status: "active_session" | "stale_blocked_session";
  last_successful_live_fetch_at: string | null;
  last_successful_parse_at: string | null;
  records_served_from_cache: number;
  blocked_unique_urls: number;
  next_recommended_action: string;
  details: {
    current_successful_html: number;
    current_successful_pdfs: number;
    current_blocked_or_forbidden: number;
    cached_candidate_records: number;
    cached_campaign_finance_records: number;
    cached_structured_documents: number;
  };
};

export const NV_SOS_PATHS = {
  seedSources: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "source-seeds", "nv-sos-sources.json"),
  generatedSources: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-discovered-sources.json"),
  expandedSources: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-expanded-sources.json"),
  fetchLog: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-fetch-log.json"),
  expandedFetchLog: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-expanded-fetch-log.json"),
  extractedDocuments: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-extracted-documents.json"),
  structuredDocuments: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-structured-documents.json"),
  campaignFinanceRecords: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-campaign-finance-records.json"),
  candidateRecords: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-candidate-records.json"),
  dataQualityReport: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-data-quality-report.json"),
  operationalStatus: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-operational-status.json"),
  cookieFile: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "private", "nv-sos-cookies.json"),
  storageStateFile: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "private", "nv-sos-storage-state.json"),
  htmlDir: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "raw", "nv-sos", "html"),
  pdfDir: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "raw", "nv-sos", "pdfs"),
  blockedDir: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "raw", "nv-sos", "blocked"),
  textDir: path.join(/* turbopackIgnore: true */ process.cwd(), "data", "generated", "nv-sos-text"),
};

export async function ensureNvSosDirs() {
  await Promise.all([
    mkdir(path.dirname(NV_SOS_PATHS.fetchLog), { recursive: true }),
    mkdir(NV_SOS_PATHS.htmlDir, { recursive: true }),
    mkdir(NV_SOS_PATHS.pdfDir, { recursive: true }),
    mkdir(NV_SOS_PATHS.blockedDir, { recursive: true }),
    mkdir(NV_SOS_PATHS.textDir, { recursive: true }),
    mkdir(path.dirname(NV_SOS_PATHS.cookieFile), { recursive: true }),
  ]);
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readNvSosSources({ includeDiscovered = false } = {}) {
  const seeded = await readJsonFile<NvSosSource[]>(NV_SOS_PATHS.seedSources, []);
  const discovered = includeDiscovered ? await readJsonFile<NvSosDiscoveredSource[]>(NV_SOS_PATHS.generatedSources, []) : [];
  const merged = [...seeded, ...discovered];
  return [...new Map(merged.map((source) => [source.id, source])).values()];
}

export function sha256(buffer: Buffer | Uint8Array | string) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function safeFileStem(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "source";
}

export function isIncapsulaBlocked(text: string) {
  return /Request unsuccessful/i.test(text) || /Incapsula incident ID/i.test(text) || /Additional security check is required/i.test(text) || /_Incapsula_Resource/i.test(text);
}

export function isAccessDeniedBlocked(text: string) {
  return /Access Denied/i.test(text) || /You don't have permission to access/i.test(text) || /errors\.edgesuite\.net/i.test(text);
}

export function isNevadaSosNotFoundPage(text: string) {
  return /Page does not exist - Secretary of State, Nevada/i.test(text) || /The page you have requested (?:can't be found|does not exist)/i.test(text);
}

export function absolutizeUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(td|th)>/gi, "\t")
    .replace(/<\/(tr|p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function inferSourceTypeFromUrl(url: string, linkText = ""): NvSosSourceType {
  const combined = `${url} ${linkText}`.toLowerCase();
  if (combined.includes("showdocument.aspx")) return "show_document";
  if (combined.includes("browsereports.aspx")) return "campaign_finance_archive";
  if (combined.includes("viewccereport.aspx") || combined.includes("ce report") || combined.includes("financial disclosure") || combined.includes("annual ce filing")) return "campaign_finance_report";
  if (combined.includes("candidatedetails.aspx") || combined.includes("groupdetails.aspx")) return "candidate_detail";
  if (combined.includes("candidatefiling.aspx") || combined.includes("certcandlist.aspx")) return "candidate_filing";
  return "other";
}

export function inferExpectedContentType(url: string, linkText = ""): NvSosExpectedContentType {
  const combined = `${url} ${linkText}`.toLowerCase();
  if (combined.includes(".pdf") || combined.includes("showdocument.aspx")) return "unknown";
  if (combined.includes(".htm") || combined.includes(".aspx") || combined.includes("ce report") || combined.includes("financial disclosure")) return "html";
  return "unknown";
}

export function inferReportType(text: string) {
  if (/candidate financial disclosure/i.test(text)) return "Candidate Financial Disclosure";
  if (/annual ce filing/i.test(text)) return "Annual CE Filing";
  if (/annual financial disclosure/i.test(text)) return "Annual Financial Disclosure";
  const ceMatch = text.match(/\bCE Report\s*\d*\b/i);
  if (ceMatch) return ceMatch[0].trim();
  return null;
}

export function parseMoneyNear(label: RegExp, text: string) {
  const index = text.search(label);
  if (index < 0) return null;
  const slice = text.slice(index, index + 220);
  const match = slice.match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/);
  if (!match) return null;
  return Number(match[1].replace(/,/g, ""));
}

export function isSuccessStatus(status: NvSosFetchStatus) {
  return status === "success_html" || status === "success_pdf";
}

export function isBlockedStatus(status: NvSosFetchStatus) {
  return status.startsWith("blocked_") || status === "forbidden";
}

export function listCachedFilesSyncSafe() {
  return {
    html: existsSync(NV_SOS_PATHS.htmlDir) ? NV_SOS_PATHS.htmlDir : null,
    pdf: existsSync(NV_SOS_PATHS.pdfDir) ? NV_SOS_PATHS.pdfDir : null,
  };
}

export async function listFilesRecursive(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFilesRecursive(fullPath);
      return [fullPath];
    }),
  );
  return nested.flat();
}
