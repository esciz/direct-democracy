import { getCommunityById } from "@/lib/community/communities";
import type { CommunityDataLevel, CommunityEconomicsSummary } from "@/types/domain";

type EconomicSeed = CommunityEconomicsSummary;

type CommunityLevelMap = Partial<Record<CommunityDataLevel, string>>;
type TaxIndicatorSeed = {
  salesTaxRate?: number | null;
  propertyTaxRateEstimate?: number | null;
  estimatedAnnualTaxContribution?: number | null;
};

const ECONOMIC_DATA_NOTE =
  "Simplified / estimated data for the demo. Use this section to understand broad patterns, not as a full budget or affordability record.";

const communityLevelMap: Record<string, CommunityLevelMap> = {
  "carson-city": {
    city: "carson-city-city",
    county: "carson-city-county",
    state: "nevada-state",
    federal: "united-states-federal",
  },
  "carson-city-county": {
    county: "carson-city-county",
    state: "nevada-state",
    federal: "united-states-federal",
  },
  reno: {
    city: "reno-city",
    county: "washoe-county",
    state: "nevada-state",
    federal: "united-states-federal",
  },
  "washoe-county": {
    county: "washoe-county",
    state: "nevada-state",
    federal: "united-states-federal",
  },
  "las-vegas": {
    city: "las-vegas-city",
    county: "clark-county",
    state: "nevada-state",
    federal: "united-states-federal",
  },
  "clark-county": {
    county: "clark-county",
    state: "nevada-state",
    federal: "united-states-federal",
  },
  nevada: {
    state: "nevada-state",
    federal: "united-states-federal",
  },
  "united-states": {
    federal: "united-states-federal",
  },
};

const taxIndicatorData: Record<string, TaxIndicatorSeed> = {
  "carson-city-city": {
    salesTaxRate: 8.38,
    propertyTaxRateEstimate: 0.59,
    estimatedAnnualTaxContribution: 4860,
  },
  "carson-city-county": {
    salesTaxRate: 8.38,
    propertyTaxRateEstimate: 0.61,
    estimatedAnnualTaxContribution: 5020,
  },
  "reno-city": {
    salesTaxRate: 8.27,
    propertyTaxRateEstimate: 0.66,
    estimatedAnnualTaxContribution: 5450,
  },
  "washoe-county": {
    salesTaxRate: 8.27,
    propertyTaxRateEstimate: 0.64,
    estimatedAnnualTaxContribution: 5260,
  },
  "las-vegas-city": {
    salesTaxRate: 8.38,
    propertyTaxRateEstimate: 0.67,
    estimatedAnnualTaxContribution: 4970,
  },
  "clark-county": {
    salesTaxRate: 8.38,
    propertyTaxRateEstimate: 0.65,
    estimatedAnnualTaxContribution: 4820,
  },
  "nevada-state": {
    salesTaxRate: 8.24,
    propertyTaxRateEstimate: 0.56,
    estimatedAnnualTaxContribution: 4780,
  },
  "united-states-federal": {
    salesTaxRate: 0,
    propertyTaxRateEstimate: null,
    estimatedAnnualTaxContribution: 11300,
  },
};

