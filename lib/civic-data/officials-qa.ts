import { prisma } from "@/lib/prisma";

export type OfficialQaFlagKey =
  | "missing_photo"
  | "missing_email"
  | "missing_phone"
  | "missing_website"
  | "missing_district"
  | "missing_term_start"
  | "missing_term_end"
  | "duplicate_name"
  | "duplicate_office"
  | "suspicious_date"
  | "source_warning";

export type OfficialQaRow = {
  id: string;
  group: string;
  fullName: string;
  officeTitle: string;
  jurisdictionName: string;
  jurisdictionSlug: string;
  districtName: string | null;
  partyText: string | null;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  termStart: Date | null;
  termEnd: Date | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceStatus: string | null;
  sourceErrorLog: string | null;
  flags: OfficialQaFlagKey[];
};

export type OfficialsQaFilters = {
  group?: string;
  missing?: OfficialQaFlagKey;
  sourceWarnings?: boolean;
  duplicates?: boolean;
};

export type OfficialsQaSummary = {
  totalRecords: number;
  cleanRecords: number;
  warningRecords: number;
  missingFieldCounts: Array<{ label: string; count: number }>;
  sourceProblems: Array<{ sourceName: string; count: number; message: string }>;
};

export const OFFICIALS_QA_GROUPS = ["Nevada", "Federal Delegation", "Nevada Legislature", "Reno", "Washoe County", "Carson City", "Other"];

export const OFFICIALS_QA_FLAG_LABELS: Record<OfficialQaFlagKey, string> = {
  missing_photo: "Missing photo",
  missing_email: "Missing email",
  missing_phone: "Missing phone",
  missing_website: "Missing website",
  missing_district: "Missing district",
  missing_term_start: "Missing term start",
  missing_term_end: "Missing term end",
  duplicate_name: "Duplicate name",
  duplicate_office: "Duplicate office",
  suspicious_date: "Suspicious date parsing",
  source_warning: "Source warning or error",
};

const missingFieldFlags: OfficialQaFlagKey[] = [
  "missing_photo",
  "missing_email",
  "missing_phone",
  "missing_website",
  "missing_district",
  "missing_term_start",
  "missing_term_end",
];

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getQaGroup({
  jurisdictionSlug,
  sourceSlug,
}: {
  jurisdictionSlug: string;
  sourceSlug?: string | null;
}) {
  if (sourceSlug === "nevada-federal-delegation") return "Federal Delegation";
  if (sourceSlug === "nevada-legislature-nelis") return "Nevada Legislature";
  if (sourceSlug === "nevada-state-government-officials") return "Nevada";
  if (jurisdictionSlug === "reno") return "Reno";
  if (jurisdictionSlug === "washoe-county") return "Washoe County";
  if (jurisdictionSlug === "carson-city") return "Carson City";
  return "Other";
}

function isSuspiciousDate(termStart: Date | null, termEnd: Date | null) {
  if (termStart && Number.isNaN(termStart.getTime())) return true;
  if (termEnd && Number.isNaN(termEnd.getTime())) return true;
  if (termStart && termEnd && termStart > termEnd) return true;

  const years = [termStart?.getUTCFullYear(), termEnd?.getUTCFullYear()].filter((year): year is number => typeof year === "number");
  return years.some((year) => year < 1990 || year > 2040);
}

function formatCsvDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function csvEscape(value: string | number | null | undefined) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return `"${stringValue.replaceAll("\"", "\"\"")}"`;
}

