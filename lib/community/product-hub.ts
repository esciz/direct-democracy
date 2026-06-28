import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AccountabilityGraph } from "@/lib/community/accountability-graph";
import { getCommunityById, getNevadaCommunityKind, seededCommunities } from "@/lib/community/communities";
import { emptyCommunityRelationshipBucket, getCommunityRelationships, type CommunityRelationshipBucket, type CommunityRelationshipRecord } from "@/lib/community/relationships";
import { compareDecisionTrustThenDate, getDecisionTrustView } from "@/lib/civic/public-decision-trust";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");

export type CommunityHubEvent = {
  id: string;
  meeting_id: string;
  title: string;
  community: string;
  jurisdiction: string;
  body_name: string | null;
  agency: string | null;
  start_at: string | null;
  status: "upcoming" | "completed" | "cancelled" | "unknown";
  agenda_url: string | null;
  minutes_url: string | null;
  video_url: string | null;
  public_comment_info: string | null;
  summary: string;
  related_votes_count: number;
  related_topics: string[];
  source_url: string | null;
  source_label: string;
  confidence: number | null;
  review_status: string;
  needsReview: boolean;
  updated_at: string | null;
};

export type CommunityHubProject = {
  id: string;
  name?: string;
  project_title: string;
  title: string;
  description?: string;
  summary: string;
  jurisdiction: string;
  communityName: string;
  agency: string | null;
  status: string;
  statusReason?: string;
  lastPublicAction?: string | null;
  nextKnownMilestone?: string | null;
  responsibleBody?: string | null;
  cost: string | null;
  budget?: number | null;
  budgetDescription?: string | null;
  timeline: string | null;
  startDate?: string | null;
  location: string | null;
  relatedMeetingIds: string[];
  relatedAgendaItemIds: string[];
  sourceMeetings?: Array<{ id: string; title: string; date: string | null; href: string }>;
  relatedVotes?: string[];
  relatedVotingCards?: string[];
  relatedIssues?: string[];
  source_url: string | null;
  source_label: string;
  confidence: number | null;
  review_status?: string;
  needsReview: boolean;
  updated_at: string | null;
};

export type CommunityHubOfficial = {
  id: string;
  name: string;
  title: string;
  office: string;
  jurisdiction: string;
  communityName: string;
  level: string | null;
  body_name: string | null;
  district: string | null;
  source_url: string | null;
  source_label: string;
  confidence: number | null;
  last_verified_at: string | null;
  profile_url: string | null;
  department?: string | null;
  role_category?: string | null;
  selection_method?: string | null;
  current_status?: string | null;
  acting_or_interim?: boolean;
  source_type?: string | null;
  related_action_count?: number;
};

export type CommunityHubDecision = {
  id: string;
  agendaItemId: string;
  title: string;
  summary: string;
  whyItMatters: string;
  affectedGroups: string[];
  jurisdiction: string;
  meeting: {
    id: string;
    title: string;
    date: string | null;
    bodyName: string;
    href: string;
  };
  decisionType: string;
  voteOutcome: string;
  voteCount: {
    yes: number;
    no: number;
    abstain: number;
    absent: number;
    unknown: number;
    totalKnown: number;
    display: string;
  };
  financialImpact: {
    estimatedAmount: number | null;
    description: string | null;
    raw: string | null;
  };
  relatedIssues: string[];
  relatedOfficials: Array<{ id: string | null; name: string; actionType: string; actionText: string }>;
  sourceReferences: Array<{ label: string; url: string | null; path: string | null; snippet: string | null }>;
  confidence: number;
  reviewStatus: string;
  generatedAt: string;
};

type Artifact<T> = {
  generatedAt?: string;
  records?: T[];
};

type CoverageRow = {
  id: string;
  name: string;
  kind: string;
  href: string;
  counts: Record<string, number>;
  localCounts: Record<string, number>;
  dashboardCounts: { local: number; statewideOverlay: number; useful: number; displayedItems: number };
  dashboardLinkAudit: { clickableInternalLinks: number; sourceOnlyLinks: number; missingDestinations: number };
  missingCategories: string[];
  acquisitionGapScore: number;
  coverage: Record<string, boolean>;
};

type CoverageReport = {
  generatedAt: string;
  relationshipMapGeneratedAt: string;
  rows: CoverageRow[];
  sprint1EReadiness?: {
    rss?: {
      capableSources: number;
      seedExamples: number;
      supplementalOnly: boolean;
    };
  };
};

type RssCapabilities = {
  generatedAt: string;
  policy: string;
  rssCapableSources?: Array<{ id: string; sourceName: string; jurisdiction: string; sourceUrl: string | null; needsReview: boolean }>;
  seedExamples?: Array<{ id: string; sourceName: string; jurisdiction: string; rssUrl: string; purpose: string; supplementalOnly: boolean; needsReview: boolean }>;
};

