"use server";

import { inflateRawSync } from "node:zlib";

import {
  CandidateStatus,
  DistrictType,
  ElectionStatus,
  ElectionType,
  JurisdictionType,
  OfficeLevel,
  OfficeSelectionMethod,
  Prisma,
  SourceSyncStatus,
  SourceType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export type ManualCandidatePreviewRow = {
  rowNumber: number;
  candidateName: string;
  officeSought: string | null;
  party: string | null;
  jurisdiction: string | null;
  district: string | null;
  election: string | null;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  sourceUrl: string | null;
  filingStatus: string | null;
  electionId: string | null;
  officeId: string | null;
  jurisdictionId: string | null;
  districtId: string | null;
  confidence: "High" | "Medium" | "Low" | "Duplicate";
  matchStatus: string;
  qaFlags: string[];
  raw: Record<string, string>;
};

export type ManualCandidateImportState = {
  status: "idle" | "preview" | "imported" | "error";
  message?: string;
  rows?: ManualCandidatePreviewRow[];
  sourceName?: string;
  sourceUrl?: string;
  sourceFormat?: string;
  summary?: {
    recordsSeen: number;
    recordsImported: number;
    duplicatesSkipped: number;
    needsReviewImported: number;
  };
};

type ImportRefs = Awaited<ReturnType<typeof loadImportRefs>>;

const fieldAliases = {
  candidateName: ["candidate name", "name", "name on ballot", "ballot name", "candidate", "full name"],
  officeSought: ["office sought", "office", "race", "contest", "position", "seat"],
  party: ["party", "party or nonpartisan office", "political party", "party affiliation"],
  jurisdiction: ["jurisdiction", "county", "city", "state", "filing office"],
  district: ["district", "ward", "seat", "department"],
  election: ["election", "election title", "election name", "election cycle"],
  websiteUrl: ["website", "website url", "campaign website", "web site"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "telephone", "phone number"],
  sourceUrl: ["source url", "url", "official url", "source"],
  filingStatus: ["filing status", "status", "in primary"],
} as const;

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: string) {
  return normalize(value).replace(/\s+/g, "-") || "manual-candidate-record";
}

function cleanCell(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function pickField(row: Record<string, string>, aliases: readonly string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalize(key), value] as const);
  for (const alias of aliases) {
    const exact = normalizedEntries.find(([key]) => key === normalize(alias));
    if (exact?.[1]) return cleanCell(exact[1]);
  }
  for (const alias of aliases) {
    const partial = normalizedEntries.find(([key]) => key.includes(normalize(alias)) || normalize(alias).includes(key));
    if (partial?.[1]) return cleanCell(partial[1]);
  }
  return "";
}

function parseCsvRows(content: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);

  return rowsToObjects(rows);
}

function parseDelimitedRows(content: string) {
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.split(/\t| {2,}/).map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
  return rowsToObjects(rows);
}

function rowsToObjects(rows: string[][]) {
  const headers = rows[0]?.map((header, index) => cleanCell(header) || `Column ${index + 1}`) ?? [];
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cleanCell(row[index]);
    });
    return record;
  });
}

function parseJsonRows(content: string) {
  const parsed = JSON.parse(content) as unknown;
  const candidates = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed
      ? ((parsed as { candidates?: unknown; data?: unknown; items?: unknown }).candidates ??
        (parsed as { data?: unknown }).data ??
        (parsed as { items?: unknown }).items)
      : [];

  if (!Array.isArray(candidates)) return [];

  return candidates
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) =>
      Object.fromEntries(Object.entries(entry).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : cleanCell(value)])),
    );
}

function parseHtmlRows(content: string) {
  const tableRows = [...content.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) =>
    [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
      decodeHtml(cellMatch[1].replace(/<[^>]+>/g, " ")).trim(),
    ),
  );

  if (tableRows.length > 1) {
    return rowsToObjects(tableRows);
  }

  const text = decodeHtml(content)
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return parseDelimitedRows(text);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function unzipXlsxEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32(buffer, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("XLSX central directory was not found.");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let cursor = readUInt32(buffer, eocdOffset + 16);

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
    entries.set(fileName, compressionMethod === 0 ? compressed : inflateRawSync(compressed));
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function columnIndex(column: string) {
  return column.split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function parseSharedStrings(xml: string) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeHtml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => textMatch[1]).join("")),
  );
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row: Array<string | undefined> = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const reference = attrs.match(/\br="([^"]+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const rawValue = cellMatch[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? cellMatch[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
      if (!reference || rawValue === undefined) continue;
      const value = type === "s" ? sharedStrings[Number(rawValue)] : decodeHtml(rawValue);
      row[columnIndex(reference.replace(/[0-9]/g, ""))] = value;
    }
    return row;
  });
}

