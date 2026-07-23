import { CivicEntityType } from "@prisma/client";

import { getCandidateFundingBreakdown, type CandidateFundingBreakdown } from "@/lib/campaign-finance/breakdown";
import { prisma } from "@/lib/prisma";

export type CampaignFinanceCycleRecord = {
  cycleYear: number;
  displayLabel: string;
  label: string;
  reportingPeriod: string;
  periodEnd: string;
  totalRaised: number;
  totalSpent: number;
  cashOnHand: number | null;
  sourceName: string;
  sourceUrl: string | null;
  isCurrentCycle: boolean;
};

export type CampaignFinanceAllReportedTotals = {
  label: string;
  reportingPeriod: string;
  totalRaised: number;
  totalSpent: number;
  cycleCount: number;
  sourceName: string;
  sourceUrl: string | null;
  aggregationMethod: string | null;
};

export type CampaignFinanceSourceCardData = {
  sourceName: string | null;
  sourceUrl: string | null;
  filingStatus: string | null;
  reviewStatus: string | null;
  lastCheckedAt: string | null;
  filingCount: number;
  filingSummaries: Array<{
    name: string;
    filedAt: string | null;
    url: string | null;
  }>;
  sourceLinks: Array<{
    label: string;
    url: string;
    note?: string | null;
  }>;
  financeSourceCount: number;
  financeFilingCount: number;
  financeDocumentCount: number;
  pendingCount: number;
  approvedCount: number;
  fundingBreakdown: CandidateFundingBreakdown | null;
  cycleHistory: CampaignFinanceCycleRecord[];
  allReportedTotals: CampaignFinanceAllReportedTotals | null;
  campaignReportedSummary: string | null;
  donorExtractionStatus: string;
};

type FinanceAttributionMetadata = {
  cycleTotalsAvailable?: boolean;
  campaignHistoryAvailable?: boolean;
  filingSummaries?: Array<{ name?: string; filedAt?: string | null; url?: string | null }>;
  sourceLinks?: Array<{ label?: string; url?: string; note?: string | null }>;
  campaignReportedSummary?: string | null;
  donorExtractionStatus?: string;
};

function financeReviewRank(value: string | null | undefined) {
  if (value === "verified") return 5;
  if (value === "approved") return 4;
  if (value === "pending_review") return 3;
  if (value === "imported") return 2;
  if (value === "rejected") return 1;
  return 0;
}

function financeMetadataScore(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const metadata = value as FinanceAttributionMetadata;
  return (metadata.cycleTotalsAvailable ? 20 : 0) + (Array.isArray(metadata.filingSummaries) ? metadata.filingSummaries.length : 0) + (Array.isArray(metadata.sourceLinks) ? metadata.sourceLinks.length : 0) + (metadata.campaignReportedSummary ? 2 : 0);
}

function dedupeFilings<T extends { name: string; filedAt: string | null; url: string | null }>(filings: T[]) {
  return [...new Map(filings.map((filing) => [`${filing.name.toLowerCase()}|${filing.filedAt ?? ""}|${filing.url ?? ""}`, filing])).values()];
}