type VoteExtractionAudit = {
  generatedAt: string;
  totals: {
    totalVoteLikeActions: number;
    parsedNamedVotes: number;
    fullRosterMatches?: number;
    individualVotesInferredFromUnanimousOutcomes?: number;
    individualVotesInferredFromAggregateCounts?: number;
    aggregateOnlyOutcomes?: number;
    actionsNeedingAttendanceReview?: number;
    actionsNeedingDistributionReview?: number;
    unnamedVoteActions: number;
    needsReview: number;
    skippedDueToInsufficientEvidence: number;
  };
  unnamedVoteActions?: Array<{ meeting_item_id: string; meeting_id: string; title: string; source_url: string | null; reason: string }>;
  attendanceReviewActions?: Array<{ meeting_item_id: string; meeting_id: string; title: string; source_url: string | null; reason: string }>;
  distributionReviewActions?: Array<{ meeting_item_id: string; meeting_id: string; title: string; source_url: string | null; reason: string }>;
};

type ProjectStatusAudit = {
  generatedAt: string;
  totals: {
    projects: number;
    needsReview: number;
    withBudget: number;
    withNextKnownMilestone: number;
    withResponsibleBody: number;
    withSourceReferences: number;
  };
  statusCounts: Record<string, number>;
};

type ResidentIntakeRuntime = {
  generatedAt: string;
  records: Array<{ id: string; publicationStatus: string; location?: string | null; createdAt?: string | null }>;
};

type VoteAttributionReadiness = {
  generatedAt: string;
  records: Array<{
    organizationId: string | null;
    bodyName: string;
    jurisdiction: string | null;
    hasMinutes: boolean;
    hasAttendance: boolean;
    hasVoteOutcome: boolean;
    hasNamedVotes: boolean;
    eligibleForAggregateAttribution: boolean;
    eligibleForUnanimousAttribution: boolean;
  }>;
};

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\bnv\b/g, "nevada").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function communityNeedles(communityId: string, relationships: CommunityRelationshipBucket) {
  const community = getCommunityById(communityId);
  const values = new Set<string>([communityId, relationships.name]);
  if (community) {
    values.add(community.name);
    values.add(community.primaryJurisdictionName);
    for (const match of community.jurisdictionMatches) values.add(match);
  }
  return [...values].map(normalize).filter(Boolean);
}

function matchesCommunity(value: string, needles: string[]) {
  const haystack = normalize(value);
  return needles.some((needle) => haystack.includes(needle) || needle.includes(haystack));
}

function legacyProjectFromRuntime(project: CommunityHubProject): CommunityHubProject {
  return {
    ...project,
    project_title: project.project_title ?? project.name ?? project.title,
    title: project.title ?? project.name ?? project.project_title,
    summary: project.summary ?? project.description ?? "Source-backed public project record.",
    communityName: project.communityName ?? project.jurisdiction,
    agency: project.agency ?? null,
    cost: project.cost ?? (project.budget ? `$${project.budget.toLocaleString()}` : null),
    timeline: project.timeline ?? project.startDate ?? null,
    location: project.location ?? null,
    relatedMeetingIds: project.relatedMeetingIds ?? project.sourceMeetings?.map((meeting) => meeting.id) ?? [],
    relatedAgendaItemIds: project.relatedAgendaItemIds ?? [],
    relatedVotes: project.relatedVotes ?? project.relatedVotingCards ?? [],
    relatedVotingCards: project.relatedVotingCards ?? project.relatedVotes ?? [],
    source_url: project.source_url ?? project.sourceMeetings?.[0]?.href ?? null,
    source_label: project.source_label ?? "Decision-derived project",
    needsReview: project.needsReview ?? project.review_status !== "source_backed",
    updated_at: project.updated_at ?? project.startDate ?? null,
  };
}

export function storyPriority(record: CommunityRelationshipRecord) {
  const scopePriority = record.relationshipScope === "direct_local" ? 1 : record.relationshipScope === "county" ? 2 : record.relationshipScope === "school_special_district" ? 3 : record.relationshipScope === "inferred_local" ? 4 : record.relationshipScope === "statewide_overlay" ? 5 : 6;
  const typePriority = record.storyType === "vote" ? 1 : record.storyType === "meeting" ? 2 : record.storyType === "project" ? 3 : record.storyType === "spending" ? 4 : record.storyType === "case" ? 5 : record.storyType === "official" ? 6 : record.storyType === "election" ? 7 : 8;
  return scopePriority * 10 + typePriority;
}

export function getStoryDestination(record: CommunityRelationshipRecord) {
  if (record.href?.startsWith("http")) return { href: record.href, kind: "source" as const };
  if (record.href) return { href: record.href, kind: "internal" as const };
  if (record.sourceUrl) return { href: record.sourceUrl, kind: "source" as const };
  return { href: null, kind: "missing" as const };
}

