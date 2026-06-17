import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import type {
  NvSosDiscoveredSource,
  NvSosExpandedSource,
  NvSosFetchLogEntry,
  NvSosCandidateRecord,
  NvSosCampaignFinanceRecord,
  NvSosDataQualityReport,
  NvSosOperationalStatus,
  NvSosSource,
  NvSosStructuredDocument,
} from "@/lib/nv-sos/pipeline";
import {
  buildCampaignFinanceDashboard,
  getFinanceSummaryForProfile,
  type CampaignFinanceDashboard,
  type NvSosProfileFinanceSummary,
} from "@/lib/nv-sos/finance-dashboard";

const NV_SOS_APP_PATHS = {
  seedSources: "data/source-seeds/nv-sos-sources.json",
  generatedSources: "data/generated/nv-sos-discovered-sources.json",
  expandedSources: "data/generated/nv-sos-expanded-sources.json",
  fetchLog: "data/generated/nv-sos-fetch-log.json",
  expandedFetchLog: "data/generated/nv-sos-expanded-fetch-log.json",
  structuredDocuments: "data/generated/nv-sos-structured-documents.json",
  candidateRecords: "data/generated/nv-sos-candidate-records.json",
  campaignFinanceRecords: "data/generated/nv-sos-campaign-finance-records.json",
  dataQualityReport: "data/generated/nv-sos-data-quality-report.json",
  operationalStatus: "data/generated/nv-sos-operational-status.json",
  cookieFile: "data/private/nv-sos-cookies.json",
  storageStateFile: "data/private/nv-sos-storage-state.json",
};

export type NvSosSourceDashboard = {
  seedSources: NvSosSource[];
  sources: NvSosSource[];
  discovered: NvSosDiscoveredSource[];
  expanded: NvSosExpandedSource[];
  fetchLog: NvSosFetchLogEntry[];
  expandedFetchLog: NvSosFetchLogEntry[];
  latestBySourceId: Map<string, NvSosFetchLogEntry>;
  hasCookieFile: boolean;
  hasStorageState: boolean;
};

export type NvSosDocumentDashboard = {
  structured: NvSosStructuredDocument[];
  candidateRecords: NvSosCandidateRecord[];
  campaignFinanceRecords: NvSosCampaignFinanceRecord[];
  unmatched: NvSosStructuredDocument[];
  unmatchedCandidates: NvSosCandidateRecord[];
  unmatchedCampaignFinance: NvSosCampaignFinanceRecord[];
};

export type OfficialSourceDocumentsCardData = {
  documents: NvSosStructuredDocument[];
  candidateRecords: NvSosCandidateRecord[];
  campaignFinanceRecords: NvSosCampaignFinanceRecord[];
  campaignFinanceSummary: NvSosProfileFinanceSummary;
  campaignFinanceDashboard: CampaignFinanceDashboard;
  lastFetchedAt: string | null;
  blockedCount: number;
  blockedImportUrlCount: number;
  unmatchedImportRecordCount: number;
  sourceLinks: Array<{ label: string; url: string }>;
};

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readSources() {
  const [seeded, discovered] = await Promise.all([
    readJsonFile<NvSosSource[]>(NV_SOS_APP_PATHS.seedSources, []),
    readJsonFile<NvSosDiscoveredSource[]>(NV_SOS_APP_PATHS.generatedSources, []),
  ]);
  return [...new Map([...seeded, ...discovered].map((source) => [source.id, source])).values()];
}

export async function getNvSosSourceDashboard(): Promise<NvSosSourceDashboard> {
  const [seedSources, sources, discovered, expanded, fetchLog, expandedFetchLog] = await Promise.all([
    readJsonFile<NvSosSource[]>(NV_SOS_APP_PATHS.seedSources, []),
    readSources(),
    readJsonFile<NvSosDiscoveredSource[]>(NV_SOS_APP_PATHS.generatedSources, []),
    readJsonFile<NvSosExpandedSource[]>(NV_SOS_APP_PATHS.expandedSources, []),
    readJsonFile<NvSosFetchLogEntry[]>(NV_SOS_APP_PATHS.fetchLog, []),
    readJsonFile<NvSosFetchLogEntry[]>(NV_SOS_APP_PATHS.expandedFetchLog, []),
  ]);
  const latestBySourceId = new Map<string, NvSosFetchLogEntry>();
  for (const entry of [...fetchLog, ...expandedFetchLog]) latestBySourceId.set(entry.source_id, entry);
  return {
    seedSources,
    sources,
    discovered,
    expanded,
    fetchLog,
    expandedFetchLog,
    latestBySourceId,
    hasCookieFile: existsSync(NV_SOS_APP_PATHS.cookieFile),
    hasStorageState: existsSync(NV_SOS_APP_PATHS.storageStateFile),
  };
}

