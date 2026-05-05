import type { AuthUser, CommunitySummary } from "@/types/domain";

export const seededCommunities: CommunitySummary[] = [
  {
    id: "carson-city",
    name: "Carson City",
    shortName: "Carson City",
    descriptor: "Nevada's capital city with a close-up view of schools, downtown growth, and public budgets.",
    communityType: "geographic",
    scope: "local",
    primaryJurisdictionName: "Carson City, Nevada",
    jurisdictionMatches: ["Carson City, Nevada"],
    imagePath: "/community/cc.webp",
  },
  {
    id: "reno",
    name: "Reno",
    shortName: "Reno",
    descriptor: "A fast-growing Northern Nevada city where housing, roads, and growth pressure are constant topics.",
    communityType: "geographic",
    scope: "local",
    primaryJurisdictionName: "Reno, Nevada",
    jurisdictionMatches: ["Reno, Nevada"],
    imagePath: "/community/nevada.svg",
  },
  {
    id: "las-vegas",
    name: "Las Vegas",
    shortName: "Las Vegas",
    descriptor: "A larger Nevada metro view with statewide overlap for housing, tourism, and infrastructure issues.",
    communityType: "geographic",
    scope: "local",
    primaryJurisdictionName: "Las Vegas, Nevada",
    jurisdictionMatches: ["Las Vegas, Nevada"],
    imagePath: "/community/nevada.svg",
  },
  {
    id: "carson-city-county",
    name: "Carson City County",
    shortName: "Carson City County",
    descriptor: "A county-equivalent view for Carson City public services, schools, and civic institutions.",
    communityType: "geographic",
    scope: "local",
    primaryJurisdictionName: "Carson City County, Nevada",
    jurisdictionMatches: ["Carson City County, Nevada", "Carson City, Nevada"],
    imagePath: "/community/cc.webp",
  },
  {
    id: "washoe-county",
    name: "Washoe County",
    shortName: "Washoe County",
    descriptor: "A county-level view connecting Reno, surrounding communities, schools, and local public services.",
    communityType: "geographic",
    scope: "local",
    primaryJurisdictionName: "Washoe County, Nevada",
    jurisdictionMatches: ["Washoe County, Nevada", "Reno, Nevada"],
    imagePath: "/community/nevada.svg",
  },
  {
    id: "clark-county",
    name: "Clark County",
    shortName: "Clark County",
    descriptor: "A county-level view connecting Las Vegas, regional growth, public services, and civic institutions.",
    communityType: "geographic",
    scope: "local",
    primaryJurisdictionName: "Clark County, Nevada",
    jurisdictionMatches: ["Clark County, Nevada", "Las Vegas, Nevada"],
    imagePath: "/community/nevada.svg",
  },
  {
    id: "nevada",
    name: "Nevada",
    shortName: "Nevada",
    descriptor: "Statewide issues shaped by growth, water, schools, and public trust.",
    communityType: "geographic",
    scope: "state",
    primaryJurisdictionName: "Nevada",
    jurisdictionMatches: ["Nevada", "Carson City, Nevada", "Washoe County, Nevada", "Las Vegas, Nevada", "Clark County, Nevada"],
    imagePath: "/community/nevada.svg",
  },
  {
    id: "united-states",
    name: "United States",
    shortName: "United States",
    descriptor: "A broader public view across local voices, state concerns, and national civic mood.",
    communityType: "geographic",
    scope: "national",
    primaryJurisdictionName: "United States",
    jurisdictionMatches: ["United States", "Nevada", "Carson City, Nevada", "Washoe County, Nevada", "Las Vegas, Nevada", "Clark County, Nevada"],
    imagePath: "/community/united-states.svg",
  },
  {
    id: "unr-campus",
    name: "University of Nevada, Reno",
    shortName: "UNR",
    descriptor: "A campus community centered on student life, university decisions, civic participation, and high-frequency events.",
    communityType: "campus",
    scope: "local",
    primaryJurisdictionName: "University of Nevada, Reno",
    jurisdictionMatches: ["University of Nevada, Reno"],
    imagePath: "/community/nevada.svg",
    locationLabel: "Reno, Nevada",
    institutionType: "public",
    enrollmentSize: 21000,
  },
  {
    id: "unlv-campus",
    name: "University of Nevada, Las Vegas",
    shortName: "UNLV",
    descriptor: "A campus community built around Las Vegas student issues, campus events, and statewide civic energy.",
    communityType: "campus",
    scope: "local",
    primaryJurisdictionName: "University of Nevada, Las Vegas",
    jurisdictionMatches: ["University of Nevada, Las Vegas"],
    imagePath: "/community/nevada.svg",
    locationLabel: "Las Vegas, Nevada",
    institutionType: "public",
    enrollmentSize: 32500,
  },
  {
    id: "wnc-campus",
    name: "Western Nevada College",
    shortName: "WNC",
    descriptor: "A smaller campus community focused on commuter students, workforce pathways, and local civic participation.",
    communityType: "campus",
    scope: "local",
    primaryJurisdictionName: "Western Nevada College",
    jurisdictionMatches: ["Western Nevada College"],
    imagePath: "/community/cc.webp",
    locationLabel: "Carson City, Nevada",
    institutionType: "public",
    enrollmentSize: 3600,
  },
];

export function getCommunityById(communityId: string | undefined) {
  return seededCommunities.find((community) => community.id === communityId);
}

