import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  inferReportType,
  NV_SOS_PATHS,
  parseMoneyNear,
  readJsonFile,
  writeJsonFile,
  type NvSosCampaignFinanceRecord,
  type NvSosExpandedSource,
  type NvSosExtractedDocument,
  type NvSosSource,
} from "../lib/nv-sos/pipeline";

type FinanceSource = NvSosSource | NvSosExpandedSource;

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

function sourceCandidateName(source: FinanceSource | undefined) {
  return source && "candidate_name" in source ? source.candidate_name : null;
}

function sourceOfficeName(source: FinanceSource | undefined) {
  return source && "office_name" in source ? source.office_name : null;
}

function cleanCandidateName(value: string | null, source: FinanceSource | undefined) {
  if (source?.source_url.includes("ExpenseResults.aspx")) return null;
  if (
    !value ||
    value.length > 120 ||
    /Party or Nonpartisan|Office Sought|Reports and Financial Disclosures|or appointed|registered or required|NRS 294A|LEGAL DEFENSE FUND|What is this|nonprofit corporation|Recall Committee/i.test(value)
  ) {
    return null;
  }
  return value;
}

function parseYear(text: string, source: FinanceSource | undefined) {
  const fromSource = source && "election_year" in source ? source.election_year : null;
  const year = firstMatch(text, [/\b(20\d{2})\s+(?:Candidate Financial Disclosure|Annual CE Filing|Annual Financial Disclosure|CE Report)/i, /\bReport\s+Year\s*:?\s*(20\d{2})/i]);
  return year ? Number(year) : fromSource ?? null;
}

function parseReportPeriod(text: string) {
  return firstMatch(text, [
    /Reporting\s+Period\s*:?\s*([^\n]+)/i,
    /Report\s+Period\s*:?\s*([^\n]+)/i,
    /Period\s+Covered\s*:?\s*([^\n]+)/i,
    /for the period\s+([^\n.]+)/i,
  ]);
}

function parseItemizedRows(text: string, kind: "contributor" | "expense") {
  const marker = kind === "contributor" ? /(contributor|contribution|receipt|donor)/i : /(payee|expense|expenditure|vendor)/i;
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => marker.test(line) && /\$?\s*\d/.test(line))
    .slice(0, 100)
    .map((line) => {
      const amountMatch = line.match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/);
      const dateMatch = line.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b20\d{2}-\d{2}-\d{2}\b/);
      const name = line
        .replace(marker, "")
        .replace(amountMatch?.[0] ?? "", "")
        .replace(dateMatch?.[0] ?? "", "")
        .replace(/[:\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140);
      return { name: name || "Unlabeled row", amount: amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null, date: dateMatch?.[0] ?? null };
    });
}

function confidenceFor(record: NvSosCampaignFinanceRecord) {
  let score = 0.2;
  if (record.candidate_name) score += 0.2;
  if (record.office) score += 0.1;
  if (record.report_name) score += 0.15;
  if (record.total_contributions !== null || record.total_expenses !== null || record.cash_on_hand !== null) score += 0.25;
  if (record.itemized_contributors.length || record.itemized_expenses.length) score += 0.15;
  return Math.min(0.95, Number(score.toFixed(2)));
}

async function main() {
  const [extracted, seedSources, expandedSources] = await Promise.all([
    readJsonFile<NvSosExtractedDocument[]>(NV_SOS_PATHS.extractedDocuments, []),
    readJsonFile<NvSosSource[]>(NV_SOS_PATHS.seedSources, []),
    readJsonFile<NvSosExpandedSource[]>(NV_SOS_PATHS.expandedSources, []),
  ]);
  const sourceById = new Map<string, FinanceSource>([
    ...seedSources.map((source) => [source.id, source] as const),
    ...expandedSources.map((source) => [source.source_id, source] as const),
  ]);
  const records: NvSosCampaignFinanceRecord[] = [];

  for (const document of extracted) {
    if (document.source_type !== "campaign_finance_report") continue;
    const source = sourceById.get(document.source_id);
    const text = await readFile(path.join(process.cwd(), document.text_path), "utf8");
    const reportName = inferReportType(`${document.title ?? ""}\n${source && "discovery_context" in source ? source.discovery_context.link_text ?? "" : ""}\n${text}`);
    const record: NvSosCampaignFinanceRecord = {
      source_id: document.source_id,
      source_url: document.source_url,
      cached_path: document.cached_path,
      candidate_name: cleanCandidateName(
        sourceCandidateName(source) ?? firstMatch(text, [/Candidate\s+Name\s*:?\s*([^\n\t]+)/i, /Candidate\s*:?\s*([^\n\t]+)/i, /Filer\s+Name\s*:?\s*([^\n\t]+)/i]),
        source,
      ),
      office: sourceOfficeName(source) ?? firstMatch(text, [/Office\s+Sought\s*:?\s*([^\n\t]+)/i, /\bOffice\s*:?\s*([^\n\t]+)/i]),
      report_name: reportName,
      report_year: parseYear(text, source),
      report_period: parseReportPeriod(text),
      total_contributions: parseMoneyNear(/total\s+(?:monetary\s+)?contributions?|contributions\s+total|total\s+receipts/i, text),
      total_expenses: parseMoneyNear(/total\s+(?:monetary\s+)?(?:expenses|expenditures)|expenditures\s+total|total\s+disbursements/i, text),
      cash_on_hand: parseMoneyNear(/cash\s+on\s+hand|ending\s+cash|ending\s+balance/i, text),
      itemized_contributors: parseItemizedRows(text, "contributor"),
      itemized_expenses: parseItemizedRows(text, "expense"),
      parse_confidence: 0,
      unmatched: false,
    };
    record.unmatched = !record.candidate_name;
    record.parse_confidence = confidenceFor(record);
    records.push(record);
  }

  await writeJsonFile(NV_SOS_PATHS.campaignFinanceRecords, records);
  console.log(`Parsed ${records.length} Nevada SoS campaign finance record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