export async function getNvSosDataQualityReport(): Promise<NvSosDataQualityReport | null> {
  return readJsonFile<NvSosDataQualityReport | null>(NV_SOS_APP_PATHS.dataQualityReport, null);
}

export async function getNvSosOperationalStatus(): Promise<NvSosOperationalStatus | null> {
  return readJsonFile<NvSosOperationalStatus | null>(NV_SOS_APP_PATHS.operationalStatus, null);
}

export async function getNvSosDocumentDashboard(): Promise<NvSosDocumentDashboard> {
  const [structured, candidateRecords, campaignFinanceRecords] = await Promise.all([
    readJsonFile<NvSosStructuredDocument[]>(NV_SOS_APP_PATHS.structuredDocuments, []),
    readJsonFile<NvSosCandidateRecord[]>(NV_SOS_APP_PATHS.candidateRecords, []),
    readJsonFile<NvSosCampaignFinanceRecord[]>(NV_SOS_APP_PATHS.campaignFinanceRecords, []),
  ]);
  return {
    structured,
    candidateRecords,
    campaignFinanceRecords,
    unmatched: structured.filter((document) => document.unmatched),
    unmatchedCandidates: candidateRecords.filter((record) => record.unmatched),
    unmatchedCampaignFinance: campaignFinanceRecords.filter((record) => record.unmatched),
  };
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalNameTokens(value: string | null | undefined) {
  const aliases = new Map([
    ["joseph", "joe"],
    ["daniel", "danny"],
  ]);
  return normalizeName(value)
    .split(" ")
    .filter(Boolean)
    .map((token) => aliases.get(token) ?? token)
    .sort();
}

function namesMatch(left: string, right: string | null) {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  const leftTokens = canonicalNameTokens(left);
  const rightTokens = canonicalNameTokens(right);
  return leftTokens.length > 1 && leftTokens.length === rightTokens.length && leftTokens.every((token, index) => token === rightTokens[index]);
}

export async function getOfficialSourceDocumentsForProfile(profileName: string, officeName?: string | null): Promise<OfficialSourceDocumentsCardData> {
  const [dashboard, sourceDashboard, operationalStatus] = await Promise.all([getNvSosDocumentDashboard(), getNvSosSourceDashboard(), getNvSosOperationalStatus()]);
  const documents = dashboard.structured
    .filter((document) => namesMatch(profileName, document.candidate_name))
    .slice(0, 8);
  const candidateRecords = dashboard.candidateRecords.filter((record) => namesMatch(profileName, record.candidate_name)).slice(0, 4);
  const allCampaignFinanceRecords = dashboard.campaignFinanceRecords.filter((record) => namesMatch(profileName, record.candidate_name));
  const campaignFinanceRecords = allCampaignFinanceRecords.slice(0, 8);
  const sourceLinks = [
    ...documents.map((document) => ({
      label: document.filing_report_type ?? document.source_type.replaceAll("_", " "),
      url: document.source_url,
    })),
    ...candidateRecords.map((record) => ({ label: "Candidate detail", url: record.source_url })),
    ...campaignFinanceRecords.map((record) => ({ label: record.report_name ?? "Campaign finance report", url: record.source_url })),
  ]
    .filter((link, index, links) => links.findIndex((candidate) => candidate.url === link.url) === index);
  const allFetchEntries = [...sourceDashboard.fetchLog, ...sourceDashboard.expandedFetchLog];
  const lastFetchedAt =
    operationalStatus?.last_successful_live_fetch_at ??
    allFetchEntries
      .filter((entry) => entry.status === "success_html" || entry.status === "success_pdf")
      .map((entry) => entry.fetched_at)
      .sort()
      .at(-1) ??
    null;
  const campaignFinanceDashboard = buildCampaignFinanceDashboard(allCampaignFinanceRecords, allFetchEntries, lastFetchedAt, dashboard.campaignFinanceRecords);
  const campaignFinanceSummary = campaignFinanceDashboard.summary;
  const matchedSourceIds = new Set([...documents.map((document) => document.source_id), ...candidateRecords.map((record) => record.source_id), ...allCampaignFinanceRecords.map((record) => record.source_id)]);
  const blockedCount = allFetchEntries.filter((entry) => matchedSourceIds.has(entry.source_id) && entry.status.startsWith("blocked_")).length;
  const blockedImportUrlCount = new Set(allFetchEntries.filter((entry) => entry.status.startsWith("blocked_") || entry.status === "forbidden").map((entry) => entry.source_url)).size;
  const unmatchedImportRecordCount = dashboard.unmatched.length + dashboard.unmatchedCandidates.length + dashboard.unmatchedCampaignFinance.length;
  return { documents, candidateRecords, campaignFinanceRecords, campaignFinanceSummary, campaignFinanceDashboard, lastFetchedAt, blockedCount, blockedImportUrlCount, unmatchedImportRecordCount, sourceLinks };
}

export { getFinanceSummaryForProfile };
