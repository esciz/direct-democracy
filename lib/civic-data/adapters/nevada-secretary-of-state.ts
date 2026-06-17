import { inflateRawSync } from "node:zlib";

import { BallotQuestionType, CandidateStatus, DistrictType, ElectionResultStatus, ElectionStatus, ElectionType, InitiativeStatus, OfficeLevel, SourceSyncStatus } from "@prisma/client";

import { createEmptyNormalizedCivicData } from "@/lib/civic-data/normalized";
import type { CivicDataAdapter, IngestionContext, IngestionIssue, IngestionResult, NormalizedCivicData } from "@/lib/civic-data/types";

const OFFICIAL_SOURCE_CHECKS = [
  "https://www.nvsos.gov/sos/elections",
  "https://www.nvsos.gov/sos/elections/election-information/previous-elections/election-results",
  "https://www.nvsos.gov/sos/elections/election-information/2024-election-information",
  "https://www.nvsos.gov/sos/elections/election-information/2026-election-information",
  "https://www.nvsos.gov/sos/elections/voters/statewide-ballot-questions",
  "https://www.washoecounty.gov/voters/information/index.php",
  "https://www.washoecounty.gov/voters/data/elections/2026.php",
];

const WASHOE_2026_CANDIDATE_WORKBOOK_URL = "https://www.washoecounty.gov/voters/files/Washoe%20County%202026%20Candidates.xlsx";
const WASHOE_2026_CANDIDATE_PAGE_URL = "https://www.washoecounty.gov/voters/information/index.php";

