import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { NEVADA_BETA_SOURCE_DEFINITIONS } from "@/lib/civic-data/source-definitions";
import { getGeographicCommunities, getNevadaCommunityKind } from "@/lib/community/communities";
import { getOfficialDirectorySources } from "@/lib/officials/current-officeholders";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-source-pack-audit.json");

type MeetingSeed = {
  id: string;
  jurisdiction: string;
  active: boolean;
  meetingIndexUrl: string | null;
  agendaArchiveUrl?: string | null;
  minutesArchiveUrl?: string | null;
  packetArchiveUrl?: string | null;
  videoArchiveUrl?: string | null;
};

type RosterSeed = {
  providerId: string;
  jurisdictionName: string;
  members?: Array<{ fullName: string; status?: string | null }>;
};

type PriorityJurisdiction = {
  id: string;
  name: string;
  aliases: string[];
  expectedGoverningMembers?: number;
};

function readJson<T>(relativePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matches(value: string, jurisdiction: PriorityJurisdiction) {
  const normalized = normalize(value);
  return [jurisdiction.id, jurisdiction.name, ...jurisdiction.aliases].some((candidate) => normalized.includes(normalize(candidate)));
}

const priorityJurisdictions: PriorityJurisdiction[] = [
  { id: "carson-city", name: "Carson City", aliases: ["Carson City, NV"], expectedGoverningMembers: 5 },
  { id: "reno", name: "Reno", aliases: ["Reno, NV"], expectedGoverningMembers: 7 },
  { id: "sparks", name: "Sparks", aliases: ["Sparks, NV"], expectedGoverningMembers: 6 },
  { id: "washoe-county", name: "Washoe County", aliases: ["Washoe County, NV"], expectedGoverningMembers: 5 },
  { id: "elko", name: "Elko", aliases: ["Elko, NV"], expectedGoverningMembers: 5 },
  { id: "elko-county", name: "Elko County", aliases: ["Elko County, NV"], expectedGoverningMembers: 5 },
  { id: "clark-county", name: "Clark County", aliases: ["Clark County, NV"], expectedGoverningMembers: 7 },
  { id: "las-vegas", name: "Las Vegas", aliases: ["Las Vegas, NV"], expectedGoverningMembers: 7 },
  { id: "henderson", name: "Henderson", aliases: ["Henderson, NV"], expectedGoverningMembers: 5 },
  { id: "north-las-vegas", name: "North Las Vegas", aliases: ["North Las Vegas, NV"], expectedGoverningMembers: 5 },
  { id: "clark-county-school-district", name: "Clark County School District", aliases: ["CCSD"], expectedGoverningMembers: 11 },
  { id: "nevada-legislature", name: "Nevada Legislature", aliases: ["nv-legislature", "Nevada Senate", "Nevada Assembly"] },
];

const generatedAt = new Date().toISOString();
const meetingSeeds = readJson<MeetingSeed[]>("data/seed/public-meeting-sources.json", []);
const officialSources = getOfficialDirectorySources(generatedAt);
const rosterSeeds = readJson<RosterSeed[]>("data/seed/public-meeting-official-rosters.json", []);
const fallbackSources = NEVADA_BETA_SOURCE_DEFINITIONS.map((source) => ({
  jurisdictionId: source.jurisdictionSlug,
  sourceName: source.name,
  url: source.url,
  dataCategory: source.dataCategory,
}));

const records = priorityJurisdictions.map((jurisdiction) => {
  const meetings = meetingSeeds.filter((seed) => matches(`${seed.id} ${seed.jurisdiction}`, jurisdiction));
  const officials = officialSources.filter((source) => source.jurisdictionId === jurisdiction.id || matches(source.jurisdictionName, jurisdiction));
  const rosters = rosterSeeds.filter((seed) => seed.providerId === jurisdiction.id || matches(`${seed.providerId} ${seed.jurisdictionName}`, jurisdiction));
  const currentRosterMembers = rosters.flatMap((seed) => seed.members ?? []).filter((member) => (member.status ?? "CURRENT").toUpperCase() === "CURRENT");
  const missing: string[] = [];

  if (!meetings.some((seed) => seed.active && seed.meetingIndexUrl)) missing.push("meeting_source");
  if (!officials.length && !rosters.length) missing.push("official_source");
  if (jurisdiction.expectedGoverningMembers && currentRosterMembers.length < jurisdiction.expectedGoverningMembers) {
    missing.push("complete_governing_roster");
  }

  return {
    jurisdictionId: jurisdiction.id,
    jurisdictionName: jurisdiction.name,
    meetingSources: meetings.length,
    activeMeetingSources: meetings.filter((seed) => seed.active).length,
    officialDirectorySources: officials.length,
    officialRosterSources: rosters.length,
    rosterSeeds: rosters.length,
    currentRosterMembers: currentRosterMembers.length,
    expectedGoverningMembers: jurisdiction.expectedGoverningMembers ?? null,
    hasAgendaSource: meetings.some((seed) => Boolean(seed.agendaArchiveUrl ?? seed.meetingIndexUrl)),
    hasMinutesSource: meetings.some((seed) => Boolean(seed.minutesArchiveUrl)),
    hasPacketSource: meetings.some((seed) => Boolean(seed.packetArchiveUrl)),
    hasVideoSource: meetings.some((seed) => Boolean(seed.videoArchiveUrl)),
    manualBootstrapCommand: `npm run meetings:bootstrap:nevada-sources -- --provider=${jurisdiction.id}`,
    sourcePackStatus: missing.length ? "incomplete" : "ready_for_acquisition",
    missing,
  };
});

const communities = getGeographicCommunities().filter((community) => {
  const kind = getNevadaCommunityKind(community.id);
  return kind !== "state" && kind !== "federal";
});

const communityRecords = communities.map((community) => {
  const kind = getNevadaCommunityKind(community.id);
  const countyId = kind === "community" ? community.locationLabel : null;
  const meetingMatches = meetingSeeds.filter((seed) => community.jurisdictionMatches.some((match) => matches(seed.jurisdiction, { id: community.id, name: match, aliases: [] })));
  const officialMatches = officialSources.filter((source) => source.jurisdictionId === community.id || community.jurisdictionMatches.some((match) => matches(source.jurisdictionName, { id: community.id, name: match, aliases: [] })));
  const rosterMatches = rosterSeeds.filter((seed) => seed.providerId === community.id || community.jurisdictionMatches.some((match) => matches(`${seed.providerId} ${seed.jurisdictionName}`, { id: community.id, name: match, aliases: [] })));
  const fallbackMatches = fallbackSources.filter((source) => source.jurisdictionId === community.id);
  const hasMeetingSource = meetingMatches.some((seed) => seed.active && seed.meetingIndexUrl);
  const hasOfficialSource = officialMatches.length > 0 || rosterMatches.length > 0;
  const acquisitionPath = hasMeetingSource
    ? "configured_meeting_source"
    : fallbackMatches.length
      ? "fallback_portal_known_needs_meeting_page"
      : kind === "community"
        ? "covered_through_county_until_local_source_exists"
        : "source_research_needed";
  return {
    communityId: community.id,
    communityName: community.name,
    kind,
    countyContext: countyId,
    meetingSources: meetingMatches.length,
    officialSources: officialMatches.length + rosterMatches.length,
    fallbackPortalSources: fallbackMatches.length,
    acquisitionPath,
    missing: [
      !hasMeetingSource ? "meeting_source" : null,
      !hasOfficialSource && kind !== "community" ? "official_source" : null,
    ].filter(Boolean),
  };
});

const artifact = {
  generatedAt,
  records,
  totals: {
    priorityJurisdictions: records.length,
    readyForAcquisition: records.filter((record) => record.sourcePackStatus === "ready_for_acquisition").length,
    incomplete: records.filter((record) => record.sourcePackStatus === "incomplete").length,
    withMeetingSources: records.filter((record) => record.meetingSources > 0).length,
    withOfficialSources: records.filter((record) => record.officialDirectorySources > 0 || record.officialRosterSources > 0).length,
    withOfficialDirectorySources: records.filter((record) => record.officialDirectorySources > 0).length,
    withCompleteGoverningRoster: records.filter(
      (record) => record.expectedGoverningMembers === null || record.currentRosterMembers >= record.expectedGoverningMembers,
    ).length,
    statewideCommunities: communityRecords.length,
    statewideCommunitiesWithMeetingSources: communityRecords.filter((record) => record.meetingSources > 0).length,
    statewideCommunitiesWithOfficialSources: communityRecords.filter((record) => record.officialSources > 0).length,
    statewideCommunitiesWithFallbackPortalKnown: communityRecords.filter((record) => record.fallbackPortalSources > 0).length,
    statewideCommunitiesCoveredThroughCounty: communityRecords.filter((record) => record.acquisitionPath === "covered_through_county_until_local_source_exists").length,
    statewideCommunitiesNeedingSourceResearch: communityRecords.filter((record) => record.acquisitionPath === "source_research_needed").length,
  },
  statewideCommunityRecords: communityRecords,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(`Generated Nevada source pack audit at ${path.relative(process.cwd(), OUTPUT_PATH)}`);
console.log(JSON.stringify(artifact.totals, null, 2));
