import {
  CivicEntityType,
  CivicRecordReviewStatus,
  DataQualityIssueStatus,
  DataQualityIssueType,
  SourceSyncStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const DATA_FACTORY_PRIORITIES = [
  {
    key: "candidate-knowledge",
    label: "Candidate Knowledge",
    importCommand: "npm run civic:import-candidate-knowledge",
    reviewCommand: "npm run civic:review-candidate-knowledge",
    outputs: ["bio", "candidate's own words", "campaign website", "public contact", "social links", "issue priorities", "experience", "data completeness"],
  },
  {
    key: "campaign-finance",
    label: "Campaign Finance",
    importCommand: "npm run civic:import-campaign-finance",
    reviewCommand: "npm run civic:review-campaign-finance",
    outputs: ["committee", "filing period", "contributions", "expenditures", "cash on hand", "top donors", "PACs", "source confidence"],
  },
  {
    key: "issue-positions",
    label: "Issue Positions",
    importCommand: "npm run civic:extract-issue-positions",
    reviewCommand: "npm run civic:review-issue-positions",
    outputs: ["issue", "position summary", "stance", "confidence", "evidence", "timeline", "source attribution"],
  },
  {
    key: "meetings",
    label: "Meeting / Agenda / Vote Data",
    importCommand: "npm run civic:import-meetings",
    reviewCommand: "npm run civic:review-meetings",
    outputs: ["meeting", "agenda items", "issue links", "official votes", "public comments", "action items", "documents"],
  },
] as const;

export const DATA_FACTORY_QA_RULES = [
  "duplicate candidate names",
  "candidate name order mismatch",
  "missing bio",
  "missing website",
  "missing campaign finance",
  "unmatched source document",
  "stale source",
  "conflicting party / office / race",
  "low-confidence news match",
  "low-confidence OCR field",
  "broken source URL",
  "missing district match",
];

export const DATA_FACTORY_REFRESH_SCHEDULE = {
  electionSeason: [
    "candidate filings: daily",
    "candidate knowledge/news: daily or every few days",
    "campaign finance: daily/weekly near deadlines",
    "meetings/agendas: weekly",
    "issue positions: after candidate source imports",
  ],
  offSeason: [
    "candidate/official data: monthly",
    "news: weekly/monthly",
    "finance: monthly/quarterly",
    "meetings: weekly/monthly depending on source",
  ],
};

export type FactoryRow = {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  updatedAt?: Date | null;
  href?: string | null;
  actionHint?: string | null;
};

function startOfStaleWindow() {
  const date = new Date();
  date.setDate(date.getDate() - 35);
  return date;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

async function getDuplicateCandidateRows(): Promise<FactoryRow[]> {
  const candidates = await prisma.candidate.findMany({
    select: {
      id: true,
      fullName: true,
      partyText: true,
      election: { select: { id: true, title: true } },
    },
    take: 750,
    orderBy: { updatedAt: "desc" },
  });
  const buckets = new Map<string, typeof candidates>();

  for (const candidate of candidates) {
    const key = `${candidate.election.id}:${normalizeName(candidate.fullName)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), candidate]);
  }

  return [...buckets.values()]
    .filter((items) => items.length > 1)
    .slice(0, 10)
    .map((items) => ({
      id: items.map((item) => item.id).join(":"),
      title: items[0].fullName,
      subtitle: `${items.length} records in ${items[0].election.title}`,
      status: "duplicate candidate",
      href: `/admin/data?duplicate=${encodeURIComponent(items.map((item) => item.id).join(","))}`,
      actionHint: "Queue merge review",
    }));
}

export async function getCivicDataFactoryDashboard() {
  const staleBefore = startOfStaleWindow();

  const [
    sources,
    importRuns,
    sourceRecordsCount,
    sourceAttributionsCount,
    pendingNewsMentions,
    missingCampaignFinanceLinks,
    missingDistrictSources,
    missingMeetingSources,
    reviewQueue,
    openQualityIssues,
    conflictingSources,
    staleSources,
    unmatchedDocuments,
    recentVersions,
    candidatesWithoutKnowledge,
    candidatesWithoutFinance,
    candidatesWithoutIssuePositions,
    meetingsWithoutAgendaItems,
    duplicateCandidates,
  ] = await Promise.all([
    prisma.source.findMany({
      orderBy: [{ importPriority: "asc" }, { name: "asc" }],
      take: 12,
      select: {
        id: true,
        name: true,
        slug: true,
        sourceType: true,
        url: true,
        dataCategory: true,
        refreshFrequency: true,
        syncStatus: true,
        lastCheckedAt: true,
        lastSuccessAt: true,
        isActive: true,
      },
    }),
    prisma.sourceSyncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 12,
      include: { source: { select: { name: true, slug: true } } },
    }),
    prisma.sourceRecord.count(),
    prisma.sourceAttribution.count(),
    prisma.newsMention.count({ where: { reviewStatus: CivicRecordReviewStatus.pending_review } }),
    prisma.dataQualityIssue.count({ where: { issueType: DataQualityIssueType.missing_campaign_finance, status: { in: [DataQualityIssueStatus.open, DataQualityIssueStatus.in_review] } } }),
    prisma.dataQualityIssue.count({ where: { issueType: DataQualityIssueType.unmatched_district, status: { in: [DataQualityIssueStatus.open, DataQualityIssueStatus.in_review] } } }),
    prisma.dataQualityIssue.count({ where: { issueType: DataQualityIssueType.missing_meeting_data, status: { in: [DataQualityIssueStatus.open, DataQualityIssueStatus.in_review] } } }),
    prisma.reviewQueueItem.findMany({
      where: { reviewStatus: CivicRecordReviewStatus.pending_review },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { source: { select: { name: true, url: true } } },
    }),
    prisma.dataQualityIssue.findMany({
      where: { status: { in: [DataQualityIssueStatus.open, DataQualityIssueStatus.in_review] } },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 12,
      include: { source: { select: { name: true, url: true } } },
    }),
    prisma.dataQualityIssue.findMany({
      where: {
        issueType: DataQualityIssueType.conflicting_source,
        status: { in: [DataQualityIssueStatus.open, DataQualityIssueStatus.in_review] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { source: { select: { name: true, url: true } } },
    }),
    prisma.source.findMany({
      where: {
        isActive: true,
        OR: [
          { syncStatus: SourceSyncStatus.ERROR },
          { lastSuccessAt: null },
          { lastSuccessAt: { lt: staleBefore } },
        ],
      },
      orderBy: [{ syncStatus: "desc" }, { lastSuccessAt: "asc" }],
      take: 10,
    }),
    prisma.civicDocument.findMany({
      where: {
        relatedEntityId: null,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.importedRecordVersion.findMany({
      orderBy: { recordedAt: "desc" },
      take: 12,
      include: { source: { select: { name: true, url: true } } },
    }),
    prisma.candidate.findMany({
      where: {
        knowledgeEnrichments: {
          none: {
            reviewStatus: { in: ["APPROVED", "VERIFIED"] },
          },
        },
      },
      include: { election: { select: { title: true } }, source: { select: { name: true, url: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.candidate.findMany({
      where: { campaignFinanceFilings: { none: {} } },
      include: { election: { select: { title: true } }, source: { select: { name: true, url: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.candidate.findMany({
      where: {
        issuePositions: {
          none: {
            reviewStatus: { in: [CivicRecordReviewStatus.approved, CivicRecordReviewStatus.verified] },
          },
        },
      },
      include: { election: { select: { title: true } }, source: { select: { name: true, url: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    prisma.meeting.findMany({
      where: { agendaItems: { none: {} } },
      include: { jurisdiction: { select: { name: true } }, source: { select: { name: true, url: true } } },
      orderBy: { startsAt: "desc" },
      take: 10,
    }),
    getDuplicateCandidateRows(),
  ]);

  return {
    summary: {
      sources: sources.length,
      recentImportRuns: importRuns.length,
      sourceRecords: sourceRecordsCount,
      sourceAttributions: sourceAttributionsCount,
      pendingNewsMentions,
      missingCampaignFinanceLinks,
      missingDistrictSources,
      missingMeetingSources,
      pendingReview: reviewQueue.length,
      openQualityIssues: openQualityIssues.length,
      staleSources: staleSources.length,
    },
    sources,
    importRuns,
    gaps: {
      candidateKnowledge: candidatesWithoutKnowledge.map((candidate) => ({
        id: candidate.id,
        title: candidate.fullName,
        subtitle: candidate.election.title,
        status: "missing approved knowledge",
        sourceName: candidate.source?.name ?? null,
        sourceUrl: candidate.source?.url ?? null,
        updatedAt: candidate.updatedAt,
        href: `/candidates/${candidate.id}`,
        actionHint: "Attach source",
      })),
      campaignFinance: candidatesWithoutFinance.map((candidate) => ({
        id: candidate.id,
        title: candidate.fullName,
        subtitle: candidate.election.title,
        status: "missing campaign finance",
        sourceName: candidate.source?.name ?? null,
        sourceUrl: candidate.source?.url ?? null,
        updatedAt: candidate.updatedAt,
        href: `/candidates/${candidate.id}`,
        actionHint: "Import finance filing",
      })),
      issuePositions: candidatesWithoutIssuePositions.map((candidate) => ({
        id: candidate.id,
        title: candidate.fullName,
        subtitle: candidate.election.title,
        status: "missing approved issue positions",
        sourceName: candidate.source?.name ?? null,
        sourceUrl: candidate.source?.url ?? null,
        updatedAt: candidate.updatedAt,
        href: `/candidates/${candidate.id}`,
        actionHint: "Extract positions",
      })),
      meetings: meetingsWithoutAgendaItems.map((meeting) => ({
        id: meeting.id,
        title: meeting.title,
        subtitle: meeting.jurisdiction.name,
        status: "missing agenda items",
        sourceName: meeting.source?.name ?? null,
        sourceUrl: meeting.source?.url ?? null,
        updatedAt: meeting.updatedAt,
        href: meeting.meetingUrl,
        actionHint: "Attach agenda document",
      })),
    } satisfies Record<string, FactoryRow[]>,
    duplicateRecords: duplicateCandidates,
    conflictingSources: conflictingSources.map((issue) => ({
      id: issue.id,
      title: issue.issueType.replaceAll("_", " "),
      subtitle: issue.notes,
      status: issue.status,
      sourceName: issue.source?.name ?? null,
      sourceUrl: issue.source?.url ?? null,
      updatedAt: issue.updatedAt,
      actionHint: "Resolve conflict",
    })),
    staleSources: staleSources.map((source) => ({
      id: source.id,
      title: source.name,
      subtitle: source.dataCategory,
      status: source.syncStatus,
      sourceName: source.name,
      sourceUrl: source.url,
      updatedAt: source.lastSuccessAt,
      actionHint: "Rerun import",
    })),
    unmatchedDocuments: unmatchedDocuments.map((document) => ({
      id: document.id,
      title: document.title,
      subtitle: document.originalFilename ?? document.localFilePath,
      status: document.documentType,
      sourceName: document.sourceName,
      sourceUrl: document.sourceUrl,
      updatedAt: document.updatedAt,
      href: "/admin/documents/review",
      actionHint: "Match document",
    })),
    pendingReview: reviewQueue.map((item) => ({
      id: item.id,
      title: item.title,
      subtitle: item.summary,
      status: item.reviewStatus,
      sourceName: item.source?.name ?? null,
      sourceUrl: item.source?.url ?? null,
      updatedAt: item.updatedAt,
      actionHint: item.actionHint ?? "Review",
    })),
    openQualityIssues: openQualityIssues.map((issue) => ({
      id: issue.id,
      title: issue.issueType.replaceAll("_", " "),
      subtitle: issue.notes,
      status: `${issue.severity} · ${issue.status}`,
      sourceName: issue.source?.name ?? null,
      sourceUrl: issue.source?.url ?? null,
      updatedAt: issue.updatedAt,
      actionHint: "Resolve",
    })),
    recentlyUpdated: recentVersions.map((version) => ({
      id: version.id,
      title: `${version.entityType} ${version.entityId}`,
      subtitle: `${version.changeType} · ${(version.changedFields as string[] | null)?.join(", ") ?? "changed fields recorded"}`,
      status: version.reviewStatus,
      sourceName: version.source.name,
      sourceUrl: version.source.url,
      updatedAt: version.recordedAt,
      actionHint: "Inspect version",
    })),
  };
}
