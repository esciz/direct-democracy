import { stat } from "node:fs/promises";

import {
  isBlockedStatus,
  isSuccessStatus,
  listFilesRecursive,
  NV_SOS_PATHS,
  readJsonFile,
  writeJsonFile,
  type NvSosCandidateRecord,
  type NvSosCampaignFinanceRecord,
  type NvSosFetchLogEntry,
  type NvSosOperationalStatus,
  type NvSosStructuredDocument,
} from "../lib/nv-sos/pipeline";

function latestIso(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

async function latestSuccessfulCachedResponseAt() {
  const files = [...(await listFilesRecursive(NV_SOS_PATHS.htmlDir)), ...(await listFilesRecursive(NV_SOS_PATHS.pdfDir))];
  const mtimes = await Promise.all(
    files.map(async (filePath) => {
      const fileStat = await stat(filePath);
      return fileStat.mtime.toISOString();
    }),
  );
  return latestIso(mtimes);
}

function liveFetchStatus(entries: NvSosFetchLogEntry[]): NvSosOperationalStatus["live_fetch_status"] {
  if (!entries.length) return "not_run";
  const success = entries.filter((entry) => isSuccessStatus(entry.status)).length;
  const blocked = entries.filter((entry) => isBlockedStatus(entry.status)).length;
  if (success > 0 && blocked === 0) return "active";
  if (success > 0) return "mixed";
  if (blocked > 0) return "blocked";
  return "error";
}

async function main() {
  const [seedFetchLog, expandedFetchLog, candidateRecords, campaignFinanceRecords, structuredDocuments] = await Promise.all([
    readJsonFile<NvSosFetchLogEntry[]>(NV_SOS_PATHS.fetchLog, []),
    readJsonFile<NvSosFetchLogEntry[]>(NV_SOS_PATHS.expandedFetchLog, []),
    readJsonFile<NvSosCandidateRecord[]>(NV_SOS_PATHS.candidateRecords, []),
    readJsonFile<NvSosCampaignFinanceRecord[]>(NV_SOS_PATHS.campaignFinanceRecords, []),
    readJsonFile<NvSosStructuredDocument[]>(NV_SOS_PATHS.structuredDocuments, []),
  ]);
  const fetchEntries = [...seedFetchLog, ...expandedFetchLog];
  const currentSuccessfulHtml = fetchEntries.filter((entry) => entry.status === "success_html").length;
  const currentSuccessfulPdfs = fetchEntries.filter((entry) => entry.status === "success_pdf").length;
  const currentBlocked = fetchEntries.filter((entry) => isBlockedStatus(entry.status)).length;
  const blockedUniqueUrls = new Set(fetchEntries.filter((entry) => isBlockedStatus(entry.status)).map((entry) => entry.source_url)).size;
  const recordsServedFromCache = candidateRecords.length + campaignFinanceRecords.length + structuredDocuments.length;
  const status = liveFetchStatus(fetchEntries);
  const sessionStatus: NvSosOperationalStatus["session_status"] = currentSuccessfulHtml + currentSuccessfulPdfs > 0 ? "active_session" : "stale_blocked_session";
  const latestSuccessFromLogs = latestIso(fetchEntries.filter((entry) => isSuccessStatus(entry.status)).map((entry) => entry.fetched_at));
  const latestSuccessFromCache = await latestSuccessfulCachedResponseAt();
  const lastSuccessfulLiveFetchAt = latestSuccessFromLogs ?? latestSuccessFromCache;
  const lastSuccessfulParseAt = latestIso(structuredDocuments.map((document) => document.parsed_at));
  const nextRecommendedAction =
    sessionStatus === "active_session"
      ? "No session refresh needed. Continue using npm run nv-sos:all for acquisition and cache refresh."
      : recordsServedFromCache > 0
        ? "Cached Nevada SoS records remain usable. Refresh the live session with npm run nv-sos:bootstrap before the next live acquisition window."
        : "Run npm run nv-sos:bootstrap, complete the browser challenge, press Enter after the page loads, then rerun npm run nv-sos:all.";

  const report: NvSosOperationalStatus = {
    generated_at: new Date().toISOString(),
    live_fetch_status: status,
    session_status: sessionStatus,
    last_successful_live_fetch_at: lastSuccessfulLiveFetchAt,
    last_successful_parse_at: lastSuccessfulParseAt,
    records_served_from_cache: recordsServedFromCache,
    blocked_unique_urls: blockedUniqueUrls,
    next_recommended_action: nextRecommendedAction,
    details: {
      current_successful_html: currentSuccessfulHtml,
      current_successful_pdfs: currentSuccessfulPdfs,
      current_blocked_or_forbidden: currentBlocked,
      cached_candidate_records: candidateRecords.length,
      cached_campaign_finance_records: campaignFinanceRecords.length,
      cached_structured_documents: structuredDocuments.length,
    },
  };

  await writeJsonFile(NV_SOS_PATHS.operationalStatus, report);
  console.log(
    `Nevada SoS operational status: ${report.session_status.replaceAll("_", " ")}; ${report.records_served_from_cache} cached records usable; next action: ${report.next_recommended_action}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
