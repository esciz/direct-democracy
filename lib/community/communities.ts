import type { AuthUser, CommunitySummary } from "@/types/domain";

export type NevadaCommunityKind = "state" | "county" | "city" | "community" | "federal";

type NevadaCommunitySeed = {
  id: string;
  name: string;
  shortName?: string;
  kind: NevadaCommunityKind;
  countyId?: string;
  descriptor: string;
  aliases?: string[];
  imagePath?: string;
};

const NEVADA_IMAGE_PATH = "/community/nevada.svg";
const CARSON_CITY_IMAGE_PATH = "/community/cc.webp";

const nevadaCommunitySeeds: NevadaCommunitySeed[] = [
  {
    id: "carson-city-county",
    name: "Carson City County",
    kind: "county",
    descriptor: "A county-equivalent view for Carson City public services, schools, elections, spending, and civic institutions.",
    aliases: ["Carson City, Nevada"],
    imagePath: CARSON_CITY_IMAGE_PATH,
  },
  {
    id: "clark-county",
    name: "Clark County",
    kind: "county",
    descriptor: "A county-level view connecting Las Vegas, regional growth, schools, courts, public services, and civic institutions.",
    aliases: ["Clark County, NV"],
  },
  {
    id: "washoe-county",
    name: "Washoe County",
    kind: "county",
    descriptor: "A county-level view connecting Reno, Sparks, surrounding communities, schools, courts, and local public services.",
    aliases: ["Washoe County, NV"],
  },
  {
    id: "douglas-county",
    name: "Douglas County",
    kind: "county",
    descriptor: "A county community page for Carson Valley, Tahoe-adjacent growth, public lands, schools, meetings, and local budgets.",
  },
  {
    id: "lyon-county",
    name: "Lyon County",
    kind: "county",
    descriptor: "A county community page for Fernley, Yerington, Silver Springs, rural services, growth, elections, and public spending.",
  },
  {
    id: "nye-county",
    name: "Nye County",
    kind: "county",
    descriptor: "A county community page for Pahrump, Tonopah, public lands, courts, county services, elections, and spending.",
  },
  {
    id: "elko-county",
    name: "Elko County",
    kind: "county",
    descriptor: "A county community page for northeastern Nevada, Elko, West Wendover, rural services, natural resources, and public meetings.",
  },
  {
    id: "churchill-county",
    name: "Churchill County",
    kind: "county",
    descriptor: "A county community page for Fallon, agriculture, water, schools, county meetings, elections, and public spending.",
  },
  {
    id: "humboldt-county",
    name: "Humboldt County",
    kind: "county",
    descriptor: "A county community page for Winnemucca, rural services, public lands, elections, meetings, and county budgets.",
  },
  {
    id: "white-pine-county",
    name: "White Pine County",
    kind: "county",
    descriptor: "A county community page for Ely, eastern Nevada services, public lands, courts, elections, and local spending.",
  },
  {
    id: "lander-county",
    name: "Lander County",
    kind: "county",
    descriptor: "A county community page for Battle Mountain, rural government, public lands, elections, meetings, and spending.",
  },
  {
    id: "lincoln-county",
    name: "Lincoln County",
    kind: "county",
    descriptor: "A county community page for rural southeastern Nevada, public lands, county services, elections, and meetings.",
  },
  {
    id: "eureka-county",
    name: "Eureka County",
    kind: "county",
    descriptor: "A county community page for local government, public lands, mining impacts, elections, meetings, and public spending.",
  },
  {
    id: "esmeralda-county",
    name: "Esmeralda County",
    kind: "county",
    descriptor: "A county community page for Nevada's smallest county, rural services, public lands, elections, meetings, and budgets.",
  },
  {
    id: "pershing-county",
    name: "Pershing County",
    kind: "county",
    descriptor: "A county community page for Lovelock, public lands, local services, elections, courts, meetings, and spending.",
  },
  {
    id: "storey-county",
    name: "Storey County",
    kind: "county",
    descriptor: "A county community page for Virginia City, industrial growth, tourism, county services, meetings, and public spending.",
  },
  {
    id: "mineral-county",
    name: "Mineral County",
    kind: "county",
    descriptor: "A county community page for Hawthorne, rural public services, elections, courts, meetings, and local budgets.",
  },
  {
    id: "carson-city",
    name: "Carson City",
    kind: "city",
    countyId: "carson-city-county",
    descriptor: "Nevada's capital city with a close-up view of schools, downtown growth, elections, public meetings, and budgets.",
    imagePath: CARSON_CITY_IMAGE_PATH,
  },
  {
    id: "las-vegas",
    name: "Las Vegas",
    kind: "city",
    countyId: "clark-county",
    descriptor: "A city community page for tourism, housing, public safety, infrastructure, city meetings, elections, and spending.",
  },
  {
    id: "henderson",
    name: "Henderson",
    kind: "city",
    countyId: "clark-county",
    descriptor: "A city community page for growth, schools, public safety, planning, city meetings, elections, and local budgets.",
  },
  {
    id: "north-las-vegas",
    name: "North Las Vegas",
    kind: "city",
    countyId: "clark-county",
    descriptor: "A city community page for housing, jobs, public safety, planning, city council actions, elections, and spending.",
  },
  {
    id: "reno",
    name: "Reno",
    kind: "city",
    countyId: "washoe-county",
    descriptor: "A fast-growing Northern Nevada city where housing, roads, downtown growth, and public meetings are constant topics.",
  },
  {
    id: "sparks",
    name: "Sparks",
    kind: "city",
    countyId: "washoe-county",
    descriptor: "A city community page for Truckee Meadows growth, redevelopment, public safety, city meetings, elections, and spending.",
  },
  {
    id: "elko",
    name: "Elko",
    kind: "city",
    countyId: "elko-county",
    descriptor: "A city community page for northeastern Nevada services, growth, public safety, elections, meetings, and budgets.",
  },
  {
    id: "mesquite",
    name: "Mesquite",
    kind: "city",
    countyId: "clark-county",
    descriptor: "A city community page for northeast Clark County growth, public services, city meetings, elections, and spending.",
  },
  {
    id: "boulder-city",
    name: "Boulder City",
    kind: "city",
    countyId: "clark-county",
    descriptor: "A city community page for controlled growth, tourism, utilities, city meetings, elections, and public spending.",
  },
  {
    id: "fallon",
    name: "Fallon",
    kind: "city",
    countyId: "churchill-county",
    descriptor: "A city community page for agriculture, water, schools, city meetings, elections, and local public spending.",
  },
  {
    id: "fernley",
    name: "Fernley",
    kind: "city",
    countyId: "lyon-county",
    descriptor: "A city community page for growth, transportation, housing, schools, city meetings, elections, and spending.",
  },
  {
    id: "winnemucca",
    name: "Winnemucca",
    kind: "city",
    countyId: "humboldt-county",
    descriptor: "A city community page for Humboldt County services, transportation, public safety, meetings, elections, and budgets.",
  },
  {
    id: "west-wendover",
    name: "West Wendover",
    kind: "city",
    countyId: "elko-county",
    descriptor: "A city community page for border-region services, tourism, public safety, elections, meetings, and spending.",
  },
  {
    id: "yerington",
    name: "Yerington",
    kind: "city",
    countyId: "lyon-county",
    descriptor: "A city community page for county-seat services, agriculture, schools, meetings, elections, and local spending.",
  },
  {
    id: "tonopah",
    name: "Tonopah",
    kind: "community",
    countyId: "nye-county",
    descriptor: "A major unincorporated community page for central Nevada services, public lands, county meetings, courts, and spending.",
  },
  {
    id: "pahrump",
    name: "Pahrump",
    kind: "community",
    countyId: "nye-county",
    descriptor: "A major unincorporated community page for growth, water, public safety, county services, elections, and spending.",
  },
  {
    id: "ely",
    name: "Ely",
    kind: "community",
    countyId: "white-pine-county",
    descriptor: "A major community page for eastern Nevada services, public lands, courts, meetings, elections, and local spending.",
  },
  {
    id: "incline-village",
    name: "Incline Village",
    kind: "community",
    countyId: "washoe-county",
    descriptor: "A major unincorporated Tahoe community page for water, wildfire, schools, county services, meetings, and spending.",
  },
  {
    id: "gardnerville",
    name: "Gardnerville",
    kind: "community",
    countyId: "douglas-county",
    descriptor: "A major Carson Valley community page for county services, growth, schools, meetings, elections, and spending.",
  },
  {
    id: "minden",
    name: "Minden",
    kind: "community",
    countyId: "douglas-county",
    descriptor: "A major Carson Valley community page for county-seat services, planning, schools, meetings, elections, and spending.",
  },
  {
    id: "laughlin",
    name: "Laughlin",
    kind: "community",
    countyId: "clark-county",
    descriptor: "A major unincorporated community page for Colorado River tourism, county services, public safety, meetings, and spending.",
  },
  {
    id: "battle-mountain",
    name: "Battle Mountain",
    kind: "community",
    countyId: "lander-county",
    descriptor: "A major community page for Lander County services, transportation, public lands, meetings, elections, and spending.",
  },
];

