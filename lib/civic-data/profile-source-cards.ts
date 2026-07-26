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

export type CampaignFinancialSnapshot = {
  sourceKind: "fec" | "transparency_usa";
  sourceName: string;
  sourceUrl: string;
  cycleYear: number;
  totalRaised: number;
  totalSpent: number;
  cashOnHand: number | null;
  reportingPeriod: string;
  periodStart: string | null;
  periodEnd: string | null;
};

export type PersonalFinancialDisclosureData = {
  sourceName: string | null;
  sourceUrl: string | null;
  status: string | null;
  applicability: string | null;
  reviewStatus: string | null;
  lastCheckedAt: string | null;
  filingSummaries: Array<{
    name: string;
    filedAt: string | null;
    url: string | null;
  }>;
  note: string | null;
};

export type CampaignFinanceContributorRelationship = {
  targetName: string;
  relationship: string;
  evidenceType: string;
  evidenceDate: string;
  confidence: "high" | "medium" | "low";
  sourceName: string;
  sourceUrl: string;
  note: string;
};

export type CampaignFinanceContributorAttribution = {
  contributorName: string;
  resolution: "verified" | "timeline" | "partial" | "reported" | "association";
  headline: string;
  summary: string;
  relationships: CampaignFinanceContributorRelationship[];
  caveat: string;
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
  financialSnapshot: CampaignFinancialSnapshot | null;
  allReportedFundingBreakdown: CandidateFundingBreakdown | null;
  contributorAttributions: CampaignFinanceContributorAttribution[];
  cycleHistory: CampaignFinanceCycleRecord[];
  allReportedTotals: CampaignFinanceAllReportedTotals | null;
  personalFinancialDisclosure: PersonalFinancialDisclosureData;
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
  contributorAttributions?: CampaignFinanceContributorAttribution[];
  financialSnapshot?: CampaignFinancialSnapshot | null;
  cycleHistory?: CampaignFinanceCycleRecord[];
  allReportedTotals?: CampaignFinanceAllReportedTotals | null;
};