function parseXlsxRows(buffer: Buffer) {
  const entries = unzipXlsxEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const sheetXml = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  if (!sheetXml) throw new Error("XLSX file is missing xl/worksheets/sheet1.xml.");
  return rowsToObjects(parseWorksheetRows(sheetXml, sharedStrings).map((row) => row.map((cell) => cleanCell(cell))));
}

function parseInput(format: string, content: string, fileBuffer: Buffer | null) {
  if (format === "xlsx") {
    if (!fileBuffer) throw new Error("XLSX import requires an uploaded .xlsx file.");
    return parseXlsxRows(fileBuffer);
  }
  if (format === "json") return parseJsonRows(content);
  if (format === "html") return parseHtmlRows(content);
  if (format === "csv") return parseCsvRows(content);
  if (content.trim().startsWith("{") || content.trim().startsWith("[")) return parseJsonRows(content);
  if (/<table|<tr|<td|<th/i.test(content)) return parseHtmlRows(content);
  if (content.includes(",")) return parseCsvRows(content);
  return parseDelimitedRows(content);
}

async function loadImportRefs() {
  const [elections, offices, districts, jurisdictions, candidates] = await Promise.all([
    prisma.election.findMany({ include: { jurisdiction: { select: { id: true, name: true, slug: true } } } }),
    prisma.office.findMany({ include: { jurisdiction: { select: { id: true, name: true, slug: true } }, district: { select: { id: true, name: true } } } }),
    prisma.district.findMany({ include: { jurisdiction: { select: { id: true, name: true, slug: true } } } }),
    prisma.jurisdiction.findMany(),
    prisma.candidate.findMany({ select: { id: true, fullName: true, electionId: true, officeId: true } }),
  ]);

  return { elections, offices, districts, jurisdictions, candidates };
}

function inferElectionType(title: string | null) {
  const normalized = normalize(title);
  if (normalized.includes("primary")) return ElectionType.PRIMARY;
  if (normalized.includes("general")) return ElectionType.GENERAL;
  if (normalized.includes("municipal") || normalized.includes("local")) return ElectionType.LOCAL;
  return ElectionType.SPECIAL;
}

function inferElectionDate(title: string | null) {
  const normalized = normalize(title);
  if (normalized.includes("2026") && normalized.includes("primary")) return new Date("2026-06-09T00:00:00.000Z");
  if (normalized.includes("2026") && normalized.includes("general")) return new Date("2026-11-03T00:00:00.000Z");
  const year = normalized.match(/\b(20\d{2})\b/)?.[1];
  return new Date(`${year ?? "2026"}-01-01T00:00:00.000Z`);
}

function inferOfficeLevel(value: string | null) {
  const normalized = normalize(value);
  if (normalized.includes("congress") || normalized.includes("senate us") || normalized.includes("representative in congress")) return OfficeLevel.FEDERAL;
  if (normalized.includes("governor") || normalized.includes("state ") || normalized.includes("supreme court") || normalized.includes("regent")) return OfficeLevel.STATE;
  if (normalized.includes("city") || normalized.includes("mayor") || normalized.includes("municipal") || normalized.includes("ward")) return OfficeLevel.CITY;
  if (normalized.includes("county") || normalized.includes("school board") || normalized.includes("district court")) return OfficeLevel.COUNTY;
  return OfficeLevel.STATE;
}

function inferDistrictType(value: string | null) {
  const normalized = normalize(value);
  if (normalized.includes("congress")) return DistrictType.CONGRESSIONAL;
  if (normalized.includes("state senate")) return DistrictType.STATE_SENATE;
  if (normalized.includes("assembly")) return DistrictType.STATE_ASSEMBLY;
  if (normalized.includes("commission")) return DistrictType.COUNTY_COMMISSION;
  if (normalized.includes("ward")) return DistrictType.CITY_WARD;
  if (normalized.includes("school")) return DistrictType.SCHOOL_BOARD;
  if (normalized.includes("district") || normalized.includes("seat") || normalized.includes("department")) return DistrictType.OTHER;
  return DistrictType.AT_LARGE;
}

