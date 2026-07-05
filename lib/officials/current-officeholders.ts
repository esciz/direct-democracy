import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { normalizeWhitespace, slugify } from "@/lib/public-meetings/shared";

export type CurrentOfficialRoleCategory =
  | "governing_body"
  | "elected_executive"
  | "elected_constitutional_office"
  | "judiciary"
  | "appointed_executive"
  | "department_leadership"
  | "board_or_commission"
  | "staff"
  | "unknown";

export type CurrentOfficialSelectionMethod = "elected" | "appointed" | "acting" | "interim" | "career_staff" | "unknown";

export type CurrentOfficialStatus = "active" | "former" | "acting" | "interim" | "vacant" | "disputed" | "needs_review";

export type OfficialDirectorySource = {
  id: string;
  jurisdictionId: string;
  jurisdictionName: string;
  sourceName: string;
  sourceUrl: string;
  sourceType:
    | "individual_official_page"
    | "governing_body_page"
    | "elected_official_page"
    | "department_directory"
    | "staff_directory"
    | "verified_meeting_roster"
    | "reviewed_manual_source";
  priority: number;
  checkCadence: string;
  monitoringCadence: string;
  parserStatus: "implemented" | "configured" | "manual_review" | "not_started";
  retrievalStatus: "not_retrieved" | "retrieved" | "blocked_by_network" | "manual_cache_available" | "reviewed_baseline";
  cachedPath: string | null;
  contentHash: string | null;
  lastCheckedAt: string | null;
  lastSuccessfulRetrievalAt: string | null;
  lastChangedAt: string | null;
  lastParsedAt: string | null;
  lastVerifiedAt: string | null;
  nextDueAt: string | null;
  sourceHealth: "healthy" | "partial" | "stale" | "blocked" | "unknown";
};

export type CurrentOfficeholderRecord = {
  id: string;
  stablePersonId: string;
  stableOfficeId: string;
  jurisdictionId: string;
  jurisdictionName: string;
  communityId: string;
  communityName: string;
  governingBodyId: string | null;
  departmentId: string | null;
  publicDisplayName: string;
  normalizedName: string;
  aliases: string[];
  sourceTitle: string;
  normalizedTitle: string;
  wardOrDistrict: string | null;
  department: string | null;
  roleCategory: CurrentOfficialRoleCategory;
  selectionMethod: CurrentOfficialSelectionMethod;
  currentStatus: CurrentOfficialStatus;
  actingOrInterim: boolean;
  termStart: string | null;
  termEnd: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string;
  sourceUrl: string;
  sourcePageTitle: string;
  sourceType: OfficialDirectorySource["sourceType"];
  sourceId: string;
  sourceHash: string | null;
  sourceSnippet: string | null;
  confidence: number;
  reviewStatus: "source_backed" | "needs_review";
  relatedActionCount: number;
};

export type CurrentOfficialRuntimeRecord = {
  id: string;
  name: string;
  title: string;
  office: string;
  jurisdiction: string;
  communityName: string;
  level: string | null;
  body_name: string | null;
  district: string | null;
  department: string | null;
  role_category: CurrentOfficialRoleCategory;
  selection_method: CurrentOfficialSelectionMethod;
  current_status: CurrentOfficialStatus;
  acting_or_interim: boolean;
  source_url: string | null;
  source_type: OfficialDirectorySource["sourceType"];
  source_label: string;
  confidence: number;
  review_status: string;
  needsReview: boolean;
  last_verified_at: string | null;
  profile_url: string | null;
  aliases: string[];
  related_action_count: number;
};

function idHash(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

export function normalizeOfficialName(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/\b(?:mr|mrs|ms|dr|hon)\.?\s+/g, "")
    .replace(/"([^"]+)"/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sourceHash(sourceUrl: string, snippet: string) {
  return idHash(`${sourceUrl}:${snippet}`);
}

