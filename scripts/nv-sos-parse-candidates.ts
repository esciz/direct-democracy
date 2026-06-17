import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  NV_SOS_PATHS,
  readJsonFile,
  writeJsonFile,
  type NvSosCandidateRecord,
  type NvSosExpandedSource,
  type NvSosExtractedDocument,
  type NvSosSource,
} from "../lib/nv-sos/pipeline";

type CandidateSource = NvSosSource | NvSosExpandedSource;

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

function sourceCandidateName(source: CandidateSource | undefined) {
  return source && "candidate_name" in source ? source.candidate_name : null;
}

function sourceOfficeName(source: CandidateSource | undefined) {
  return source && "office_name" in source ? source.office_name : null;
}

function parseCandidateName(text: string, source: CandidateSource | undefined) {
  const value =
    sourceCandidateName(source) ??
    firstMatch(text, [
      /Follow this Candidate\s+([^\n]+)/i,
      /Candidate\s+Name\s*:?\s*([^\n\t]+)/i,
      /Candidate\s*:?\s*([^\n\t]+)/i,
      /Name\s*:?\s*([A-Z][^\n\t]{2,80})/i,
    ]);
  if (!value || /Party or Nonpartisan|Office Sought|Filed Date/i.test(value)) return null;
  return value;
}

function parseOffice(text: string, source: CandidateSource | undefined) {
  const value =
    sourceOfficeName(source) ??
    firstMatch(text, [
      /Office\s+Sought\s*:?\s*([^\n\t]+)/i,
      /\bOffice\s*:?\s*([^\n\t]+)/i,
      /Public Office\s*:?\s*([^\n\t]+)/i,
    ]);
  if (!value || /Residential Address|Filed Date|Filing Office/i.test(value)) return null;
  return value;
}

function parseYear(text: string, source: CandidateSource | undefined) {
  const fromSource = source && "election_year" in source ? source.election_year : null;
  const year = firstMatch(text, [/\bElection\s+Year\s*:?\s*(20\d{2})/i, /\b(20\d{2})\s+(?:Candidate|Annual|CE Report)/i]);
  return year ? Number(year) : fromSource ?? null;
}

function parseEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function parseWebsite(text: string) {
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? firstMatch(text, [/Website\s*:?\s*([^\n\t]+)/i]);
}

function parsePhone(text: string) {
  return text.match(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0] ?? null;
}

function cleanCandidateField(value: string | null) {
  if (!value) return null;
  if (/Party or Nonpartisan|Office Sought|Filing Office|Residential Address|Filed Date|Data pager/i.test(value)) return null;
  return value;
}

function confidenceFor(record: NvSosCandidateRecord) {
  let score = 0.2;
  if (record.candidate_name) score += 0.25;
  if (record.office) score += 0.15;
  if (record.party) score += 0.1;
  if (record.filing_status) score += 0.1;
  if (record.public_contact.website || record.public_contact.email || record.public_contact.phone) score += 0.1;
  if (record.source_url.includes("CandidateDetails.aspx")) score += 0.1;
  return Math.min(0.95, Number(score.toFixed(2)));
}

async function main() {
  const [extracted, seedSources, expandedSources] = await Promise.all([
    readJsonFile<NvSosExtractedDocument[]>(NV_SOS_PATHS.extractedDocuments, []),
    readJsonFile<NvSosSource[]>(NV_SOS_PATHS.seedSources, []),
    readJsonFile<NvSosExpandedSource[]>(NV_SOS_PATHS.expandedSources, []),
  ]);
  const sourceById = new Map<string, CandidateSource>([
    ...seedSources.map((source) => [source.id, source] as const),
    ...expandedSources.map((source) => [source.source_id, source] as const),
  ]);
  const records: NvSosCandidateRecord[] = [];

  for (const document of extracted) {
    if (document.source_type !== "candidate_detail" && document.source_type !== "candidate_filing") continue;
    const source = sourceById.get(document.source_id);
    const text = await readFile(path.join(process.cwd(), document.text_path), "utf8");
    const record: NvSosCandidateRecord = {
      source_id: document.source_id,
      source_url: document.source_url,
      cached_path: document.cached_path,
      candidate_name: parseCandidateName(text, source),
      office: parseOffice(text, source),
      jurisdiction: (source && "jurisdiction" in source ? source.jurisdiction : null) ?? firstMatch(text, [/Jurisdiction\s*:?\s*([^\n\t]+)/i]) ?? "Nevada",
      district: firstMatch(text, [/District\s*:?\s*([^\n\t]+)/i]) ?? null,
      party: cleanCandidateField(firstMatch(text, [/Party\s*:?\s*([^\n\t]+)/i, /Party or Nonpartisan\s+([^\n\t]+)/i])),
      election_year: parseYear(text, source),
      filing_status: cleanCandidateField(firstMatch(text, [/Filed\s+Status\s*:?\s*([^\n\t]+)/i, /Filing\s+Status\s*:?\s*([^\n\t]+)/i, /Status\s*:?\s*([^\n\t]+)/i])),
      mailing_address: firstMatch(text, [/Mailing\s+Address\s*:?\s*([^\n]+)/i, /Residential\s+Address\s*:?\s*([^\n]+)/i]),
      public_contact: {
        website: parseWebsite(text),
        email: parseEmail(text),
        phone: parsePhone(text),
      },
      parse_confidence: 0,
      unmatched: false,
    };
    record.unmatched = !record.candidate_name;
    record.parse_confidence = confidenceFor(record);
    records.push(record);
  }

  await writeJsonFile(NV_SOS_PATHS.candidateRecords, records);
  console.log(`Parsed ${records.length} Nevada SoS candidate record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