function findJurisdiction(refs: ImportRefs, value: string | null, officeSought: string | null) {
  const haystack = normalize(`${value ?? ""} ${officeSought ?? ""}`);
  const exact = refs.jurisdictions.find((jurisdiction) => normalize(jurisdiction.name) === normalize(value) || normalize(jurisdiction.slug) === normalize(value));
  if (exact) return exact;
  if (haystack.includes("reno")) return refs.jurisdictions.find((jurisdiction) => jurisdiction.slug === "reno") ?? null;
  if (haystack.includes("washoe") || haystack.includes("sparks")) return refs.jurisdictions.find((jurisdiction) => jurisdiction.slug === "washoe-county") ?? null;
  if (haystack.includes("carson")) return refs.jurisdictions.find((jurisdiction) => jurisdiction.slug === "carson-city") ?? null;
  if (haystack.includes("nevada") || haystack.includes("state") || haystack.includes("congress")) return refs.jurisdictions.find((jurisdiction) => jurisdiction.slug === "nevada") ?? null;
  return null;
}

function findElection(refs: ImportRefs, value: string | null, officeSought: string | null, jurisdictionSlug: string | null) {
  const normalizedValue = normalize(value);
  const haystack = normalize(`${value ?? ""} ${officeSought ?? ""}`);
  const exact = refs.elections.find((election) => normalize(election.title) === normalizedValue || normalize(election.slug) === normalizedValue);
  if (exact) return exact;

  if (haystack.includes("2026") && haystack.includes("primary")) {
    return refs.elections.find((election) => election.slug === "nevada-2026-primary-election") ?? null;
  }
  if (haystack.includes("2026") && haystack.includes("general")) {
    if (jurisdictionSlug === "reno") return refs.elections.find((election) => election.slug === "reno-2026-general-election") ?? null;
    if (jurisdictionSlug === "washoe-county") return refs.elections.find((election) => election.slug === "washoe-county-2026-general-election") ?? null;
    if (jurisdictionSlug === "carson-city") return refs.elections.find((election) => election.slug === "carson-city-2026-general-election") ?? null;
    return refs.elections.find((election) => election.slug === "nevada-2026-general-election") ?? null;
  }
  return null;
}

function findOffice(refs: ImportRefs, value: string | null, jurisdictionId: string | null) {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return null;
  return (
    refs.offices.find((office) => normalize(office.title) === normalizedValue && (!jurisdictionId || office.jurisdictionId === jurisdictionId)) ??
    refs.offices.find((office) => normalize(office.title).includes(normalizedValue) || normalizedValue.includes(normalize(office.title))) ??
    null
  );
}

function findDistrict(refs: ImportRefs, value: string | null, officeSought: string | null, jurisdictionId: string | null) {
  const candidateValue = value || officeSought?.match(/,\s*((?:district|ward|seat|department)\s+.+)$/i)?.[1] || null;
  const normalizedValue = normalize(candidateValue);
  if (!normalizedValue) return null;
  return (
    refs.districts.find((district) => normalize(district.name) === normalizedValue && (!jurisdictionId || district.jurisdictionId === jurisdictionId)) ??
    refs.districts.find((district) => normalize(district.name).includes(normalizedValue) || normalizedValue.includes(normalize(district.name))) ??
    null
  );
}

function isDuplicate(refs: ImportRefs, candidateName: string, electionId: string | null, officeId: string | null) {
  if (!candidateName || !electionId) return false;
  return refs.candidates.some(
    (candidate) =>
      normalize(candidate.fullName) === normalize(candidateName) &&
      candidate.electionId === electionId &&
      (candidate.officeId ?? null) === (officeId ?? null),
  );
}

