import fs from "node:fs";
import path from "node:path";

import {
  getNevadaCommunityKind,
  nevadaCityCommunityIds,
  nevadaCountyCommunityIds,
  nevadaMajorCommunityIds,
  nevadaLocalCommunityIds,
  seededCommunities,
} from "@/lib/community/communities";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const RELATIONSHIPS_PATH = path.join(GENERATED_DIR, "nevada-community-relationships.json");
const EVENTS_PATH = path.join(GENERATED_DIR, "nevada-community-events.json");
const PROJECTS_PATH = path.join(GENERATED_DIR, "nevada-community-projects.json");
const OFFICIALS_PATH = path.join(GENERATED_DIR, "nevada-community-officials.json");
const RSS_PATH = path.join(GENERATED_DIR, "nevada-rss-source-capabilities.json");
const INGESTION_REPORT_PATH = path.join(GENERATED_DIR, "public-meeting-ingestion-report.json");
const MANUAL_PROVIDER_REPORT_PATH = path.join(GENERATED_DIR, "public-meeting-manual-provider-report.json");
const CASE_LEAD_INTAKE_PATH = path.join(process.cwd(), "data/manual-sources/case-leads/intake.json");
const OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-community-coverage-report.json");
const GAP_OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-community-acquisition-gap-report.json");

type DomainCounts = {
  meetings: number;
  agendaItems: number;
  votingCards: number;
  issues: number;
  courtCases: number;
  spendingRecords: number;
  projects: number;
  elections: number;
  officialActionRecords: number;
};

type CommunityRelationshipBucket = {
  communityId: string;
  name: string;
  counts: DomainCounts & { sourceDocuments: number };
  localCounts: DomainCounts;
  statewideOverlayCounts: DomainCounts;
  linkCounts: {
    direct: number;
    inferred: number;
    statewideOverlay: number;
    federalOverlay?: number;
  };
  reviewCounts: {
    approved: number;
    ready: number;
    needsReview: number;
    unknown: number;
  };
  confidenceCounts: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  records: Record<keyof DomainCounts, RelationshipRecord[]>;
};

type RelationshipRecord = {
  id: string;
  title: string;
  storyHeadline?: string;
  storySummary?: string;
  storyWhyItMatters?: string;
  storySourceDetail?: string | null;
  sourcePath: string;
  linkType: "direct" | "inferred" | "statewide_overlay" | "federal_overlay";
  relationshipScope: "direct_local" | "inferred_local" | "county" | "school_special_district" | "statewide_overlay" | "federal_overlay";
  confidence: number | null;
  date: string | null;
  sourceUpdatedAt?: string | null;
  sourceUrl: string | null;
  href: string | null;
  needsReview: boolean;
  statewideOverlay: boolean;
  federalOverlay: boolean;
};

type RelationshipMap = {
  generatedAt: string;
  sourceArtifacts: Array<{ domain: string; sourcePath: string; recordCount: number }>;
  totals: {
    recordsProcessed: number;
    directLinkCount: number;
    inferredLinkCount: number;
    statewideOnlyCount: number;
    federalOnlyCount: number;
    unlinkedCount: number;
    needsReviewCount: number;
    lowConfidenceCount: number;
  };
  communities: Record<string, CommunityRelationshipBucket>;
  unlinked: Record<string, string[]>;
};

function readRelationshipMap() {
  if (!fs.existsSync(RELATIONSHIPS_PATH)) {
    throw new Error("Missing data/generated/nevada-community-relationships.json. Run npm run communities:relationships first.");
  }

  return JSON.parse(fs.readFileSync(RELATIONSHIPS_PATH, "utf8")) as RelationshipMap;
}

function readOptionalJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function recordsFromArtifact(filePath: string) {
  const value = readOptionalJson<unknown>(filePath, []);
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && "records" in value && Array.isArray((value as { records: unknown[] }).records)) {
    return (value as { records: unknown[] }).records;
  }
  return [];
}

function hasAnyDomainCount(counts: DomainCounts) {
  return Object.values(counts).some((count) => count > 0);
}

function localDashboardRecordCount(counts: DomainCounts) {
  return counts.meetings + counts.votingCards + counts.issues + counts.courtCases + counts.spendingRecords + counts.projects + counts.elections + counts.officialActionRecords;
}

