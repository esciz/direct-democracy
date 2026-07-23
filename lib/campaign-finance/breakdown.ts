import { CivicRecordReviewStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const PUBLISHABLE_REVIEW_STATUSES = [CivicRecordReviewStatus.approved, CivicRecordReviewStatus.verified];

export type CandidateFundingBreakdown = {
  hasDetailedContributions: boolean;
  totalContributions: number;
  totalRaised: number | null;
  totalSpent: number | null;
  cashOnHand: number | null;
  reportingPeriod: string | null;
  byContributorType: Array<{ label: string; amount: number; percentage: number }>;
  byIndustry: Array<{ label: string; amount: number; percentage: number }>;
  topContributors: Array<{ name: string; amount: number; percentage: number; contributorType: string; industry: string | null }>;
  pacVsIndividual: Array<{ label: string; amount: number; percentage: number }>;
  sourceCoverageNote: string;
};

function asNumber(value: unknown) {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatLabel(value: string | null | undefined) {
  return String(value ?? "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupedPercentages(groups: Map<string, number>, total: number) {
  return [...groups.entries()]
    .map(([label, amount]) => ({
      label: formatLabel(label),
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

function addToGroup(groups: Map<string, number>, key: string, amount: number) {
  groups.set(key, (groups.get(key) ?? 0) + amount);
}

export async function getCandidateFundingBreakdown(candidateId: string): Promise<CandidateFundingBreakdown> {
  try {
    const [contributions, summary] = await Promise.all([
      prisma.campaignFinanceContribution.findMany({
        where: {
          candidateId,
          reviewStatus: { in: PUBLISHABLE_REVIEW_STATUSES },
        },
        orderBy: { amount: "desc" },
        take: 5000,
      }),
      prisma.campaignFinanceSummary.findFirst({
        where: {
          candidateId,
          reviewStatus: { in: PUBLISHABLE_REVIEW_STATUSES },
        },
        orderBy: { lastUpdated: "desc" },
      }),
    ]);

    const totalContributions = contributions.reduce((sum, row) => sum + (asNumber(row.amount) ?? 0), 0);
    const byContributorType = new Map<string, number>();
    const byIndustry = new Map<string, number>();
    const topContributorTotals = new Map<string, { amount: number; contributorType: string; industry: string | null }>();
    const pacVsIndividual = new Map<string, number>();

    for (const contribution of contributions) {
      const amount = asNumber(contribution.amount) ?? 0;
      addToGroup(byContributorType, contribution.contributorType, amount);
      if (contribution.industry) addToGroup(byIndustry, contribution.industry, amount);
      const existing = topContributorTotals.get(contribution.contributorName) ?? {
        amount: 0,
        contributorType: contribution.contributorType,
        industry: contribution.industry,
      };
      existing.amount += amount;
      topContributorTotals.set(contribution.contributorName, existing);
      const bucket =
        contribution.contributorType === "pac"
          ? "PAC"
          : contribution.contributorType === "business"
            ? "Business"
            : contribution.contributorType === "individual"
              ? "Individual"
              : "Other / unknown";
      addToGroup(pacVsIndividual, bucket, amount);
    }

    const topContributors = [...topContributorTotals.entries()]
      .map(([name, value]) => ({
        name,
        amount: value.amount,
        percentage: totalContributions > 0 ? Math.round((value.amount / totalContributions) * 1000) / 10 : 0,
        contributorType: formatLabel(value.contributorType),
        industry: value.industry,
      }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 8);

    const hasDetailedContributions = contributions.length > 0 && totalContributions > 0;
    const totalRaised = asNumber(summary?.totalRaised);
    const coveragePercentage =
      hasDetailedContributions && totalRaised && totalRaised > 0
        ? Math.min(100, Math.round((totalContributions / totalRaised) * 1000) / 10)
        : null;
    return {
      hasDetailedContributions,
      totalContributions,
      totalRaised,
      totalSpent: asNumber(summary?.totalSpent),
      cashOnHand: asNumber(summary?.cashOnHand),
      reportingPeriod: summary?.reportingPeriod ?? null,
      byContributorType: groupedPercentages(byContributorType, totalContributions),
      byIndustry: groupedPercentages(byIndustry, totalContributions),
      topContributors,
      pacVsIndividual: groupedPercentages(pacVsIndividual, totalContributions),
      sourceCoverageNote: hasDetailedContributions
        ? coveragePercentage != null
          ? `Shows ${contributions.length.toLocaleString()} reviewed top-contributor aggregate${contributions.length === 1 ? "" : "s"}, representing ${coveragePercentage}% of cycle-to-date contributions. This reviewed sample may not be the full donor ledger.`
          : `Shows ${contributions.length.toLocaleString()} reviewed top-contributor aggregate${contributions.length === 1 ? "" : "s"}. This reviewed sample may not be the full donor ledger.`
        : "Not enough clean contributor rows are available for donor-category charts yet.",
    };
  } catch (error) {
    console.warn("[campaign-finance] funding breakdown unavailable", error);
    return {
      hasDetailedContributions: false,
      totalContributions: 0,
      totalRaised: null,
      totalSpent: null,
      cashOnHand: null,
      reportingPeriod: null,
      byContributorType: [],
      byIndustry: [],
      topContributors: [],
      pacVsIndividual: [],
      sourceCoverageNote: "Not enough clean contributor rows are available for donor-category charts yet.",
    };
  }
}