function buildPreviewRows(records: Record<string, string>[], refs: ImportRefs, sourceUrl: string | null) {
  return records.map((record, index): ManualCandidatePreviewRow => {
    const candidateName = pickField(record, fieldAliases.candidateName);
    const officeSought = pickField(record, fieldAliases.officeSought) || null;
    const party = pickField(record, fieldAliases.party) || null;
    const jurisdictionValue = pickField(record, fieldAliases.jurisdiction) || null;
    const districtValue = pickField(record, fieldAliases.district) || null;
    const electionValue = pickField(record, fieldAliases.election) || null;
    const jurisdiction = findJurisdiction(refs, jurisdictionValue, officeSought);
    const election = findElection(refs, electionValue, officeSought, jurisdiction?.slug ?? null);
    const office = findOffice(refs, officeSought, jurisdiction?.id ?? null);
    const district = findDistrict(refs, districtValue, officeSought, jurisdiction?.id ?? null);
    const rowSourceUrl = pickField(record, fieldAliases.sourceUrl) || sourceUrl;
    const qaFlags = [
      !candidateName ? "Missing candidate name" : null,
      !officeSought ? "Missing office" : null,
      !election ? "Missing election" : null,
      !jurisdiction ? "Missing jurisdiction" : null,
      officeSought && /district|ward|seat|department/i.test(officeSought) && !district ? "Missing district" : null,
      !party ? "Missing party" : null,
      !rowSourceUrl ? "Missing source URL" : null,
    ].filter((flag): flag is string => Boolean(flag));
    const duplicate = isDuplicate(refs, candidateName, election?.id ?? null, office?.id ?? null);
    const willCreate = [officeSought && !office ? "office" : null, districtValue && !district ? "district" : null].filter(Boolean);
    const confidence = duplicate ? "Duplicate" : qaFlags.length > 0 ? "Low" : willCreate.length > 0 ? "Medium" : "High";

    return {
      rowNumber: index + 2,
      candidateName,
      officeSought,
      party,
      jurisdiction: jurisdiction?.name ?? jurisdictionValue,
      district: district?.name ?? districtValue,
      election: election?.title ?? electionValue,
      websiteUrl: pickField(record, fieldAliases.websiteUrl) || null,
      email: pickField(record, fieldAliases.email) || null,
      phone: pickField(record, fieldAliases.phone) || null,
      sourceUrl: rowSourceUrl || null,
      filingStatus: pickField(record, fieldAliases.filingStatus) || null,
      electionId: election?.id ?? null,
      officeId: office?.id ?? null,
      jurisdictionId: jurisdiction?.id ?? null,
      districtId: district?.id ?? null,
      confidence,
      matchStatus: duplicate ? "Duplicate existing candidate" : willCreate.length ? `Will create ${willCreate.join(" and ")}` : qaFlags.length ? "Needs Review" : "Matched",
      qaFlags,
      raw: record,
    };
  });
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    throw new Error("Only admins can import manual candidate data.");
  }
  return user;
}

export async function previewManualCandidateImportAction(
  _previousState: ManualCandidateImportState,
  formData: FormData,
): Promise<ManualCandidateImportState> {
  try {
    await requireAdmin();
    const fileEntry = formData.get("candidateFile");
    const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
    const pastedContent = String(formData.get("pastedContent") ?? "");
    const selectedFormat = String(formData.get("sourceFormat") ?? "auto").toLowerCase();
    const sourceUrl = cleanCell(formData.get("sourceUrl")) || null;
    const sourceName = cleanCell(formData.get("sourceName")) || (file ? file.name : "Pasted official candidate data");
    const fileBuffer = file ? Buffer.from(await file.arrayBuffer()) : null;
    const fileText = fileBuffer && selectedFormat !== "xlsx" && !file?.name.toLowerCase().endsWith(".xlsx") ? fileBuffer.toString("utf8") : "";
    const content = pastedContent.trim() || fileText;
    const format = selectedFormat === "auto" && file?.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : selectedFormat;

    if (!content && !fileBuffer) {
      return { status: "error", message: "Upload a file or paste official candidate content before previewing." };
    }

    const rows = parseInput(format, content, fileBuffer).filter((row) => Object.values(row).some(Boolean));
    const refs = await loadImportRefs();
    const previewRows = buildPreviewRows(rows, refs, sourceUrl);

    return {
      status: "preview",
      message: `Parsed ${previewRows.length} candidate row${previewRows.length === 1 ? "" : "s"} for review.`,
      rows: previewRows,
      sourceName,
      sourceUrl: sourceUrl ?? undefined,
      sourceFormat: format,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Manual candidate import preview failed.",
    };
  }
}