function jurisdictionNameForSeed(seed: NevadaCommunitySeed) {
  if (seed.kind === "state") return "Nevada";
  return `${seed.name}, Nevada`;
}

function buildJurisdictionMatches(seed: NevadaCommunitySeed) {
  const matches = new Set<string>([jurisdictionNameForSeed(seed), seed.name, ...(seed.aliases ?? [])]);

  if (seed.countyId) {
    const county = nevadaCommunitySeeds.find((entry) => entry.id === seed.countyId);
    if (county) {
      matches.add(county.name);
      matches.add(`${county.name}, Nevada`);
    }
  }

  return [...matches];
}

function communityFromSeed(seed: NevadaCommunitySeed): CommunitySummary {
  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName ?? seed.name,
    descriptor: seed.descriptor,
    communityType: "geographic",
    scope: seed.kind === "state" ? "state" : "local",
    primaryJurisdictionName: jurisdictionNameForSeed(seed),
    jurisdictionMatches: buildJurisdictionMatches(seed),
    imagePath: seed.imagePath ?? NEVADA_IMAGE_PATH,
    locationLabel: seed.countyId ? getCommunitySeedById(seed.countyId)?.name ?? null : null,
  };
}

function getCommunitySeedById(communityId: string | undefined) {
  return nevadaCommunitySeeds.find((community) => community.id === communityId);
}