function asFiniteNumber(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asFinanceRawData(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function getCampaignFinanceSourceCard(entityType: "candidate" | "official", entityId: string): Promise<CampaignFinanceSourceCardData> {
  const civicEntityType = entityType === "candidate" ? CivicEntityType.CANDIDATE : CivicEntityType.OFFICIAL;
  const [attributions, filingCount, latestFiling, filings, documents, fundingBreakdown] = await Promise.all([
    prisma.sourceAttribution.findMany({
      where: {
        entityType: civicEntityType,
        entityId,
        fieldName: "campaign_finance",
      },
      orderBy: [{ lastImportedAt: "desc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    entityType === "candidate" ? prisma.campaignFinanceFiling.count({ where: { candidateId: entityId } }) : Promise.resolve(0),
    entityType === "candidate"
      ? prisma.campaignFinanceFiling.findFirst({
          where: { candidateId: entityId },
          orderBy: [{ filedAt: "desc" }, { updatedAt: "desc" }],
          include: { source: { select: { name: true, url: true, lastCheckedAt: true } } },
        })
      : Promise.resolve(null),
    entityType === "candidate"
      ? prisma.campaignFinanceFiling.findMany({
          where: { candidateId: entityId },
          orderBy: [{ filedAt: "desc" }, { updatedAt: "desc" }],
          take: 50,
          include: { source: { select: { name: true } } },
        })
      : Promise.resolve([]),
    entityType === "candidate"
      ? prisma.civicDocument.findMany({
          where: {
            documentType: "CAMPAIGN_FINANCE_FILING",
            relatedEntityType: "CANDIDATE",
            relatedEntityId: entityId,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            extractionRuns: { orderBy: { startedAt: "desc" }, take: 1 },
          },
        })
      : Promise.resolve([]),
    entityType === "candidate" ? getCandidateFundingBreakdown(entityId) : Promise.resolve(null),
  ]);
  const attribution =
    attributions
      .slice()
      .sort((left, right) => {
        const totalsDelta = Number(Boolean((right.metadata as FinanceAttributionMetadata | null)?.cycleTotalsAvailable)) - Number(Boolean((left.metadata as FinanceAttributionMetadata | null)?.cycleTotalsAvailable));
        if (totalsDelta !== 0) return totalsDelta;
        const reviewDelta = financeReviewRank(right.reviewStatus) - financeReviewRank(left.reviewStatus);
        if (reviewDelta !== 0) return reviewDelta;
        const metadataDelta = financeMetadataScore(right.metadata) - financeMetadataScore(left.metadata);
        if (metadataDelta !== 0) return metadataDelta;
        return (right.lastImportedAt?.getTime() ?? 0) - (left.lastImportedAt?.getTime() ?? 0);
      })
      .at(0) ?? null;
  const metadata = (attribution?.metadata ?? {}) as FinanceAttributionMetadata;
  const allMetadata = attributions.map((row) => (row.metadata ?? {}) as FinanceAttributionMetadata);
  const metadataFilings = allMetadata
    .flatMap((entry) => (Array.isArray(entry.filingSummaries) ? entry.filingSummaries : []))
        .map((filing) => ({
          name: filing.name ?? "Campaign finance filing",
          filedAt: filing.filedAt ?? null,
          url: filing.url ?? attribution?.sourceUrl ?? null,
        }))
        .filter((filing) => filing.name);
  const parsedFilings = filings.map((filing) => {
    const rawData = asFinanceRawData(filing.rawData);
    return {
      name: typeof rawData?.filingName === "string" ? rawData.filingName : filing.filingType.replaceAll("_", " "),
      filedAt: filing.filedAt?.toISOString() ?? null,
      url: filing.filingUrl,
    };
  });
  const cycleHistory = filings
    .flatMap((filing): CampaignFinanceCycleRecord[] => {
      const rawData = asFinanceRawData(filing.rawData);
      const cycleYear = asFiniteNumber(rawData?.cycleYear);
      const totalRaised = asFiniteNumber(filing.amountRaised);
      const totalSpent = asFiniteNumber(filing.amountSpent);
      if (
        rawData?.recordKind !== "reviewed_cycle_aggregate" ||
        cycleYear == null ||
        totalRaised == null ||
        totalSpent == null ||
        !filing.periodEnd
      ) {
        return [];
      }
      return [{
        cycleYear,
        displayLabel:
          typeof rawData.cycleDisplayLabel === "string"
            ? rawData.cycleDisplayLabel
            : typeof rawData.filingName === "string"
              ? rawData.filingName.replace(/\s+totals.*$/i, "")
              : `${cycleYear} cycle`,
        label: typeof rawData.filingName === "string" ? rawData.filingName : `${cycleYear} cycle totals`,
        reportingPeriod: typeof rawData.reportingPeriod === "string" ? rawData.reportingPeriod : `${cycleYear - 1}-${cycleYear} election cycle`,
        periodEnd: filing.periodEnd.toISOString(),
        totalRaised,
        totalSpent,
        cashOnHand: asFiniteNumber(rawData.cashOnHand),
        sourceName: filing.source?.name ?? attribution?.sourceName ?? "Campaign finance source",
        sourceUrl: filing.filingUrl,
        isCurrentCycle: rawData.isCurrentCycle === true,
      }];
    })
    .sort((left, right) => right.cycleYear - left.cycleYear);
  const allReportedFiling = filings.find((filing) => asFinanceRawData(filing.rawData)?.recordKind === "reviewed_all_reported_aggregate");
  const allReportedRawData = asFinanceRawData(allReportedFiling?.rawData);
  const allReportedRaised = asFiniteNumber(allReportedFiling?.amountRaised);
  const allReportedSpent = asFiniteNumber(allReportedFiling?.amountSpent);
  const allReportedTotals: CampaignFinanceAllReportedTotals | null =
    allReportedFiling && allReportedRaised != null && allReportedSpent != null
      ? {
          label: typeof allReportedRawData?.filingName === "string" ? allReportedRawData.filingName : "All reported campaign activity",
          reportingPeriod: typeof allReportedRawData?.reportingPeriod === "string" ? allReportedRawData.reportingPeriod : "All available reporting periods",
          totalRaised: allReportedRaised,
          totalSpent: allReportedSpent,
          cycleCount: asFiniteNumber(allReportedRawData?.cycleCount) ?? cycleHistory.length,
          sourceName: allReportedFiling.source?.name ?? attribution?.sourceName ?? "Campaign finance source",
          sourceUrl: allReportedFiling.filingUrl,
          aggregationMethod: typeof allReportedRawData?.aggregationMethod === "string" ? allReportedRawData.aggregationMethod : null,
        }
      : null;
  const documentFilings = documents.map((document) => ({
    name: document.title,
    filedAt: null,
    url: document.sourceUrl,
  }));
  const metadataLinks = allMetadata
    .flatMap((entry) => (Array.isArray(entry.sourceLinks) ? entry.sourceLinks : []))
        .filter((link): link is { label: string; url: string; note?: string | null } => Boolean(link?.label && link?.url))
        .map((link) => ({ label: link.label, url: link.url, note: link.note ?? null }));
  const rawSourceLinks: Array<{ label: string; url: string; note: string | null } | null> = [
    attribution?.sourceUrl ? { label: attribution.sourceName, url: attribution.sourceUrl, note: "Official campaign finance source" } : null,
    latestFiling?.filingUrl ? { label: "Latest parsed filing", url: latestFiling.filingUrl, note: null } : null,
    ...metadataLinks,
  ];
  const sourceLinks = rawSourceLinks.filter((link): link is { label: string; url: string; note: string | null } => Boolean(link?.url));
  const dedupedLinks = [...new Map(sourceLinks.map((link) => [link.url, link])).values()];
  const latestFilingRawData =
    latestFiling?.rawData && typeof latestFiling.rawData === "object" && !Array.isArray(latestFiling.rawData)
      ? (latestFiling.rawData as Record<string, unknown>)
      : null;
  const currentCycleRecord = cycleHistory.find((cycle) => cycle.isCurrentCycle) ?? cycleHistory.at(0) ?? null;

  return {
    sourceName: attribution?.sourceName ?? latestFiling?.source?.name ?? null,
    sourceUrl: attribution?.sourceUrl ?? latestFiling?.filingUrl ?? latestFiling?.source?.url ?? null,
    filingStatus: currentCycleRecord?.label ?? (latestFiling
      ? typeof latestFilingRawData?.filingName === "string"
        ? latestFilingRawData.filingName
        : latestFiling.filingType.replaceAll("_", " ")
      : metadataFilings.length || documentFilings.length
        ? "Filing references stored"
        : attribution
          ? "Source link stored; filing extraction pending"
          : null),
    reviewStatus: attribution?.reviewStatus ?? null,
    lastCheckedAt: attribution?.lastImportedAt?.toISOString() ?? latestFiling?.source?.lastCheckedAt?.toISOString() ?? null,
    filingCount: dedupeFilings(parsedFilings).length,
    filingSummaries: metadataFilings.length ? dedupeFilings(metadataFilings) : parsedFilings.length ? dedupeFilings(parsedFilings) : dedupeFilings(documentFilings),
    sourceLinks: dedupedLinks,
    financeSourceCount: attributions.length,
    financeFilingCount: dedupeFilings(parsedFilings).length,
    financeDocumentCount: documents.length,
    pendingCount: attributions.filter((row) => row.reviewStatus === "pending_review").length,
    approvedCount: attributions.filter((row) => row.reviewStatus === "approved" || row.reviewStatus === "verified").length,
    fundingBreakdown,
    cycleHistory,
    allReportedTotals,
    campaignReportedSummary: metadata.campaignReportedSummary ?? allMetadata.find((entry) => entry.campaignReportedSummary)?.campaignReportedSummary ?? null,
    donorExtractionStatus: fundingBreakdown?.hasDetailedContributions
      ? fundingBreakdown.sourceCoverageNote
      : metadata.donorExtractionStatus ?? allMetadata.find((entry) => entry.donorExtractionStatus)?.donorExtractionStatus ?? fundingBreakdown?.sourceCoverageNote ?? "Classification incomplete; source-backed filing summaries remain available.",
  };
}
