import { getCommunityById, getLocalCommunityBundle, nevadaLocalCommunityIds } from "@/lib/community/communities";
import { slugifyIssueText } from "@/lib/issues/utils";
import type { PublicIssueHubSummary } from "@/types/domain";

type LocalIssueDefinition = {
  title: string;
  category: string;
  keywords: string[];
  summary: string;
};

const LOCAL_ISSUE_DEFINITIONS: LocalIssueDefinition[] = [
  { title: "Housing and managed growth", category: "Housing & growth", keywords: ["housing", "growth", "planning", "downtown", "redevelopment", "tourism"], summary: "housing supply, development patterns, neighborhood impacts, and the pace of growth" },
  { title: "Water and utility reliability", category: "Water & utilities", keywords: ["water", "agriculture", "utilities", "rural", "public lands"], summary: "water supply, utility reliability, conservation, and long-range infrastructure needs" },
  { title: "Roads and transportation", category: "Transportation", keywords: ["transportation", "roads", "infrastructure", "growth", "rural", "tourism"], summary: "road conditions, traffic safety, transit access, and transportation investment" },
  { title: "Public safety and emergency response", category: "Public safety", keywords: ["public safety", "wildfire", "rural", "tourism", "growth"], summary: "police, fire, emergency readiness, response times, and neighborhood safety" },
  { title: "Schools and youth services", category: "Education", keywords: ["schools", "youth", "growth", "rural"], summary: "school capacity, student support, staffing, facilities, and youth services" },
  { title: "Public lands and natural resources", category: "Environment", keywords: ["public lands", "natural resources", "mining", "agriculture", "water", "wildfire"], summary: "public-land stewardship, natural resources, conservation, recreation, and local economic impacts" },
  { title: "Local budgets and public services", category: "Budget & services", keywords: ["budgets", "spending", "services", "public services", "county services", "city services", "rural"], summary: "budget priorities, taxes and fees, staffing, contracts, and reliable public services" },
  { title: "Open meetings and public accountability", category: "Civic access", keywords: ["meetings", "elections", "courts", "civic institutions"], summary: "agenda access, public comment, records, ethics, and clear explanations of local decisions" },
];

function definitionsForDescriptor(descriptor: string) {
  const normalized = descriptor.toLowerCase();
  const ranked = LOCAL_ISSUE_DEFINITIONS.map((definition, index) => ({
    definition,
    index,
    score: definition.keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0),
  })).sort((left, right) => right.score - left.score || left.index - right.index);

  const selected = ranked.filter((entry) => entry.score > 0).slice(0, 4).map((entry) => entry.definition);
  for (const fallback of LOCAL_ISSUE_DEFINITIONS) {
    if (selected.length >= 4) break;
    if (!selected.includes(fallback)) selected.push(fallback);
  }
  return selected;
}

function issueForCommunity(communityId: string, definition: LocalIssueDefinition): PublicIssueHubSummary | null {
  const community = getCommunityById(communityId);
  if (!community || community.scope !== "local") return null;

  const issueText = `${definition.title} in ${community.name}`;
  return {
    id: `issue_local_${community.id}_${slugifyIssueText(definition.title)}`,
    issueText,
    plainTitle: issueText,
    scope: "local",
    jurisdictionName: community.primaryJurisdictionName,
    source: "curated",
    createdAt: "2026-08-22T00:00:00.000Z",
    createdByUserId: null,
    createdByName: "Nevada local issue starter catalog",
    upvoteCount: 0,
    viewerHasUpvoted: false,
    category: definition.category,
    sourceBacked: false,
    sourceCount: 0,
    linkedMeetingsCount: 0,
    linkedVotesCount: 0,
    linkedCourtRecordsCount: 0,
    whyThisMatters: `${community.name} residents can use this starter hub to connect current records and community discussion about ${definition.summary}.`,
  };
}

export function getNevadaLocalIssueSummaries(communityId: string) {
  const bundle = getLocalCommunityBundle(communityId);
  return bundle.communityIds.flatMap((id) => {
    const community = getCommunityById(id);
    if (!community || community.scope !== "local") return [];
    return definitionsForDescriptor(community.descriptor)
      .map((definition) => issueForCommunity(id, definition))
      .filter((issue): issue is PublicIssueHubSummary => Boolean(issue));
  });
}

export function getAnyNevadaLocalIssueByRouteParam(issueParam: string) {
  // Kept separate from the fast per-community listing because detail routes do not carry a community query.
  for (const communityId of nevadaLocalCommunityIds) {
    const match = getNevadaLocalIssueSummaries(communityId).find(
      (issue) => issue.id === issueParam || slugifyIssueText(issue.issueText) === issueParam,
    );
    if (match) return match;
  }
  return null;
}