type DisclosureAttributionMetadata = {
  coverageStatus?: string;
  applicability?: string;
  filingSummaries?: Array<{ name?: string; filedAt?: string | null; url?: string | null }>;
  note?: string | null;
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

function asFinancialSnapshot(value: unknown): CampaignFinancialSnapshot | null {
  const snapshot = asFinanceRawData(value);
  const cycleYear = asFiniteNumber(snapshot?.cycleYear);
  const totalRaised = asFiniteNumber(snapshot?.totalRaised);
  const totalSpent = asFiniteNumber(snapshot?.totalSpent);
  if (
    (snapshot?.sourceKind !== "fec" && snapshot?.sourceKind !== "transparency_usa") ||
    typeof snapshot.sourceName !== "string" ||
    typeof snapshot.sourceUrl !== "string" ||
    typeof snapshot.reportingPeriod !== "string" ||
    cycleYear == null ||
    totalRaised == null ||
    totalSpent == null
  ) {
    return null;
  }
  return {
    sourceKind: snapshot.sourceKind,
    sourceName: snapshot.sourceName,
    sourceUrl: snapshot.sourceUrl,
    cycleYear,
    totalRaised,
    totalSpent,
    cashOnHand: asFiniteNumber(snapshot.cashOnHand),
    reportingPeriod: snapshot.reportingPeriod,
    periodStart: typeof snapshot.periodStart === "string" ? snapshot.periodStart : null,
    periodEnd: typeof snapshot.periodEnd === "string" ? snapshot.periodEnd : null,
  };
}

function asCycleRecord(value: unknown): CampaignFinanceCycleRecord | null {
  const cycle = asFinanceRawData(value);
  const cycleYear = asFiniteNumber(cycle?.cycleYear);
  const totalRaised = asFiniteNumber(cycle?.totalRaised);
  const totalSpent = asFiniteNumber(cycle?.totalSpent);
  if (
    cycleYear == null ||
    totalRaised == null ||
    totalSpent == null ||
    typeof cycle?.displayLabel !== "string" ||
    typeof cycle.reportingPeriod !== "string"
  ) {
    return null;
  }
  return {
    cycleYear,
    displayLabel: cycle.displayLabel,
    label: typeof cycle.label === "string" ? cycle.label : `${cycle.displayLabel} totals`,
    reportingPeriod: cycle.reportingPeriod,
    periodEnd: typeof cycle.periodEnd === "string" ? cycle.periodEnd : "",
    totalRaised,
    totalSpent,
    cashOnHand: asFiniteNumber(cycle.cashOnHand),
    sourceName: typeof cycle.sourceName === "string" ? cycle.sourceName : "Campaign finance source",
    sourceUrl: typeof cycle.sourceUrl === "string" ? cycle.sourceUrl : null,
    isCurrentCycle: cycle.isCurrentCycle === true,
  };
}

function asAllReportedTotals(value: unknown): CampaignFinanceAllReportedTotals | null {
  const aggregate = asFinanceRawData(value);
  const totalRaised = asFiniteNumber(aggregate?.totalRaised);
  const totalSpent = asFiniteNumber(aggregate?.totalSpent);
  const cycleCount = asFiniteNumber(aggregate?.cycleCount);
  if (
    typeof aggregate?.label !== "string" ||
    typeof aggregate.reportingPeriod !== "string" ||
    typeof aggregate.sourceName !== "string" ||
    totalRaised == null ||
    totalSpent == null ||
    cycleCount == null
  ) {
    return null;
  }
  return {
    label: aggregate.label,
    reportingPeriod: aggregate.reportingPeriod,
    totalRaised,
    totalSpent,
    cycleCount,
    sourceName: aggregate.sourceName,
    sourceUrl: typeof aggregate.sourceUrl === "string" ? aggregate.sourceUrl : null,
    aggregationMethod: typeof aggregate.aggregationMethod === "string" ? aggregate.aggregationMethod : null,
  };
}

function isContributorAttribution(value: unknown): value is CampaignFinanceContributorAttribution {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const attribution = value as Partial<CampaignFinanceContributorAttribution>;
  return Boolean(
    attribution.contributorName &&
      attribution.headline &&
      attribution.summary &&
      attribution.caveat &&
      ["verified", "timeline", "partial", "reported", "association"].includes(attribution.resolution ?? "") &&
      Array.isArray(attribution.relationships) &&
      attribution.relationships.length,
  );
}

async function getLinkedFinanceCandidateId(entityType: "candidate" | "official", entityId: string) {
  if (entityType === "candidate") return entityId;
  const official = await prisma.official.findUnique({
    where: { id: entityId },
    select: { fullName: true },
  });
  if (!official) return null;
  const candidates = await prisma.candidate.findMany({
    where: {
      fullName: { equals: official.fullName, mode: "insensitive" },
      OR: [
        { campaignFinanceFilings: { some: {} } },
        { campaignFinanceSummaries: { some: {} } },
      ],
    },
    select: {
      id: true,
      _count: {
        select: {
          campaignFinanceFilings: true,
          campaignFinanceSummaries: true,
        },
      },
    },
    take: 3,
  });
  return candidates
    .slice()
    .sort(
      (left, right) =>
        right._count.campaignFinanceFilings +
        right._count.campaignFinanceSummaries -
        (left._count.campaignFinanceFilings + left._count.campaignFinanceSummaries),
    )
    .at(0)?.id ?? null;
}

export async function getCampaignFinanceSourceCard(entityType: "candidate" | "official", entityId: string): Promise<CampaignFinanceSourceCardData> {
  const civicEntityType = entityType === "candidate" ? CivicEntityType.CANDIDATE : CivicEntityType.OFFICIAL;
  const financeCandidateId = await getLinkedFinanceCandidateId(entityType, entityId);
  const [attributions, disclosureAttributions, filingCount, latestFiling, filings, documents, fundingBreakdown] = await Promise.all([
    prisma.sourceAttribution.findMany({
      where: {
        entityType: civicEntityType,
        entityId,
        fieldName: "campaign_finance",
      },
      orderBy: [{ lastImportedAt: "desc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    prisma.sourceAttribution.findMany({
      where: {
        entityType: civicEntityType,
        entityId,
        fieldName: "financial_disclosure",
      },
      orderBy: [{ lastImportedAt: "desc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    financeCandidateId ? prisma.campaignFinanceFiling.count({ where: { candidateId: financeCandidateId } }) : Promise.resolve(0),
    financeCandidateId
      ? prisma.campaignFinanceFiling.findFirst({
          where: { candidateId: financeCandidateId },
          orderBy: [{ filedAt: "desc" }, { updatedAt: "desc" }],
          include: { source: { select: { name: true, url: true, lastCheckedAt: true } } },
        })
      : Promise.resolve(null),
    financeCandidateId
      ? prisma.campaignFinanceFiling.findMany({
          where: { candidateId: financeCandidateId },
          orderBy: [{ filedAt: "desc" }, { updatedAt: "desc" }],
          take: 50,
          include: { source: { select: { name: true } } },
        })
      : Promise.resolve([]),
    financeCandidateId
      ? prisma.civicDocument.findMany({
          where: {
            documentType: "CAMPAIGN_FINANCE_FILING",
            relatedEntityType: "CANDIDATE",
            relatedEntityId: financeCandidateId,
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: {
            extractionRuns: { orderBy: { startedAt: "desc" }, take: 1 },
          },
        })
      : Promise.resolve([]),
    financeCandidateId
      ? getCandidateFundingBreakdown(financeCandidateId, { reportIdPrefix: "reviewed-top-contributors:" })
      : Promise.resolve(null),
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
  const financialSnapshot =
    asFinancialSnapshot(metadata.financialSnapshot) ??
    allMetadata.map((entry) => asFinancialSnapshot(entry.financialSnapshot)).find(Boolean) ??
    null;
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
  const filingCycleHistory = filings
    .slice()
    .sort((left, right) => {
      const kindRank = (value: unknown) =>
        asFinanceRawData(value)?.recordKind === "reviewed_cycle_aggregate" ? 2 : 1;
      const kindDelta = kindRank(right.rawData) - kindRank(left.rawData);
      if (kindDelta !== 0) return kindDelta;
      return (right.periodEnd?.getTime() ?? 0) - (left.periodEnd?.getTime() ?? 0);
    })
    .flatMap((filing): CampaignFinanceCycleRecord[] => {
      const rawData = asFinanceRawData(filing.rawData);
      const cycleYear = asFiniteNumber(rawData?.cycleYear);
      const totalRaised = asFiniteNumber(filing.amountRaised);
      const totalSpent = asFiniteNumber(filing.amountSpent);
      if (
        !rawData ||
        !["reviewed_cycle_aggregate", "statewide_cycle_aggregate"].includes(String(rawData?.recordKind ?? "")) ||
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
  const metadataCycleHistory = allMetadata
    .flatMap((entry) => (Array.isArray(entry.cycleHistory) ? entry.cycleHistory : []))
    .map(asCycleRecord)
    .filter((cycle): cycle is CampaignFinanceCycleRecord => Boolean(cycle));
  const cycleHistory = (() => {
    const cycles = new Map<number, CampaignFinanceCycleRecord>();
    for (const cycle of [...filingCycleHistory, ...metadataCycleHistory]) {
      if (!cycles.has(cycle.cycleYear)) cycles.set(cycle.cycleYear, cycle);
    }
    return [...cycles.values()].sort((left, right) => right.cycleYear - left.cycleYear);
  })();
  const allReportedFiling =
    filings.find((filing) => asFinanceRawData(filing.rawData)?.recordKind === "reviewed_all_reported_aggregate") ??
    filings.find((filing) => asFinanceRawData(filing.rawData)?.recordKind === "statewide_all_reported_aggregate");
  const allReportedRawData = asFinanceRawData(allReportedFiling?.rawData);
  const allReportedRaised = asFiniteNumber(allReportedFiling?.amountRaised);
  const allReportedSpent = asFiniteNumber(allReportedFiling?.amountSpent);
  const filingAllReportedTotals: CampaignFinanceAllReportedTotals | null =
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
  const allReportedTotals =
    filingAllReportedTotals ??
    asAllReportedTotals(metadata.allReportedTotals) ??
    allMetadata.map((entry) => asAllReportedTotals(entry.allReportedTotals)).find(Boolean) ??
    null;
  const allReportedFundingBreakdown =
    financeCandidateId && allReportedTotals
      ? await getCandidateFundingBreakdown(financeCandidateId, {
          reportIdPrefix: "reviewed-all-reported-top-contributors:",
          totalRaised: allReportedTotals.totalRaised,
          totalSpent: allReportedTotals.totalSpent,
          cashOnHand: null,
          reportingPeriod: allReportedTotals.reportingPeriod,
          coverageLabel: "all-reported contributions",
        })
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
  const publishedContributorBreakdown =
    allReportedFundingBreakdown?.hasDetailedContributions ? allReportedFundingBreakdown : fundingBreakdown;
  const contributorAttributions = [
    ...new Map(
      allMetadata
        .flatMap((entry) => (Array.isArray(entry.contributorAttributions) ? entry.contributorAttributions : []))
        .filter(isContributorAttribution)
        .map((entry) => [entry.contributorName.toLowerCase(), entry]),
    ).values(),
  ];
  const disclosureAttribution =
    disclosureAttributions
      .slice()
      .sort((left, right) => {
        const reviewDelta = financeReviewRank(right.reviewStatus) - financeReviewRank(left.reviewStatus);
        if (reviewDelta !== 0) return reviewDelta;
        return (right.lastImportedAt?.getTime() ?? 0) - (left.lastImportedAt?.getTime() ?? 0);
      })
      .at(0) ?? null;
  const disclosureMetadata = (disclosureAttribution?.metadata ?? {}) as DisclosureAttributionMetadata;
  const disclosureFilings = dedupeFilings(
    (Array.isArray(disclosureMetadata.filingSummaries) ? disclosureMetadata.filingSummaries : [])
      .map((filing) => ({
        name: filing.name ?? "Personal financial disclosure",
        filedAt: filing.filedAt ?? null,
        url: filing.url ?? disclosureAttribution?.sourceUrl ?? null,
      }))
      .filter((filing) => filing.name),
  );

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
    financialSnapshot,
    allReportedFundingBreakdown,
    contributorAttributions,
    cycleHistory,
    allReportedTotals,
    personalFinancialDisclosure: {
      sourceName: disclosureAttribution?.sourceName ?? null,
      sourceUrl: disclosureAttribution?.sourceUrl ?? null,
      status: disclosureMetadata.coverageStatus ?? (disclosureAttribution ? "source_registered" : null),
      applicability: disclosureMetadata.applicability ?? null,
      reviewStatus: disclosureAttribution?.reviewStatus ?? null,
      lastCheckedAt: disclosureAttribution?.lastImportedAt?.toISOString() ?? null,
      filingSummaries: disclosureFilings,
      note: disclosureMetadata.note ?? null,
    },
    campaignReportedSummary: metadata.campaignReportedSummary ?? allMetadata.find((entry) => entry.campaignReportedSummary)?.campaignReportedSummary ?? null,
    donorExtractionStatus: publishedContributorBreakdown?.hasDetailedContributions
      ? publishedContributorBreakdown.sourceCoverageNote
      : metadata.donorExtractionStatus ?? allMetadata.find((entry) => entry.donorExtractionStatus)?.donorExtractionStatus ?? publishedContributorBreakdown?.sourceCoverageNote ?? "Classification incomplete; source-backed filing summaries remain available.",
  };
}