const economicsData: Record<string, EconomicSeed> = {
  "carson-city-city": {
    id: "carson-city-city",
    communityId: "carson-city",
    level: "city",
    levelLabel: "City",
    geographyLabel: "Carson City",
    dataNote: ECONOMIC_DATA_NOTE,
    costOfLivingIndex: 103,
    medianHomePrice: 498000,
    medianRent: 1710,
    averageIncome: 68200,
    costBreakdown: [
      { label: "Housing", index: 116, relatedIssue: "Housing affordability", relatedOfficialId: "profile_elena_ramirez" },
      { label: "Food", index: 101, relatedIssue: "Taxes / cost of living", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Transportation", index: 96, relatedIssue: "Infrastructure", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Utilities", index: 99, relatedIssue: "Infrastructure", relatedOfficialId: "profile_elena_ramirez" },
    ],
    revenueBreakdown: [
      { label: "Sales tax", percentage: 29, relatedIssue: "Economic development", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Property tax", percentage: 24, relatedIssue: "Housing affordability", relatedOfficialId: "profile_elena_ramirez" },
      { label: "Fees & permits", percentage: 11, relatedIssue: "Government transparency", relatedOfficialId: "profile_elena_ramirez" },
      { label: "Federal funding", percentage: 27, relatedIssue: "Education funding", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Other", percentage: 9, relatedIssue: "Government transparency" },
    ],
    spendingBreakdown: [
      { label: "Education", percentage: 24, relatedIssue: "Education funding", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Infrastructure", percentage: 18, relatedIssue: "Infrastructure", relatedOfficialId: "profile_elena_ramirez" },
      { label: "Public safety", percentage: 22, relatedIssue: "Public safety", relatedOfficialId: "profile_elena_ramirez" },
      { label: "Healthcare", percentage: 8, relatedIssue: "Healthcare access", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Administration", percentage: 12, relatedIssue: "Government transparency" },
      { label: "Other", percentage: 16, relatedIssue: "Economic development" },
    ],
  },
  "carson-city-county": {
    id: "carson-city-county",
    communityId: "carson-city",
    level: "county",
    levelLabel: "County",
    geographyLabel: "Carson City (county-equivalent)",
    dataNote: ECONOMIC_DATA_NOTE,
    costOfLivingIndex: 104,
    medianHomePrice: 505000,
    medianRent: 1735,
    averageIncome: 69500,
    costBreakdown: [
      { label: "Housing", index: 118, relatedIssue: "Housing affordability", relatedOfficialId: "profile_elena_ramirez" },
      { label: "Food", index: 101, relatedIssue: "Taxes / cost of living" },
      { label: "Transportation", index: 95, relatedIssue: "Infrastructure", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Utilities", index: 100, relatedIssue: "Infrastructure" },
    ],
    revenueBreakdown: [
      { label: "Sales tax", percentage: 26, relatedIssue: "Economic development" },
      { label: "Property tax", percentage: 28, relatedIssue: "Housing affordability", relatedOfficialId: "profile_elena_ramirez" },
      { label: "Fees & permits", percentage: 10, relatedIssue: "Government transparency" },
      { label: "Federal funding", percentage: 25, relatedIssue: "Education funding" },
      { label: "Other", percentage: 11, relatedIssue: "Government transparency" },
    ],
    spendingBreakdown: [
      { label: "Education", percentage: 22, relatedIssue: "Education funding" },
      { label: "Infrastructure", percentage: 17, relatedIssue: "Infrastructure" },
      { label: "Public safety", percentage: 24, relatedIssue: "Public safety" },
      { label: "Healthcare", percentage: 9, relatedIssue: "Healthcare access" },
      { label: "Administration", percentage: 12, relatedIssue: "Government transparency" },
      { label: "Other", percentage: 16, relatedIssue: "Economic development" },
    ],
  },
  "reno-city": {
    id: "reno-city",
    communityId: "reno",
    level: "city",
    levelLabel: "City",
    geographyLabel: "Reno",
    dataNote: ECONOMIC_DATA_NOTE,
    costOfLivingIndex: 108,
    medianHomePrice: 579000,
    medianRent: 1890,
    averageIncome: 72400,
    costBreakdown: [
      { label: "Housing", index: 124, relatedIssue: "Housing affordability" },
      { label: "Food", index: 103, relatedIssue: "Taxes / cost of living" },
      { label: "Transportation", index: 98, relatedIssue: "Infrastructure" },
      { label: "Utilities", index: 101, relatedIssue: "Infrastructure" },
    ],
    revenueBreakdown: [
      { label: "Sales tax", percentage: 31, relatedIssue: "Economic development" },
      { label: "Property tax", percentage: 20, relatedIssue: "Housing affordability" },
      { label: "Fees & permits", percentage: 12, relatedIssue: "Government transparency" },
      { label: "Federal funding", percentage: 26, relatedIssue: "Education funding" },
      { label: "Other", percentage: 11, relatedIssue: "Government transparency" },
    ],
    spendingBreakdown: [
      { label: "Education", percentage: 23, relatedIssue: "Education funding" },
      { label: "Infrastructure", percentage: 19, relatedIssue: "Infrastructure" },
      { label: "Public safety", percentage: 20, relatedIssue: "Public safety" },
      { label: "Healthcare", percentage: 7, relatedIssue: "Healthcare access" },
      { label: "Administration", percentage: 11, relatedIssue: "Government transparency" },
      { label: "Other", percentage: 20, relatedIssue: "Economic development" },
    ],
  },
  "washoe-county": {
    id: "washoe-county",
    communityId: "reno",
    level: "county",
    levelLabel: "County",
    geographyLabel: "Washoe County",
    dataNote: ECONOMIC_DATA_NOTE,
    costOfLivingIndex: 107,
    medianHomePrice: 562000,
    medianRent: 1810,
    averageIncome: 70300,
    costBreakdown: [
      { label: "Housing", index: 121, relatedIssue: "Housing affordability" },
      { label: "Food", index: 102, relatedIssue: "Taxes / cost of living" },
      { label: "Transportation", index: 97, relatedIssue: "Infrastructure" },
      { label: "Utilities", index: 100, relatedIssue: "Infrastructure" },
    ],
    revenueBreakdown: [
      { label: "Sales tax", percentage: 28, relatedIssue: "Economic development" },
      { label: "Property tax", percentage: 24, relatedIssue: "Housing affordability" },
      { label: "Fees & permits", percentage: 11, relatedIssue: "Government transparency" },
      { label: "Federal funding", percentage: 25, relatedIssue: "Education funding" },
      { label: "Other", percentage: 12, relatedIssue: "Government transparency" },
    ],
    spendingBreakdown: [
      { label: "Education", percentage: 25, relatedIssue: "Education funding" },
      { label: "Infrastructure", percentage: 18, relatedIssue: "Infrastructure" },
      { label: "Public safety", percentage: 21, relatedIssue: "Public safety" },
      { label: "Healthcare", percentage: 8, relatedIssue: "Healthcare access" },
      { label: "Administration", percentage: 11, relatedIssue: "Government transparency" },
      { label: "Other", percentage: 17, relatedIssue: "Economic development" },
    ],
  },
  "las-vegas-city": {
    id: "las-vegas-city",
    communityId: "las-vegas",
    level: "city",
    levelLabel: "City",
    geographyLabel: "Las Vegas",
    dataNote: ECONOMIC_DATA_NOTE,
    costOfLivingIndex: 106,
    medianHomePrice: 452000,
    medianRent: 1680,
    averageIncome: 64800,
    costBreakdown: [
      { label: "Housing", index: 119, relatedIssue: "Housing affordability" },
      { label: "Food", index: 102, relatedIssue: "Taxes / cost of living" },
      { label: "Transportation", index: 99, relatedIssue: "Infrastructure" },
      { label: "Utilities", index: 104, relatedIssue: "Infrastructure" },
    ],
    revenueBreakdown: [
      { label: "Sales tax", percentage: 33, relatedIssue: "Economic development" },
      { label: "Property tax", percentage: 18, relatedIssue: "Housing affordability" },
      { label: "Fees & permits", percentage: 13, relatedIssue: "Government transparency" },
      { label: "Federal funding", percentage: 24, relatedIssue: "Education funding" },
      { label: "Other", percentage: 12, relatedIssue: "Government transparency" },
    ],
    spendingBreakdown: [
      { label: "Education", percentage: 21, relatedIssue: "Education funding" },
      { label: "Infrastructure", percentage: 17, relatedIssue: "Infrastructure" },
      { label: "Public safety", percentage: 24, relatedIssue: "Public safety" },
      { label: "Healthcare", percentage: 8, relatedIssue: "Healthcare access" },
      { label: "Administration", percentage: 12, relatedIssue: "Government transparency" },
      { label: "Other", percentage: 18, relatedIssue: "Economic development" },
    ],
  },
  "clark-county": {
    id: "clark-county",
    communityId: "las-vegas",
    level: "county",
    levelLabel: "County",
    geographyLabel: "Clark County",
    dataNote: ECONOMIC_DATA_NOTE,
    costOfLivingIndex: 104,
    medianHomePrice: 438000,
    medianRent: 1610,
    averageIncome: 62600,
    costBreakdown: [
      { label: "Housing", index: 115, relatedIssue: "Housing affordability" },
      { label: "Food", index: 101, relatedIssue: "Taxes / cost of living" },
      { label: "Transportation", index: 98, relatedIssue: "Infrastructure" },
      { label: "Utilities", index: 103, relatedIssue: "Infrastructure" },
    ],
    revenueBreakdown: [
      { label: "Sales tax", percentage: 31, relatedIssue: "Economic development" },
      { label: "Property tax", percentage: 21, relatedIssue: "Housing affordability" },
      { label: "Fees & permits", percentage: 12, relatedIssue: "Government transparency" },
      { label: "Federal funding", percentage: 24, relatedIssue: "Education funding" },
      { label: "Other", percentage: 12, relatedIssue: "Government transparency" },
    ],
    spendingBreakdown: [
      { label: "Education", percentage: 22, relatedIssue: "Education funding" },
      { label: "Infrastructure", percentage: 17, relatedIssue: "Infrastructure" },
      { label: "Public safety", percentage: 23, relatedIssue: "Public safety" },
      { label: "Healthcare", percentage: 8, relatedIssue: "Healthcare access" },
      { label: "Administration", percentage: 11, relatedIssue: "Government transparency" },
      { label: "Other", percentage: 19, relatedIssue: "Economic development" },
    ],
  },
  "nevada-state": {
    id: "nevada-state",
    communityId: "nevada",
    level: "state",
    levelLabel: "State",
    geographyLabel: "Nevada",
    dataNote: ECONOMIC_DATA_NOTE,
    costOfLivingIndex: 105,
    medianHomePrice: 460000,
    medianRent: 1660,
    averageIncome: 67600,
    costBreakdown: [
      { label: "Housing", index: 117, relatedIssue: "Housing affordability", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Food", index: 101, relatedIssue: "Taxes / cost of living", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Transportation", index: 98, relatedIssue: "Infrastructure", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Utilities", index: 101, relatedIssue: "Infrastructure" },
    ],
    revenueBreakdown: [
      { label: "Income tax", percentage: 0, relatedIssue: "Taxes / cost of living", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Sales tax", percentage: 37, relatedIssue: "Taxes / cost of living", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Property tax", percentage: 14, relatedIssue: "Housing affordability" },
      { label: "Fees & permits", percentage: 8, relatedIssue: "Government transparency" },
      { label: "Federal funding", percentage: 31, relatedIssue: "Education funding", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Other", percentage: 10, relatedIssue: "Government transparency" },
    ],
    spendingBreakdown: [
      { label: "Education", percentage: 28, relatedIssue: "Education funding", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Infrastructure", percentage: 14, relatedIssue: "Infrastructure", relatedOfficialId: "profile_jonathan_bennett" },
      { label: "Public safety", percentage: 16, relatedIssue: "Public safety" },
      { label: "Healthcare", percentage: 17, relatedIssue: "Healthcare access" },
      { label: "Administration", percentage: 9, relatedIssue: "Government transparency" },
      { label: "Other", percentage: 16, relatedIssue: "Economic development" },
    ],
  },
  "united-states-federal": {
    id: "united-states-federal",
    communityId: "united-states",
    level: "federal",
    levelLabel: "Federal",
    geographyLabel: "United States",
    dataNote: ECONOMIC_DATA_NOTE,
    costOfLivingIndex: 100,
    medianHomePrice: 420000,
    medianRent: 1550,
    averageIncome: 70100,
    costBreakdown: [
      { label: "Housing", index: 100, relatedIssue: "Housing affordability" },
      { label: "Food", index: 100, relatedIssue: "Taxes / cost of living" },
      { label: "Transportation", index: 100, relatedIssue: "Infrastructure" },
      { label: "Utilities", index: 100, relatedIssue: "Infrastructure" },
    ],
    revenueBreakdown: [
      { label: "Income tax", percentage: 48, relatedIssue: "Taxes / cost of living" },
      { label: "Sales tax", percentage: 0, relatedIssue: "Taxes / cost of living" },
      { label: "Property tax", percentage: 0, relatedIssue: "Housing affordability" },
      { label: "Fees & permits", percentage: 6, relatedIssue: "Government transparency" },
      { label: "Other", percentage: 46, relatedIssue: "Economic development" },
    ],
    spendingBreakdown: [
      { label: "Education", percentage: 8, relatedIssue: "Education funding" },
      { label: "Infrastructure", percentage: 7, relatedIssue: "Infrastructure" },
      { label: "Public safety", percentage: 14, relatedIssue: "Public safety" },
      { label: "Healthcare", percentage: 27, relatedIssue: "Healthcare access" },
      { label: "Administration", percentage: 8, relatedIssue: "Government transparency" },
      { label: "Other", percentage: 36, relatedIssue: "Economic development" },
    ],
  },
};

function withTaxIndicators(summary: CommunityEconomicsSummary): CommunityEconomicsSummary {
  const taxIndicators = taxIndicatorData[summary.id];

  if (!taxIndicators) {
    return summary;
  }

  return {
    ...summary,
    salesTaxRate: taxIndicators.salesTaxRate ?? null,
    propertyTaxRateEstimate: taxIndicators.propertyTaxRateEstimate ?? null,
    estimatedAnnualTaxContribution: taxIndicators.estimatedAnnualTaxContribution ?? null,
  };
}

export function getCommunityEconomicsLevelOptions(communityId: string) {
  const mapping = communityLevelMap[communityId] ?? communityLevelMap["carson-city"];

  return (["city", "county", "state", "federal"] as CommunityDataLevel[])
    .filter((level) => Boolean(mapping[level]))
    .map((level) => ({
      level,
      label:
        level === "city"
          ? "City"
          : level === "county"
            ? "County"
            : level === "state"
              ? "State"
              : "Federal",
    }));
}

export function getCommunityEconomics(communityId: string, level?: CommunityDataLevel) {
  const mapping = communityLevelMap[communityId] ?? communityLevelMap["carson-city"];
  const availableLevels = getCommunityEconomicsLevelOptions(communityId);
  const selectedLevel = level && mapping[level] ? level : availableLevels[0]?.level ?? "city";
  const selectedId = mapping[selectedLevel] ?? communityLevelMap["carson-city"].city ?? "carson-city-city";
  const selected = withTaxIndicators(economicsData[selectedId]);
  const comparison = availableLevels
    .map((entry) => {
      const economicId = mapping[entry.level];
      return economicId ? withTaxIndicators(economicsData[economicId]) : null;
    })
    .filter((entry): entry is CommunityEconomicsSummary => Boolean(entry));
  const community = getCommunityById(communityId);

  return {
    community: community ?? getCommunityById("carson-city"),
    selectedLevel,
    selected,
    comparison,
    availableLevels,
  };
}