function overlayDashboardRecordCount(counts: DomainCounts) {
  return counts.meetings + counts.votingCards + counts.issues + counts.courtCases + counts.spendingRecords + counts.projects + counts.elections + counts.officialActionRecords;
}

function localCoverageTotal(rows: Array<{ localCounts: DomainCounts }>, domain: keyof DomainCounts) {
  return rows.filter((row) => row.localCounts[domain] > 0).length;
}

function anyCoverageTotal(rows: Array<{ counts: DomainCounts }>, domain: keyof DomainCounts) {
  return rows.filter((row) => row.counts[domain] > 0).length;
}

function relationshipPriority(record: RelationshipRecord) {
  if (record.relationshipScope === "direct_local" || record.linkType === "direct") return 1;
  if (record.relationshipScope === "county") return 2;
  if (record.relationshipScope === "school_special_district") return 3;
  if (record.relationshipScope === "inferred_local" || record.linkType === "inferred") return 4;
  if (record.relationshipScope === "statewide_overlay" || record.linkType === "statewide_overlay") return 5;
  if (record.relationshipScope === "federal_overlay" || record.linkType === "federal_overlay") return 6;
  return 7;
}

function sortDashboardRecords(records: RelationshipRecord[]) {
  return [...records].sort((left, right) => {
    const priorityDiff = relationshipPriority(left) - relationshipPriority(right);
    if (priorityDiff !== 0) return priorityDiff;
    const reviewDiff = Number(left.needsReview) - Number(right.needsReview);
    if (reviewDiff !== 0) return reviewDiff;
    const confidenceDiff = (right.confidence ?? 0.65) - (left.confidence ?? 0.65);
    if (Math.abs(confidenceDiff) > 0.001) return confidenceDiff;
    return (Date.parse(right.date ?? "") || 0) - (Date.parse(left.date ?? "") || 0);
  });
}

function getMostRecentRecord(records: RelationshipRecord[]) {
  const now = Date.now();
  return sortDashboardRecords(records)
    .filter((record) => {
      const timestamp = Date.parse(record.date ?? "");
      return Number.isFinite(timestamp) && timestamp <= now;
    })
    .sort((left, right) => (Date.parse(right.date ?? "") || 0) - (Date.parse(left.date ?? "") || 0))[0] ?? null;
}

function getNextUpcomingRecord(records: RelationshipRecord[]) {
  const now = Date.now();
  return sortDashboardRecords(records)
    .filter((record) => {
      const timestamp = Date.parse(record.date ?? "");
      return Number.isFinite(timestamp) && timestamp > now;
    })
    .sort((left, right) => (Date.parse(left.date ?? "") || 0) - (Date.parse(right.date ?? "") || 0))[0] ?? null;
}

function getDashboardRecords(bucket: CommunityRelationshipBucket | undefined) {
  if (!bucket?.records) return [];
  const overlayRecords = sortDashboardRecords([
    ...bucket.records.votingCards,
    ...bucket.records.issues,
    ...bucket.records.courtCases,
    ...bucket.records.spendingRecords,
    ...bucket.records.projects,
    ...bucket.records.elections,
    ...bucket.records.officialActionRecords,
  ]).filter((record) => record.statewideOverlay || record.federalOverlay || record.linkType === "statewide_overlay" || record.linkType === "federal_overlay");
  return [
    getMostRecentRecord(bucket.records.meetings),
    getNextUpcomingRecord(bucket.records.meetings),
    ...sortDashboardRecords(bucket.records.votingCards).slice(0, 4),
    ...sortDashboardRecords(bucket.records.issues).slice(0, 3),
    ...sortDashboardRecords(bucket.records.courtCases).slice(0, 3),
    ...sortDashboardRecords(bucket.records.spendingRecords).slice(0, 3),
    ...sortDashboardRecords(bucket.records.projects).slice(0, 3),
    ...overlayRecords.slice(0, 4),
  ].filter((record): record is RelationshipRecord => Boolean(record));
}

function getDestinationKind(record: RelationshipRecord) {
  if (record.href?.startsWith("http")) return "source";
  if (record.href) return "internal";
  if (record.sourceUrl) return "source";
  return "missing";
}