export const nevadaCountyCommunityIds = nevadaCommunitySeeds.filter((community) => community.kind === "county").map((community) => community.id);
export const nevadaCityCommunityIds = nevadaCommunitySeeds.filter((community) => community.kind === "city").map((community) => community.id);
export const nevadaMajorCommunityIds = nevadaCommunitySeeds.filter((community) => community.kind === "community").map((community) => community.id);
export const nevadaLocalCommunityIds = [...nevadaCountyCommunityIds, ...nevadaCityCommunityIds, ...nevadaMajorCommunityIds];

const nevadaStateCommunity: CommunitySummary = {
  id: "nevada",
  name: "Nevada",
  shortName: "Nevada",
  descriptor: "Statewide issues shaped by growth, water, schools, courts, elections, public spending, and public trust.",
  communityType: "geographic",
  scope: "state",
  primaryJurisdictionName: "Nevada",
  jurisdictionMatches: ["Nevada", ...nevadaCommunitySeeds.flatMap((community) => [community.name, jurisdictionNameForSeed(community)])],
  imagePath: NEVADA_IMAGE_PATH,
};

const federalOverlayCommunity: CommunitySummary = {
  id: "united-states",
  name: "United States",
  shortName: "United States",
  descriptor: "The federal overlay for national actions that affect Nevada, including executive actions, Congress, and federal courts.",
  communityType: "geographic",
  scope: "national",
  primaryJurisdictionName: "United States",
  jurisdictionMatches: ["United States", "Federal", "Nevada", ...nevadaStateCommunity.jurisdictionMatches],
  imagePath: "/community/united-states.svg",
};

export const seededCommunities: CommunitySummary[] = [
  ...nevadaCommunitySeeds.map(communityFromSeed),
  nevadaStateCommunity,
  federalOverlayCommunity,
];

export function getNevadaCommunityKind(communityId: string | undefined): NevadaCommunityKind | null {
  if (communityId === "nevada") return "state";
  if (communityId === "united-states") return "federal";
  return getCommunitySeedById(communityId)?.kind ?? null;
}

export function getCommunityById(communityId: string | undefined) {
  return seededCommunities.find((community) => community.id === communityId);
}

export function getGeographicCommunities() {
  return seededCommunities;
}

export function getCommunityByJurisdictionName(jurisdictionName: string) {
  return (
    seededCommunities.find((community) => community.primaryJurisdictionName === jurisdictionName) ??
    seededCommunities.find((community) => community.jurisdictionMatches.includes(jurisdictionName))
  );
}