export async function getOfficialsQaRows(filters: OfficialsQaFilters = {}) {
  const officials = await prisma.official.findMany({
    include: {
      office: { select: { title: true } },
      jurisdiction: { select: { name: true, slug: true } },
      district: { select: { name: true } },
      source: { select: { name: true, slug: true, url: true, syncStatus: true, errorLog: true } },
    },
    orderBy: [{ jurisdiction: { name: "asc" } }, { office: { title: "asc" } }, { fullName: "asc" }],
  });

  const nameCounts = new Map<string, number>();
  const officeCounts = new Map<string, number>();

  for (const official of officials) {
    const nameKey = normalizeKey(official.fullName);
    const officeKey = normalizeKey(`${official.jurisdiction.slug}|${official.office.title}|${official.district?.name ?? "no-district"}`);
    nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1);
    officeCounts.set(officeKey, (officeCounts.get(officeKey) ?? 0) + 1);
  }

  const rows: OfficialQaRow[] = officials.map((official) => {
    const nameKey = normalizeKey(official.fullName);
    const officeKey = normalizeKey(`${official.jurisdiction.slug}|${official.office.title}|${official.district?.name ?? "no-district"}`);
    const flags: OfficialQaFlagKey[] = [];

    if (!official.photoUrl) flags.push("missing_photo");
    if (!official.email) flags.push("missing_email");
    if (!official.phone) flags.push("missing_phone");
    if (!official.websiteUrl) flags.push("missing_website");
    if (!official.district) flags.push("missing_district");
    if (!official.termStart) flags.push("missing_term_start");
    if (!official.termEnd) flags.push("missing_term_end");
    if ((nameCounts.get(nameKey) ?? 0) > 1) flags.push("duplicate_name");
    if ((officeCounts.get(officeKey) ?? 0) > 1) flags.push("duplicate_office");
    if (isSuspiciousDate(official.termStart, official.termEnd)) flags.push("suspicious_date");
    if (official.source?.errorLog || official.source?.syncStatus === "ERROR") flags.push("source_warning");

    return {
      id: official.id,
      group: getQaGroup({ jurisdictionSlug: official.jurisdiction.slug, sourceSlug: official.source?.slug }),
      fullName: official.fullName,
      officeTitle: official.office.title,
      jurisdictionName: official.jurisdiction.name,
      jurisdictionSlug: official.jurisdiction.slug,
      districtName: official.district?.name ?? null,
      partyText: official.partyText,
      websiteUrl: official.websiteUrl,
      email: official.email,
      phone: official.phone,
      photoUrl: official.photoUrl,
      termStart: official.termStart,
      termEnd: official.termEnd,
      sourceName: official.source?.name ?? null,
      sourceUrl: official.source?.url ?? null,
      sourceStatus: official.source?.syncStatus ?? null,
      sourceErrorLog: official.source?.errorLog ?? null,
      flags,
    };
  });

  return rows.filter((row) => {
    if (filters.group && row.group !== filters.group) return false;
    if (filters.missing && !row.flags.includes(filters.missing)) return false;
    if (filters.sourceWarnings && !row.flags.includes("source_warning")) return false;
    if (filters.duplicates && !row.flags.some((flag) => flag === "duplicate_name" || flag === "duplicate_office")) return false;
    return true;
  });
}

export function summarizeOfficialsQa(rows: OfficialQaRow[]): OfficialsQaSummary {
  const missingFieldCounts = missingFieldFlags
    .map((flag) => ({
      label: OFFICIALS_QA_FLAG_LABELS[flag],
      count: rows.filter((row) => row.flags.includes(flag)).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const sourceProblemMap = new Map<string, { sourceName: string; count: number; message: string }>();
  for (const row of rows) {
    if (!row.sourceErrorLog) continue;
    const key = row.sourceName ?? "Unknown source";
    const existing = sourceProblemMap.get(key);
    sourceProblemMap.set(key, {
      sourceName: key,
      count: (existing?.count ?? 0) + 1,
      message: row.sourceErrorLog,
    });
  }

  return {
    totalRecords: rows.length,
    cleanRecords: rows.filter((row) => row.flags.length === 0).length,
    warningRecords: rows.filter((row) => row.flags.length > 0).length,
    missingFieldCounts,
    sourceProblems: [...sourceProblemMap.values()].sort((a, b) => b.count - a.count),
  };
}

export function officialsQaRowsToCsv(rows: OfficialQaRow[]) {
  const headers = [
    "Group",
    "Name",
    "Office",
    "Jurisdiction",
    "District",
    "Party",
    "Website",
    "Email",
    "Phone",
    "Photo URL",
    "Term Start",
    "Term End",
    "Source",
    "Source URL",
    "Source Status",
    "Flags",
  ];
  const lines = rows.map((row) =>
    [
      row.group,
      row.fullName,
      row.officeTitle,
      row.jurisdictionName,
      row.districtName,
      row.partyText,
      row.websiteUrl,
      row.email,
      row.phone,
      row.photoUrl,
      formatCsvDate(row.termStart),
      formatCsvDate(row.termEnd),
      row.sourceName,
      row.sourceUrl,
      row.sourceStatus,
      row.flags.map((flag) => OFFICIALS_QA_FLAG_LABELS[flag]).join("; "),
    ]
      .map(csvEscape)
      .join(","),
  );

  return [headers.map(csvEscape).join(","), ...lines].join("\n");
}
