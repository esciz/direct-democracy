import { DistrictType, OfficeLevel, Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { DISTRICT_SOURCE_ADAPTER_STUBS } from "@/lib/district-matching/source-adapters";
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/types/domain";

export type RepresentativeGroupKey = "federal" | "state" | "county" | "city" | "school" | "courts";

export type DistrictAssignmentSummary = {
  id: string;
  label: string;
  jurisdictionName: string;
  jurisdictionSlug: string;
  districtName: string | null;
  districtType: DistrictType | "JURISDICTION";
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string | null;
  confidenceScore: number;
  matchMethod: string;
  status: "matched" | "pending";
};

export type RepresentativeLookupItem = {
  id: string;
  name: string;
  roleLabel: string;
  jurisdictionName: string;
  districtName: string | null;
  partyText: string | null;
  href: string;
  sourceName: string;
  sourceUrl: string | null;
  confidenceScore: number;
  matchNote: string;
};

export type ElectionLookupItem = {
  id: string;
  title: string;
  officeTitle: string;
  electionDate: string;
  jurisdictionName: string;
  districtName: string | null;
  href: string;
  sourceName: string;
  sourceUrl: string | null;
};

export type BallotLookupItem = {
  id: string;
  title: string;
  jurisdictionName: string;
  href: string;
  sourceName: string;
  sourceUrl: string | null;
};

export type RepresentativeLookupGroup = {
  key: RepresentativeGroupKey;
  label: string;
  description: string;
  officials: RepresentativeLookupItem[];
  candidates: RepresentativeLookupItem[];
  elections: ElectionLookupItem[];
  ballotItems: BallotLookupItem[];
  missing: string[];
};

export type RepresentativeLookupResult = {
  inputLabel: string;
  normalizedLocationLabel: string;
  assignments: DistrictAssignmentSummary[];
  pendingAssignments: DistrictAssignmentSummary[];
  groups: RepresentativeLookupGroup[];
  adapterStubs: typeof DISTRICT_SOURCE_ADAPTER_STUBS;
};

const GROUPS: Array<Pick<RepresentativeLookupGroup, "key" | "label" | "description">> = [
  { key: "federal", label: "Federal", description: "Countrywide, statewide federal, and congressional district offices." },
  { key: "state", label: "State", description: "Nevada statewide, State Senate, and State Assembly offices." },
  { key: "county", label: "County", description: "Countywide and county commission district offices." },
  { key: "city", label: "City", description: "Municipal at-large and ward-specific offices." },
  { key: "school", label: "School", description: "School district and trustee district offices." },
  { key: "courts", label: "Courts / Judges", description: "Judicial districts, municipal courts, and justice court departments." },
];

const REQUIRED_DISTRICT_TYPES: Array<{ type: DistrictType; label: string; group: RepresentativeGroupKey }> = [
  { type: DistrictType.CONGRESSIONAL, label: "Congressional district", group: "federal" },
  { type: DistrictType.STATE_SENATE, label: "State Senate district", group: "state" },
  { type: DistrictType.STATE_ASSEMBLY, label: "State Assembly district", group: "state" },
  { type: DistrictType.COUNTY_COMMISSION, label: "County commission district", group: "county" },
  { type: DistrictType.CITY_WARD, label: "City ward", group: "city" },
  { type: DistrictType.SCHOOL_DISTRICT, label: "School district", group: "school" },
  { type: DistrictType.SCHOOL_BOARD, label: "School board trustee district", group: "school" },
  { type: DistrictType.JUDICIAL_DISTRICT, label: "Judicial district / court", group: "courts" },
  { type: DistrictType.MUNICIPAL_COURT, label: "Municipal court department", group: "courts" },
  { type: DistrictType.JUSTICE_COURT, label: "Justice court township / department", group: "courts" },
];

const COMMUNITY_DISTRICT_BASELINES: Record<
  string,
  Array<{
    label: string;
    jurisdictionSlug: string;
    jurisdictionName: string;
    districtName: string;
    districtType: DistrictType;
    districtAliases?: string[];
    sourceName: string;
    sourceUrl: string;
    confidenceScore: number;
    matchMethod: string;
  }>
> = {
  "carson-city": [
    {
      label: "Congressional District 2",
      jurisdictionSlug: "nevada",
      jurisdictionName: "Nevada",
      districtName: "Congressional District 2",
      districtType: DistrictType.CONGRESSIONAL,
      sourceName: "Carson City Clerk-Recorder Elected Officials",
      sourceUrl: "https://www.carsoncity.gov/government/departments-a-f/clerk-recorder/elections-department/carson-city-elected-officials",
      confidenceScore: 0.9,
      matchMethod: "Carson City elected-official source identifies the federal district representing Carson City.",
    },
    {
      label: "State Senate District 16",
      jurisdictionSlug: "nevada",
      jurisdictionName: "Nevada",
      districtName: "Senate District 16",
      districtAliases: ["District 16", "State Senate District 16"],
      districtType: DistrictType.STATE_SENATE,
      sourceName: "Carson City Clerk-Recorder Elected Officials",
      sourceUrl: "https://www.carsoncity.gov/government/departments-a-f/clerk-recorder/elections-department/carson-city-elected-officials",
      confidenceScore: 0.9,
      matchMethod: "Carson City elected-official source lists State Senate District 16 as representing Carson City.",
    },
    {
      label: "State Assembly District 40",
      jurisdictionSlug: "nevada",
      jurisdictionName: "Nevada",
      districtName: "Assembly District 40",
      districtAliases: ["District 40", "State Assembly District 40"],
      districtType: DistrictType.STATE_ASSEMBLY,
      sourceName: "Carson City Clerk-Recorder Elected Officials",
      sourceUrl: "https://www.carsoncity.gov/government/departments-a-f/clerk-recorder/elections-department/carson-city-elected-officials",
      confidenceScore: 0.9,
      matchMethod: "Carson City elected-official source lists State Assembly District 40 as representing Carson City.",
    },
    {
      label: "Carson City county-equivalent government",
      jurisdictionSlug: "carson-city",
      jurisdictionName: "Carson City",
      districtName: "County-equivalent Board of Supervisors",
      districtType: DistrictType.COUNTY_COMMISSION,
      sourceName: "Carson City Board of Supervisors",
      sourceUrl: "https://www.carsoncity.gov/government/board-of-supervisors",
      confidenceScore: 0.86,
      matchMethod: "Carson City is an independent city and county-equivalent government; the Board of Supervisors performs local governing functions.",
    },
    {
      label: "Carson City municipality",
      jurisdictionSlug: "carson-city",
      jurisdictionName: "Carson City",
      districtName: "Citywide / ward offices",
      districtType: DistrictType.CITY_WARD,
      sourceName: "Carson City Board of Supervisors",
      sourceUrl: "https://www.carsoncity.gov/government/board-of-supervisors",
      confidenceScore: 0.78,
      matchMethod: "Carson City mayor and ward supervisor offices are known; exact ward assignment still requires address-level boundary matching.",
    },
    {
      label: "Carson City School District",
      jurisdictionSlug: "carson-city",
      jurisdictionName: "Carson City",
      districtName: "Carson City School District",
      districtType: DistrictType.SCHOOL_DISTRICT,
      sourceName: "Carson City School District School Board",
      sourceUrl: "https://www.carsoncityschools.com/our-district/school-board",
      confidenceScore: 0.9,
      matchMethod: "Official Carson City School District page confirms the district and school board serving Carson City.",
    },
    {
      label: "Carson City School Board trustee districts",
      jurisdictionSlug: "carson-city",
      jurisdictionName: "Carson City",
      districtName: "Trustee Districts 1-7",
      districtType: DistrictType.SCHOOL_BOARD,
      sourceName: "Carson City School District School Board",
      sourceUrl: "https://www.carsoncityschools.com/our-district/school-board",
      confidenceScore: 0.78,
      matchMethod: "Official district page lists trustee Districts 1-7; exact trustee district still requires address-level boundary matching.",
    },
    {
      label: "First Judicial District / Carson City courts",
      jurisdictionSlug: "carson-city",
      jurisdictionName: "Carson City",
      districtName: "First Judicial District and Carson City Justice/Municipal Court",
      districtType: DistrictType.JUDICIAL_DISTRICT,
      sourceName: "Carson City Department Directory",
      sourceUrl: "https://www.carsoncity.gov/government/department-directory",
      confidenceScore: 0.84,
      matchMethod: "Carson City source-backed court records identify Carson City justice/municipal court officials.",
    },
    {
      label: "Carson City municipal court departments",
      jurisdictionSlug: "carson-city",
      jurisdictionName: "Carson City",
      districtName: "Justice/Municipal Court Departments I-II",
      districtType: DistrictType.MUNICIPAL_COURT,
      sourceName: "Carson City Department Directory",
      sourceUrl: "https://www.carsoncity.gov/government/department-directory",
      confidenceScore: 0.84,
      matchMethod: "Carson City department source lists Justice of the Peace departments for the local justice/municipal court.",
    },
    {
      label: "Carson City justice court departments",
      jurisdictionSlug: "carson-city",
      jurisdictionName: "Carson City",
      districtName: "Justice Court Departments I-II",
      districtType: DistrictType.JUSTICE_COURT,
      sourceName: "Carson City Department Directory",
      sourceUrl: "https://www.carsoncity.gov/government/department-directory",
      confidenceScore: 0.84,
      matchMethod: "Carson City department source lists Justice of the Peace departments for local justice court functions.",
    },
  ],
};

type GeneratedCurrentOfficialRecord = {
  id: string;
  name: string;
  title?: string | null;
  office?: string | null;
  jurisdiction?: string | null;
  district?: string | null;
  party?: string | null;
  source_url?: string | null;
  source_label?: string | null;
  profile_url?: string | null;
  confidence?: number | null;
  review_status?: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function slugifyDistrictName(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizePersonName(value: string | null | undefined) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function personNamesProbablyMatch(a: string | null | undefined, b: string | null | undefined) {
  const aText = normalize(a).replace(/["']/g, "");
  const bText = normalize(b).replace(/["']/g, "");
  const aCompact = normalizePersonName(aText);
  const bCompact = normalizePersonName(bText);
  if (!aCompact || !bCompact) return false;
  if (aCompact === bCompact) return true;
  const aParts = aText.split(/\s+/).filter(Boolean);
  const bParts = bText.split(/\s+/).filter(Boolean);
  const aFirst = aParts[0];
  const bFirst = bParts[0];
  const aLast = aParts.at(-1);
  const bLast = bParts.at(-1);
  return Boolean(aFirst && bFirst && aLast && bLast && aFirst === bFirst && aLast === bLast);
}

function parseLatLng(input: string | undefined) {
  const match = input?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function locationToJurisdictionSlugs(input: string, user: AuthUser) {
  const normalized = normalize(input);
  const defaultCommunity = getDefaultCommunityForUser(user);
  const slugs = new Set(["united-states"]);

  if (!normalized || normalized === "saved" || normalized === "my community") {
    slugs.add(defaultCommunity.id);
  }

  if (normalized.includes("reno")) {
    slugs.add("reno");
    slugs.add("washoe-county");
    slugs.add("nevada");
  }

  if (normalized.includes("sparks")) {
    slugs.add("sparks");
    slugs.add("washoe-county");
    slugs.add("nevada");
  }

  if (normalized.includes("washoe")) {
    slugs.add("washoe-county");
    slugs.add("nevada");
  }

  if (normalized.includes("carson")) {
    slugs.add("carson-city");
    slugs.add("nevada");
  }

  if (normalized.includes("nevada")) {
    slugs.add("nevada");
  }

  const community = getCommunityById(defaultCommunity.id);
  if (community?.jurisdictionMatches.some((name) => name.toLowerCase().includes("nevada"))) {
    slugs.add("nevada");
  }

  return [...slugs];
}

function sourceFallback(source: { name: string; url: string; lastSyncAt?: Date | null; updatedAt?: Date } | null | undefined) {
  return {
    sourceName: source?.name ?? "Stored Direct Democracy civic data",
    sourceUrl: source?.url ?? "https://www.nvsos.gov/sos/elections",
    lastUpdated: (source?.lastSyncAt ?? source?.updatedAt)?.toISOString() ?? null,
  };
}

function pointInRing(point: { lat: number; lng: number }, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (typeof xi !== "number" || typeof yi !== "number" || typeof xj !== "number" || typeof yj !== "number") continue;
    const intersects = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi || 1) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeoJson(point: { lat: number; lng: number }, geoJson: Prisma.JsonValue | null) {
  const geometry = (geoJson as { type?: string; coordinates?: unknown; geometry?: { type?: string; coordinates?: unknown } } | null)?.geometry ??
    (geoJson as { type?: string; coordinates?: unknown } | null);
  if (!geometry?.type || !Array.isArray(geometry.coordinates)) return false;

  if (geometry.type === "Polygon") {
    return (geometry.coordinates as number[][][]).some((ring) => pointInRing(point, ring));
  }

  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][]).some((polygon) => polygon.some((ring) => pointInRing(point, ring)));
  }

  return false;
}

function groupForDistrictType(type: DistrictType | null | undefined): RepresentativeGroupKey | null {
  if (!type) return null;
  if (type === DistrictType.CONGRESSIONAL) return "federal";
  if (type === DistrictType.STATE_SENATE || type === DistrictType.STATE_ASSEMBLY) return "state";
  if (type === DistrictType.COUNTY_COMMISSION) return "county";
  if (type === DistrictType.CITY_WARD) return "city";
  if (type === DistrictType.SCHOOL_DISTRICT || type === DistrictType.SCHOOL_BOARD) return "school";
  if (type === DistrictType.JUDICIAL_DISTRICT || type === DistrictType.MUNICIPAL_COURT || type === DistrictType.JUSTICE_COURT) return "courts";
  return null;
}

function groupForRecord(record: {
  office?: { title: string; level: OfficeLevel } | null;
  jurisdiction: { slug: string; type?: string | null };
  district?: { districtType?: DistrictType; name?: string } | null;
}): RepresentativeGroupKey {
  const officeText = normalize(record.office?.title);
  const districtGroup = groupForDistrictType(record.district?.districtType);
  if (districtGroup) return districtGroup;
  if (officeText.includes("court") || officeText.includes("judge")) return "courts";
  if (officeText.includes("school") || officeText.includes("trustee")) return "school";
  if (record.jurisdiction.slug === "united-states" || record.office?.level === OfficeLevel.FEDERAL) return "federal";
  if (record.office?.level === OfficeLevel.STATE || record.jurisdiction.slug === "nevada") return "state";
  if (record.office?.level === OfficeLevel.COUNTY) return "county";
  if (record.office?.level === OfficeLevel.CITY) return "city";
  return "state";
}

function groupForGeneratedOfficial(record: GeneratedCurrentOfficialRecord): RepresentativeGroupKey | null {
  const title = normalize(record.title ?? record.office);
  const jurisdiction = normalize(record.jurisdiction);
  const source = normalize(record.source_label);
  if (jurisdiction.includes("school district") || source.includes("school district") || source.includes("school board")) return "school";
  if (title.includes("justice") || title.includes("judge") || title.includes("court")) return "courts";
  if (title.includes("school") || title.includes("trustee")) return "school";
  if (title.includes("assessor") || title.includes("clerk") || title.includes("recorder") || title.includes("district attorney") || title.includes("sheriff") || title.includes("treasurer")) {
    return "county";
  }
  if (title.includes("mayor") || title.includes("supervisor") || title.includes("council") || title.includes("commissioner")) return "city";
  return null;
}

function isRepresentativeLikeGeneratedOfficial(record: GeneratedCurrentOfficialRecord) {
  return Boolean(groupForGeneratedOfficial(record));
}

function readGeneratedCurrentOfficials() {
  const filePath = path.join(process.cwd(), "data", "generated", "nevada-community-officials.json");
  if (!existsSync(filePath)) return [];

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as { records?: GeneratedCurrentOfficialRecord[] } | GeneratedCurrentOfficialRecord[];
    return (Array.isArray(parsed) ? parsed : parsed.records ?? []).filter(isRepresentativeLikeGeneratedOfficial);
  } catch (error) {
    console.warn("[district-lookup] generated current officials unavailable", error);
    return [];
  }
}

function generatedOfficialMatchesJurisdiction(record: GeneratedCurrentOfficialRecord, jurisdictionNames: string[]) {
  const recordJurisdiction = normalize(record.jurisdiction);
  if (!recordJurisdiction) return false;
  return jurisdictionNames.some((name) => recordJurisdiction.includes(normalize(name)) || normalize(name).includes(recordJurisdiction));
}

function displayJurisdiction(value: string | null | undefined) {
  return String(value ?? "Nevada").replace(/,\s*Nevada$/i, "");
}

function displayPersonName(value: string) {
  const decoded = value
    .replace(/&#225;/g, "á")
    .replace(/&#233;/g, "é")
    .replace(/&#237;/g, "í")
    .replace(/&#243;/g, "ó")
    .replace(/&#250;/g, "ú")
    .replace(/&amp;/g, "&");
  const commaMatch = decoded.match(/^([^,]+),\s*(.+)$/);
  return commaMatch ? `${commaMatch[2]} ${commaMatch[1]}` : decoded;
}

function generatedRoleLabel(record: GeneratedCurrentOfficialRecord) {
  if (groupForGeneratedOfficial(record) === "school") {
    const title = normalize(record.title ?? record.office);
    if (title.includes("vice president")) return `${displayJurisdiction(record.jurisdiction)} Trustee, Vice President`;
    if (title.includes("president")) return `${displayJurisdiction(record.jurisdiction)} Trustee, President`;
    if (title.includes("clerk")) return `${displayJurisdiction(record.jurisdiction)} Trustee, Clerk`;
    return `${displayJurisdiction(record.jurisdiction)} Trustee`;
  }
  return record.title ?? record.office ?? "Current official";
}

async function getStoredAssignments(userId: string) {
  try {
    return await prisma.userDistrictAssignment.findMany({
      where: { userId, isActive: true },
      include: {
        jurisdiction: true,
        district: true,
        source: true,
      },
      orderBy: [{ updatedAt: "desc" }],
    });
  } catch (error) {
    console.warn("[district-lookup] stored assignment lookup unavailable", error);
    return [];
  }
}

export async function getRepresentativeLookup({
  user,
  locationInput,
}: {
  user: AuthUser;
  locationInput?: string;
}): Promise<RepresentativeLookupResult> {
  const inputLabel = locationInput?.trim() || "Saved community";
  const point = parseLatLng(locationInput);
  const jurisdictionSlugs = locationToJurisdictionSlugs(inputLabel, user);
  const baselineEntries = [...new Set(jurisdictionSlugs.flatMap((slug) => COMMUNITY_DISTRICT_BASELINES[slug] ?? []))];
  const baselineDistrictWhere: Prisma.DistrictWhereInput[] = baselineEntries.map((entry) => ({
    districtType: entry.districtType,
    jurisdiction: { slug: entry.jurisdictionSlug },
    name: { in: [entry.districtName, ...(entry.districtAliases ?? [])] },
  }));
  const [jurisdictions, storedAssignments, boundaryDistricts, baselineDistricts] = await Promise.all([
    prisma.jurisdiction.findMany({
      where: { slug: { in: jurisdictionSlugs } },
      include: { sources: true },
    }),
    getStoredAssignments(user.id),
    point
      ? prisma.district.findMany({
          where: {
            boundaryGeoJson: { not: Prisma.JsonNull },
            jurisdiction: { slug: { in: jurisdictionSlugs } },
          },
          include: { jurisdiction: true, source: true },
        })
      : Promise.resolve([]),
    baselineDistrictWhere.length
      ? prisma.district.findMany({
          where: { OR: baselineDistrictWhere },
          include: { jurisdiction: true, source: true },
        })
      : Promise.resolve([]),
  ]);

  const assignments: DistrictAssignmentSummary[] = [];

  jurisdictions.forEach((jurisdiction) => {
    const source = sourceFallback(jurisdiction.sources[0]);
    assignments.push({
      id: `jurisdiction-${jurisdiction.id}`,
      label: jurisdiction.name,
      jurisdictionName: jurisdiction.name,
      jurisdictionSlug: jurisdiction.slug,
      districtName: null,
      districtType: "JURISDICTION",
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl,
      lastUpdated: source.lastUpdated,
      confidenceScore: jurisdiction.slug === "united-states" || jurisdiction.slug === "nevada" ? 0.9 : 0.68,
      matchMethod: point ? "Jurisdiction inferred from entered coordinates" : "Jurisdiction inferred from saved community or entered location text",
      status: "matched",
    });
  });

  storedAssignments.forEach((assignment) => {
    const source = sourceFallback(assignment.source);
    assignments.push({
      id: assignment.id,
      label: assignment.district?.name ?? assignment.jurisdiction.name,
      jurisdictionName: assignment.jurisdiction.name,
      jurisdictionSlug: assignment.jurisdiction.slug,
      districtName: assignment.district?.name ?? null,
      districtType: assignment.district?.districtType ?? assignment.assignmentType ?? "JURISDICTION",
      sourceName: assignment.sourceName || source.sourceName,
      sourceUrl: assignment.sourceUrl || source.sourceUrl,
      lastUpdated: assignment.sourceLastUpdatedAt?.toISOString() ?? source.lastUpdated,
      confidenceScore: assignment.confidenceScore,
      matchMethod: assignment.matchMethod,
      status: assignment.districtId ? "matched" : "pending",
    });
  });

  if (point) {
    boundaryDistricts.forEach((district) => {
      if (!pointInGeoJson(point, district.boundaryGeoJson)) return;
      const source = sourceFallback(district.source);
      assignments.push({
        id: `boundary-${district.id}`,
        label: district.name,
        jurisdictionName: district.jurisdiction.name,
        jurisdictionSlug: district.jurisdiction.slug,
        districtName: district.name,
        districtType: district.districtType,
        sourceName: source.sourceName,
        sourceUrl: source.sourceUrl,
        lastUpdated: source.lastUpdated,
        confidenceScore: 0.92,
        matchMethod: "Point-in-boundary match against stored district GeoJSON",
        status: "matched",
      });
    });
  }

  baselineEntries.forEach((entry) => {
    const matchedDistrict = baselineDistricts.find((district) => {
      const names = [entry.districtName, ...(entry.districtAliases ?? [])].map(normalize);
      return district.districtType === entry.districtType && district.jurisdiction.slug === entry.jurisdictionSlug && names.includes(normalize(district.name));
    });
    assignments.push({
      id: `baseline-${entry.jurisdictionSlug}-${entry.districtType}-${slugifyDistrictName(entry.districtName)}`,
      label: entry.label,
      jurisdictionName: matchedDistrict?.jurisdiction.name ?? entry.jurisdictionName,
      jurisdictionSlug: matchedDistrict?.jurisdiction.slug ?? entry.jurisdictionSlug,
      districtName: matchedDistrict?.name ?? entry.districtName,
      districtType: entry.districtType,
      sourceName: matchedDistrict?.source?.name ?? entry.sourceName,
      sourceUrl: matchedDistrict?.source?.url ?? entry.sourceUrl,
      lastUpdated: matchedDistrict?.updatedAt?.toISOString() ?? null,
      confidenceScore: entry.confidenceScore,
      matchMethod: entry.matchMethod,
      status: "matched",
    });
  });

  const jurisdictionIds = new Set(jurisdictions.map((jurisdiction) => jurisdiction.id));
  const matchedDistrictIds = new Set(
    [
      ...storedAssignments.filter((assignment) => assignment.districtId).map((assignment) => assignment.districtId!),
      ...boundaryDistricts.filter((district) => assignments.some((assignment) => assignment.id === `boundary-${district.id}`)).map((district) => district.id),
      ...baselineDistricts.map((district) => district.id),
    ],
  );
  const matchedDistrictTypes = new Set(assignments.flatMap((assignment) => (assignment.status === "matched" && assignment.districtType !== "JURISDICTION" ? [assignment.districtType] : [])));

  const includedDistrictWhere = {
    OR: [
      { districtId: null, jurisdictionId: { in: [...jurisdictionIds] } },
      { districtId: { in: [...matchedDistrictIds] } },
      { district: { districtType: DistrictType.AT_LARGE }, jurisdictionId: { in: [...jurisdictionIds] } },
    ],
  };
  const localJurisdictionIds = jurisdictions
    .filter((jurisdiction) => jurisdiction.slug !== "nevada" && jurisdiction.slug !== "united-states")
    .map((jurisdiction) => jurisdiction.id);
  const officialWhere: Prisma.OfficialWhereInput = {
    status: "CURRENT",
    OR: [
      ...includedDistrictWhere.OR,
      {
        jurisdictionId: { in: localJurisdictionIds },
        office: { level: { in: [OfficeLevel.COUNTY, OfficeLevel.CITY] } },
      },
    ],
  };

  const [officials, candidates, elections, ballotItems] = await Promise.all([
    prisma.official.findMany({
      where: officialWhere,
      include: { office: true, jurisdiction: true, district: true, source: true },
      orderBy: [{ jurisdiction: { name: "asc" } }, { office: { level: "asc" } }, { fullName: "asc" }],
      take: 80,
    }),
    prisma.candidate.findMany({
      where: includedDistrictWhere,
      include: { office: true, jurisdiction: true, district: true, source: true, election: true },
      orderBy: [{ election: { electionDate: "desc" } }, { fullName: "asc" }],
      take: 80,
    }),
    prisma.election.findMany({
      where: includedDistrictWhere,
      include: { jurisdiction: true, district: true, source: true },
      orderBy: [{ electionDate: "asc" }],
      take: 40,
    }),
    prisma.ballotQuestion.findMany({
      where: { jurisdictionId: { in: [...jurisdictionIds] } },
      include: { jurisdiction: true, source: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 40,
    }),
  ]);

  const pendingAssignments = REQUIRED_DISTRICT_TYPES.filter((entry) => !matchedDistrictTypes.has(entry.type)).map((entry) => {
    const source = DISTRICT_SOURCE_ADAPTER_STUBS.find((adapter) => adapter.districtTypes.includes(entry.type));
    return {
      id: `pending-${entry.type}`,
      label: entry.label,
      jurisdictionName: "Nevada / local district source",
      jurisdictionSlug: "nevada",
      districtName: null,
      districtType: entry.type,
      sourceName: source?.sourceName ?? "District source pending",
      sourceUrl: source?.sourceUrl ?? "https://www.nvsos.gov/sos/elections",
      lastUpdated: null,
      confidenceScore: 0,
      matchMethod: "District match pending — source data not imported yet.",
      status: "pending" as const,
    };
  });

  const localJurisdictionNames = jurisdictions
    .filter((jurisdiction) => jurisdiction.slug !== "nevada" && jurisdiction.slug !== "united-states")
    .map((jurisdiction) => jurisdiction.name);
  const jurisdictionNamesForGeneratedOfficials = localJurisdictionNames.length ? localJurisdictionNames : jurisdictions.map((jurisdiction) => jurisdiction.name);
  const generatedCurrentOfficials = readGeneratedCurrentOfficials().filter((official) => generatedOfficialMatchesJurisdiction(official, jurisdictionNamesForGeneratedOfficials));

  const groups = GROUPS.map((group) => {
    const groupOfficialRows = officials.filter((official) => groupForRecord(official) === group.key);
    const groupCandidateRows = candidates.filter((candidate) => groupForRecord(candidate) === group.key);
    const groupElectionRows = elections.filter((election) => groupForRecord({ ...election, office: null }) === group.key);
    const groupBallotRows = ballotItems.filter((item) => group.key === "state" || group.key === "county" || group.key === "city");
    const missing = pendingAssignments.filter((assignment) => REQUIRED_DISTRICT_TYPES.find((entry) => entry.type === assignment.districtType)?.group === group.key);
    const generatedOfficials = generatedCurrentOfficials
      .filter((official) => groupForGeneratedOfficial(official) === group.key)
      .filter((official) => !groupOfficialRows.some((row) => personNamesProbablyMatch(row.fullName, official.name)));

    return {
      ...group,
      officials: [
        ...groupOfficialRows.map((official) => {
          const exactDistrictMatch = official.districtId ? matchedDistrictIds.has(official.districtId) : true;
          const districtNeedsAddress = Boolean(official.districtId && !exactDistrictMatch);
          return {
            id: official.id,
            name: displayPersonName(official.fullName),
            roleLabel: official.office.title,
            jurisdictionName: official.jurisdiction.name,
            districtName: official.district?.name ?? null,
            partyText: official.partyText,
            href: `/officials/${official.id}`,
            sourceName: official.source?.name ?? "Imported civic data",
            sourceUrl: official.source?.url ?? null,
            confidenceScore: districtNeedsAddress ? 0.72 : official.districtId ? 0.92 : 0.82,
            matchNote: districtNeedsAddress
              ? "District-specific local office shown because it belongs to this jurisdiction. Entering an address can narrow the exact ward or district when boundary data is available."
              : official.districtId
                ? "Matched to a stored district assignment."
                : "Jurisdiction-wide office for this location.",
          };
        }),
        ...generatedOfficials.map((official) => ({
          id: official.id,
          name: official.name,
          roleLabel: generatedRoleLabel(official),
          jurisdictionName: official.jurisdiction ?? "Nevada",
          districtName: official.district ?? null,
          partyText: official.party ?? null,
          href: `/officials/${official.id}`,
          sourceName: official.source_label ?? "Generated Nevada current-officeholder source",
          sourceUrl: official.source_url ?? official.profile_url ?? null,
          confidenceScore: official.confidence ?? 0.78,
          matchNote: "Current officeholder from the generated Nevada official index. Shown because the source-backed record matches this jurisdiction.",
        })),
      ],
      candidates: groupCandidateRows.map((candidate) => ({
        id: candidate.id,
        name: candidate.ballotName ?? candidate.fullName,
        roleLabel: candidate.office?.title ?? candidate.election.officeTitle,
        jurisdictionName: candidate.jurisdiction.name,
        districtName: candidate.district?.name ?? null,
        partyText: candidate.partyText,
        href: `/candidates/${candidate.id}`,
        sourceName: candidate.source?.name ?? "Imported candidate data",
        sourceUrl: candidate.sourceUrl ?? candidate.source?.url ?? null,
        confidenceScore: candidate.districtId ? 0.9 : 0.8,
        matchNote: candidate.districtId ? "Matched to an election district." : "Jurisdiction-wide candidate record.",
      })),
      elections: groupElectionRows.map((election) => ({
        id: election.id,
        title: election.title,
        officeTitle: election.officeTitle,
        electionDate: election.electionDate.toISOString(),
        jurisdictionName: election.jurisdiction.name,
        districtName: election.district?.name ?? null,
        href: `/elections/${election.id}`,
        sourceName: election.source?.name ?? "Imported election data",
        sourceUrl: election.source?.url ?? null,
      })),
      ballotItems: groupBallotRows.map((item) => ({
        id: item.id,
        title: item.title,
        jurisdictionName: item.jurisdiction.name,
        href: `/ballot-measures`,
        sourceName: item.source?.name ?? "Imported ballot data",
        sourceUrl: item.source?.url ?? null,
      })),
      missing: [
        ...new Set(
          missing.map((assignment) => {
            const districtLabel = REQUIRED_DISTRICT_TYPES.find((entry) => entry.type === assignment.districtType)?.label.toLowerCase() ?? "district";
            return `Exact ${districtLabel} matching is still pending. Source-backed jurisdiction-wide and local district officials are shown when available.`;
          }),
        ),
      ],
    } satisfies RepresentativeLookupGroup;
  });

  return {
    inputLabel,
    normalizedLocationLabel: jurisdictions.map((jurisdiction) => jurisdiction.name).join(" / ") || "District match pending",
    assignments,
    pendingAssignments,
    groups,
    adapterStubs: DISTRICT_SOURCE_ADAPTER_STUBS,
  };
}