export function getCampusCommunities() {
  return seededCommunities.filter((community) => community.communityType === "campus");
}

export function getCampusesForCommunity(communityId: string) {
  const community = getCommunityById(communityId);

  if (!community || community.communityType === "campus") {
    return [];
  }

  return getCampusCommunities().filter((campus) => {
    const location = campus.locationLabel ?? "";

    return community.jurisdictionMatches.some((match) => location.includes(match));
  });
}

export function getGeographicCommunities() {
  return seededCommunities.filter((community) => community.communityType === "geographic");
}

export function getCommunityByJurisdictionName(jurisdictionName: string) {
  return (
    seededCommunities.find((community) => community.primaryJurisdictionName === jurisdictionName) ??
    seededCommunities.find((community) => community.jurisdictionMatches.includes(jurisdictionName))
  );
}

export function isCampusCommunityId(communityId: string | undefined) {
  return getCommunityById(communityId)?.communityType === "campus";
}

export function getCommunityContextLabel(jurisdictionName: string) {
  const community = getCommunityByJurisdictionName(jurisdictionName);

  if (!community) {
    return jurisdictionName;
  }

  return community.communityType === "campus" ? `Campus — ${community.shortName}` : community.name;
}

export function getCommunityPageHref(communityId: string) {
  const community = getCommunityById(communityId);

  if (!community) {
    return "/my-community";
  }

  return community.communityType === "campus" ? `/campuses/${community.id}` : `/my-community?communityId=${community.id}`;
}

export function getCountiesForState(stateCommunityId: string) {
  if (stateCommunityId !== "nevada") {
    return [];
  }

  return ["carson-city-county", "washoe-county", "clark-county"]
    .map((communityId) => getCommunityById(communityId))
    .filter((community): community is CommunitySummary => Boolean(community));
}

export function getCitiesForState(stateCommunityId: string) {
  if (stateCommunityId !== "nevada") {
    return [];
  }

  return ["carson-city", "reno", "las-vegas"]
    .map((communityId) => getCommunityById(communityId))
    .filter((community): community is CommunitySummary => Boolean(community));
}

export function getCitiesForCounty(countyCommunityId: string) {
  const communityIds =
    countyCommunityId === "washoe-county"
      ? ["reno"]
      : countyCommunityId === "clark-county"
        ? ["las-vegas"]
        : countyCommunityId === "carson-city-county"
          ? ["carson-city"]
          : [];

  return communityIds
    .map((communityId) => getCommunityById(communityId))
    .filter((community): community is CommunitySummary => Boolean(community));
}

function findLocalCommunityForCampus(campusCommunityId: string) {
  const campus = getCommunityById(campusCommunityId);

  if (!campus || campus.communityType !== "campus") {
    return null;
  }

  return (
    getGeographicCommunities().find(
      (community) =>
        community.scope === "local" &&
        Boolean(campus.locationLabel) &&
        campus.locationLabel!.includes(community.name),
    ) ?? null
  );
}

export function getLocalCommunityForCampus(campusCommunityId: string) {
  return findLocalCommunityForCampus(campusCommunityId);
}

function getCountyLabelForCommunity(communityId: string) {
  if (communityId === "washoe-county") {
    return "Washoe County";
  }

  if (communityId === "clark-county") {
    return "Clark County";
  }

  if (communityId === "carson-city-county") {
    return "Carson City County";
  }

  if (communityId === "reno") {
    return "Washoe County";
  }

  if (communityId === "las-vegas") {
    return "Clark County";
  }

  if (communityId === "carson-city") {
    return "Carson City County";
  }

  return null;
}

export function getCommunityHierarchy(communityId: string) {
  const current = getCommunityById(communityId);

  if (!current) {
    return [];
  }

  const stateCommunity = getCommunityById("nevada");
  const nationalCommunity = getCommunityById("united-states");
  const currentIsCounty =
    current.communityType === "geographic" &&
    current.scope === "local" &&
    (current.id === "carson-city-county" || current.id === "washoe-county" || current.id === "clark-county");
  const countyCommunity = currentIsCounty
    ? current
    : current.id === "reno"
      ? getCommunityById("washoe-county")
      : current.id === "las-vegas"
        ? getCommunityById("clark-county")
        : current.id === "carson-city"
          ? getCommunityById("carson-city-county")
          : null;
  const localCommunity =
    current.communityType === "campus"
      ? findLocalCommunityForCampus(current.id)
      : current.communityType === "geographic" && current.scope === "local" && !currentIsCounty
        ? current
        : null;
  const countyLabel = countyCommunity ? getCountyLabelForCommunity(countyCommunity.id) : null;
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

  if (countyLabel && countyCommunity) {
    entries.push({
      id: countyCommunity.id,
      label: countyLabel,
      level: "County",
      href: getCommunityPageHref(countyCommunity.id),
      active: current.id === countyCommunity.id,
    });
  }

  if (localCommunity) {
    entries.push({
      id: localCommunity.id,
      label: localCommunity.name,
      level: "City",
      href: getCommunityPageHref(localCommunity.id),
      active: current.id === localCommunity.id,
    });
  }

  if (current.communityType === "campus") {
    entries.push({
      id: current.id,
      label: current.shortName || current.name,
      level: "Campus",
      href: getCommunityPageHref(current.id),
      active: true,
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