export function getCommunityContextLabel(jurisdictionName: string) {
  const community = getCommunityByJurisdictionName(jurisdictionName);

  if (!community) {
    return jurisdictionName;
  }

  return community.name;
}

export function getCommunityPageHref(communityId: string) {
  const community = getCommunityById(communityId);

  if (!community) {
    return "/my-community";
  }

  return `/community/${community.id}`;
}

export function getCountiesForState(stateCommunityId: string) {
  if (stateCommunityId !== "nevada") {
    return [];
  }

  return nevadaCountyCommunityIds
    .map((communityId) => getCommunityById(communityId))
    .filter((community): community is CommunitySummary => Boolean(community));
}

export function getCitiesForState(stateCommunityId: string) {
  if (stateCommunityId !== "nevada") {
    return [];
  }

  return nevadaCityCommunityIds
    .map((communityId) => getCommunityById(communityId))
    .filter((community): community is CommunitySummary => Boolean(community));
}

export function getMajorCommunitiesForState(stateCommunityId: string) {
  if (stateCommunityId !== "nevada") {
    return [];
  }

  return nevadaMajorCommunityIds
    .map((communityId) => getCommunityById(communityId))
    .filter((community): community is CommunitySummary => Boolean(community));
}

export function getCitiesForCounty(countyCommunityId: string) {
  return nevadaCommunitySeeds
    .filter((community) => community.kind === "city" && community.countyId === countyCommunityId)
    .map((community) => getCommunityById(community.id))
    .filter((community): community is CommunitySummary => Boolean(community));
}

export function getMajorCommunitiesForCounty(countyCommunityId: string) {
  return nevadaCommunitySeeds
    .filter((community) => community.kind === "community" && community.countyId === countyCommunityId)
    .map((community) => getCommunityById(community.id))
    .filter((community): community is CommunitySummary => Boolean(community));
}

function getCountyForCommunity(communityId: string) {
  const seed = getCommunitySeedById(communityId);
  const countyId = seed?.kind === "county" ? seed.id : seed?.countyId;
  return countyId ? getCommunityById(countyId) : null;
}

export function getCommunityHierarchy(communityId: string) {
  const current = getCommunityById(communityId);

  if (!current) {
    return [];
  }

  const stateCommunity = getCommunityById("nevada");
  const nationalCommunity = getCommunityById("united-states");
  const currentKind = getNevadaCommunityKind(current.id);
  const countyCommunity = getCountyForCommunity(current.id);
  const localCommunity = current.scope === "local" && currentKind !== "county" ? current : null;
  const entries = [];

  if (nationalCommunity) {
    entries.push({
      id: nationalCommunity.id,
      label: "USA",
      level: "USA",
      href: getCommunityPageHref(nationalCommunity.id),
      active: current.id === nationalCommunity.id,
    });
  }

  if (stateCommunity) {
    entries.push({
      id: stateCommunity.id,
      label: stateCommunity.name,
      level: "State",
      href: getCommunityPageHref(stateCommunity.id),
      active: current.id === stateCommunity.id,
    });
  }

  if (countyCommunity) {
    entries.push({
      id: countyCommunity.id,
      label: countyCommunity.name,
      level: "County",
      href: getCommunityPageHref(countyCommunity.id),
      active: current.id === countyCommunity.id,
    });
  }

  if (localCommunity) {
    entries.push({
      id: localCommunity.id,
      label: localCommunity.name,
      level: currentKind === "community" ? "Community" : "City",
      href: getCommunityPageHref(localCommunity.id),
      active: current.id === localCommunity.id,
    });
  }

  return entries;
}

export function getDefaultCommunityForJurisdiction(jurisdictionName: string) {
  const directMatch = getCommunityByJurisdictionName(jurisdictionName);

  if (directMatch) {
    return directMatch;
  }

  if (jurisdictionName === "Washoe County, Nevada") {
    return getCommunityById("reno") ?? seededCommunities[0];
  }

  if (jurisdictionName === "Nevada") {
    return getCommunityById("nevada") ?? seededCommunities[0];
  }

  return getCommunityById("carson-city") ?? seededCommunities[0];
}

export function getDefaultCommunityForUser(user: Pick<AuthUser, "jurisdictionName" | "primaryCommunityId">) {
  if (user.primaryCommunityId) {
    const selected = getCommunityById(user.primaryCommunityId);

    if (selected) {
      return selected;
    }
  }

  return getDefaultCommunityForJurisdiction(user.jurisdictionName);
}