function isStaleDashboard(records: RelationshipRecord[], generatedAt: string) {
  if (!records.length) return false;
  const generatedTime = Date.parse(generatedAt);
  if (!Number.isFinite(generatedTime)) return false;
  const latest = Math.max(
    ...records.map((record) => Date.parse(record.sourceUpdatedAt ?? record.date ?? "")).filter((timestamp) => Number.isFinite(timestamp)),
  );
  if (!Number.isFinite(latest)) return true;
  return generatedTime - latest > 180 * 24 * 60 * 60 * 1000;
}

function main() {
  const relationshipMap = readRelationshipMap();
  const eventRecords = recordsFromArtifact(EVENTS_PATH);
  const projectRecords = recordsFromArtifact(PROJECTS_PATH);
  const officialRecords = recordsFromArtifact(OFFICIALS_PATH);
  const rssCapabilities = readOptionalJson<{ rssCapableSources?: unknown[]; seedExamples?: unknown[] }>(RSS_PATH, {});
  const ingestionReport = readOptionalJson<{ provider_reports?: Array<Record<string, unknown>> }>(INGESTION_REPORT_PATH, {});
  const manualProviderReport = readOptionalJson<Array<Record<string, unknown>>>(MANUAL_PROVIDER_REPORT_PATH, []);
  const caseLeadIntake = readOptionalJson<{ schemaVersion?: number; intakeStatus?: string; workflow?: string[]; submissions?: unknown[] }>(CASE_LEAD_INTAKE_PATH, {
    submissions: [],
  });
  const communities = seededCommunities.filter((community) => nevadaLocalCommunityIds.includes(community.id));
  const rows = communities.map((community) => {
    const bucket = relationshipMap.communities[community.id];
    const kind = getNevadaCommunityKind(community.id) ?? "community";
    const counts = bucket?.counts ?? {
      meetings: 0,
      agendaItems: 0,
      votingCards: 0,
      issues: 0,
      courtCases: 0,
      spendingRecords: 0,
      projects: 0,
      elections: 0,
      officialActionRecords: 0,
      sourceDocuments: 0,
    };
    const localCounts = bucket?.localCounts ?? {
      meetings: 0,
      agendaItems: 0,
      votingCards: 0,
      issues: 0,
      courtCases: 0,
      spendingRecords: 0,
      projects: 0,
      elections: 0,
      officialActionRecords: 0,
    };
    const statewideOverlayCounts = bucket?.statewideOverlayCounts ?? {
      meetings: 0,
      agendaItems: 0,
      votingCards: 0,
      issues: 0,
      courtCases: 0,
      spendingRecords: 0,
      projects: 0,
      elections: 0,
      officialActionRecords: 0,
    };
    const localDashboardCount = localDashboardRecordCount(localCounts);
    const overlayDashboardCount = overlayDashboardRecordCount(statewideOverlayCounts);
    const usefulDashboardCount = localDashboardCount + overlayDashboardCount;
    const hasOnlyStatewideOverlayData = localDashboardCount === 0 && overlayDashboardCount > 0;
    const hasLimitedLocalData = localDashboardCount < 5;
    const dashboardRecords = getDashboardRecords(bucket);
    const clickableInternalLinks = dashboardRecords.filter((record) => getDestinationKind(record) === "internal").length;
    const sourceOnlyLinks = dashboardRecords.filter((record) => getDestinationKind(record) === "source").length;
    const missingDestinations = dashboardRecords.filter((record) => getDestinationKind(record) === "missing").length;

    const categoryCoverage = {
      meetings: localCounts.meetings > 0,
      votes: localCounts.votingCards > 0,
      issues: localCounts.issues > 0,
      spending: localCounts.spendingRecords > 0,
      cases: localCounts.courtCases > 0,
      officials: localCounts.officialActionRecords > 0,
      projects: localCounts.projects > 0,
    };
    const missingCategories = Object.entries(categoryCoverage)
      .filter(([, hasData]) => !hasData)
      .map(([category]) => category);
    const acquisitionGapScore = missingCategories.length + (hasOnlyStatewideOverlayData ? 3 : 0) + (hasLimitedLocalData ? 2 : 0);

    return {
      id: community.id,
      name: community.name,
      kind,
      primaryJurisdictionName: community.primaryJurisdictionName,
      parentCountyId: kind === "county" ? community.id : null,
      href: `/community/${community.id}`,
      counts,
      localCounts,
      statewideOverlayCounts,
      dashboardCounts: {
        local: localDashboardCount,
        statewideOverlay: overlayDashboardCount,
        useful: usefulDashboardCount,
        displayedItems: dashboardRecords.length,
      },
      dashboardLinkAudit: {
        clickableInternalLinks,
        sourceOnlyLinks,
        missingDestinations,
        stale: isStaleDashboard(dashboardRecords, relationshipMap.generatedAt),
      },
      detailCoverage: {
        communityPage: true,
        eventDetail: bucket ? bucket.counts.meetings > 0 : false,
        projectDetail: bucket ? bucket.counts.projects > 0 : false,
        officialDetail: bucket ? bucket.counts.officialActionRecords > 0 : false,
        caseLeadIntake: true,
      },
      categoryCoverage,
      missingCategories,
      acquisitionGapScore,
      linkCounts: bucket?.linkCounts ?? { direct: 0, inferred: 0, statewideOverlay: 0, federalOverlay: 0 },
      reviewCounts: bucket?.reviewCounts ?? { approved: 0, ready: 0, needsReview: 0, unknown: 0 },
      confidenceCounts: bucket?.confidenceCounts ?? { high: 0, medium: 0, low: 0, unknown: 0 },
      coverage: {
        navigable: true,
        hasAnyLinkedCivicRecord: hasAnyDomainCount(counts),
        hasLocalLinkedCivicRecord: hasAnyDomainCount(localCounts),
        hasUsefulDashboardData: usefulDashboardCount > 0,
        hasOnlyStatewideOverlayData,
        hasLimitedLocalData,
        hasZeroLocalRecordsButUsableOverlays: localDashboardCount === 0 && overlayDashboardCount > 0,
        hasStaleDashboardData: isStaleDashboard(dashboardRecords, relationshipMap.generatedAt),
        hasMeetings: counts.meetings > 0,
        hasLocalMeetings: localCounts.meetings > 0,
        hasOfficials: counts.officialActionRecords > 0,
        hasLocalOfficials: localCounts.officialActionRecords > 0,
        hasElections: counts.elections > 0,
        hasLocalElections: localCounts.elections > 0,
        hasCourtCases: counts.courtCases > 0,
        hasLocalCourtCases: localCounts.courtCases > 0,
        hasSpendingData: counts.spendingRecords > 0,
        hasLocalSpendingData: localCounts.spendingRecords > 0,
        hasProjects: counts.projects > 0,
        hasLocalProjects: localCounts.projects > 0,
        hasVotingCards: counts.votingCards > 0,
        hasLocalVotingCards: localCounts.votingCards > 0,
        hasIssues: counts.issues > 0,
        hasLocalIssues: localCounts.issues > 0,
      },
    };
  });

  const carsonCityBucket = relationshipMap.communities["carson-city"];
  const storyExamples = (carsonCityBucket ? [
    ...getDashboardRecords(carsonCityBucket).filter((record) => record.storyHeadline && record.storyHeadline !== record.title).slice(0, 6),
  ] : []).map((record) => ({
    recordId: record.id,
    type: record.relationshipScope,
    before: record.title,
    after: {
      headline: record.storyHeadline,
      summary: record.storySummary,
      whyItMatters: record.storyWhyItMatters,
      source: record.storySourceDetail,
    },
  }));
  const launchRows = rows.map((row) => ({
    id: row.id,
    slug: row.id,
    name: row.name,
    href: row.href,
    readyScore:
      row.dashboardCounts.local +
      row.dashboardLinkAudit.clickableInternalLinks * 3 +
      Object.values(row.categoryCoverage).filter(Boolean).length * 20 -
      row.missingCategories.length * 15 -
      row.dashboardLinkAudit.missingDestinations * 50,
    missingSections: row.missingCategories,
    internalLinks: row.dashboardLinkAudit.clickableInternalLinks,
    sourceOnlyLinks: row.dashboardLinkAudit.sourceOnlyLinks,
    missingDestinations: row.dashboardLinkAudit.missingDestinations,
    detailCoverage: row.detailCoverage,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    relationshipMapGeneratedAt: relationshipMap.generatedAt,
    roadmapScope: "Nevada local coverage plus federal overlay only",
    totals: {
      communities: rows.length,
      counties: nevadaCountyCommunityIds.length,
      cities: nevadaCityCommunityIds.length,
      majorCommunities: nevadaMajorCommunityIds.length,
      navigableCommunities: rows.filter((row) => row.coverage.navigable).length,
      communitiesWithAnyLinkedCivicRecord: rows.filter((row) => row.coverage.hasAnyLinkedCivicRecord).length,
      communitiesWithLocalLinkedCivicRecord: rows.filter((row) => row.coverage.hasLocalLinkedCivicRecord).length,
      communitiesWithUsefulDashboardData: rows.filter((row) => row.coverage.hasUsefulDashboardData).length,
      communitiesWithOnlyStatewideOverlayData: rows.filter((row) => row.coverage.hasOnlyStatewideOverlayData).length,
      communitiesWithLimitedLocalData: rows.filter((row) => row.coverage.hasLimitedLocalData).length,
      communitiesWithImprovedLimitedDataMessaging: rows.filter((row) => row.coverage.hasLimitedLocalData).length,
      communitiesWithZeroLocalRecordsButUsableOverlays: rows.filter((row) => row.coverage.hasZeroLocalRecordsButUsableOverlays).length,
      communitiesWithStaleDashboardData: rows.filter((row) => row.coverage.hasStaleDashboardData).length,
      dashboardCardsWithInternalLinks: rows.reduce((total, row) => total + row.dashboardLinkAudit.clickableInternalLinks, 0),
      dashboardCardsWithSourceOnlyLinks: rows.reduce((total, row) => total + row.dashboardLinkAudit.sourceOnlyLinks, 0),
      dashboardItemsMissingDestinations: rows.reduce((total, row) => total + row.dashboardLinkAudit.missingDestinations, 0),
      communityPagesReady: rows.length,
      projectDetailCoverageCommunities: rows.filter((row) => row.detailCoverage.projectDetail).length,
      eventDetailCoverageCommunities: rows.filter((row) => row.detailCoverage.eventDetail).length,
      officialDetailCoverageCommunities: rows.filter((row) => row.detailCoverage.officialDetail).length,
      communitiesWithMeetings: anyCoverageTotal(rows, "meetings"),
      communitiesWithLocalMeetings: localCoverageTotal(rows, "meetings"),
      communitiesWithOfficials: anyCoverageTotal(rows, "officialActionRecords"),
      communitiesWithLocalOfficials: localCoverageTotal(rows, "officialActionRecords"),
      communitiesWithElections: anyCoverageTotal(rows, "elections"),
      communitiesWithLocalElections: localCoverageTotal(rows, "elections"),
      communitiesWithCourtCases: anyCoverageTotal(rows, "courtCases"),
      communitiesWithLocalCourtCases: localCoverageTotal(rows, "courtCases"),
      communitiesWithSpendingData: anyCoverageTotal(rows, "spendingRecords"),
      communitiesWithLocalSpendingData: localCoverageTotal(rows, "spendingRecords"),
      communitiesWithVotingCards: anyCoverageTotal(rows, "votingCards"),
      communitiesWithLocalVotingCards: localCoverageTotal(rows, "votingCards"),
      communitiesWithIssues: anyCoverageTotal(rows, "issues"),
      communitiesWithLocalIssues: localCoverageTotal(rows, "issues"),
      communitiesWithProjects: anyCoverageTotal(rows, "projects"),
      communitiesWithLocalProjects: localCoverageTotal(rows, "projects"),
      communitiesWithSourceDocuments: rows.filter((row) => row.counts.sourceDocuments > 0).length,
      sourceDocumentLinkCount: rows.reduce((total, row) => total + row.counts.sourceDocuments, 0),
      directLinkCount: relationshipMap.totals.directLinkCount,
      inferredLinkCount: relationshipMap.totals.inferredLinkCount,
      statewideOnlyCount: relationshipMap.totals.statewideOnlyCount,
      federalOnlyCount: relationshipMap.totals.federalOnlyCount,
      unlinkedCount: relationshipMap.totals.unlinkedCount,
      needsReviewCount: relationshipMap.totals.needsReviewCount,
      lowConfidenceCount: relationshipMap.totals.lowConfidenceCount,
      recordsProcessed: relationshipMap.totals.recordsProcessed,
    },
    sourceArtifacts: {
      communities: "lib/community/communities.ts",
      relationships: "data/generated/nevada-community-relationships.json",
      officials: "data/generated/nevada-community-officials.json",
      projects: "data/generated/nevada-community-projects.json",
      events: "data/generated/nevada-community-events.json",
      rssCapabilities: "data/generated/nevada-rss-source-capabilities.json",
      caseLeadIntake: "data/manual-sources/case-leads/intake.json",
      runtimeArtifacts: relationshipMap.sourceArtifacts,
    },
    sprint1EReadiness: {
      officials: {
        generatedRecords: officialRecords.length,
        coveredCommunities: rows.filter((row) => row.coverage.hasOfficials).length,
        namedSourceBackedOnly: true,
      },
      projects: {
        generatedRecords: projectRecords.length,
        coveredCommunities: rows.filter((row) => row.coverage.hasProjects).length,
        localCoveredCommunities: rows.filter((row) => row.coverage.hasLocalProjects).length,
        inferredRecordsNeedReview: true,
      },
      events: {
        generatedRecords: eventRecords.length,
        communitiesWithEvents: rows.filter((row) => row.coverage.hasMeetings).length,
        artifact: "data/generated/nevada-community-events.json",
      },
      historicalMeetingCoverage: {
        providerReports: [...(ingestionReport.provider_reports ?? []), ...manualProviderReport].map((provider) => ({
          sourceId: provider.source_id ?? provider.provider_id ?? null,
          name: provider.provider_name ?? provider.source_name ?? null,
          jurisdiction: provider.jurisdiction ?? null,
          historicalIngestionSupported: provider.historical_ingestion_supported ?? null,
          meetingsParsed: provider.meetings_parsed ?? provider.parsed_meetings ?? 0,
          minutesParsed: provider.minutes_parsed ?? null,
          oldestMeetingFound: provider.oldest_meeting_found ?? null,
          newestMeetingFound: provider.newest_meeting_found ?? null,
          nextRecommendedAction: provider.next_recommended_action ?? provider.notes ?? null,
        })),
      },
      rss: {
        capableSources: (rssCapabilities.rssCapableSources ?? []).length,
        seedExamples: (rssCapabilities.seedExamples ?? []).length,
        supplementalOnly: true,
      },
      citizenCaseLeads: {
        intakeStatus: caseLeadIntake.intakeStatus ?? "draft_architecture",
        pendingSubmissions: (caseLeadIntake.submissions ?? []).length,
        publishesOnlyAfterSourceVerification: true,
      },
    },
    storyExamples: {
      community: "Carson City",
      examples: storyExamples,
    },
    communityPageReadinessBySlug: launchRows,
    topLaunchReadyCommunities: [...launchRows].sort((left, right) => right.readyScore - left.readyScore).slice(0, 10),
    topAcquisitionGapsBlockingLaunch: [...launchRows]
      .sort((left, right) => right.missingSections.length - left.missingSections.length || left.readyScore - right.readyScore)
      .slice(0, 10),
    rows,
  };

  const acquisitionGapReport = {
    generatedAt: report.generatedAt,
    relationshipMapGeneratedAt: relationshipMap.generatedAt,
    purpose: "Prioritize Nevada communities that need additional local source acquisition before expansion.",
    priorityOrder: rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        href: row.href,
        acquisitionGapScore: row.acquisitionGapScore,
        missingCategories: row.missingCategories,
        localDashboardRecords: row.dashboardCounts.local,
        overlayDashboardRecords: row.dashboardCounts.statewideOverlay,
        recommendation: row.coverage.hasOnlyStatewideOverlayData
          ? "Acquire local meeting, official, election, spending, and case sources first; this page currently relies on overlays."
          : row.coverage.hasLimitedLocalData
            ? "Backfill local meeting/vote/spending/case sources and review inferred links."
            : "Maintain source refresh and add missing categories.",
      }))
      .sort((left, right) => right.acquisitionGapScore - left.acquisitionGapScore || left.localDashboardRecords - right.localDashboardRecords),
  };

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(GAP_OUTPUT_PATH, `${JSON.stringify(acquisitionGapReport, null, 2)}\n`);
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(`[nevada-community-coverage] Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
  console.log(`[nevada-community-gaps] Wrote ${path.relative(process.cwd(), GAP_OUTPUT_PATH)}`);
}

main();