async function ensureFallbackElection(sourceId: string, jurisdictionId: string) {
  return prisma.election.upsert({
    where: { slug: "manual-candidate-records-needing-review" },
    create: {
      sourceId,
      jurisdictionId,
      slug: "manual-candidate-records-needing-review",
      title: "Manual Candidate Records Needing Review",
      officeTitle: "Candidate records needing review",
      electionDate: new Date("2026-01-01T00:00:00.000Z"),
      electionType: ElectionType.SPECIAL,
      status: ElectionStatus.UPCOMING,
      externalId: "manual-candidate-records-needing-review",
    },
    update: {
      sourceId,
      jurisdictionId,
      officeTitle: "Candidate records needing review",
    },
  });
}

async function ensureOffice(row: ManualCandidatePreviewRow, sourceId: string, jurisdictionId: string, districtId: string | null) {
  if (row.officeId) return row.officeId;
  if (!row.officeSought) return null;
  const externalId = `manual-office-${slugify(`${jurisdictionId}-${row.officeSought}`)}`;
  const office = await prisma.office.upsert({
    where: { sourceId_externalId: { sourceId, externalId } },
    create: {
      sourceId,
      externalId,
      jurisdictionId,
      districtId,
      slug: `${externalId}-${sourceId.slice(-6)}`,
      title: row.officeSought,
      level: inferOfficeLevel(row.officeSought),
      selectionMethod: OfficeSelectionMethod.ELECTED,
    },
    update: {
      jurisdictionId,
      districtId,
      title: row.officeSought,
      level: inferOfficeLevel(row.officeSought),
    },
    select: { id: true },
  });
  return office.id;
}

async function ensureDistrict(row: ManualCandidatePreviewRow, sourceId: string, jurisdictionId: string) {
  if (row.districtId) return row.districtId;
  if (!row.district) return null;
  const externalId = `manual-district-${slugify(`${jurisdictionId}-${row.district}`)}`;
  const district = await prisma.district.upsert({
    where: { sourceId_externalId: { sourceId, externalId } },
    create: {
      sourceId,
      externalId,
      jurisdictionId,
      slug: `${externalId}-${sourceId.slice(-6)}`,
      name: row.district,
      districtType: inferDistrictType(`${row.officeSought ?? ""} ${row.district}`),
    },
    update: {
      jurisdictionId,
      name: row.district,
      districtType: inferDistrictType(`${row.officeSought ?? ""} ${row.district}`),
    },
    select: { id: true },
  });
  return district.id;
}

async function ensureElection(row: ManualCandidatePreviewRow, sourceId: string, jurisdictionId: string) {
  if (row.electionId) return row.electionId;
  if (!row.election) {
    const fallback = await ensureFallbackElection(sourceId, jurisdictionId);
    return fallback.id;
  }

  const externalId = `manual-election-${slugify(`${jurisdictionId}-${row.election}`)}`;
  const election = await prisma.election.upsert({
    where: { sourceId_externalId: { sourceId, externalId } },
    create: {
      sourceId,
      externalId,
      jurisdictionId,
      slug: `${externalId}-${sourceId.slice(-6)}`,
      title: row.election,
      officeTitle: row.officeSought ?? "Candidate offices needing review",
      electionDate: inferElectionDate(row.election),
      electionType: inferElectionType(row.election),
      status: ElectionStatus.UPCOMING,
    },
    update: {
      jurisdictionId,
      title: row.election,
      officeTitle: row.officeSought ?? "Candidate offices needing review",
      electionDate: inferElectionDate(row.election),
      electionType: inferElectionType(row.election),
    },
    select: { id: true },
  });
  return election.id;
}

