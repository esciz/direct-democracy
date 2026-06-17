import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  inferReportType,
  NV_SOS_PATHS,
  parseMoneyNear,
  readJsonFile,
  writeJsonFile,
  type NvSosExtractedDocument,
  type NvSosExpandedSource,
  type NvSosSource,
  type NvSosStructuredDocument,
} from "../lib/nv-sos/pipeline";

type StructuredSource = NvSosSource | NvSosExpandedSource;

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

function parseYear(text: string, fallback: number | null) {
  const year = firstMatch(text, [/\b(20\d{2})\s+(?:Candidate Financial Disclosure|Annual CE Filing|Annual Financial Disclosure|CE Report)/i, /\bYear\s+(\d{4})\b/i]);
  return year ? Number(year) : fallback;
}

function parseCandidateName(text: string, source: StructuredSource | undefined) {
  if (source?.source_type === "candidate_filing" || source?.source_type === "campaign_finance_archive") return source.candidate_name ?? null;
  if (source?.source_url.includes("ExpenseResults.aspx")) return source.candidate_name ?? null;
  const candidateName =
    source?.candidate_name ??
    firstMatch(text, [
      /Candidate\s+Name\s*:?\s*([^\n\t]+)/i,
      /Candidate\s*:?\s*([^\n\t]+)/i,
      /Filer\s+Name\s*:?\s*([^\n\t]+)/i,
      /Entity\s+Name\s*:?\s*([^\n\t]+)/i,
      /Follow this Candidate\s+([^\n]+)/i,
    ]);
  if (!candidateName) return null;
  if (
    candidateName.length > 120 ||
    /Party or Nonpartisan|Office Sought|Reports and Financial Disclosures|or appointed|registered or required|NRS 294A|LEGAL DEFENSE FUND|What is this|nonprofit corporation|Recall Committee/i.test(candidateName)
  ) {
    return null;
  }
  return candidateName;
}

function parseOffice(text: string, source: StructuredSource | undefined) {
  const office =
    source?.office_name ??
    firstMatch(text, [
      /Office\s+Sought\s*:?\s*([^\n\t]+)/i,
      /\bOffice\s*:?\s*([^\n\t]+)/i,
      /District\s*:?\s*([^\n\t]+)/i,
    ]);
  if (!office) return null;
  if (/Residential Address|Filed Date|Nevada Commission on Ethics|complete list/i.test(office)) return null;
  return office;
}

function parseReportPeriod(text: string) {
  return firstMatch(text, [
    /Reporting\s+Period\s*:?\s*([^\n]+)/i,
    /Report\s+Period\s*:?\s*([^\n]+)/i,
    /Period\s+Covered\s*:?\s*([^\n]+)/i,
    /for the period\s+([^\n.]+)/i,
  ]);
}

function parseItemizedRows(text: string, kind: "contributor" | "payee") {
  const marker = kind === "contributor" ? /(contributor|contribution|receipt)/i : /(payee|expense|expenditure)/i;
  const rows = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => marker.test(line) && /\$?\s*\d/.test(line))
    .slice(0, 50);

  return rows.map((line) => {
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
    return {
      name: name || "Unlabeled row",
      amount: amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null,
      date: dateMatch?.[0] ?? null,
    };
  });
}

function confidenceFor(document: NvSosStructuredDocument) {
  let score = 0.2;
  if (document.candidate_name) score += 0.15;
  if (document.office) score += 0.1;
  if (document.filing_report_type) score += 0.15;
  if (document.contribution_total !== null || document.expense_total !== null || document.cash_on_hand !== null) score += 0.25;
  if (document.itemized_contributors.length || document.itemized_payees.length) score += 0.15;
  return Math.min(0.95, Number(score.toFixed(2)));
}

async function main() {
  const extracted = await readJsonFile<NvSosExtractedDocument[]>(NV_SOS_PATHS.extractedDocuments, []);
  const seedSources = await readJsonFile<NvSosSource[]>(NV_SOS_PATHS.seedSources, []);
  const discoveredSources = await readJsonFile<NvSosSource[]>(NV_SOS_PATHS.generatedSources, []);
  const expandedSources = await readJsonFile<NvSosExpandedSource[]>(NV_SOS_PATHS.expandedSources, []);
  const sourceById = new Map<string, StructuredSource>([
    ...seedSources.map((source) => [source.id, source] as const),
    ...discoveredSources.map((source) => [source.id, source] as const),
    ...expandedSources.map((source) => [source.source_id, source] as const),
  ]);
  const parsed: NvSosStructuredDocument[] = [];

  for (const document of extracted) {
    const source = sourceById.get(document.source_id);
    const text = await readFile(path.join(process.cwd(), document.text_path), "utf8");
    const structured: NvSosStructuredDocument = {
      source_id: document.source_id,
      source_url: document.source_url,
      source_type: document.source_type,
      cached_path: document.cached_path,
      text_path: document.text_path,
      parsed_at: new Date().toISOString(),
      candidate_name: parseCandidateName(text, source),
      office: parseOffice(text, source),
      jurisdiction: source?.jurisdiction ?? firstMatch(text, [/Jurisdiction\s*:?\s*([^\n\t]+)/i]) ?? "Nevada",
      election_year: parseYear(text, source?.election_year ?? null),
      filing_report_type: inferReportType(`${document.title ?? ""}\n${text}`),
      report_period: parseReportPeriod(text),
      contribution_total: parseMoneyNear(/total\s+(?:monetary\s+)?contributions?|contributions\s+total/i, text),
      expense_total: parseMoneyNear(/total\s+(?:monetary\s+)?(?:expenses|expenditures)|expenditures\s+total/i, text),
      cash_on_hand: parseMoneyNear(/cash\s+on\s+hand|ending\s+cash/i, text),
      itemized_contributors: parseItemizedRows(text, "contributor"),
      itemized_payees: parseItemizedRows(text, "payee"),
      parse_confidence: 0,
      unmatched: false,
    };

    structured.parse_confidence = confidenceFor(structured);
    structured.unmatched = !structured.candidate_name;
    parsed.push(structured);
  }

  await writeJsonFile(NV_SOS_PATHS.structuredDocuments, parsed);
  console.log(`Parsed ${parsed.length} Nevada SoS structured document(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