async function checkOfficialNevadaSource(url: string): Promise<IngestionIssue | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DirectDemocracyNevadaBeta/1.0 civic data importer",
      },
    });
    const body = await response.text();
    const blocked = body.includes("Incapsula") || body.includes("_Incapsula_Resource") || body.includes("Request unsuccessful");

    if (!response.ok || blocked) {
      return {
        severity: "warning",
        message: `Official Nevada Secretary of State source check returned ${response.status}${blocked ? " with bot-protection content" : ""}: ${url}`,
      };
    }
  } catch (error) {
    return {
      severity: "warning",
      message: `Official Nevada Secretary of State source check failed for ${url}: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }

  return null;
}

function addElectionFoundation(data: NormalizedCivicData) {
  data.elections.push(
    {
      externalId: "nvsos-2024-general-statewide",
      jurisdictionSlug: "nevada",
      slug: "nevada-2024-general-election",
      title: "2024 Nevada General Election",
      officeTitle: "Statewide and Federal Offices",
      electionDate: "2024-11-05",
      electionType: ElectionType.GENERAL,
      status: ElectionStatus.COMPLETED,
    },
    {
      externalId: "nvsos-2024-primary-statewide",
      jurisdictionSlug: "nevada",
      slug: "nevada-2024-primary-election",
      title: "2024 Nevada Primary Election",
      officeTitle: "Statewide and Federal Offices",
      electionDate: "2024-06-11",
      electionType: ElectionType.PRIMARY,
      status: ElectionStatus.COMPLETED,
    },
    {
      externalId: "nvsos-2026-primary-statewide",
      jurisdictionSlug: "nevada",
      slug: "nevada-2026-primary-election",
      title: "2026 Nevada Primary Election",
      officeTitle: "Statewide, Federal, Legislative, and Local Offices",
      electionDate: "2026-06-09",
      electionType: ElectionType.PRIMARY,
      status: ElectionStatus.UPCOMING,
    },
    {
      externalId: "nvsos-2026-general-statewide",
      jurisdictionSlug: "nevada",
      slug: "nevada-2026-general-election",
      title: "2026 Nevada General Election",
      officeTitle: "Statewide, Federal, Legislative, and Local Offices",
      electionDate: "2026-11-03",
      electionType: ElectionType.GENERAL,
      status: ElectionStatus.UPCOMING,
    },
    {
      externalId: "nvsos-reno-2026-general",
      jurisdictionSlug: "reno",
      slug: "reno-2026-general-election",
      title: "2026 Reno Municipal General Election",
      officeTitle: "Reno Municipal Offices",
      electionDate: "2026-11-03",
      electionType: ElectionType.LOCAL,
      status: ElectionStatus.UPCOMING,
    },
    {
      externalId: "nvsos-washoe-2026-general",
      jurisdictionSlug: "washoe-county",
      slug: "washoe-county-2026-general-election",
      title: "2026 Washoe County General Election",
      officeTitle: "Washoe County Offices",
      electionDate: "2026-11-03",
      electionType: ElectionType.LOCAL,
      status: ElectionStatus.UPCOMING,
    },
    {
      externalId: "nvsos-carson-city-2026-general",
      jurisdictionSlug: "carson-city",
      slug: "carson-city-2026-general-election",
      title: "2026 Carson City General Election",
      officeTitle: "Carson City Offices",
      electionDate: "2026-11-03",
      electionType: ElectionType.LOCAL,
      status: ElectionStatus.UPCOMING,
    },
  );
}

function addCandidateOffices(data: NormalizedCivicData) {
  data.offices.push(
    {
      externalId: "nvsos-office-president",
      jurisdictionSlug: "nevada",
      slug: "nvsos-president-nevada-ballot",
      title: "President of the United States",
      level: "FEDERAL",
      selectionMethod: "ELECTED",
      termLengthYears: 4,
    },
    {
      externalId: "nvsos-office-us-senate",
      jurisdictionSlug: "nevada",
      slug: "nvsos-us-senate-nevada",
      title: "U.S. Senator from Nevada",
      level: "FEDERAL",
      selectionMethod: "ELECTED",
      termLengthYears: 6,
    },
    {
      externalId: "nvsos-office-us-house",
      jurisdictionSlug: "nevada",
      slug: "nvsos-us-house-nevada",
      title: "U.S. Representative from Nevada",
      level: "FEDERAL",
      selectionMethod: "ELECTED",
      termLengthYears: 2,
    },
    {
      externalId: "nvsos-office-nevada-legislature",
      jurisdictionSlug: "nevada",
      slug: "nvsos-nevada-legislature-candidate-office",
      title: "Nevada Legislature",
      level: "STATE",
      selectionMethod: "ELECTED",
    },
    {
      externalId: "nvsos-office-reno-municipal",
      jurisdictionSlug: "reno",
      slug: "nvsos-reno-municipal-candidate-office",
      title: "Reno Municipal Office",
      level: "CITY",
      selectionMethod: "ELECTED",
    },
    {
      externalId: "nvsos-office-washoe-county",
      jurisdictionSlug: "washoe-county",
      slug: "nvsos-washoe-county-candidate-office",
      title: "Washoe County Office",
      level: "COUNTY",
      selectionMethod: "ELECTED",
    },
    {
      externalId: "nvsos-office-carson-city",
      jurisdictionSlug: "carson-city",
      slug: "nvsos-carson-city-candidate-office",
      title: "Carson City Office",
      level: "CITY",
      selectionMethod: "ELECTED",
    },
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseOffice(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bIn\b/g, "in")
    .replace(/\bOf\b/g, "of")
    .replace(/\bAnd\b/g, "and")
    .replace(/\bU\.s\.\b/gi, "U.S.");
}

function getOfficeLevel(officeType: string, officeSought: string): OfficeLevel {
  const haystack = `${officeType} ${officeSought}`.toLowerCase();
  if (haystack.includes("federal")) return OfficeLevel.FEDERAL;
  if (haystack.includes("statewide") || haystack.includes("state senate") || haystack.includes("state assembly") || haystack.includes("supreme court") || haystack.includes("regents")) return OfficeLevel.STATE;
  if (haystack.includes("city of reno") || haystack.includes("reno city") || haystack.includes("sparks city") || haystack.includes("municipal court")) return OfficeLevel.CITY;
  return OfficeLevel.COUNTY;
}

function getDistrictType(officeSought: string): DistrictType {
  const office = officeSought.toLowerCase();
  if (office.includes("representative in congress")) return DistrictType.CONGRESSIONAL;
  if (office.includes("state senate")) return DistrictType.STATE_SENATE;
  if (office.includes("state assembly")) return DistrictType.STATE_ASSEMBLY;
  if (office.includes("county commissioner")) return DistrictType.COUNTY_COMMISSION;
  if (office.includes("ward")) return DistrictType.CITY_WARD;
  if (office.includes("school board")) return DistrictType.SCHOOL_BOARD;
  if (office.includes("district")) return DistrictType.OTHER;
  return DistrictType.AT_LARGE;
}

function getJurisdictionSlug(officeType: string, officeSought: string) {
  const haystack = `${officeType} ${officeSought}`.toLowerCase();
  if (haystack.includes("reno")) return "reno";
  if (haystack.includes("sparks")) return "washoe-county";
  if (haystack.includes("county") || haystack.includes("district court") || haystack.includes("school board") || haystack.includes("general improvement") || haystack.includes("fire protection") || haystack.includes("tv district")) return "washoe-county";
  return "nevada";
}

function getDistrictName(officeSought: string) {
  const districtMatch = officeSought.match(/,\s*(DISTRICT|WARD)\s+(.+)$/i);
  if (districtMatch) return `${titleCaseOffice(districtMatch[1])} ${districtMatch[2].trim()}`;
  const seatMatch = officeSought.match(/,\s*(SEAT|DEPARTMENT)\s+(.+)$/i);
  if (seatMatch) return `${titleCaseOffice(seatMatch[1])} ${seatMatch[2].trim()}`;
  return null;
}

function getElectionExternalId(inPrimary: string | undefined, jurisdictionSlug: string) {
  if (inPrimary?.toUpperCase() === "YES") return "nvsos-2026-primary-statewide";
  if (jurisdictionSlug === "reno") return "nvsos-reno-2026-general";
  if (jurisdictionSlug === "washoe-county") return "nvsos-washoe-2026-general";
  return "nvsos-2026-general-statewide";
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function unzipXlsxEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32(buffer, offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("XLSX central directory was not found.");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = readUInt32(buffer, eocdOffset + 16);
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(buffer, cursor) !== 0x02014b50) throw new Error("Invalid XLSX central directory entry.");
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = readUInt32(buffer, cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = readUInt32(buffer, cursor + 42);
    const fileName = buffer.toString("utf8", cursor + 46, cursor + 46 + fileNameLength);

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = compressionMethod === 0 ? compressed : inflateRawSync(compressed);
    entries.set(fileName, data);
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function getCellColumn(cellReference: string) {
  return cellReference.replace(/[0-9]/g, "");
}

function columnIndex(column: string) {
  return column.split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function excelSerialDateToIso(value: string) {
  const serial = Number(value);
  if (!Number.isFinite(serial)) return undefined;
  const utc = Date.UTC(1899, 11, 30) + serial * 24 * 60 * 60 * 1000;
  return new Date(utc).toISOString().slice(0, 10);
}

function parseSharedStrings(xml: string) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => textMatch[1]).join("")),
  );
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row: Array<string | undefined> = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const reference = attrs.match(/\br="([^"]+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (!reference || rawValue === undefined) continue;
      const value = type === "s" ? sharedStrings[Number(rawValue)] : rawValue;
      row[columnIndex(getCellColumn(reference))] = value;
    }
    return row;
  });
}

async function fetchWashoeCandidateRows(): Promise<Array<Record<string, string | undefined>>> {
  const response = await fetch(WASHOE_2026_CANDIDATE_WORKBOOK_URL, {
    headers: { "User-Agent": "DirectDemocracyNevadaBeta/1.0 civic data importer" },
  });
  if (!response.ok) throw new Error(`Washoe County candidate workbook returned ${response.status}`);

  const entries = unzipXlsxEntries(Buffer.from(await response.arrayBuffer()));
  const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  const sheetXml = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  if (!sharedStringsXml || !sheetXml) throw new Error("Washoe County candidate workbook is missing worksheet XML.");

  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseWorksheetRows(sheetXml, sharedStrings);
  const headers = rows[0] ?? [];

  return rows.slice(1).map((row) => {
    const record: Record<string, string | undefined> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = header === "Filed Date" && row[index] ? excelSerialDateToIso(row[index]!) : row[index];
    });
    return record;
  });
}

async function addWashoe2026CandidateFilingData(data: NormalizedCivicData, issues: IngestionIssue[]) {
  let records: Array<Record<string, string | undefined>> = [];
  try {
    records = await fetchWashoeCandidateRows();
  } catch (error) {
    issues.push({
      severity: "warning",
      message: `Washoe County 2026 candidate workbook could not be imported: ${error instanceof Error ? error.message : "unknown error"}`,
    });
    return;
  }

  const officeExternalIds = new Set(data.offices.map((office) => office.externalId));
  const districtExternalIds = new Set(data.districts.map((district) => district.externalId));

  for (const record of records) {
    const fullName = record["Name on Ballot"]?.trim();
    const officeSought = record["Office Sought"]?.trim();
    if (!fullName || !officeSought) continue;

    const officeType = record["Office Type"]?.trim() ?? "";
    const partyText = record["Party or Nonpartisan Office"]?.trim();
    const jurisdictionSlug = getJurisdictionSlug(officeType, officeSought);
    const officeSlug = slugify(`2026-${jurisdictionSlug}-${officeSought}`);
    const officeExternalId = `washoe-2026-office-${officeSlug}`;
    const districtName = getDistrictName(officeSought);
    const districtExternalId = districtName ? `washoe-2026-district-${slugify(`${jurisdictionSlug}-${officeSought}`)}` : undefined;

    if (districtName && districtExternalId && !districtExternalIds.has(districtExternalId)) {
      data.districts.push({
        externalId: districtExternalId,
        jurisdictionSlug,
        slug: slugify(districtExternalId),
        name: districtName,
        districtType: getDistrictType(officeSought),
      });
      districtExternalIds.add(districtExternalId);
    }

    if (!officeExternalIds.has(officeExternalId)) {
      data.offices.push({
        externalId: officeExternalId,
        jurisdictionSlug,
        districtExternalId,
        slug: officeSlug,
        title: titleCaseOffice(officeSought),
        level: getOfficeLevel(officeType, officeSought),
        selectionMethod: "ELECTED",
      });
      officeExternalIds.add(officeExternalId);
    }

    const inPrimary = record["In Primary"]?.trim();
    data.candidates.push({
      externalId: `washoe-2026-candidate-${slugify(`${officeSought}-${fullName}`)}`,
      electionExternalId: getElectionExternalId(inPrimary, jurisdictionSlug),
      jurisdictionSlug,
      officeExternalId,
      districtExternalId,
      fullName,
      partyText,
      ballotName: fullName,
      filingDate: record["Filed Date"],
      filingStatus: inPrimary ? `Filed; in primary: ${inPrimary}` : "Filed",
      status: CandidateStatus.FILED,
      sourceUrl: WASHOE_2026_CANDIDATE_WORKBOOK_URL,
    });
  }
}

function addKnown2024Candidates(data: NormalizedCivicData) {
  data.candidates.push(
    {
      externalId: "nvsos-2024-president-harris",
      electionExternalId: "nvsos-2024-general-statewide",
      jurisdictionSlug: "nevada",
      officeExternalId: "nvsos-office-president",
      fullName: "Kamala D. Harris",
      ballotName: "Kamala D. Harris / Tim Walz",
      partyText: "Democratic",
      status: CandidateStatus.LOST,
    },
    {
      externalId: "nvsos-2024-president-trump",
      electionExternalId: "nvsos-2024-general-statewide",
      jurisdictionSlug: "nevada",
      officeExternalId: "nvsos-office-president",
      fullName: "Donald J. Trump",
      ballotName: "Donald J. Trump / JD Vance",
      partyText: "Republican",
      status: CandidateStatus.WON,
    },
    {
      externalId: "nvsos-2024-us-senate-rosen",
      electionExternalId: "nvsos-2024-general-statewide",
      jurisdictionSlug: "nevada",
      officeExternalId: "nvsos-office-us-senate",
      fullName: "Jacky Rosen",
      partyText: "Democratic",
      status: CandidateStatus.WON,
      isIncumbent: true,
    },
    {
      externalId: "nvsos-2024-us-senate-brown",
      electionExternalId: "nvsos-2024-general-statewide",
      jurisdictionSlug: "nevada",
      officeExternalId: "nvsos-office-us-senate",
      fullName: "Sam Brown",
      partyText: "Republican",
      status: CandidateStatus.LOST,
    },
  );
}

function add2024BallotQuestions(data: NormalizedCivicData) {
  const questions = [
    {
      number: "Question 1",
      slug: "nevada-2024-question-1-board-of-regents",
      title: "Remove the Board of Regents from the Nevada Constitution",
      summary: "Proposed constitutional amendment concerning the governance status of the Nevada System of Higher Education Board of Regents.",
      type: BallotQuestionType.CONSTITUTIONAL_AMENDMENT,
      status: InitiativeStatus.FAILED,
      passed: false,
    },
    {
      number: "Question 2",
      slug: "nevada-2024-question-2-sales-tax-act",
      title: "Revise the Sales and Use Tax Act of 1955",
      summary: "Proposed constitutional amendment revising provisions of the Sales and Use Tax Act of 1955.",
      type: BallotQuestionType.CONSTITUTIONAL_AMENDMENT,
      status: InitiativeStatus.PASSED,
      passed: true,
    },
    {
      number: "Question 3",
      slug: "nevada-2024-question-3-open-primary-ranked-choice",
      title: "Open primary and ranked-choice voting initiative",
      summary: "Initiative proposing open primaries and ranked-choice voting for specified Nevada elections.",
      type: BallotQuestionType.INITIATIVE_PETITION,
      status: InitiativeStatus.FAILED,
      passed: false,
    },
    {
      number: "Question 4",
      slug: "nevada-2024-question-4-slavery-involuntary-servitude",
      title: "Remove slavery and involuntary servitude language",
      summary: "Proposed constitutional amendment removing language allowing slavery and involuntary servitude as criminal punishment.",
      type: BallotQuestionType.CONSTITUTIONAL_AMENDMENT,
      status: InitiativeStatus.PASSED,
      passed: true,
    },
    {
      number: "Question 5",
      slug: "nevada-2024-question-5-diaper-tax-exemption",
      title: "Sales tax exemption for diapers",
      summary: "Proposed exemption from sales and use taxes for child and adult diapers.",
      type: BallotQuestionType.CONSTITUTIONAL_AMENDMENT,
      status: InitiativeStatus.PASSED,
      passed: true,
    },
    {
      number: "Question 6",
      slug: "nevada-2024-question-6-reproductive-freedom",
      title: "Reproductive freedom constitutional amendment",
      summary: "Initiative proposing constitutional protections for reproductive freedom.",
      type: BallotQuestionType.INITIATIVE_PETITION,
      status: InitiativeStatus.PASSED,
      passed: true,
    },
    {
      number: "Question 7",
      slug: "nevada-2024-question-7-voter-identification",
      title: "Voter identification initiative",
      summary: "Initiative proposing voter identification requirements in Nevada elections.",
      type: BallotQuestionType.INITIATIVE_PETITION,
      status: InitiativeStatus.PASSED,
      passed: true,
    },
  ];

  for (const question of questions) {
    const externalId = `nvsos-2024-${question.number.toLowerCase().replaceAll(" ", "-")}`;

    data.ballotInitiatives.push({
      externalId,
      electionExternalId: "nvsos-2024-general-statewide",
      jurisdictionSlug: "nevada",
      slug: question.slug,
      title: question.title,
      summary: question.summary,
      measureNumber: question.number,
      fullTextUrl: "https://www.nvsos.gov/sos/elections/voters/statewide-ballot-questions",
      status: question.status,
      petitionStatus: "ON_BALLOT",
      resultStatus: ElectionResultStatus.OFFICIAL,
      passed: question.passed,
    });

    data.ballotQuestions.push({
      externalId: `${externalId}-ballot-question`,
      electionExternalId: "nvsos-2024-general-statewide",
      initiativeExternalId: externalId,
      jurisdictionSlug: "nevada",
      slug: `${question.slug}-ballot-question`,
      questionNumber: question.number,
      title: question.title,
      summary: question.summary,
      questionType: question.type,
      petitionStatus: "ON_BALLOT",
      resultStatus: ElectionResultStatus.OFFICIAL,
      passed: question.passed,
      fullTextUrl: "https://www.nvsos.gov/sos/elections/voters/statewide-ballot-questions",
    });
  }
}

async function buildNevadaElectionFoundation(issues: IngestionIssue[]): Promise<NormalizedCivicData> {
  const data = createEmptyNormalizedCivicData();
  addElectionFoundation(data);
  addCandidateOffices(data);
  addKnown2024Candidates(data);
  await addWashoe2026CandidateFilingData(data, issues);
  add2024BallotQuestions(data);
  return data;
}

export const nevadaSecretaryOfStateAdapter: CivicDataAdapter = {
  key: "nevada-secretary-of-state",
  displayName: "Nevada Secretary of State",
  supportsIncremental: true,
  supportsScheduled: true,
  async sync(context: IngestionContext): Promise<IngestionResult> {
    if (
      context.source.slug === "nevada-secretary-of-state-voter-registration-statistics" ||
      context.source.slug === "nevada-secretary-of-state-election-results" ||
      context.source.slug === "nevada-secretary-of-state-precinct-results"
    ) {
      return {
        sourceSlug: context.source.slug,
        status: SourceSyncStatus.SUCCESS,
        cursor: new Date().toISOString(),
        data: createEmptyNormalizedCivicData(),
        issues: [
          {
            severity: "info",
            message: `${context.source.name} parser is registered for scheduled checks; source data import is pending implementation.`,
          },
        ],
        recordsSeen: 0,
        recordsChanged: 0,
      };
    }

    const sourceIssues = (await Promise.all(OFFICIAL_SOURCE_CHECKS.map((url) => checkOfficialNevadaSource(url)))).filter(
      (issue): issue is IngestionIssue => Boolean(issue),
    );
    const data = await buildNevadaElectionFoundation(sourceIssues);
    const recordsSeen = data.elections.length + data.offices.length + data.districts.length + data.candidates.length + data.ballotInitiatives.length + data.ballotQuestions.length;

    return {
      sourceSlug: context.source.slug,
      status: sourceIssues.some((issue) => issue.severity === "error") ? SourceSyncStatus.ERROR : SourceSyncStatus.SUCCESS,
      cursor: new Date().toISOString(),
      data,
      issues: sourceIssues,
      recordsSeen,
      recordsChanged: 0,
    };
  },
};