export async function importManualCandidateRowsAction(
  _previousState: ManualCandidateImportState,
  formData: FormData,
): Promise<ManualCandidateImportState> {
  const startedAt = new Date();
  try {
    const user = await requireAdmin();
    const rows = JSON.parse(String(formData.get("rowsJson") ?? "[]")) as ManualCandidatePreviewRow[];
    const sourceName = cleanCell(formData.get("sourceName")) || "Manual Candidate Import";
    const sourceUrl = cleanCell(formData.get("sourceUrl")) || "manual://candidate-import";
    const sourceFormat = cleanCell(formData.get("sourceFormat")) || "manual";
    const importedAt = new Date();
    const sourceSlug = `manual-candidate-import-${importedAt.toISOString().replace(/[^0-9]/g, "").slice(0, 14)}`;
    const nevada = await prisma.jurisdiction.findUnique({ where: { slug: "nevada" } });
    const fallbackJurisdictionId = nevada?.id ?? (await prisma.jurisdiction.create({
      data: { slug: "nevada", name: "Nevada", type: JurisdictionType.STATE },
      select: { id: true },
    })).id;
    const source = await prisma.source.create({
      data: {
        name: sourceName,
        slug: sourceSlug,
        sourceType: SourceType.MANUAL,
        url: sourceUrl,
        jurisdictionId: fallbackJurisdictionId,
        adapterKey: "manual-candidate-fallback",
        isActive: true,
        syncStatus: SourceSyncStatus.SYNCING,
        metadata: {
          importedByManualFallback: true,
          importedAt: importedAt.toISOString(),
          importedByUserId: user.id,
          sourceFormat,
        } satisfies Prisma.InputJsonObject,
      },
    });
    const run = await prisma.sourceSyncRun.create({
      data: {
        sourceId: source.id,
        startedAt,
        status: SourceSyncStatus.SYNCING,
        recordsSeen: rows.length,
      },
    });
    const refs = await loadImportRefs();
    let recordsImported = 0;
    let duplicatesSkipped = 0;
    let needsReviewImported = 0;

    for (const row of rows) {
      if (!row.candidateName) continue;
      if (row.confidence === "Duplicate") {
        duplicatesSkipped += 1;
        continue;
      }

      const jurisdictionId = row.jurisdictionId ?? fallbackJurisdictionId;
      const districtId = await ensureDistrict(row, source.id, jurisdictionId);
      const officeId = await ensureOffice(row, source.id, jurisdictionId, districtId);
      const electionId = await ensureElection(row, source.id, jurisdictionId);
      const duplicate = isDuplicate(refs, row.candidateName, electionId, officeId);
      if (duplicate) {
        duplicatesSkipped += 1;
        continue;
      }

      const qaFlags = row.qaFlags.length ? row.qaFlags : row.confidence === "Low" ? ["Needs manual review"] : [];
      const status = qaFlags.length ? CandidateStatus.NEEDS_REVIEW : CandidateStatus.FILED;
      if (status === CandidateStatus.NEEDS_REVIEW) needsReviewImported += 1;

      await prisma.candidate.create({
        data: {
          sourceId: source.id,
          externalId: `manual-candidate-${row.rowNumber}-${slugify(row.candidateName)}`,
          electionId,
          officeId,
          jurisdictionId,
          districtId,
          fullName: row.candidateName,
          ballotName: row.candidateName,
          partyText: row.party,
          websiteUrl: row.websiteUrl,
          email: row.email,
          phone: row.phone,
          sourceUrl: row.sourceUrl ?? sourceUrl,
          filingStatus: [
            row.filingStatus,
            "Imported by manual fallback",
            qaFlags.length ? `Needs Review: ${qaFlags.join(", ")}` : null,
          ].filter(Boolean).join(" | "),
          status,
        },
      });
      recordsImported += 1;
    }

    await prisma.$transaction([
      prisma.source.update({
        where: { id: source.id },
        data: {
          syncStatus: SourceSyncStatus.SUCCESS,
          lastSyncAt: importedAt,
          errorLog: null,
        },
      }),
      prisma.sourceSyncRun.update({
        where: { id: run.id },
        data: {
          completedAt: new Date(),
          status: SourceSyncStatus.SUCCESS,
          recordsChanged: recordsImported,
          errorLog: needsReviewImported ? `${needsReviewImported} candidate record(s) imported with Needs Review status.` : null,
        },
      }),
    ]);

    revalidatePath("/admin/imports");
    revalidatePath("/admin/imports/manual-candidates");
    revalidatePath("/admin/candidates");
    revalidatePath("/admin/elections/qa");
    revalidatePath("/candidates");
    revalidatePath("/elections");

    return {
      status: "imported",
      message: `Imported ${recordsImported} candidate record${recordsImported === 1 ? "" : "s"}.`,
      summary: {
        recordsSeen: rows.length,
        recordsImported,
        duplicatesSkipped,
        needsReviewImported,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Manual candidate import failed.",
    };
  }
}
