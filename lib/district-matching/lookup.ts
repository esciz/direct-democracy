import { DistrictType, OfficeLevel, Prisma } from "@prisma/client";

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

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
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
  const [jurisdictions, storedAssignments, boundaryDistricts] = await Promise.all([
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

  const jurisdictionIds = new Set(jurisdictions.map((jurisdiction) => jurisdiction.id));
  const matchedDistrictIds = new Set(
    [
      ...storedAssignments.filter((assignment) => assignment.districtId).map((assignment) => assignment.districtId!),
      ...boundaryDistricts.filter((district) => assignments.some((assignment) => assignment.id === `boundary-${district.id}`)).map((district) => district.id),
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

  const [officials, candidates, elections, ballotItems] = await Promise.all([
    prisma.official.findMany({
      where: { status: "CURRENT", ...includedDistrictWhere },
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

  const groups = GROUPS.map((group) => {
    const groupOfficialRows = officials.filter((official) => groupForRecord(official) === group.key);
    const groupCandidateRows = candidates.filter((candidate) => groupForRecord(candidate) === group.key);
    const groupElectionRows = elections.filter((election) => groupForRecord({ ...election, office: null }) === group.key);
    const groupBallotRows = ballotItems.filter((item) => group.key === "state" || group.key === "county" || group.key === "city");
    const missing = pendingAssignments.filter((assignment) => REQUIRED_DISTRICT_TYPES.find((entry) => entry.type === assignment.districtType)?.group === group.key);

    return {
      ...group,
      officials: groupOfficialRows.map((official) => ({
        id: official.id,
        name: official.fullName,
        roleLabel: official.office.title,
        jurisdictionName: official.jurisdiction.name,
        districtName: official.district?.name ?? null,
        partyText: official.partyText,
        href: `/officials/${official.id}`,
        sourceName: official.source?.name ?? "Imported civic data",
        sourceUrl: official.source?.url ?? null,
        confidenceScore: official.districtId ? 0.92 : 0.82,
      })),
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
      missing: missing.map((assignment) => assignment.matchMethod),
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