function nextDueFrom(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function getOfficialDirectorySources(generatedAt = new Date().toISOString()): OfficialDirectorySource[] {
  return [
    {
      id: "carson-city-department-directory",
      jurisdictionId: "carson-city",
      jurisdictionName: "Carson City",
      sourceName: "Carson City Department Directory",
      sourceUrl: "https://www.carsoncity.gov/government/department-directory",
      sourceType: "department_directory",
      priority: 4,
      checkCadence: "P1D",
      monitoringCadence: "daily source check; weekly full validation",
      parserStatus: "implemented",
      retrievalStatus: "reviewed_baseline",
      cachedPath: null,
      contentHash: null,
      lastCheckedAt: generatedAt,
      lastSuccessfulRetrievalAt: null,
      lastChangedAt: null,
      lastParsedAt: generatedAt,
      lastVerifiedAt: generatedAt,
      nextDueAt: nextDueFrom(generatedAt, 1),
      sourceHealth: "partial",
    },
    {
      id: "carson-city-board-of-supervisors",
      jurisdictionId: "carson-city",
      jurisdictionName: "Carson City",
      sourceName: "Carson City Board of Supervisors",
      sourceUrl: "https://www.carsoncity.gov/government/board-of-supervisors",
      sourceType: "governing_body_page",
      priority: 2,
      checkCadence: "P1D",
      monitoringCadence: "daily source check; weekly full validation",
      parserStatus: "implemented",
      retrievalStatus: "reviewed_baseline",
      cachedPath: null,
      contentHash: null,
      lastCheckedAt: generatedAt,
      lastSuccessfulRetrievalAt: null,
      lastChangedAt: null,
      lastParsedAt: generatedAt,
      lastVerifiedAt: generatedAt,
      nextDueAt: nextDueFrom(generatedAt, 1),
      sourceHealth: "partial",
    },
    {
      id: "carson-city-staff-directory",
      jurisdictionId: "carson-city",
      jurisdictionName: "Carson City",
      sourceName: "Carson City Staff Directory",
      sourceUrl: "https://www.carsoncity.gov/government/department-directory/staff-directory",
      sourceType: "staff_directory",
      priority: 5,
      checkCadence: "P1D",
      monitoringCadence: "daily source check; weekly full validation",
      parserStatus: "configured",
      retrievalStatus: "not_retrieved",
      cachedPath: null,
      contentHash: null,
      lastCheckedAt: null,
      lastSuccessfulRetrievalAt: null,
      lastChangedAt: null,
      lastParsedAt: null,
      lastVerifiedAt: null,
      nextDueAt: generatedAt,
      sourceHealth: "unknown",
    },
    {
      id: "carson-city-school-district-board",
      jurisdictionId: "carson-city-school-district",
      jurisdictionName: "Carson City School District",
      sourceName: "Carson City School District School Board",
      sourceUrl: "https://www.carsoncityschools.com/our-district/school-board",
      sourceType: "governing_body_page",
      priority: 3,
      checkCadence: "P1D",
      monitoringCadence: "daily source check; weekly full validation",
      parserStatus: "configured",
      retrievalStatus: "reviewed_baseline",
      cachedPath: null,
      contentHash: null,
      lastCheckedAt: generatedAt,
      lastSuccessfulRetrievalAt: null,
      lastChangedAt: null,
      lastParsedAt: generatedAt,
      lastVerifiedAt: generatedAt,
      nextDueAt: nextDueFrom(generatedAt, 1),
      sourceHealth: "partial",
    },
    {
      id: "elko-city-council",
      jurisdictionId: "elko",
      jurisdictionName: "Elko",
      sourceName: "Elko City Council",
      sourceUrl: "https://www.elkocity.com/government/city_council.php",
      sourceType: "governing_body_page",
      priority: 3,
      checkCadence: "P1D",
      monitoringCadence: "daily source check; weekly full validation",
      parserStatus: "configured",
      retrievalStatus: "not_retrieved",
      cachedPath: null,
      contentHash: null,
      lastCheckedAt: null,
      lastSuccessfulRetrievalAt: null,
      lastChangedAt: null,
      lastParsedAt: null,
      lastVerifiedAt: null,
      nextDueAt: generatedAt,
      sourceHealth: "unknown",
    },
    {
      id: "elko-city-staff-directory",
      jurisdictionId: "elko",
      jurisdictionName: "Elko",
      sourceName: "Elko Staff Directory",
      sourceUrl: "https://www.elkocity.com/staff_directory/index.php",
      sourceType: "staff_directory",
      priority: 5,
      checkCadence: "P1D",
      monitoringCadence: "daily source check; weekly full validation",
      parserStatus: "configured",
      retrievalStatus: "not_retrieved",
      cachedPath: null,
      contentHash: null,
      lastCheckedAt: null,
      lastSuccessfulRetrievalAt: null,
      lastChangedAt: null,
      lastParsedAt: null,
      lastVerifiedAt: null,
      nextDueAt: generatedAt,
      sourceHealth: "unknown",
    },
    {
      id: "elko-county-commission",
      jurisdictionId: "elko-county",
      jurisdictionName: "Elko County",
      sourceName: "Elko County Commission Members",
      sourceUrl: "https://www.elkocountynv.net/boards/commissioners/commission/members19.php",
      sourceType: "governing_body_page",
      priority: 3,
      checkCadence: "P1D",
      monitoringCadence: "daily source check; weekly full validation",
      parserStatus: "configured",
      retrievalStatus: "not_retrieved",
      cachedPath: null,
      contentHash: null,
      lastCheckedAt: null,
      lastSuccessfulRetrievalAt: null,
      lastChangedAt: null,
      lastParsedAt: null,
      lastVerifiedAt: null,
      nextDueAt: generatedAt,
      sourceHealth: "unknown",
    },
  ];
}

type CarsonOfficialInput = {
  name: string;
  title: string;
  wardOrDistrict?: string | null;
  department?: string | null;
  roleCategory: CurrentOfficialRoleCategory;
  selectionMethod: CurrentOfficialSelectionMethod;
  currentStatus?: CurrentOfficialStatus;
  sourceId: string;
  sourcePageTitle: string;
  sourceType: OfficialDirectorySource["sourceType"];
  sourceUrl: string;
  sourceSnippet: string;
  aliases?: string[];
  confidence?: number;
};

type ReviewedOfficialInput = {
  name: string;
  title: string;
  jurisdictionId: string;
  jurisdictionName: string;
  communityId: string;
  communityName: string;
  governingBodyId: string;
  bodyName: string;
  wardOrDistrict?: string | null;
  roleCategory?: CurrentOfficialRoleCategory;
  selectionMethod?: CurrentOfficialSelectionMethod;
  sourceId: string;
  sourceUrl: string;
  sourceSnippet: string;
  aliases?: string[];
  confidence?: number;
};

type ReviewedRosterSeed = {
  providerId: string;
  sourceName: string;
  sourceUrl?: string | null;
  bodyName: string;
  members?: Array<{
    externalId?: string | null;
    fullName: string;
    surname?: string | null;
    seatTitle?: string | null;
    termStart?: string | null;
    status?: string | null;
    sourceUrl?: string | null;
    aliases?: string[];
  }>;
};

const reviewedRosterJurisdictions: Record<
  string,
  {
    jurisdictionId: string;
    jurisdictionName: string;
    communityId: string;
    communityName: string;
    governingBodyId: string;
    confidence: number;
  }
> = {
  "clark-county-commission": {
    jurisdictionId: "clark-county",
    jurisdictionName: "Clark County",
    communityId: "clark-county",
    communityName: "Clark County",
    governingBodyId: "clark-county-commission",
    confidence: 0.9,
  },
  "clark-county-school-district": {
    jurisdictionId: "clark-county-school-district",
    jurisdictionName: "Clark County School District",
    communityId: "clark-county-school-district",
    communityName: "Clark County School District",
    governingBodyId: "clark-county-school-district-board-of-trustees",
    confidence: 0.88,
  },
  "carson-city-school-district": {
    jurisdictionId: "carson-city-school-district",
    jurisdictionName: "Carson City School District",
    communityId: "carson-city",
    communityName: "Carson City",
    governingBodyId: "carson-city-school-district-board-of-trustees",
    confidence: 0.92,
  },
  "henderson-city-council": {
    jurisdictionId: "henderson",
    jurisdictionName: "Henderson",
    communityId: "henderson",
    communityName: "Henderson",
    governingBodyId: "henderson-city-council",
    confidence: 0.9,
  },
  "las-vegas-city-council": {
    jurisdictionId: "las-vegas",
    jurisdictionName: "Las Vegas",
    communityId: "las-vegas",
    communityName: "Las Vegas",
    governingBodyId: "las-vegas-city-council",
    confidence: 0.9,
  },
  "north-las-vegas-city-council": {
    jurisdictionId: "north-las-vegas",
    jurisdictionName: "North Las Vegas",
    communityId: "north-las-vegas",
    communityName: "North Las Vegas",
    governingBodyId: "north-las-vegas-city-council",
    confidence: 0.9,
  },
  "sparks-city-council": {
    jurisdictionId: "sparks",
    jurisdictionName: "Sparks",
    communityId: "sparks",
    communityName: "Sparks",
    governingBodyId: "sparks-city-council",
    confidence: 0.9,
  },
  "elko-city-council": {
    jurisdictionId: "elko",
    jurisdictionName: "Elko",
    communityId: "elko",
    communityName: "Elko",
    governingBodyId: "elko-city-council",
    confidence: 0.9,
  },
  "elko-county-commission": {
    jurisdictionId: "elko-county",
    jurisdictionName: "Elko County",
    communityId: "elko-county",
    communityName: "Elko County",
    governingBodyId: "elko-county-commission",
    confidence: 0.9,
  },
};

const carsonOfficials: CarsonOfficialInput[] = [
  {
    name: "Lori Bagwell",
    title: "Mayor",
    wardOrDistrict: "Mayor",
    roleCategory: "governing_body",
    selectionMethod: "elected",
    sourceId: "carson-city-board-of-supervisors",
    sourcePageTitle: "Carson City Board of Supervisors",
    sourceType: "governing_body_page",
    sourceUrl: "https://www.carsoncity.gov/government/board-of-supervisors",
    sourceSnippet: "Lori Bagwell - Mayor",
  },
  {
    name: "Stacey Giomi",
    title: "Supervisor, Ward 1",
    wardOrDistrict: "Ward 1",
    roleCategory: "governing_body",
    selectionMethod: "elected",
    sourceId: "carson-city-board-of-supervisors",
    sourcePageTitle: "Carson City Board of Supervisors",
    sourceType: "governing_body_page",
    sourceUrl: "https://www.carsoncity.gov/government/board-of-supervisors",
    sourceSnippet: "Stacey Giomi - Supervisor, Ward 1",
  },
  {
    name: "Maurice White",
    title: "Supervisor, Ward 2",
    wardOrDistrict: "Ward 2",
    roleCategory: "governing_body",
    selectionMethod: "elected",
    sourceId: "carson-city-board-of-supervisors",
    sourcePageTitle: "Carson City Board of Supervisors",
    sourceType: "governing_body_page",
    sourceUrl: "https://www.carsoncity.gov/government/board-of-supervisors",
    sourceSnippet: "Maurice \"Mo\" White - Supervisor, Ward 2",
    aliases: ['Maurice "Mo" White', "Mo White"],
  },
  {
    name: "Curtis Horton",
    title: "Supervisor, Ward 3",
    wardOrDistrict: "Ward 3",
    roleCategory: "governing_body",
    selectionMethod: "elected",
    sourceId: "carson-city-board-of-supervisors",
    sourcePageTitle: "Carson City Board of Supervisors",
    sourceType: "governing_body_page",
    sourceUrl: "https://www.carsoncity.gov/government/board-of-supervisors",
    sourceSnippet: "Curtis Horton - Supervisor, Ward 3",
  },
  {
    name: "Lisa Schuette",
    title: "Supervisor, Ward 4",
    wardOrDistrict: "Ward 4",
    roleCategory: "governing_body",
    selectionMethod: "elected",
    sourceId: "carson-city-board-of-supervisors",
    sourcePageTitle: "Carson City Board of Supervisors",
    sourceType: "governing_body_page",
    sourceUrl: "https://www.carsoncity.gov/government/board-of-supervisors",
    sourceSnippet: "Lisa Schuette - Supervisor, Ward 4",
  },
  {
    name: "Kimberly Adams",
    title: "Assessor",
    roleCategory: "elected_constitutional_office",
    selectionMethod: "elected",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Kimberly Adams - Assessor",
  },
  {
    name: "Scott Hoen",
    title: "Clerk-Recorder",
    roleCategory: "elected_constitutional_office",
    selectionMethod: "elected",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Scott Hoen - Clerk-Recorder",
  },
  {
    name: "Garrit Pruyt",
    title: "District Attorney",
    roleCategory: "elected_constitutional_office",
    selectionMethod: "elected",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Garrit Pruyt - District Attorney",
  },
  {
    name: "Thomas Armstrong",
    title: "Justice of the Peace, Department I",
    wardOrDistrict: "Department I",
    roleCategory: "judiciary",
    selectionMethod: "elected",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Thomas Armstrong - Justice of the Peace, Department I",
  },
  {
    name: "Melanie Bruketta",
    title: "Justice of the Peace, Department II",
    wardOrDistrict: "Department II",
    roleCategory: "judiciary",
    selectionMethod: "elected",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Melanie Bruketta - Justice of the Peace, Department II",
  },
  {
    name: "Ken Furlong",
    title: "Sheriff",
    roleCategory: "elected_constitutional_office",
    selectionMethod: "elected",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Ken Furlong - Sheriff",
  },
  {
    name: "Andrew Rasor",
    title: "Treasurer",
    roleCategory: "elected_constitutional_office",
    selectionMethod: "elected",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Andrew Rasor - Treasurer",
  },
  {
    name: "Glen Martel",
    title: "City Manager",
    roleCategory: "appointed_executive",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Glen Martel - City Manager",
  },
  {
    name: "Hope Sullivan",
    title: "Community Development Director",
    department: "Community Development",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Hope Sullivan - Community Development Director",
  },
  {
    name: "Sheri Russell-Benabou",
    title: "Chief Financial Officer",
    department: "Finance",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Sheri Russell-Benabou - Chief Financial Officer",
  },
  {
    name: "Kevin Nyberg",
    title: "Acting Fire Chief",
    department: "Fire",
    roleCategory: "department_leadership",
    selectionMethod: "acting",
    currentStatus: "acting",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Kevin Nyberg - Acting Fire Chief",
  },
  {
    name: "Jeanne M. Freeman",
    title: "Health and Human Services Director",
    department: "Health and Human Services",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Jeanne M. Freeman - Health and Human Services Director",
  },
  {
    name: "Jeff Coulam",
    title: "Human Resources Director",
    department: "Human Resources",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Jeff Coulam - Human Resources Director",
  },
  {
    name: "Frank Abella",
    title: "Chief Information Officer",
    department: "Information Technology",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Frank Abella - Chief Information Officer",
  },
  {
    name: "Ali Banister",
    title: "Chief Juvenile Probation Officer",
    department: "Juvenile Probation",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Ali Banister - Chief Juvenile Probation Officer",
  },
  {
    name: "Joy Holt",
    title: "Library Director",
    department: "Library",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Joy Holt - Library Director",
  },
  {
    name: "Jennifer Budge",
    title: "Parks and Recreation Director",
    department: "Parks and Recreation",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Jennifer Budge - Parks and Recreation Director",
  },
  {
    name: "Sandra Doughty",
    title: "Public Guardian",
    department: "Public Guardian",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Sandra Doughty - Public Guardian",
  },
  {
    name: "Darren Schulz",
    title: "Public Works Director",
    department: "Public Works",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Darren Schulz - Public Works Director",
  },
  {
    name: "Courtney Warner",
    title: "Senior Center Director",
    department: "Senior Center",
    roleCategory: "department_leadership",
    selectionMethod: "appointed",
    sourceId: "carson-city-department-directory",
    sourcePageTitle: "Carson City Department Directory",
    sourceType: "department_directory",
    sourceUrl: "https://www.carsoncity.gov/government/department-directory",
    sourceSnippet: "Courtney Warner - Senior Center Director",
  },
];

const additionalReviewedOfficials: ReviewedOfficialInput[] = [
  {
    name: "Hillary Schieve",
    title: "Mayor",
    jurisdictionId: "reno",
    jurisdictionName: "Reno",
    communityId: "reno",
    communityName: "Reno",
    governingBodyId: "reno-city-council",
    bodyName: "Reno City Council",
    wardOrDistrict: "Mayor",
    roleCategory: "elected_executive",
    sourceId: "reno-city-council",
    sourceUrl: "https://www.reno.gov/government/city-council",
    sourceSnippet: "Reno Mayor Hillary Schieve - Mayor",
    aliases: ["Mayor Schieve", "Hillary L. Schieve"],
    confidence: 0.9,
  },
  ...[
    ["Kathleen Taylor", "Ward 1 Councilmember", "Ward 1"],
    ["Naomi Duerr", "Ward 2 Councilmember", "Ward 2"],
    ["Miguel Martinez", "Ward 3 Councilmember", "Ward 3"],
    ["Meghan Ebert", "Ward 4 Councilmember", "Ward 4"],
    ["Devon Reese", "Ward 5 Councilmember", "Ward 5"],
    ["Brandi Anderson", "At-Large Councilmember", "At-Large"],
  ].map(([name, title, district]) => ({
    name,
    title,
    jurisdictionId: "reno",
    jurisdictionName: "Reno",
    communityId: "reno",
    communityName: "Reno",
    governingBodyId: "reno-city-council",
    bodyName: "Reno City Council",
    wardOrDistrict: district,
    sourceId: "reno-city-council",
    sourceUrl: "https://www.reno.gov/government/city-council",
    sourceSnippet: `${name} - ${title}`,
    aliases: [name.split(/\s+/).at(-1) ?? name],
    confidence: 0.88,
  })),
  ...[
    ["Clara Andriola", "District 4, Chair", "District 4"],
    ["Mariluz Garcia", "District 3, Vice Chair", "District 3"],
    ["Alexis Hill", "District 1, Commissioner", "District 1"],
    ["Michael Clark", "District 2, Commissioner", "District 2"],
    ["Jeanne Herman", "District 5, Commissioner", "District 5"],
  ].map(([name, title, district]) => ({
    name,
    title,
    jurisdictionId: "washoe-county",
    jurisdictionName: "Washoe County",
    communityId: "washoe-county",
    communityName: "Washoe County",
    governingBodyId: "washoe-county-commission",
    bodyName: "Washoe County Board of County Commissioners",
    wardOrDistrict: district,
    sourceId: "washoe-county-commission",
    sourceUrl: "https://www.washoecounty.gov/bcc/profile/index.php",
    sourceSnippet: `${name} - ${title}`,
    aliases: [name.split(/\s+/).at(-1) ?? name],
    confidence: 0.92,
  })),
  ...[
    ["Carrie Ann Buck", "Senator, District 5", "Senate District 5"],
    ["Nicole Cannizzaro", "Senator, District 6, Majority Leader", "Senate District 6"],
    ['Michelee "Shelly" Cruz-Crawford', "Senator, District 1", "Senate District 1"],
    ["Skip Daly", "Senator, District 13, Deputy Majority Whip", "Senate District 13"],
    ["Fabian Doñate", "Senator, District 10, Deputy Majority Whip", "Senate District 10"],
    ["Marilyn Dondero Loop", "Senator, District 8, President pro Tempore", "Senate District 8"],
    ["John Ellison", "Senator, District 19", "Senate District 19"],
    ["Edgar Flores", "Senator, District 2", "Senate District 2"],
    ["Ira Hansen", "Senator, District 14", "Senate District 14"],
    ["Lisa Krasner", "Senator, District 16, Minority Whip", "Senate District 16"],
    ["Roberta Lange", "Senator, District 7, Assistant Majority Leader", "Senate District 7"],
    ["Dina Neal", "Senator, District 4", "Senate District 4"],
    ["Rochelle Nguyen", "Senator, District 3", "Senate District 3"],
    ["James Ohrenschall", "Senator, District 21", "Senate District 21"],
    ["Julie Pazina", "Senator, District 12", "Senate District 12"],
    ["Lori Rogich", "Senator, District 11", "Senate District 11"],
    ["Melanie Scheible", "Senator, District 9, Chief Majority Whip", "Senate District 9"],
    ["John Steinbeck", "Senator, District 18", "Senate District 18"],
    ["Jeff Stone", "Senator, District 20, Assistant Minority Leader", "Senate District 20"],
    ["Angela Taylor", "Senator, District 15", "Senate District 15"],
    ["Robin Titus", "Senator, District 17, Minority Leader", "Senate District 17"],
  ].map(([name, title, district]) => ({
    name,
    title,
    jurisdictionId: "nevada-legislature",
    jurisdictionName: "Nevada Legislature",
    communityId: "nevada",
    communityName: "Nevada",
    governingBodyId: "nevada-senate",
    bodyName: "Nevada Senate",
    wardOrDistrict: district,
    sourceId: "nevada-senate-current",
    sourceUrl: "https://www.leg.state.nv.us/Senate/Senators-and-Committees/",
    sourceSnippet: `${name} - ${title}`,
    aliases: [name.split(/\s+/).at(-1)?.replace(/"/g, "") ?? name],
    confidence: 0.9,
  })),
  ...[
    ["Natha C. Anderson", "Assemblymember, District 30, Assistant Majority Whip", "Assembly District 30"],
    ["Shea M. Backus", "Assemblymember, District 37", "Assembly District 37"],
    ["Tracy Brown-May", "Assemblymember, District 42", "Assembly District 42"],
    ["Max E. Carter II", "Assemblymember, District 12", "Assembly District 12"],
    ["Lisa K. Cole", "Assemblymember, District 4", "Assembly District 4"],
    ["Venicia Considine", "Assemblymember, District 18", "Assembly District 18"],
    ["Joe Dalia", "Assemblymember, District 29", "Assembly District 29"],
    ["Rich DeLong", "Assemblymember, District 26", "Assembly District 26"],
    ["Jill Dickman", "Assemblymember, District 31", "Assembly District 31"],
    ["Reuben D'Silva", "Assemblymember, District 28", "Assembly District 28"],
    ["Rebecca Edgeworth", "Assemblymember, District 35", "Assembly District 35"],
    ["Tanya P. Flanagan", "Assemblymember, District 7", "Assembly District 7"],
    ["Danielle Gallant", "Assemblymember, District 23", "Assembly District 23"],
    ["Cecelia González", "Assemblymember, District 16", "Assembly District 16"],
    ["Heather Goulding", "Assemblymember, District 27", "Assembly District 27"],
    ["Bert K. Gurr", "Assemblymember, District 33", "Assembly District 33"],
    ["Gregory T. Hafen II", "Assemblymember, District 36, Minority Floor Leader", "Assembly District 36"],
    ["Alexis M. Hansen", "Assemblymember, District 32", "Assembly District 32"],
    ["Melissa R. Hardy", "Assemblymember, District 22, Assistant Minority Floor Leader South", "Assembly District 22"],
    ["Brian Hibbetts", "Assemblymember, District 13", "Assembly District 13"],
    ["Linda F. Hunt", "Assemblymember, District 17", "Assembly District 17"],
    ["Jovan A. Jackson", "Assemblymember, District 6", "Assembly District 6"],
    ["Sandra Jauregui", "Assemblymember, District 41, Majority Floor Leader", "Assembly District 41"],
    ["Venise Karris", "Assemblymember, District 10", "Assembly District 10"],
    ["Heidi Kasama", "Assemblymember, District 2", "Assembly District 2"],
    ["Gregory S. Koenig", "Assemblymember, District 38, Assistant Minority Floor Leader North", "Assembly District 38"],
    ["Selena La Rue Hatch", "Assemblymember, District 25", "Assembly District 25"],
    ["Elaine H. Marzola", "Assemblymember, District 21, Speaker Pro Tempore", "Assembly District 21"],
    ["Brittney M. Miller", "Assemblymember, District 5", "Assembly District 5"],
    ["Daniele Monroe-Moreno", "Assemblymember, District 1", "Assembly District 1"],
    ["Cinthia Zermeño Moore", "Assemblymember, District 11", "Assembly District 11"],
    ["Erica Mosca", "Assemblymember, District 14, Assistant Majority Floor Leader", "Assembly District 14"],
    ["Hanadi Nadeem", "Assemblymember, District 34", "Assembly District 34"],
    ["Duy Nguyen", "Assemblymember, District 8", "Assembly District 8"],
    ["PK O'Neill", "Assemblymember, District 40", "Assembly District 40"],
    ["David Orentlicher", "Assemblymember, District 20", "Assembly District 20"],
    ["Blayne Osborn", "Assemblymember, District 39", "Assembly District 39"],
    ["Jason Patchett", "Assemblymember, District 19", "Assembly District 19"],
    ["Erica P. Roth", "Assemblymember, District 24", "Assembly District 24"],
    ["Selena Torres-Fossett", "Assemblymember, District 3", "Assembly District 3"],
    ["Howard Watts", "Assemblymember, District 15, Majority Whip", "Assembly District 15"],
    ["Steve Yeager", "Assemblymember, District 9, Speaker", "Assembly District 9"],
  ].map(([name, title, district]) => ({
    name,
    title,
    jurisdictionId: "nevada-legislature",
    jurisdictionName: "Nevada Legislature",
    communityId: "nevada",
    communityName: "Nevada",
    governingBodyId: "nevada-assembly",
    bodyName: "Nevada Assembly",
    wardOrDistrict: district,
    sourceId: "nevada-assembly-current",
    sourceUrl: "https://www.leg.state.nv.us/App/Legislator/A/assembly/current",
    sourceSnippet: `${name} - ${title}`,
    aliases: [name.split(/\s+/).at(-1)?.replace(/"/g, "") ?? name],
    confidence: 0.9,
  })),
  ...[
    ["Byron Brooks", "Regent, District 3, Chair", "Regent District 3"],
    ["Stephanie Goodman", "Regent, District 13, Vice Chair", "Regent District 13"],
    ["Joseph C. Arrascada", "Regent, District 10", "Regent District 10"],
    ["Aaron Bautista", "Regent, District 4", "Regent District 4"],
    ["Patrick J. Boylan", "Regent, District 5", "Regent District 5"],
    ["Susan Brager", "Regent, District 7", "Regent District 7"],
    ["Heather Brown", "Regent, District 6", "Regent District 6"],
    ["Amy J. Carvalho", "Regent, District 12", "Regent District 12"],
    ["Carol Del Carlo", "Regent, District 9", "Regent District 9"],
    ["Jeffrey S. Downs", "Regent, District 11", "Regent District 11"],
    ["Carlos D. Fernandez", "Regent, District 1", "Regent District 1"],
    ["Pete Goicoechea", "Regent, District 8", "Regent District 8"],
    ["Jennifer J. McGrath", "Regent, District 2", "Regent District 2"],
  ].map(([name, title, district]) => ({
    name,
    title,
    jurisdictionId: "nshe",
    jurisdictionName: "Nevada System of Higher Education",
    communityId: "nevada",
    communityName: "Nevada",
    governingBodyId: "nshe-board-of-regents",
    bodyName: "NSHE Board of Regents",
    wardOrDistrict: district,
    roleCategory: "governing_body" as CurrentOfficialRoleCategory,
    sourceId: "nshe-current-regents",
    sourceUrl: "https://nshe.nevada.edu/regents/current-regents/",
    sourceSnippet: `${name} - ${title}`,
    aliases: [name.split(/\s+/).at(-1)?.replace(/"/g, "") ?? name],
    confidence: 0.9,
  })),
];

function readReviewedRosterSeeds() {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "data", "seed", "public-meeting-official-rosters.json"), "utf8")) as ReviewedRosterSeed[];
  } catch {
    return [];
  }
}

function roleCategoryForRosterTitle(title: string): CurrentOfficialRoleCategory {
  if (/\bmayor\b/i.test(title) && !/\bpro\s+tempore\b/i.test(title)) return "elected_executive";
  return "governing_body";
}

function districtFromTitle(title: string) {
  return (
    title.match(/\b(?:district|ward)\s+[A-Z0-9IVX-]+/i)?.[0] ??
    title.match(/\bmayor\b/i)?.[0] ??
    null
  );
}

function reviewedRosterOfficeholders(generatedAt: string): CurrentOfficeholderRecord[] {
  const records: CurrentOfficeholderRecord[] = [];
  for (const seed of readReviewedRosterSeeds()) {
    const jurisdiction = reviewedRosterJurisdictions[seed.providerId];
    if (!jurisdiction) continue;
    for (const member of seed.members ?? []) {
      if ((member.status ?? "CURRENT").toUpperCase() !== "CURRENT") continue;
      const title = member.seatTitle ?? "Member";
      const normalizedName = normalizeOfficialName(member.fullName);
      const stablePersonId = `person-${slugify(normalizedName)}`;
      const stableOfficeId = `office-${jurisdiction.jurisdictionId}-${slugify(title)}`;
      const key = `${stablePersonId}:${stableOfficeId}`;
      const sourceUrl = member.sourceUrl ?? seed.sourceUrl ?? "";
      const sourceSnippet = `${member.fullName} - ${title}`;
      records.push({
        id: `current-official-${idHash(key)}`,
        stablePersonId,
        stableOfficeId,
        jurisdictionId: jurisdiction.jurisdictionId,
        jurisdictionName: jurisdiction.jurisdictionName,
        communityId: jurisdiction.communityId,
        communityName: jurisdiction.communityName,
        governingBodyId: jurisdiction.governingBodyId,
        departmentId: null,
        publicDisplayName: member.fullName,
        normalizedName,
        aliases: [...new Set((member.aliases ?? []).map(normalizeWhitespace).filter(Boolean))],
        sourceTitle: title,
        normalizedTitle: normalizeWhitespace(title.toLowerCase()),
        wardOrDistrict: districtFromTitle(title),
        department: null,
        roleCategory: roleCategoryForRosterTitle(title),
        selectionMethod: "elected",
        currentStatus: "active",
        actingOrInterim: false,
        termStart: member.termStart ?? null,
        termEnd: null,
        firstSeenAt: generatedAt,
        lastSeenAt: generatedAt,
        lastVerifiedAt: generatedAt,
        sourceUrl,
        sourcePageTitle: seed.bodyName,
        sourceType: "reviewed_manual_source",
        sourceId: seed.providerId,
        sourceHash: sourceUrl ? sourceHash(sourceUrl, sourceSnippet) : null,
        sourceSnippet,
        confidence: jurisdiction.confidence,
        reviewStatus: "source_backed",
        relatedActionCount: 0,
      });
    }
  }
  return records;
}

function reviewedManualOfficeholders(generatedAt: string): CurrentOfficeholderRecord[] {
  return additionalReviewedOfficials.map((item) => {
    const normalizedName = normalizeOfficialName(item.name);
    const stablePersonId = `person-${slugify(normalizedName)}`;
    const stableOfficeId = `office-${item.jurisdictionId}-${slugify(item.title)}`;
    const key = `${stablePersonId}:${stableOfficeId}`;
    const actingOrInterim = item.selectionMethod === "acting" || item.selectionMethod === "interim" || /\b(acting|interim)\b/i.test(item.title);

    return {
      id: `current-official-${idHash(key)}`,
      stablePersonId,
      stableOfficeId,
      jurisdictionId: item.jurisdictionId,
      jurisdictionName: item.jurisdictionName,
      communityId: item.communityId,
      communityName: item.communityName,
      governingBodyId: item.governingBodyId,
      departmentId: null,
      publicDisplayName: item.name,
      normalizedName,
      aliases: [...new Set((item.aliases ?? []).map(normalizeWhitespace).filter(Boolean))],
      sourceTitle: item.title,
      normalizedTitle: normalizeWhitespace(item.title.toLowerCase()),
      wardOrDistrict: item.wardOrDistrict ?? null,
      department: null,
      roleCategory: item.roleCategory ?? "governing_body",
      selectionMethod: item.selectionMethod ?? "elected",
      currentStatus: actingOrInterim ? "acting" : "active",
      actingOrInterim,
      termStart: null,
      termEnd: null,
      firstSeenAt: generatedAt,
      lastSeenAt: generatedAt,
      lastVerifiedAt: generatedAt,
      sourceUrl: item.sourceUrl,
      sourcePageTitle: item.bodyName,
      sourceType: "reviewed_manual_source",
      sourceId: item.sourceId,
      sourceHash: sourceHash(item.sourceUrl, item.sourceSnippet),
      sourceSnippet: item.sourceSnippet,
      confidence: item.confidence ?? 0.88,
      reviewStatus: "source_backed",
      relatedActionCount: 0,
    };
  });
}

export function getSeededCurrentOfficeholders(generatedAt = new Date().toISOString()): CurrentOfficeholderRecord[] {
  const seen = new Map<string, CurrentOfficeholderRecord>();

  for (const item of carsonOfficials) {
    const normalizedName = normalizeOfficialName(item.name);
    const stablePersonId = `person-${slugify(normalizedName)}`;
    const stableOfficeId = `office-carson-city-${slugify(item.title)}`;
    const key = `${stablePersonId}:${stableOfficeId}`;
    const sourceHashValue = sourceHash(item.sourceUrl, item.sourceSnippet);
    const actingOrInterim = item.selectionMethod === "acting" || item.selectionMethod === "interim" || /\b(acting|interim)\b/i.test(item.title);

    if (seen.has(key)) {
      const existing = seen.get(key)!;
      seen.set(key, {
        ...existing,
        aliases: [...new Set([...existing.aliases, ...(item.aliases ?? []).map(normalizeWhitespace)])],
        confidence: Math.max(existing.confidence, item.confidence ?? 0.9),
      });
      continue;
    }

    seen.set(key, {
      id: `current-official-${idHash(key)}`,
      stablePersonId,
      stableOfficeId,
      jurisdictionId: "carson-city",
      jurisdictionName: "Carson City",
      communityId: "carson-city",
      communityName: "Carson City",
      governingBodyId: item.roleCategory === "governing_body" ? "carson-city-board-of-supervisors" : null,
      departmentId: item.department ? `carson-city-${slugify(item.department)}` : null,
      publicDisplayName: item.name,
      normalizedName,
      aliases: [...new Set((item.aliases ?? []).map(normalizeWhitespace).filter(Boolean))],
      sourceTitle: item.title,
      normalizedTitle: normalizeWhitespace(item.title.toLowerCase()),
      wardOrDistrict: item.wardOrDistrict ?? null,
      department: item.department ?? null,
      roleCategory: item.roleCategory,
      selectionMethod: item.selectionMethod,
      currentStatus: item.currentStatus ?? (actingOrInterim ? "acting" : "active"),
      actingOrInterim,
      termStart: null,
      termEnd: null,
      firstSeenAt: generatedAt,
      lastSeenAt: generatedAt,
      lastVerifiedAt: generatedAt,
      sourceUrl: item.sourceUrl,
      sourcePageTitle: item.sourcePageTitle,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      sourceHash: sourceHashValue,
      sourceSnippet: item.sourceSnippet,
      confidence: item.confidence ?? 0.9,
      reviewStatus: "source_backed",
      relatedActionCount: 0,
    });
  }

  for (const record of reviewedRosterOfficeholders(generatedAt)) {
    const key = `${record.stablePersonId}:${record.stableOfficeId}`;
    if (seen.has(key)) continue;
    seen.set(key, record);
  }

  for (const record of reviewedManualOfficeholders(generatedAt)) {
    const key = `${record.stablePersonId}:${record.stableOfficeId}`;
    if (seen.has(key)) continue;
    seen.set(key, record);
  }

  return [...seen.values()].sort((left, right) => {
    const roleOrder = [
      "governing_body",
      "elected_executive",
      "elected_constitutional_office",
      "judiciary",
      "appointed_executive",
      "department_leadership",
      "board_or_commission",
      "staff",
      "unknown",
    ];
    const roleDiff = roleOrder.indexOf(left.roleCategory) - roleOrder.indexOf(right.roleCategory);
    if (roleDiff !== 0) return roleDiff;
    return left.sourceTitle.localeCompare(right.sourceTitle);
  });
}

export function toCurrentOfficialRuntime(records: CurrentOfficeholderRecord[]): CurrentOfficialRuntimeRecord[] {
  return records.map((record) => ({
    id: record.id,
    name: record.publicDisplayName,
    title: record.sourceTitle,
    office: record.sourceTitle,
    jurisdiction: `${record.jurisdictionName}, Nevada`,
    communityName: record.communityName,
    level: record.jurisdictionId.includes("county")
      ? "county"
      : record.jurisdictionId.includes("school-district")
        ? "district"
        : record.jurisdictionId.includes("nevada")
          ? "state"
          : "city",
    body_name: record.governingBodyId ? record.sourcePageTitle : null,
    district: record.wardOrDistrict,
    department: record.department,
    role_category: record.roleCategory,
    selection_method: record.selectionMethod,
    current_status: record.currentStatus,
    acting_or_interim: record.actingOrInterim,
    source_url: record.sourceUrl,
    source_type: record.sourceType,
    source_label: record.sourcePageTitle,
    confidence: record.confidence,
    review_status: record.reviewStatus,
    needsReview: record.reviewStatus !== "source_backed",
    last_verified_at: record.lastVerifiedAt,
    profile_url: record.sourceUrl,
    aliases: record.aliases,
    related_action_count: record.relatedActionCount,
  }));
}
