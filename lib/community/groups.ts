import { getCommunityById } from "@/lib/community/communities";
import type { CommunityGroupSummary } from "@/types/domain";

const seededCommunityGroups: Array<CommunityGroupSummary & { memberUserIds: string[] }> = [
  {
    id: "group_carson_downtown_neighborhoods",
    name: "Carson Downtown Neighborhood Association",
    type: "neighborhoodAssociation",
    communityId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    description: "Residents organizing around growth, parking, and downtown quality-of-life decisions.",
    issueFocuses: ["Downtown growth", "Housing affordability", "Infrastructure", "Public meeting access"],
    memberUserIds: ["user_citizen_alicia_hart", "user_trusted_citizen_marco_silva"],
  },
  {
    id: "group_carson_parent_teacher",
    name: "Carson Parent and Teacher Alliance",
    type: "parentTeacherGroup",
    communityId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    description: "Parents and educators focused on school staffing, transparency, and classroom support.",
    issueFocuses: ["Education funding", "Teacher retention", "School staffing", "Public meeting access"],
    memberUserIds: ["user_citizen_alicia_hart", "user_candidate_owen_castillo"],
  },
  {
    id: "group_nevada_small_business",
    name: "Northern Nevada Small Business Coalition",
    type: "smallBusinessGroup",
    communityId: "nevada",
    jurisdictionName: "Nevada",
    description: "Owners and operators tracking permitting, downtown vitality, and cost-of-living pressures.",
    issueFocuses: ["Economic development", "Taxes / cost of living", "Housing affordability", "Infrastructure"],
    memberUserIds: ["user_citizen_miles_reed", "user_trusted_citizen_hannah_cho"],
  },
  {
    id: "group_nevada_chamber",
    name: "Nevada Chamber Civic Forum",
    type: "chamberOfCommerce",
    communityId: "nevada",
    jurisdictionName: "Nevada",
    description: "Business-facing civic group focused on transparency, growth planning, and public access.",
    issueFocuses: ["Economic development", "Government transparency", "Infrastructure", "Housing affordability"],
    memberUserIds: ["user_official_elena_ramirez", "user_candidate_sofia_bennett"],
  },
  {
    id: "group_washoe_environment",
    name: "Truckee Basin Environmental Network",
    type: "environmentalGroup",
    communityId: "reno",
    jurisdictionName: "Washoe County, Nevada",
    description: "Residents tracking water planning, wildfire readiness, and land-use decisions.",
    issueFocuses: ["Water resilience", "Environment / land use", "Wildfire readiness", "Growth planning"],
    memberUserIds: ["user_citizen_miles_reed", "user_official_david_park"],
  },
  {
    id: "group_washoe_veterans",
    name: "Washoe Veterans Community Council",
    type: "veteransGroup",
    communityId: "reno",
    jurisdictionName: "Washoe County, Nevada",
    description: "Veterans and family advocates engaged around access, transportation, and public meetings.",
    issueFocuses: ["Public meeting access", "Transit funding", "Healthcare access", "Public safety"],
    memberUserIds: ["user_trusted_citizen_hannah_cho"],
  },
  {
    id: "group_nevada_open_government",
    name: "Nevada Open Government Partnership",
    type: "advocacyOrganization",
    communityId: "nevada",
    jurisdictionName: "Nevada",
    description: "Statewide advocates for plain-language records, finance disclosures, and meeting access.",
    issueFocuses: ["Government transparency", "Campaign finance", "Open records", "Public meeting access"],
    memberUserIds: ["user_citizen_tiana_moore", "user_trusted_citizen_marco_silva"],
  },
  {
    id: "group_carson_service",
    name: "Carson Community Service Network",
    type: "faithCommunityService",
    communityId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    description: "Volunteer-serving coalition helping connect residents around food, housing, and school needs.",
    issueFocuses: ["Housing affordability", "Teacher retention", "Youth services", "Community discussion"],
    memberUserIds: ["user_citizen_alicia_hart", "user_official_elena_ramirez"],
  },
  {
    id: "group_nevada_professionals",
    name: "Nevada Public Interest Professionals",
    type: "professionalAssociation",
    communityId: "nevada",
    jurisdictionName: "Nevada",
    description: "Civic-minded professionals convening around public trust, budgeting, and access.",
    issueFocuses: ["Government transparency", "Budget clarity", "Infrastructure", "Economic development"],
    memberUserIds: ["user_candidate_sofia_bennett", "user_admin_riley_morgan"],
  },
  {
    id: "group_carson_labor",
    name: "Capital Region Public Workers Alliance",
    type: "tradeUnion",
    communityId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    description: "Public workers organizing around staffing stability, compensation, and public services.",
    issueFocuses: ["Teacher retention", "Education funding", "Infrastructure", "Public safety"],
    memberUserIds: ["user_candidate_owen_castillo", "user_official_elena_ramirez"],
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
}

function communityMatches(groupCommunityId: string, selectedCommunityId: string) {
  if (groupCommunityId === selectedCommunityId) {
    return true;
  }

  if (selectedCommunityId === "nevada") {
    return groupCommunityId === "carson-city" || groupCommunityId === "reno" || groupCommunityId === "las-vegas" || groupCommunityId === "nevada";
  }

  if (selectedCommunityId === "united-states") {
    return true;
  }

  return groupCommunityId === "nevada";
}

export function getCommunityGroups(communityId: string): CommunityGroupSummary[] {
  return seededCommunityGroups
    .filter((group) => communityMatches(group.communityId, communityId))
    .map(({ memberUserIds: _memberUserIds, ...group }) => group);
}

export function getCommunityGroupsForUser(userId: string, communityId?: string): CommunityGroupSummary[] {
  return seededCommunityGroups
    .filter((group) => group.memberUserIds.includes(userId))
    .filter((group) => (communityId ? communityMatches(group.communityId, communityId) : true))
    .map(({ memberUserIds: _memberUserIds, ...group }) => group);
}

export function getIssueRelatedGroups(communityId: string, issueLabel: string): CommunityGroupSummary[] {
  const issueTokens = new Set(tokenize(issueLabel));

  return getCommunityGroups(communityId)
    .filter((group) =>
      group.issueFocuses.some((focus) => tokenize(focus).some((token) => issueTokens.has(token))),
    )
    .slice(0, 3);
}

export function getAvailableCommunityGroupFilters(communityId: string) {
  return getCommunityGroups(communityId).slice(0, 8);
}

export function getCommunityGroupById(groupId: string) {
  const group = seededCommunityGroups.find((entry) => entry.id === groupId);

  if (!group) {
    return null;
  }

  const { memberUserIds: _memberUserIds, ...summary } = group;
  return summary;
}

export function getCommunityForGroup(groupId: string) {
  const group = seededCommunityGroups.find((entry) => entry.id === groupId);
  return group ? getCommunityById(group.communityId) ?? null : null;
}
