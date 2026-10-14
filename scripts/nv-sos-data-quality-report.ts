import {
  NV_SOS_PATHS,
  readJsonFile,
  writeJsonFile,
  type NvSosCandidateRecord,
  type NvSosCampaignFinanceRecord,
  type NvSosDataQualityReport,
  type NvSosFetchLogEntry,
  type NvSosStructuredDocument,
} from "../lib/nv-sos/pipeline";

type QualityRecord = {
  candidate_name: string | null;
  office: string | null;
  parse_confidence: number;
  unmatched: boolean;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function confidenceSummary(records: QualityRecord[]): NvSosDataQualityReport["parser_confidence_summary"] {
  const values = records.map((record) => record.parse_confidence).filter((value) => Number.isFinite(value));
  if (!values.length) {
    return { min: null, max: null, average: null, low_count: 0, medium_count: 0, high_count: 0 };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: Number(Math.min(...values).toFixed(3)),
    max: Number(Math.max(...values).toFixed(3)),
    average: Number((total / values.length).toFixed(3)),
    low_count: values.filter((value) => value < 0.5).length,
    medium_count: values.filter((value) => value >= 0.5 && value < 0.8).length,
    high_count: values.filter((value) => value >= 0.8).length,
  };
}

function duplicateFinanceRecords(records: NvSosCampaignFinanceRecord[]) {
  const groups = new Map<string, NvSosCampaignFinanceRecord[]>();
  for (const record of records) {
    if (!record.candidate_name) continue;
    const key = [
      normalize(record.candidate_name),
      normalize(record.office),
      normalize(record.report_name),
      record.report_year ?? "",
      normalize(record.report_period),
    ].join("|");
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      count: group.length,
      source_urls: [...new Set(group.map((record) => record.source_url))],
    }));
}

function uniqueBlockedUrls(fetchEntries: NvSosFetchLogEntry[]) {
  const latest = new Map<string, NvSosFetchLogEntry>();
  for (const entry of fetchEntries) {
    if (!entry.status.startsWith("blocked_") && entry.status !== "forbidden") continue;
    latest.set(entry.source_url, entry);
  }
  return [...latest.values()].map((entry) => ({
    source_id: entry.source_id,
    source_stage: entry.source_stage ?? null,
    source_url: entry.source_url,
    status: entry.status,
    http_status: entry.http_status,
    fetched_at: entry.fetched_at,
  }));
}

async function main() {
  const [candidateRecords, campaignFinanceRecords, structuredDocuments, seedFetchLog, expandedFetchLog] = await Promise.all([
    readJsonFile<NvSosCandidateRecord[]>(NV_SOS_PATHS.candidateRecords, []),
    readJsonFile<NvSosCampaignFinanceRecord[]>(NV_SOS_PATHS.campaignFinanceRecords, []),
    readJsonFile<NvSosStructuredDocument[]>(NV_SOS_PATHS.structuredDocuments, []),
    readJsonFile<NvSosFetchLogEntry[]>(NV_SOS_PATHS.fetchLog, []),
    readJsonFile<NvSosFetchLogEntry[]>(NV_SOS_PATHS.expandedFetchLog, []),
  ]);
  const qualityRecords: QualityRecord[] = [...candidateRecords, ...campaignFinanceRecords, ...structuredDocuments].map((record) => ({
    candidate_name: record.candidate_name,
    office: "office" in record ? record.office : null,
    parse_confidence: record.parse_confidence,
    unmatched: record.unmatched,
  }));
  const allFetch = [...seedFetchLog, ...expandedFetchLog];
  const report: NvSosDataQualityReport = {
    generated_at: new Date().toISOString(),
    total_records: qualityRecords.length,
    matched_records: qualityRecords.filter((record) => !record.unmatched).length,
    unmatched_records: qualityRecords.filter((record) => record.unmatched).length,
    records_missing_candidate_name: qualityRecords.filter((record) => !record.candidate_name).length,
    records_missing_office: qualityRecords.filter((record) => !record.office).length,
    records_missing_totals:
      campaignFinanceRecords.filter((record) => record.total_contributions === null && record.total_expenses === null && record.cash_on_hand === null).length +
      structuredDocuments.filter((record) => record.contribution_total === null && record.expense_total === null && record.cash_on_hand === null).length,
    duplicate_candidate_report_records: duplicateFinanceRecords(campaignFinanceRecords),
    blocked_urls: uniqueBlockedUrls(allFetch),
    parser_confidence_summary: confidenceSummary(qualityRecords),
    breakdown: {
      candidate_records: candidateRecords.length,
      campaign_finance_records: campaignFinanceRecords.length,
      structured_documents: structuredDocuments.length,
      successful_html: allFetch.filter((entry) => entry.status === "success_html").length,
      successful_pdfs: allFetch.filter((entry) => entry.status === "success_pdf").length,
      blocked_or_forbidden: allFetch.filter((entry) => entry.status.startsWith("blocked_") || entry.status === "forbidden").length,
    },
  };

  await writeJsonFile(NV_SOS_PATHS.dataQualityReport, report);
  console.log(`Wrote Nevada SoS data quality report: ${report.total_records} records, ${report.unmatched_records} unmatched, ${report.blocked_urls.length} blocked URLs.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