export async function getCommunityHubData(communitySlug: string) {
  const community = getCommunityById(communitySlug) ?? seededCommunities.find((entry) => entry.id === communitySlug);
  if (!community) return null;
  const relationships = await getCommunityRelationships(community.id, community.name).catch(() => emptyCommunityRelationshipBucket(community.id, community.name));
  const needles = communityNeedles(community.id, relationships);
  const [
    eventsArtifact,
    projectsRuntimeArtifact,
    legacyProjectsArtifact,
    officialsArtifact,
    coverageReport,
    rssCapabilities,
    votingCardsArtifact,
    accountabilityGraph,
    voteAudit,
    projectAudit,
    residentIntakeRuntime,
    attributionReadiness,
  ] = await Promise.all([
    readJson<Artifact<CommunityHubEvent>>("nevada-community-events.json", { records: [] }),
    readJson<Artifact<CommunityHubProject>>("projects-runtime.json", { records: [] }),
    readJson<Artifact<CommunityHubProject>>("nevada-community-projects.json", { records: [] }),
    readJson<Artifact<CommunityHubOfficial>>("nevada-community-officials.json", { records: [] }),
    readJson<CoverageReport | null>("nevada-community-coverage-report.json", null),
    readJson<RssCapabilities | null>("nevada-rss-source-capabilities.json", null),
    readJson<Artifact<CommunityHubDecision>>("voting-cards.json", { records: [] }),
    readJson<AccountabilityGraph | null>("accountability-graph.json", null),
    readJson<VoteExtractionAudit | null>("public-meeting-vote-extraction-audit.json", null),
    readJson<ProjectStatusAudit | null>("project-status-audit.json", null),
    readJson<ResidentIntakeRuntime | null>("resident-civic-intake-runtime.json", null),
    readJson<VoteAttributionReadiness | null>("vote-attribution-readiness.json", null),
  ]);
  const coverageRow = coverageReport?.rows.find((row) => row.id === community.id) ?? null;
  const events = (eventsArtifact.records ?? []).filter((event) => matchesCommunity(`${event.community} ${event.jurisdiction} ${event.body_name ?? ""}`, needles));
  const runtimeProjects = (projectsRuntimeArtifact.records ?? []).map(legacyProjectFromRuntime);
  const legacyProjects = (legacyProjectsArtifact.records ?? []).map(legacyProjectFromRuntime);
  const projects = (runtimeProjects.length ? runtimeProjects : legacyProjects).filter((project) =>
    matchesCommunity(`${project.communityName} ${project.jurisdiction} ${project.agency ?? ""} ${project.name ?? ""} ${project.project_title ?? ""}`, needles),
  );
  const officials = (officialsArtifact.records ?? []).filter((official) => matchesCommunity(`${official.communityName} ${official.jurisdiction} ${official.body_name ?? ""}`, needles));
  const decisions = (votingCardsArtifact.records ?? [])
    .filter((decision) => matchesCommunity(`${decision.jurisdiction} ${decision.meeting.bodyName} ${decision.title}`, needles))
    .sort(compareDecisionTrustThenDate);
  const decisionTrustCounts = decisions.reduce(
    (counts, decision) => {
      counts[getDecisionTrustView(decision).state] += 1;
      return counts;
    },
    { approved: 0, ready: 0, needs_review: 0 },
  );
  const readinessRows = (attributionReadiness?.records ?? []).filter((row) => matchesCommunity(`${row.jurisdiction ?? ""} ${row.bodyName}`, needles));
  const accountabilitySummary = accountabilityGraph?.communitySummaries[community.id] ?? null;
  const communityDecisionIds = new Set(decisions.map((decision) => decision.agendaItemId));
  const votesNeedingRollCallReview = voteAudit?.unnamedVoteActions?.filter((action) => communityDecisionIds.has(action.meeting_item_id)).length ?? 0;
  const voteActionsMissingAttendance = voteAudit?.attendanceReviewActions?.filter((action) => communityDecisionIds.has(action.meeting_item_id)).length ?? 0;
  const voteActionsNeedingDistributionReview = voteAudit?.distributionReviewActions?.filter((action) => communityDecisionIds.has(action.meeting_item_id)).length ?? 0;
  const projectsWithNoRecentUpdate = projects.filter((project) => {
    const value = project.updated_at ?? project.timeline ?? project.startDate;
    if (!value) return true;
    const ageMs = Date.now() - Date.parse(value);
    return Number.isFinite(ageMs) && ageMs > 180 * 24 * 60 * 60 * 1000;
  }).length;
  const residentConcernsPendingReview =
    residentIntakeRuntime?.records.filter((record) => record.publicationStatus === "private_pending_review" && matchesCommunity(`${record.location ?? ""}`, needles)).length ?? 0;
  const bodiesByAction = decisions.reduce<Record<string, number>>((counts, decision) => {
    const body = decision.meeting.bodyName || "Public body pending";
    counts[body] = (counts[body] ?? 0) + 1;
    return counts;
  }, {});
  const topActionBodies = Object.entries(bodiesByAction)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const storyRecords = [
    ...relationships.records.votingCards,
    ...relationships.records.meetings,
    ...relationships.records.projects,
    ...relationships.records.spendingRecords,
    ...relationships.records.courtCases,
    ...relationships.records.officialActionRecords,
    ...relationships.records.elections,
    ...relationships.records.issues,
  ]
    .sort((left, right) => {
      const priorityDiff = storyPriority(left) - storyPriority(right);
      if (priorityDiff !== 0) return priorityDiff;
      return (Date.parse(right.date ?? "") || 0) - (Date.parse(left.date ?? "") || 0);
    })
    .slice(0, 12);

  return {
    community,
    kind: getNevadaCommunityKind(community.id) ?? "community",
    relationships,
    coverageRow,
    coverageGeneratedAt: coverageReport?.generatedAt ?? relationships.generatedAt ?? null,
    events,
    projects,
    officials,
    decisions,
    accountabilitySummary,
    accountabilityScoreboard: {
      recentDecisions: decisions.length,
      approvedDecisions: decisionTrustCounts.approved,
      readyDecisions: decisionTrustCounts.ready,
      decisionsNeedingReview: decisionTrustCounts.needs_review,
      activeProjects: projects.filter((project) => ["proposed", "approved", "funded", "in_progress"].includes(project.status)).length,
      projectsWithNoRecentUpdate,
      votesParsed: accountabilitySummary?.votesParsed ?? decisions.reduce((sum, decision) => sum + decision.voteCount.totalKnown, 0),
      votesNeedingRollCallReview,
      attendanceVerifiedVoteActions: voteAudit?.totals.fullRosterMatches ?? 0,
      voteActionsMissingAttendance,
      voteActionsNeedingDistributionReview,
      aggregateOnlyVoteActions: voteAudit?.totals.aggregateOnlyOutcomes ?? 0,
      votesInferredFromAttendance: (voteAudit?.totals.individualVotesInferredFromUnanimousOutcomes ?? 0) + (voteAudit?.totals.individualVotesInferredFromAggregateCounts ?? 0),
      residentConcernsPendingReview,
      topActionBodies,
      voteAuditGeneratedAt: voteAudit?.generatedAt ?? null,
      projectAuditGeneratedAt: projectAudit?.generatedAt ?? null,
      projectStatusCounts: projectAudit?.statusCounts ?? {},
    },
    civicDataCoverage: {
      generatedAt: attributionReadiness?.generatedAt ?? null,
      meetingsImported: readinessRows.length || events.length,
      meetingsWithMinutes: readinessRows.filter((row) => row.hasMinutes).length,
      meetingsWithAttendance: readinessRows.filter((row) => row.hasAttendance).length,
      meetingsWithVoteOutcomes: readinessRows.filter((row) => row.hasVoteOutcome).length,
      namedVotes: readinessRows.filter((row) => row.hasNamedVotes).length,
      attendanceValidatedVotes: readinessRows.filter((row) => row.eligibleForAggregateAttribution || row.eligibleForUnanimousAttribution).length,
      aggregateOnlyVotes: voteAudit?.totals.aggregateOnlyOutcomes ?? 0,
      activeProjects: projects.filter((project) => ["proposed", "approved", "funded", "in_progress"].includes(project.status)).length,
      completedProjects: projects.filter((project) => project.status === "completed").length,
      projectsAwaitingUpdates: projectsWithNoRecentUpdate,
    },
    rssCapabilities,
    storyRecords,
  };
}

export async function getProjectById(projectId: string) {
  const runtime = await readJson<Artifact<CommunityHubProject>>("projects-runtime.json", { records: [] });
  const legacy = await readJson<Artifact<CommunityHubProject>>("nevada-community-projects.json", { records: [] });
  return [...(runtime.records ?? []), ...(legacy.records ?? [])].map(legacyProjectFromRuntime).find((project) => project.id === projectId) ?? null;
}

export async function getCommunityHubProjects() {
  const runtime = await readJson<Artifact<CommunityHubProject>>("projects-runtime.json", { records: [] });
  const legacy = await readJson<Artifact<CommunityHubProject>>("nevada-community-projects.json", { records: [] });
  const merged = new Map<string, CommunityHubProject>();

  for (const project of [...(legacy.records ?? []), ...(runtime.records ?? [])].map(legacyProjectFromRuntime)) {
    merged.set(project.id, project);
  }

  return [...merged.values()];
}
