import donorClassificationOverridesConfig from "@/data/source-seeds/nv-sos-donor-classification-overrides.json";
import type { NvSosCampaignFinanceRecord, NvSosFetchLogEntry } from "@/lib/nv-sos/pipeline";

export type CampaignFinanceClassificationSource =
  | "Manual Admin Override"
  | "Known Entity Match"
  | "Historical Classification Inheritance"
  | "Keyword Match"
  | "Pattern Match"
  | "Not enough signal";

export type DonorEntityType =
  | "Individual"
  | "Corporation"
  | "LLC"
  | "Partnership"
  | "PAC"
  | "Super PAC"
  | "Political Committee"
  | "Trade Association"
  | "Labor Union"
  | "Nonprofit"
  | "Government Entity"
  | "Tribal Entity"
  | "Candidate Committee"
  | "Trust"
  | "Unknown";

export type DonorIndustry =
  | "Gaming / Casinos"
  | "Mining"
  | "Energy / Utilities"
  | "Real Estate Development"
  | "Construction"
  | "Finance / Banking"
  | "Insurance"
  | "Healthcare"
  | "Pharmaceuticals"
  | "Technology"
  | "Telecommunications"
  | "Transportation"
  | "Hospitality"
  | "Tourism"
  | "Legal Services"
  | "Education"
  | "Labor"
  | "Agriculture"
  | "Manufacturing"
  | "Government Contractors"
  | "Retail"
  | "Media"
  | "Environmental"
  | "Public Sector"
  | "Political Organizations"
  | "Other";

export type DonorClassificationRecord = {
  id: string;
  originalName: string;
  normalizedName: string;
  normalizedKey: string;
  address: string | null;
  ein: string | null;
  website: string | null;
  entityType: DonorEntityType;
  entityTypeConfidenceScore: number;
  entityTypeReason: string;
  industry: DonorIndustry;
  industryConfidenceScore: number;
  industryReason: string;
  classificationSource: CampaignFinanceClassificationSource;
  confidenceScore: number;
  classificationReason: string;
  sourceUrls: string[];
  rowCount: number;
  adjustmentRowCount: number;
  contributionAmount: number;
  excludedAdjustmentAmount: number;
};

export type CampaignFinanceOrganizationRow = CampaignFinanceCategoryRow & {
  entityType: DonorEntityType;
  industry: DonorIndustry;
  confidenceScore: number;
  classificationSource: CampaignFinanceClassificationSource;
};

export type CampaignFinanceFundingSplit = {
  individualAmount: number;
  organizationalAmount: number;
  unknownAmount: number;
  totalAmount: number;
  individualPercentage: number;
  organizationalPercentage: number;
  unknownPercentage: number;
};

export type CampaignFinanceRaceComparison = {
  office: string | null;
  candidates: Array<{
    candidateName: string;
    totalContributions: number | null;
    totalExpenses: number | null;
    reportCount: number;
    percentageOfRaceFunding: number;
    sourceUrl: string | null;
    isCurrentProfile: boolean;
  }>;
};

export type CampaignFinanceCategoryRow = {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  count: number;
  note: string | null;
  date: string | null;
  sourceUrl: string | null;
  reportLabel: string | null;
};

export type CampaignFinanceEntityRow = CampaignFinanceCategoryRow;

export type CampaignFinanceReviewIssue =
  | "missing_name"
  | "ambiguous_type"
  | "excluded_adjustment"
  | "low_confidence";

export type CampaignFinanceReviewRow = {
  id: string;
  issue: CampaignFinanceReviewIssue;
  rowKind: "contribution" | "expenditure";
  originalName: string | null;
  displayName: string;
  normalizedName: string | null;
  amount: number | null;
  date: string | null;
  sourceUrl: string;
  cachedPath: string | null;
  reportLabel: string | null;
  reportYear: number | null;
  status: string;
  confidenceScore: number | null;
  reason: string;
};

export type CampaignFinanceReviewQueues = {
  missingNameRows: CampaignFinanceReviewRow[];
  ambiguousRows: CampaignFinanceReviewRow[];
  excludedAdjustmentRows: CampaignFinanceReviewRow[];
  lowConfidenceRows: CampaignFinanceReviewRow[];
};

export type CampaignFinanceRawRow = {
  id: string;
  originalName: string;
  normalizedName: string;
  normalizedKey: string;
  address: string | null;
  ein: string | null;
  website: string | null;
  displayName: string;
  amount: number;
  date: string | null;
  sourceUrl: string;
  cachedPath: string | null;
  reportLabel: string | null;
  reportYear: number | null;
  fundingCategory: string;
  sizeCategory: string;
  sector: string;
  industry: DonorIndustry;
  entityType: DonorEntityType;
  entityTypeConfidenceScore: number;
  entityTypeReason: string;
  industryConfidenceScore: number;
  industryReason: string;
  classificationSource: CampaignFinanceClassificationSource;
  confidenceScore: number;
  spendingCategory: string | null;
  isAdjustment: boolean;
  isBoilerplate: boolean;
  isOrganization: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type CampaignFinanceValidationSummary = {
  officialTotalContributionsParsed: number | null;
  itemizedContributionRowsParsed: number;
  itemizedExpenseRowsParsed: number;
  itemizedContributionAmountParsed: number;
  itemizedExpenseAmountParsed: number;
  itemizedContributionAmountCategorized: number;
  excludedRefundOrAdjustmentRows: number;
  excludedRefundOrAdjustmentAmount: number;
  rawContributorRowCountPreserved: number;
  rawPayeeRowCountPreserved: number;
  needsReviewRowCount: number;
  topContributionCategories: Array<{ name: string; amount: number; count: number }>;
  donorClassificationCount: number;
  highConfidenceClassificationCount: number;
  mediumConfidenceClassificationCount: number;
  lowConfidenceClassificationCount: number;
  incomingFundingRowsUsedForCharts: number;
};

export type CampaignFinanceDataStatus = {
  hasCleanItemizedContributions: boolean;
  hasRefundHeavyData: boolean;
  hasAggregateTotals: boolean;
  contributionRowsCount: number;
  excludedRefundAdjustmentRowsCount: number;
  rawRowsCount: number;
  confidenceLevel: "high" | "medium" | "low";
  voterFacingMode: "full_breakdown" | "limited_breakdown" | "aggregate_only" | "source_documents_only";
};

export type CampaignFinanceTimePoint = {
  key: string;
  label: string;
  reportLabel: string | null;
  reportPeriod: string | null;
  reportYear: number | null;
  raised: number | null;
  spent: number | null;
  cumulativeRaised: number;
  cumulativeSpent: number;
  sourceUrl: string;
};

export type CampaignFinanceSourceReport = {
  label: string;
  filingDate: string | null;
  period: string | null;
  year: number | null;
  sourceUrl: string;
  cachedPath: string | null;
  totalContributions: number | null;
  totalExpenses: number | null;
  cashOnHand: number | null;
  contributionRowCount: number;
  expenditureRowCount: number;
  excludedAdjustmentRowCount: number;
  parseConfidence: number;
  parserStatus: "parsed" | "needs_review" | "low_confidence";
};

export type NvSosProfileFinanceSummary = {
  reportCount: number;
  totalContributions: number | null;
  totalContributionsSourceUrl: string | null;
  totalExpenses: number | null;
  totalExpensesSourceUrl: string | null;
  netTotal: number | null;
  netTotalSourceUrl: string | null;
  cashOnHand: number | null;
  cashOnHandSourceUrl: string | null;
  latestReportLabel: string | null;
  latestReportPeriod: string | null;
  latestReportYear: number | null;
  latestReportUrl: string | null;
  lastFetchedAt: string | null;
  recordsWithTotals: number;
  topContributors: CampaignFinanceEntityRow[];
  topPayees: CampaignFinanceEntityRow[];
};

export type CampaignFinanceDashboard = {
  summary: NvSosProfileFinanceSummary;
  dataStatus: CampaignFinanceDataStatus;
  timeSeries: CampaignFinanceTimePoint[];
  accountingBreakdown: CampaignFinanceCategoryRow[];
  contributionBreakdown: CampaignFinanceCategoryRow[];
  fundingSourceBreakdown: CampaignFinanceCategoryRow[];
  donorSizeBreakdown: CampaignFinanceCategoryRow[];
  industrySectorBreakdown: CampaignFinanceCategoryRow[];
  donorTypeBreakdown: CampaignFinanceCategoryRow[];
  expenseBreakdown: CampaignFinanceCategoryRow[];
  spendingCategoryBreakdown: CampaignFinanceCategoryRow[];
  adjustmentBreakdown: CampaignFinanceCategoryRow[];
  topOrganizations: CampaignFinanceOrganizationRow[];
  topContributors: CampaignFinanceRawRow[];
  topPayees: CampaignFinanceRawRow[];
  rawContributorRows: CampaignFinanceRawRow[];
  rawPayeeRows: CampaignFinanceRawRow[];
  rawAdjustmentRows: CampaignFinanceRawRow[];
  reviewQueues: CampaignFinanceReviewQueues;
  donorClassifications: DonorClassificationRecord[];
  individualVsOrganizational: CampaignFinanceFundingSplit;
  raceComparison: CampaignFinanceRaceComparison | null;
  voterInsights: string[];
  sourceReports: CampaignFinanceSourceReport[];
  validation: CampaignFinanceValidationSummary;
  itemizationStatus: {
    hasContributorRows: boolean;
    hasExpenseRows: boolean;
    hasCategorizedContributions: boolean;
    hasSpendingCategories: boolean;
    contributorNote: string | null;
    expenseNote: string | null;
  };
};

type Classification = {
  fundingCategory: string;
  sizeCategory: string;
  sector: string;
  spendingCategory: string | null;
  isAdjustment: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
  donorClassification: DonorClassification;
};

const FUNDING_CATEGORIES = {
  small: "Small-dollar grassroots",
  medium: "Medium individual",
  large: "Large individual/private donors",
  pac: "PACs / political committees",
  business: "Business / corporate interests",
  self: "Candidate self-funding",
  sector: "Special interest / industry sectors",
  other: "Other / uncategorized",
  adjustment: "Refunds / reimbursements / adjustments",
} as const;

const SPENDING_CATEGORIES = {
  advertising: "Advertising / media",
  consultants: "Consultants",
  payroll: "Payroll",
  fundraising: "Fundraising",
  legal: "Legal",
  travel: "Travel",
  operations: "Office / operations",
  adjustment: "Refunds / reimbursements / adjustments",
  other: "Other",
} as const;

const ACCOUNTING_CATEGORIES = {
  receipts: "Contributions / receipts",
  expenditures: "Expenditures",
  refunds: "Refunds / reimbursements",
  loans: "Loans / self-funding",
  transfers: "Transfers",
  otherAdjustments: "Other adjustments",
} as const;

const INDUSTRY_CATEGORIES = {
  gaming: "Gaming / Casinos",
  mining: "Mining",
  energy: "Energy / Utilities",
  realEstate: "Real Estate Development",
  construction: "Construction",
  finance: "Finance / Banking",
  insurance: "Insurance",
  healthcare: "Healthcare",
  pharmaceuticals: "Pharmaceuticals",
  technology: "Technology",
  telecommunications: "Telecommunications",
  transportation: "Transportation",
  hospitality: "Hospitality",
  tourism: "Tourism",
  labor: "Labor",
  legal: "Legal Services",
  education: "Education",
  agriculture: "Agriculture",
  manufacturing: "Manufacturing",
  governmentContractors: "Government Contractors",
  retail: "Retail",
  media: "Media",
  environmental: "Environmental",
  publicSector: "Public Sector",
  politicalOrganizations: "Political Organizations",
  other: "Other",
} as const satisfies Record<string, DonorIndustry>;

const SECTOR_CATEGORIES = INDUSTRY_CATEGORIES;

type DonorClassificationSeed = {
  aliases: string[];
  entityType: DonorEntityType;
  industry: DonorIndustry;
  confidenceScore: number;
  reason: string;
  website?: string | null;
  ein?: string | null;
  source?: CampaignFinanceClassificationSource;
};

type DonorClassificationOverride = {
  original_name?: string;
  normalized_name: string;
  entity_type?: DonorEntityType;
  industry?: DonorIndustry;
  confidence_score?: number;
  reason?: string;
  website?: string | null;
  ein?: string | null;
};

type DonorClassificationOverrideConfig = {
  overrides?: DonorClassificationOverride[];
};

type DonorClassification = {
  originalName: string;
  normalizedName: string;
  normalizedKey: string;
  address: string | null;
  ein: string | null;
  website: string | null;
  entityType: DonorEntityType;
  entityTypeConfidenceScore: number;
  entityTypeReason: string;
  industry: DonorIndustry;
  industryConfidenceScore: number;
  industryReason: string;
  classificationSource: CampaignFinanceClassificationSource;
  confidenceScore: number;
  classificationReason: string;
};

const KNOWN_DONOR_CLASSIFICATIONS: DonorClassificationSeed[] = [
  {
    aliases: ["caesars enterprise services", "caesars entertainment", "caesars"],
    entityType: "LLC",
    industry: "Gaming / Casinos",
    confidenceScore: 99,
    reason: "Known Nevada gaming and casino enterprise.",
  },
  {
    aliases: ["mgm resorts international", "mgm resorts", "mgm"],
    entityType: "Corporation",
    industry: "Gaming / Casinos",
    confidenceScore: 99,
    reason: "Known Nevada resort and casino operator.",
  },
  {
    aliases: ["nv energy", "nevada power", "sierra pacific power"],
    entityType: "Corporation",
    industry: "Energy / Utilities",
    confidenceScore: 99,
    reason: "Known Nevada electric utility.",
  },
  {
    aliases: ["barrick gold", "nevada gold mines"],
    entityType: "Corporation",
    industry: "Mining",
    confidenceScore: 98,
    reason: "Known mining company.",
  },
  {
    aliases: ["at t", "att", "at and t"],
    entityType: "Corporation",
    industry: "Telecommunications",
    confidenceScore: 98,
    reason: "Known telecommunications company.",
  },
  {
    aliases: ["nevada state education association", "nsea"],
    entityType: "Labor Union",
    industry: "Labor",
    confidenceScore: 98,
    reason: "Known education labor organization.",
  },
  {
    aliases: ["ford country valley auto mall"],
    entityType: "Corporation",
    industry: "Retail",
    confidenceScore: 94,
    reason: "Known/explicit auto dealer business name.",
  },
  {
    aliases: ["area 15 las vegas"],
    entityType: "LLC",
    industry: "Hospitality",
    confidenceScore: 92,
    reason: "Known entertainment and hospitality venue.",
  },
  {
    aliases: ["molina healthcare"],
    entityType: "Corporation",
    industry: "Healthcare",
    confidenceScore: 95,
    reason: "Known healthcare company.",
  },
  {
    aliases: ["martin harris construction", "gillett construction", "general design construction", "q d construction", "miller construction supply", "metcalf builders"],
    entityType: "LLC",
    industry: "Construction",
    confidenceScore: 88,
    reason: "Known/explicit construction or building business name.",
  },
  {
    aliases: ["sunshine minting"],
    entityType: "Corporation",
    industry: "Manufacturing",
    confidenceScore: 88,
    reason: "Known/explicit manufacturing business name.",
  },
  {
    aliases: ["american airlines"],
    entityType: "Corporation",
    industry: "Transportation",
    confidenceScore: 98,
    reason: "Known airline.",
  },
  {
    aliases: ["lamar companies", "lamar advertising"],
    entityType: "Corporation",
    industry: "Media",
    confidenceScore: 92,
    reason: "Known advertising and outdoor media company.",
  },
  {
    aliases: ["office depot"],
    entityType: "Corporation",
    industry: "Retail",
    confidenceScore: 94,
    reason: "Known office-supply retailer.",
  },
  {
    aliases: ["centurion insurance services"],
    entityType: "Corporation",
    industry: "Insurance",
    confidenceScore: 90,
    reason: "Explicit insurance business name.",
  },
  {
    aliases: ["muslusky law", "the firm a professional law", "steve dimopoulos law firm", "the law offices of christian m morris", "the vegas lawyers"],
    entityType: "Corporation",
    industry: "Legal Services",
    confidenceScore: 88,
    reason: "Known/explicit legal services business name.",
  },
];

const DONOR_OVERRIDES = (donorClassificationOverridesConfig as DonorClassificationOverrideConfig).overrides ?? [];

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseName(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((token) => {
      if (token.length <= 2) return token.toUpperCase();
      return `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function normalizeDonorKey(value: string | null | undefined) {
  return normalizeName(value)
    .replace(/\b(limited liability company|incorporated|corporation|company)\b/g, (match) => {
      if (match === "limited liability company") return "llc";
      if (match === "incorporated") return "inc";
      if (match === "corporation") return "corp";
      return "co";
    })
    .replace(/\b(llc|inc|corp|co|ltd|lp|llp|pc|pllc)\b/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDonorName(value: string | null | undefined) {
  const key = normalizeDonorKey(cleanEntityName(value ?? ""));
  return key ? titleCaseName(key) : "Unknown";
}

function confidenceLabel(score: number): "high" | "medium" | "low" {
  if (score >= 85) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function clampConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function extractAddress(value: string) {
  const match = value.match(/\b(?:refund(?:ed)?(?:\s+of)?|returned contribution|reimbursement(?:\s+of)?|court ordered reimbursement(?:\s+of)?(?:\s+legal\s+s)?)\b\s+(.+)$/i);
  const rawAddress = match?.[1]?.trim() ?? null;
  if (!rawAddress) return null;
  const cleaned = rawAddress.replace(/\s+\bO\b\s*$/i, "").replace(/\s+/g, " ").trim();
  if (!/^(?:c\/o|po box|\d{1,6}\b)/i.test(cleaned)) return null;
  return cleaned;
}

function extractEin(value: string) {
  return value.match(/\bEIN[#:\s-]*([0-9-]{7,})\b/i)?.[1] ?? null;
}

function normalizedOverrideKey(value: string) {
  return normalizeDonorKey(value);
}

function findManualOverride(normalizedKey: string, originalName: string) {
  const originalKey = normalizeDonorKey(cleanEntityName(originalName));
  return DONOR_OVERRIDES.find((override) => {
    const overrideKey = normalizedOverrideKey(override.normalized_name);
    const overrideOriginalKey = override.original_name ? normalizedOverrideKey(override.original_name) : null;
    return overrideKey === normalizedKey || overrideKey === originalKey || overrideOriginalKey === originalKey;
  });
}

function findKnownDonor(normalizedKey: string) {
  return KNOWN_DONOR_CLASSIFICATIONS.find((seed) =>
    seed.aliases.some((alias) => {
      const aliasKey = normalizeDonorKey(alias);
      return aliasKey === normalizedKey || (aliasKey.length > 3 && normalizedKey.includes(aliasKey)) || (normalizedKey.length > 3 && aliasKey.includes(normalizedKey));
    }),
  );
}

function detectEntityType(value: string, candidateName: string | null | undefined): Pick<DonorClassification, "entityType" | "entityTypeConfidenceScore" | "entityTypeReason" | "classificationSource"> {
  const normalized = normalizeName(value);
  const tokens = normalized.split(" ").filter(Boolean);

  if (!normalized) {
    return {
      entityType: "Unknown",
      entityTypeConfidenceScore: 0,
      entityTypeReason: "No donor or payee name was parsed.",
      classificationSource: "Not enough signal",
    };
  }

  if (candidateName && namesMatch(value, candidateName)) {
    return {
      entityType: "Individual",
      entityTypeConfidenceScore: 95,
      entityTypeReason: "Name matches the candidate; classified as individual self-funding unless a filing-specific override says otherwise.",
      classificationSource: "Pattern Match",
    };
  }

  if (includesAny(normalized, ["super pac"])) {
    return { entityType: "Super PAC", entityTypeConfidenceScore: 98, entityTypeReason: "Name explicitly contains Super PAC.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, [" pac", "political action", "fec id"])) {
    return { entityType: "PAC", entityTypeConfidenceScore: 94, entityTypeReason: "Name contains PAC, political action, or FEC committee language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["friends of", "committee to elect", "for governor", "for congress", "for assembly", "for senate", "candidate committee"])) {
    return { entityType: "Candidate Committee", entityTypeConfidenceScore: 92, entityTypeReason: "Name resembles a candidate committee.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["committee", "party", "caucus", "democratic", "republican", "libertarian"])) {
    return { entityType: "Political Committee", entityTypeConfidenceScore: 86, entityTypeReason: "Name contains committee, party, or caucus language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["union", "labor", "afl cio", "workers", "firefighters association", "police protective", "education association", "teachers association"])) {
    return { entityType: "Labor Union", entityTypeConfidenceScore: 90, entityTypeReason: "Name contains labor union or collective-representation language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["chamber of commerce", "trade association", "association of", "realtors association", "builders association"])) {
    return { entityType: "Trade Association", entityTypeConfidenceScore: 86, entityTypeReason: "Name resembles a trade or industry association.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["tribe", "tribal", "pueblo", "paiute", "shoshone", "washoe"])) {
    return { entityType: "Tribal Entity", entityTypeConfidenceScore: 88, entityTypeReason: "Name contains tribal entity language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["city of", "county", "state of", "department", "office of", "school district", "university of nevada"])) {
    return { entityType: "Government Entity", entityTypeConfidenceScore: 86, entityTypeReason: "Name resembles a government or public-sector entity.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["foundation", "nonprofit", "non profit", "charity", "501 c"])) {
    return { entityType: "Nonprofit", entityTypeConfidenceScore: 82, entityTypeReason: "Name contains nonprofit or foundation language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, [" trust", "trustee"])) {
    return { entityType: "Trust", entityTypeConfidenceScore: 84, entityTypeReason: "Name contains trust language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["limited liability"]) || tokens.includes("llc")) {
    return { entityType: "LLC", entityTypeConfidenceScore: 96, entityTypeReason: "Name explicitly contains LLC or limited liability company language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["partners", "partnership"]) || tokens.includes("lp") || tokens.includes("llp")) {
    return { entityType: "Partnership", entityTypeConfidenceScore: 88, entityTypeReason: "Name contains partnership language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["law firm", "law offices", "lawyers"]) || normalized.split(" ").includes("law")) {
    return { entityType: "Corporation", entityTypeConfidenceScore: 78, entityTypeReason: "Name contains legal-practice business language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["corporation", "company"]) || tokens.some((token) => ["inc", "corp", "co", "pllc", "pc"].includes(token))) {
    return { entityType: "Corporation", entityTypeConfidenceScore: 90, entityTypeReason: "Name contains corporate entity language.", classificationSource: "Keyword Match" };
  }
  if (includesAny(normalized, ["holdings", "construction", "builders", "health", "rehab", "car wash", "auto mall", "insurance", "supply", "concepts", "investment", "capital", "properties", "signs", "printing", "banner"])) {
    return { entityType: "Corporation", entityTypeConfidenceScore: 72, entityTypeReason: "Name contains business descriptor language but no precise legal suffix.", classificationSource: "Keyword Match" };
  }

  const likelyPersonName = tokens.length >= 2 && tokens.length <= 4 && !includesAny(normalized, ["law", "capital", "holdings", "construction", "health", "insurance", "properties", "group", "services"]);
  if (likelyPersonName) {
    return { entityType: "Individual", entityTypeConfidenceScore: 72, entityTypeReason: "Name looks like a personal name and lacks business entity language.", classificationSource: "Pattern Match" };
  }

  return {
    entityType: "Unknown",
    entityTypeConfidenceScore: 35,
    entityTypeReason: "No reliable entity-type keyword or known entity match was found.",
    classificationSource: "Not enough signal",
  };
}

function inferIndustry(value: string, knownDonor?: DonorClassificationSeed | null): Pick<DonorClassification, "industry" | "industryConfidenceScore" | "industryReason" | "classificationSource"> {
  if (knownDonor) {
    return {
      industry: knownDonor.industry,
      industryConfidenceScore: knownDonor.confidenceScore,
      industryReason: knownDonor.reason,
      classificationSource: knownDonor.source ?? "Known Entity Match",
    };
  }

  const normalized = normalizeName(value);
  if (includesAny(normalized, ["casino", "gaming", "mgm", "caesars", "station casino", "boyd gaming"])) return { industry: INDUSTRY_CATEGORIES.gaming, industryConfidenceScore: 88, industryReason: "Name contains gaming or casino keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["mine", "mining", "gold", "silver", "barrick", "newmont", "mineral"])) return { industry: INDUSTRY_CATEGORIES.mining, industryConfidenceScore: 86, industryReason: "Name contains mining or mineral keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["energy", "solar", "electric", " power ", " oil ", " gas ", "utility", "utilities"])) return { industry: INDUSTRY_CATEGORIES.energy, industryConfidenceScore: 84, industryReason: "Name contains energy or utility keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["realty", "realtor", "real estate", "properties", "property", "development", "land", "apartment", "homes", "housing"])) return { industry: INDUSTRY_CATEGORIES.realEstate, industryConfidenceScore: 82, industryReason: "Name contains real estate or development keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["construction", "builder", "builders", "contractor", "paving", "concrete", "plumbing", "engineering", "design build", "construction supply"])) return { industry: INDUSTRY_CATEGORIES.construction, industryConfidenceScore: 86, industryReason: "Name contains construction, building, or contractor keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["bank", "capital", "investment", "financial", "finance", "holdings", "credit", "wealth"])) return { industry: INDUSTRY_CATEGORIES.finance, industryConfidenceScore: 78, industryReason: "Name contains finance, banking, holding, or investment keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["insurance", "insurer", "underwriter"])) return { industry: INDUSTRY_CATEGORIES.insurance, industryConfidenceScore: 86, industryReason: "Name contains insurance keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["health", "healthcare", "medical", "hospital", "rehab", "clinic", "physician", "dental", "molina"])) return { industry: INDUSTRY_CATEGORIES.healthcare, industryConfidenceScore: 84, industryReason: "Name contains healthcare or medical keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["pharma", "pharmaceutical", "rx ", "drug"])) return { industry: INDUSTRY_CATEGORIES.pharmaceuticals, industryConfidenceScore: 84, industryReason: "Name contains pharmaceutical keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["tech", "software", "data", "digital", "systems"])) return { industry: INDUSTRY_CATEGORIES.technology, industryConfidenceScore: 78, industryReason: "Name contains technology keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["telecom", "communications", "wireless", "broadband"])) return { industry: INDUSTRY_CATEGORIES.telecommunications, industryConfidenceScore: 82, industryReason: "Name contains telecommunications keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["airlines", "airline", "transport", "logistics", "trucking", "freight", "rail"])) return { industry: INDUSTRY_CATEGORIES.transportation, industryConfidenceScore: 84, industryReason: "Name contains transportation or logistics keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["resort", "hotel", "hospitality", "tavern", "bar ", "restaurant", "area 15", "entertainment"])) return { industry: INDUSTRY_CATEGORIES.hospitality, industryConfidenceScore: 78, industryReason: "Name contains hospitality or entertainment venue keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["tourism", "visitor", "convention authority"])) return { industry: INDUSTRY_CATEGORIES.tourism, industryConfidenceScore: 82, industryReason: "Name contains tourism keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["law firm", "legal", "attorney", "attorneys", "esq", "counsel", "firm a professional law", "law offices", "lawyers"]) || normalized.split(" ").includes("law")) return { industry: INDUSTRY_CATEGORIES.legal, industryConfidenceScore: 88, industryReason: "Name contains legal services keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["school", "education", "university", "college", "teachers"])) return { industry: INDUSTRY_CATEGORIES.education, industryConfidenceScore: 82, industryReason: "Name contains education keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["union", "labor", "afl cio", "workers", "firefighters association", "police protective"])) return { industry: INDUSTRY_CATEGORIES.labor, industryConfidenceScore: 86, industryReason: "Name contains labor organization keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["farm", "farms", "ranch", "agriculture", "cattle", "dairy"])) return { industry: INDUSTRY_CATEGORIES.agriculture, industryConfidenceScore: 82, industryReason: "Name contains agriculture keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["manufacturing", "minting", "factory", "industrial"])) return { industry: INDUSTRY_CATEGORIES.manufacturing, industryConfidenceScore: 78, industryReason: "Name contains manufacturing keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["defense", "aerospace", "government contractor", "federal contractor"])) return { industry: INDUSTRY_CATEGORIES.governmentContractors, industryConfidenceScore: 80, industryReason: "Name contains government-contractor keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["retail", "store", "auto mall", "car wash", "office depot", "supply"])) return { industry: INDUSTRY_CATEGORIES.retail, industryConfidenceScore: 76, industryReason: "Name contains retail or consumer-service keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["media", "advertising", "signs", "banner", "print", "newspaper", "broadcast", "lamar"])) return { industry: INDUSTRY_CATEGORIES.media, industryConfidenceScore: 82, industryReason: "Name contains media, print, signage, or advertising keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["environment", "conservation", "clean water", "climate"])) return { industry: INDUSTRY_CATEGORIES.environmental, industryConfidenceScore: 80, industryReason: "Name contains environmental keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, ["police", "sheriff", "fire", "public safety", "correction", "peace officers", "city of", "county", "state of", "department"])) return { industry: INDUSTRY_CATEGORIES.publicSector, industryConfidenceScore: 76, industryReason: "Name contains public-sector or public-safety keywords.", classificationSource: "Keyword Match" };
  if (includesAny(normalized, [" pac", "committee", "party", "caucus", "political action", "friends of"])) return { industry: INDUSTRY_CATEGORIES.politicalOrganizations, industryConfidenceScore: 82, industryReason: "Name contains political organization keywords.", classificationSource: "Keyword Match" };

  return {
    industry: INDUSTRY_CATEGORIES.other,
    industryConfidenceScore: 35,
    industryReason: "No reliable industry keyword or known donor match was found.",
    classificationSource: "Not enough signal",
  };
}

function classifyDonor(value: string, candidateName: string | null | undefined, historicalClassifications?: Map<string, DonorClassification>): DonorClassification {
  const cleanedName = cleanEntityName(value);
  const normalizedKey = normalizeDonorKey(cleanedName);
  const normalizedName = normalizedKey ? titleCaseName(normalizedKey) : "Unknown";
  const manualOverride = findManualOverride(normalizedKey, value);
  const knownDonor = findKnownDonor(normalizedKey);
  const entity = detectEntityType(cleanedName || value, candidateName);
  const industry = inferIndustry(cleanedName || value, knownDonor);
  const address = extractAddress(value);
  const ein = manualOverride?.ein ?? extractEin(value) ?? knownDonor?.ein ?? null;
  const website = manualOverride?.website ?? knownDonor?.website ?? null;

  let entityType = knownDonor && entity.entityType === "Unknown" ? knownDonor.entityType : entity.entityType;
  let entityTypeConfidenceScore = knownDonor && entity.entityType === "Unknown" ? knownDonor.confidenceScore : entity.entityTypeConfidenceScore;
  let entityTypeReason = knownDonor && entity.entityType === "Unknown" ? knownDonor.reason : entity.entityTypeReason;
  let donorIndustry = industry.industry;
  let industryConfidenceScore = industry.industryConfidenceScore;
  let industryReason = industry.industryReason;
  let classificationSource: CampaignFinanceClassificationSource =
    knownDonor ? "Known Entity Match" : entity.classificationSource !== "Not enough signal" ? entity.classificationSource : industry.classificationSource;
  let classificationReason = knownDonor ? knownDonor.reason : [entity.entityTypeReason, industry.industryReason].filter(Boolean).join(" ");

  const inherited = historicalClassifications?.get(normalizedKey);
  if (!manualOverride && inherited && inherited.confidenceScore >= Math.max(entityTypeConfidenceScore, industryConfidenceScore)) {
    return {
      ...inherited,
      originalName: value,
      address: inherited.address ?? address,
      classificationSource: "Historical Classification Inheritance",
      classificationReason: `Inherited prior classification for normalized donor "${inherited.normalizedName}".`,
    };
  }

  if (manualOverride) {
    entityType = manualOverride.entity_type ?? entityType;
    entityTypeConfidenceScore = clampConfidence(manualOverride.confidence_score ?? 100);
    entityTypeReason = manualOverride.reason ?? "Manual admin override.";
    donorIndustry = manualOverride.industry ?? donorIndustry;
    industryConfidenceScore = clampConfidence(manualOverride.confidence_score ?? 100);
    industryReason = manualOverride.reason ?? "Manual admin override.";
    classificationSource = "Manual Admin Override";
    classificationReason = manualOverride.reason ?? "Manual admin override.";
  }

  const confidenceScore = clampConfidence(Math.max(entityTypeConfidenceScore, industryConfidenceScore));

  const classification = {
    originalName: value,
    normalizedName,
    normalizedKey,
    address,
    ein,
    website,
    entityType,
    entityTypeConfidenceScore,
    entityTypeReason,
    industry: donorIndustry,
    industryConfidenceScore,
    industryReason,
    classificationSource,
    confidenceScore,
    classificationReason,
  };

  if (normalizedKey && confidenceScore >= 60) historicalClassifications?.set(normalizedKey, classification);
  return classification;
}

function isOrganizationalEntity(entityType: DonorEntityType) {
  return entityType !== "Individual" && entityType !== "Unknown";
}

function canonicalNameTokens(value: string | null | undefined) {
  const aliases = new Map([
    ["joseph", "joe"],
    ["daniel", "danny"],
  ]);
  return normalizeName(value)
    .split(" ")
    .filter(Boolean)
    .map((token) => aliases.get(token) ?? token)
    .sort();
}

function namesMatch(left: string, right: string | null | undefined) {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  const leftTokens = canonicalNameTokens(left);
  const rightTokens = canonicalNameTokens(right);
  return leftTokens.length > 1 && leftTokens.length === rightTokens.length && leftTokens.every((token, index) => token === rightTokens[index]);
}

function sumNullable(values: Array<number | null>) {
  const numeric = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) : null;
}

function normalizeReportUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function reportRank(record: NvSosCampaignFinanceRecord) {
  const reportName = record.report_name ?? "";
  const ceMatch = reportName.match(/ce report\s*(\d+)/i);
  if (ceMatch) return Number(ceMatch[1]);
  if (/annual ce filing/i.test(reportName)) return 20;
  if (/financial disclosure/i.test(reportName)) return 40;
  return 30;
}

function parseDateValue(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function latestItemizedDate(record: NvSosCampaignFinanceRecord) {
  const dates = [...record.itemized_contributors, ...record.itemized_expenses]
    .map((row) => parseDateValue(row.date))
    .filter((value): value is number => typeof value === "number");
  return dates.length ? Math.max(...dates) : null;
}

function reportSortKey(record: NvSosCampaignFinanceRecord) {
  const itemizedDate = latestItemizedDate(record);
  if (itemizedDate) return itemizedDate;
  const year = record.report_year ?? 0;
  return Date.UTC(year, 0, 1) + reportRank(record) * 86400000;
}

function sortReportsAscending(left: NvSosCampaignFinanceRecord, right: NvSosCampaignFinanceRecord) {
  const delta = reportSortKey(left) - reportSortKey(right);
  if (delta !== 0) return delta;
  return (left.report_name ?? "").localeCompare(right.report_name ?? "") || left.source_url.localeCompare(right.source_url);
}

function sortReportsDescending(left: NvSosCampaignFinanceRecord, right: NvSosCampaignFinanceRecord) {
  return sortReportsAscending(right, left);
}

function dedupeFinanceReports(records: NvSosCampaignFinanceRecord[]) {
  const byUrl = new Map<string, NvSosCampaignFinanceRecord>();
  for (const record of records) {
    const key = normalizeReportUrl(record.source_url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, record);
      continue;
    }
    const existingRows = existing.itemized_contributors.length + existing.itemized_expenses.length;
    const nextRows = record.itemized_contributors.length + record.itemized_expenses.length;
    if (record.parse_confidence > existing.parse_confidence || nextRows > existingRows) byUrl.set(key, record);
  }
  return [...byUrl.values()];
}

function isCampaignFinanceReport(record: NvSosCampaignFinanceRecord) {
  return !/financial disclosure/i.test(record.report_name ?? "");
}

function isLikelyBoilerplateName(value: string) {
  const normalized = normalizeName(value);
  if (!normalized) return true;
  if (normalized.length > 170) return true;
  return [
    "secretary of state",
    "contributions summary",
    "expenses summary",
    "name and address",
    "when added together",
    "transfer total",
    "total monetary",
    "total value",
    "total amount",
    "categories nrs",
    "per nrs",
    "section 6 gifts",
    "written commitments",
  ].some((fragment) => normalized.includes(fragment));
}

function includesAny(value: string, fragments: string[]) {
  return fragments.some((fragment) => value.includes(fragment));
}

function cleanEntityName(value: string) {
  return value
    .replace(/\brefund(?:ed)?(?:\s+of)?\s+.*$/i, "")
    .replace(/\breturned contribution\s+.*$/i, "")
    .replace(/\breimbursement(?:\s+of)?\s+.*$/i, "")
    .replace(/\s+c\/o\s+.*$/i, "")
    .replace(/\s+po box\s+\d.*$/i, "")
    .replace(/\s+\d{2,6}\s+[a-z0-9#.,' -]+$/i, "")
    .replace(/\s+by\s+paul\s+padda\s+law.*$/i, "")
    .replace(/\s*,\s*(llc|inc|corp|co|ltd|lp|llp|pc|pllc)\b/i, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

function isAdjustmentText(value: string, amount: number) {
  const normalized = normalizeName(value);
  return amount < 0 || includesAny(normalized, ["refund", "reimbursement", "returned contribution", "void", "correction", "adjustment"]);
}

function inferSector(value: string) {
  return inferIndustry(value).industry;
}

function classifyContributor(value: string, amount: number, candidateName: string | null | undefined, historicalClassifications?: Map<string, DonorClassification>): Classification {
  const cleanedName = cleanEntityName(value);
  const normalized = normalizeName(value);
  const normalizedCleaned = normalizeName(cleanedName);
  const donorClassification = classifyDonor(value, candidateName, historicalClassifications);
  const sector = donorClassification.industry;
  const isAdjustment = isAdjustmentText(value, amount);

  if (isAdjustment) {
    return {
      fundingCategory: FUNDING_CATEGORIES.adjustment,
      sizeCategory: FUNDING_CATEGORIES.adjustment,
      sector,
      spendingCategory: null,
      isAdjustment: true,
      confidence: "high",
      reason: "Row text or amount indicates a refund, reimbursement, correction, or adjustment.",
      donorClassification,
    };
  }

  if (candidateName && (namesMatch(cleanedName, candidateName) || includesAny(normalized, ["personal loan", "self funding", "self funded", "candidate contribution", "owner candidate"]))) {
    return {
      fundingCategory: FUNDING_CATEGORIES.self,
      sizeCategory: amount > 1000 ? FUNDING_CATEGORIES.large : amount >= 200 ? FUNDING_CATEGORIES.medium : FUNDING_CATEGORIES.small,
      sector,
      spendingCategory: null,
      isAdjustment: false,
      confidence: "high",
      reason: "Contributor text matches the candidate or self-funding language.",
      donorClassification,
    };
  }

  if (includesAny(normalizedCleaned, [" pac", "committee", "party", "caucus", "federation", "association", "union", "club", "coalition", "political action"])) {
    return {
      fundingCategory: FUNDING_CATEGORIES.pac,
      sizeCategory: amount > 1000 ? FUNDING_CATEGORIES.large : amount >= 200 ? FUNDING_CATEGORIES.medium : FUNDING_CATEGORIES.small,
      sector,
      spendingCategory: null,
      isAdjustment: false,
      confidence: "high",
      reason: "Contributor name appears to be a PAC, party, committee, union, association, or political organization.",
      donorClassification,
    };
  }

  if (includesAny(normalizedCleaned, [" llc", " inc", " corp", " corporation", " lp", " llp", " co ", " company", "holdings", "properties", "development", "group", "enterprises", "partners", "services"])) {
    return {
      fundingCategory: FUNDING_CATEGORIES.business,
      sizeCategory: amount > 1000 ? FUNDING_CATEGORIES.large : amount >= 200 ? FUNDING_CATEGORIES.medium : FUNDING_CATEGORIES.small,
      sector,
      spendingCategory: null,
      isAdjustment: false,
      confidence: "medium",
      reason: "Contributor name contains business entity language.",
      donorClassification,
    };
  }

  if (sector !== SECTOR_CATEGORIES.other) {
    return {
      fundingCategory: FUNDING_CATEGORIES.sector,
      sizeCategory: amount > 1000 ? FUNDING_CATEGORIES.large : amount >= 200 ? FUNDING_CATEGORIES.medium : FUNDING_CATEGORIES.small,
      sector,
      spendingCategory: null,
      isAdjustment: false,
      confidence: "medium",
      reason: "Contributor name contains an inferred industry or special-interest signal.",
      donorClassification,
    };
  }

  if (amount < 200) {
    return {
      fundingCategory: FUNDING_CATEGORIES.small,
      sizeCategory: FUNDING_CATEGORIES.small,
      sector,
      spendingCategory: null,
      isAdjustment: false,
      confidence: "medium",
      reason: "Individual-looking contribution below $200.",
      donorClassification,
    };
  }

  if (amount <= 1000) {
    return {
      fundingCategory: FUNDING_CATEGORIES.medium,
      sizeCategory: FUNDING_CATEGORIES.medium,
      sector,
      spendingCategory: null,
      isAdjustment: false,
      confidence: "medium",
      reason: "Individual-looking contribution from $200 to $1,000.",
      donorClassification,
    };
  }

  return {
    fundingCategory: FUNDING_CATEGORIES.large,
    sizeCategory: FUNDING_CATEGORIES.large,
    sector,
    spendingCategory: null,
    isAdjustment: false,
    confidence: "medium",
    reason: "Individual-looking contribution over $1,000.",
    donorClassification,
  };
}

function classifyExpense(value: string, amount: number, candidateName: string | null | undefined, historicalClassifications?: Map<string, DonorClassification>): Classification {
  const normalized = normalizeName(value);
  const isAdjustment = isAdjustmentText(value, amount);
  const donorClassification = classifyDonor(value, candidateName, historicalClassifications);
  const sector = donorClassification.industry;

  if (isAdjustment) {
    return {
      fundingCategory: FUNDING_CATEGORIES.adjustment,
      sizeCategory: FUNDING_CATEGORIES.adjustment,
      sector,
      spendingCategory: SPENDING_CATEGORIES.adjustment,
      isAdjustment: true,
      confidence: "high",
      reason: "Expense text or amount indicates a refund, reimbursement, correction, or accounting adjustment.",
      donorClassification,
    };
  }

  if (includesAny(normalized, ["advertis", " media", "radio", "television", " tv", "print", "banner", "sign", "mailer", "mail ", "digital", "facebook", "google", "lamar"])) {
    return { fundingCategory: FUNDING_CATEGORIES.other, sizeCategory: FUNDING_CATEGORIES.other, sector, spendingCategory: SPENDING_CATEGORIES.advertising, isAdjustment: false, confidence: "medium", reason: "Vendor text suggests advertising, media, mail, print, or signs.", donorClassification };
  }
  if (includesAny(normalized, ["consult", "strategy", "strategies", "advisor", "management", "campaign services"])) {
    return { fundingCategory: FUNDING_CATEGORIES.other, sizeCategory: FUNDING_CATEGORIES.other, sector, spendingCategory: SPENDING_CATEGORIES.consultants, isAdjustment: false, confidence: "medium", reason: "Vendor text suggests consulting or strategy.", donorClassification };
  }
  if (includesAny(normalized, ["payroll", "salary", "wage", "staff", "employee"])) {
    return { fundingCategory: FUNDING_CATEGORIES.other, sizeCategory: FUNDING_CATEGORIES.other, sector, spendingCategory: SPENDING_CATEGORIES.payroll, isAdjustment: false, confidence: "medium", reason: "Vendor text suggests payroll or staff expense.", donorClassification };
  }
  if (includesAny(normalized, ["fundrais", "anedot", "winred", "donation processor", "merchant", "processing fee"])) {
    return { fundingCategory: FUNDING_CATEGORIES.other, sizeCategory: FUNDING_CATEGORIES.other, sector, spendingCategory: SPENDING_CATEGORIES.fundraising, isAdjustment: false, confidence: "medium", reason: "Vendor text suggests fundraising or payment processing.", donorClassification };
  }
  if (includesAny(normalized, ["law", "legal", "attorney", "court", "campbell williams", "firm"])) {
    return { fundingCategory: FUNDING_CATEGORIES.other, sizeCategory: FUNDING_CATEGORIES.other, sector, spendingCategory: SPENDING_CATEGORIES.legal, isAdjustment: false, confidence: "medium", reason: "Vendor text suggests legal services.", donorClassification };
  }
  if (includesAny(normalized, ["airlines", "hotel", "travel", "uber", "lyft", "rental car", "flight", "lodging", "mileage"])) {
    return { fundingCategory: FUNDING_CATEGORIES.other, sizeCategory: FUNDING_CATEGORIES.other, sector, spendingCategory: SPENDING_CATEGORIES.travel, isAdjustment: false, confidence: "medium", reason: "Vendor text suggests travel or lodging.", donorClassification };
  }
  if (includesAny(normalized, ["office", "depot", "supplies", "rent", "insurance", "phone", "internet", "postage", "software"])) {
    return { fundingCategory: FUNDING_CATEGORIES.other, sizeCategory: FUNDING_CATEGORIES.other, sector, spendingCategory: SPENDING_CATEGORIES.operations, isAdjustment: false, confidence: "medium", reason: "Vendor text suggests office or operational expense.", donorClassification };
  }

  return {
    fundingCategory: FUNDING_CATEGORIES.other,
    sizeCategory: FUNDING_CATEGORIES.other,
    sector,
    spendingCategory: SPENDING_CATEGORIES.other,
    isAdjustment: false,
    confidence: "low",
    reason: "No deterministic spending category signal found.",
    donorClassification,
  };
}

function buildRawRows(records: NvSosCampaignFinanceRecord[], field: "itemized_contributors" | "itemized_expenses", candidateName: string | null | undefined) {
  const rawRows: CampaignFinanceRawRow[] = [];
  const historicalClassifications = new Map<string, DonorClassification>();
  for (const record of records.filter(isCampaignFinanceReport)) {
    record[field].forEach((row, index) => {
      if (!row.name || typeof row.amount !== "number" || !Number.isFinite(row.amount)) return;
      const amount = Math.abs(row.amount);
      const classification = field === "itemized_contributors" ? classifyContributor(row.name, row.amount, candidateName, historicalClassifications) : classifyExpense(row.name, row.amount, candidateName, historicalClassifications);
      const displayName = cleanEntityName(row.name) || row.name;
      const donor = classification.donorClassification;
      rawRows.push({
        id: `${record.source_id}-${field}-${index}-${normalizeName(row.name).slice(0, 36)}`,
        originalName: row.name,
        normalizedName: donor.normalizedName,
        normalizedKey: donor.normalizedKey,
        address: donor.address,
        ein: donor.ein,
        website: donor.website,
        displayName,
        amount,
        date: row.date,
        sourceUrl: record.source_url,
        cachedPath: record.cached_path,
        reportLabel: record.report_name,
        reportYear: record.report_year,
        fundingCategory: classification.fundingCategory,
        sizeCategory: classification.sizeCategory,
        sector: classification.sector,
        industry: donor.industry,
        entityType: donor.entityType,
        entityTypeConfidenceScore: donor.entityTypeConfidenceScore,
        entityTypeReason: donor.entityTypeReason,
        industryConfidenceScore: donor.industryConfidenceScore,
        industryReason: donor.industryReason,
        classificationSource: donor.classificationSource,
        confidenceScore: donor.confidenceScore,
        spendingCategory: classification.spendingCategory,
        isAdjustment: classification.isAdjustment,
        isBoilerplate: isLikelyBoilerplateName(row.name),
        isOrganization: isOrganizationalEntity(donor.entityType),
        confidence: classification.confidence,
        reason: classification.reason,
      });
    });
  }

  return rawRows.sort((left, right) => right.amount - left.amount);
}

function buildCategoryRows(rows: CampaignFinanceRawRow[], categoryKey: keyof Pick<CampaignFinanceRawRow, "fundingCategory" | "sizeCategory" | "sector" | "industry" | "entityType" | "spendingCategory">, options: { includeAdjustments?: boolean; excludeOther?: boolean; limit?: number } = {}) {
  const byCategory = new Map<string, { amount: number; count: number; sourceUrl: string | null; reportLabel: string | null; date: string | null }>();
  for (const row of rows) {
    if (row.isBoilerplate) continue;
    if (!options.includeAdjustments && row.isAdjustment) continue;
    const name = row[categoryKey];
    if (!name) continue;
    if (options.excludeOther && (name === FUNDING_CATEGORIES.other || name === SECTOR_CATEGORIES.other || name === SPENDING_CATEGORIES.other || name === "Unknown")) continue;
    const existing = byCategory.get(name) ?? { amount: 0, count: 0, sourceUrl: null, reportLabel: null, date: null };
    byCategory.set(name, {
      amount: existing.amount + row.amount,
      count: existing.count + 1,
      sourceUrl: row.amount >= existing.amount ? row.sourceUrl : existing.sourceUrl,
      reportLabel: row.amount >= existing.amount ? row.reportLabel : existing.reportLabel,
      date: row.date ?? existing.date,
    });
  }

  const allRows = [...byCategory.entries()]
    .map(([name, value]) => ({
      id: normalizeName(name).replace(/\s+/g, "-") || "category",
      name,
      amount: value.amount,
      percentage: 0,
      count: value.count,
      note: `${value.count} parsed row${value.count === 1 ? "" : "s"}`,
      date: value.date,
      sourceUrl: value.sourceUrl,
      reportLabel: value.reportLabel,
    }))
    .sort((left, right) => right.amount - left.amount);

  const limitedRows = typeof options.limit === "number" ? allRows.slice(0, options.limit) : allRows;
  const total = limitedRows.reduce((sum, row) => sum + row.amount, 0);
  return limitedRows.map((row) => ({
    ...row,
    percentage: total > 0 ? (row.amount / total) * 100 : 0,
  }));
}

function buildDonorClassifications(rows: CampaignFinanceRawRow[]) {
  const byDonor = new Map<string, DonorClassificationRecord>();
  for (const row of rows.filter((entry) => !entry.isBoilerplate)) {
    const key = row.normalizedKey || normalizeDonorKey(row.displayName);
    if (!key) continue;
    const existing = byDonor.get(key);
    const contributionAmount = row.isAdjustment ? 0 : row.amount;
    const excludedAdjustmentAmount = row.isAdjustment ? row.amount : 0;
    const next: DonorClassificationRecord = existing
      ? {
          ...existing,
          originalName: existing.originalName === row.originalName ? existing.originalName : `${existing.originalName}; ${row.originalName}`.slice(0, 420),
          address: existing.address ?? row.address,
          ein: existing.ein ?? row.ein,
          website: existing.website ?? row.website,
          sourceUrls: [...new Set([...existing.sourceUrls, row.sourceUrl])],
          rowCount: existing.rowCount + 1,
          adjustmentRowCount: existing.adjustmentRowCount + (row.isAdjustment ? 1 : 0),
          contributionAmount: existing.contributionAmount + contributionAmount,
          excludedAdjustmentAmount: existing.excludedAdjustmentAmount + excludedAdjustmentAmount,
        }
      : {
          id: key.replace(/\s+/g, "-"),
          originalName: row.originalName,
          normalizedName: row.normalizedName,
          normalizedKey: key,
          address: row.address,
          ein: row.ein,
          website: row.website,
          entityType: row.entityType,
          entityTypeConfidenceScore: row.entityTypeConfidenceScore,
          entityTypeReason: row.entityTypeReason,
          industry: row.industry,
          industryConfidenceScore: row.industryConfidenceScore,
          industryReason: row.industryReason,
          classificationSource: row.classificationSource,
          confidenceScore: row.confidenceScore,
          classificationReason: [row.entityTypeReason, row.industryReason].filter(Boolean).join(" "),
          sourceUrls: [row.sourceUrl],
          rowCount: 1,
          adjustmentRowCount: row.isAdjustment ? 1 : 0,
          contributionAmount,
          excludedAdjustmentAmount,
        };
    byDonor.set(key, next);
  }

  return [...byDonor.values()].sort((left, right) => right.contributionAmount - left.contributionAmount || right.excludedAdjustmentAmount - left.excludedAdjustmentAmount || right.confidenceScore - left.confidenceScore);
}

function buildTopOrganizations(rows: CampaignFinanceRawRow[]): CampaignFinanceOrganizationRow[] {
  const byOrganization = new Map<string, CampaignFinanceOrganizationRow>();
  for (const row of rows) {
    if (row.isBoilerplate || row.isAdjustment || !row.isOrganization || row.entityType === "Unknown") continue;
    const key = row.normalizedKey || normalizeDonorKey(row.displayName);
    if (!key) continue;
    const existing = byOrganization.get(key);
    byOrganization.set(key, {
      id: key.replace(/\s+/g, "-"),
      name: row.normalizedName,
      amount: (existing?.amount ?? 0) + row.amount,
      percentage: 0,
      count: (existing?.count ?? 0) + 1,
      note: `${row.entityType} · ${row.industry} · ${row.confidenceScore}% confidence`,
      date: row.date ?? existing?.date ?? null,
      sourceUrl: row.amount >= (existing?.amount ?? 0) ? row.sourceUrl : existing?.sourceUrl ?? row.sourceUrl,
      reportLabel: row.amount >= (existing?.amount ?? 0) ? row.reportLabel : existing?.reportLabel ?? row.reportLabel,
      entityType: row.entityType,
      industry: row.industry,
      confidenceScore: Math.max(existing?.confidenceScore ?? 0, row.confidenceScore),
      classificationSource: row.classificationSource,
    });
  }

  const organizations = [...byOrganization.values()].sort((left, right) => right.amount - left.amount).slice(0, 8);
  const total = organizations.reduce((sum, row) => sum + row.amount, 0);
  return organizations.map((row) => ({ ...row, percentage: total > 0 ? (row.amount / total) * 100 : 0 }));
}

function buildFundingSplit(rows: CampaignFinanceRawRow[]): CampaignFinanceFundingSplit {
  const split = rows
    .filter((row) => !row.isBoilerplate && !row.isAdjustment)
    .reduce(
      (summary, row) => {
        if (row.entityType === "Individual") summary.individualAmount += row.amount;
        else if (row.entityType === "Unknown") summary.unknownAmount += row.amount;
        else summary.organizationalAmount += row.amount;
        return summary;
      },
      { individualAmount: 0, organizationalAmount: 0, unknownAmount: 0 },
    );
  const totalAmount = split.individualAmount + split.organizationalAmount + split.unknownAmount;
  return {
    ...split,
    totalAmount,
    individualPercentage: totalAmount ? (split.individualAmount / totalAmount) * 100 : 0,
    organizationalPercentage: totalAmount ? (split.organizationalAmount / totalAmount) * 100 : 0,
    unknownPercentage: totalAmount ? (split.unknownAmount / totalAmount) * 100 : 0,
  };
}

function parsedRowCount(record: NvSosCampaignFinanceRecord, field: "itemized_contributors" | "itemized_expenses") {
  return record[field].filter((row) => row.name && typeof row.amount === "number" && Number.isFinite(row.amount) && !isLikelyBoilerplateName(row.name)).length;
}

function adjustmentRowCount(record: NvSosCampaignFinanceRecord) {
  return [...record.itemized_contributors, ...record.itemized_expenses].filter((row) => {
    if (!row.name || typeof row.amount !== "number" || !Number.isFinite(row.amount) || isLikelyBoilerplateName(row.name)) return false;
    return isAdjustmentText(row.name, row.amount);
  }).length;
}

function parserStatus(record: NvSosCampaignFinanceRecord): CampaignFinanceSourceReport["parserStatus"] {
  if (record.parse_confidence >= 0.85) return "parsed";
  if (record.parse_confidence >= 0.6) return "needs_review";
  return "low_confidence";
}

function reviewRowFromRawRow(row: CampaignFinanceRawRow, issue: CampaignFinanceReviewIssue, rowKind: "contribution" | "expenditure", status: string): CampaignFinanceReviewRow {
  return {
    id: `${issue}-${row.id}`,
    issue,
    rowKind,
    originalName: row.originalName,
    displayName: row.displayName,
    normalizedName: row.normalizedName,
    amount: row.amount,
    date: row.date,
    sourceUrl: row.sourceUrl,
    cachedPath: row.cachedPath,
    reportLabel: row.reportLabel,
    reportYear: row.reportYear,
    status,
    confidenceScore: row.confidenceScore,
    reason: row.reason,
  };
}

function buildMissingNameReviewRows(records: NvSosCampaignFinanceRecord[]): CampaignFinanceReviewRow[] {
  const rows: CampaignFinanceReviewRow[] = [];
  for (const record of records.filter(isCampaignFinanceReport)) {
    (["itemized_contributors", "itemized_expenses"] as const).forEach((field) => {
      record[field].forEach((row, index) => {
        if (row.name) return;
        const rowKind = field === "itemized_contributors" ? "contribution" : "expenditure";
        rows.push({
          id: `missing-name-${record.source_id}-${field}-${index}`,
          issue: "missing_name",
          rowKind,
          originalName: null,
          displayName: "Missing name",
          normalizedName: null,
          amount: typeof row.amount === "number" && Number.isFinite(row.amount) ? row.amount : null,
          date: row.date,
          sourceUrl: record.source_url,
          cachedPath: record.cached_path,
          reportLabel: record.report_name,
          reportYear: record.report_year,
          status: "missing name",
          confidenceScore: Math.round(record.parse_confidence * 100),
          reason: "The parser found a row-like entry without a contributor or payee name.",
        });
      });
    });
  }
  return rows;
}

function buildReviewQueues({
  records,
  rawContributorRows,
  rawPayeeRows,
  rawAdjustmentRows,
}: {
  records: NvSosCampaignFinanceRecord[];
  rawContributorRows: CampaignFinanceRawRow[];
  rawPayeeRows: CampaignFinanceRawRow[];
  rawAdjustmentRows: CampaignFinanceRawRow[];
}): CampaignFinanceReviewQueues {
  const cleanRows = [...rawContributorRows, ...rawPayeeRows].filter((row) => !row.isBoilerplate && !row.isAdjustment);
  const ambiguousRows = cleanRows
    .filter((row) => row.entityType === "Unknown" || row.classificationSource === "Not enough signal")
    .map((row) =>
      reviewRowFromRawRow(
        row,
        "ambiguous_type",
        rawContributorRows.some((candidate) => candidate.id === row.id) ? "contribution" : "expenditure",
        row.entityType === "Unknown" ? "unknown type" : "needs review",
      ),
    );
  const lowConfidenceRows = cleanRows
    .filter((row) => row.confidenceScore < 60 || row.confidence === "low")
    .map((row) =>
      reviewRowFromRawRow(
        row,
        "low_confidence",
        rawContributorRows.some((candidate) => candidate.id === row.id) ? "contribution" : "expenditure",
        "low confidence",
      ),
    );
  const excludedAdjustmentRows = rawAdjustmentRows.map((row) =>
    reviewRowFromRawRow(
      row,
      "excluded_adjustment",
      rawContributorRows.some((candidate) => candidate.id === row.id) ? "contribution" : "expenditure",
      "excluded from donor charts",
    ),
  );

  return {
    missingNameRows: buildMissingNameReviewRows(records),
    ambiguousRows,
    excludedAdjustmentRows,
    lowConfidenceRows,
  };
}

function buildAccountingBreakdown({
  rawContributorRows,
  rawPayeeRows,
  rawAdjustmentRows,
  summary,
}: {
  rawContributorRows: CampaignFinanceRawRow[];
  rawPayeeRows: CampaignFinanceRawRow[];
  rawAdjustmentRows: CampaignFinanceRawRow[];
  summary: Pick<NvSosProfileFinanceSummary, "totalContributions" | "totalContributionsSourceUrl" | "totalExpenses" | "totalExpensesSourceUrl" | "latestReportLabel" | "latestReportYear">;
}): CampaignFinanceCategoryRow[] {
  const cleanContributionRows = rawContributorRows.filter((row) => !row.isBoilerplate && !row.isAdjustment);
  const cleanExpenseRows = rawPayeeRows.filter((row) => !row.isBoilerplate && !row.isAdjustment);
  const refundRows = rawAdjustmentRows.filter((row) => includesAny(normalizeName(row.originalName), ["refund", "reimbursement", "returned contribution"]));
  const loanRows = cleanContributionRows.filter((row) => includesAny(normalizeName(row.originalName), ["loan", "self funding", "self funded", "candidate contribution"]) || row.fundingCategory === FUNDING_CATEGORIES.self);
  const transferRows = [...rawContributorRows, ...rawPayeeRows].filter((row) => !row.isBoilerplate && includesAny(normalizeName(row.originalName), ["transfer"]));
  const otherAdjustmentRows = rawAdjustmentRows.filter((row) => !refundRows.some((refund) => refund.id === row.id) && !transferRows.some((transfer) => transfer.id === row.id));
  const latestLabel = summary.latestReportLabel ? `${summary.latestReportLabel}${summary.latestReportYear ? ` · ${summary.latestReportYear}` : ""}` : null;
  const rows: CampaignFinanceCategoryRow[] = [
    {
      id: "contributions-receipts",
      name: ACCOUNTING_CATEGORIES.receipts,
      amount: summary.totalContributions ?? cleanContributionRows.reduce((sum, row) => sum + row.amount, 0),
      percentage: 0,
      count: cleanContributionRows.length,
      note: summary.totalContributions !== null ? "Official report total parsed from source filings" : `${cleanContributionRows.length} clean parsed row${cleanContributionRows.length === 1 ? "" : "s"}`,
      date: null,
      sourceUrl: summary.totalContributionsSourceUrl,
      reportLabel: latestLabel,
    },
    {
      id: "expenditures",
      name: ACCOUNTING_CATEGORIES.expenditures,
      amount: summary.totalExpenses ?? cleanExpenseRows.reduce((sum, row) => sum + row.amount, 0),
      percentage: 0,
      count: cleanExpenseRows.length,
      note: summary.totalExpenses !== null ? "Official report total parsed from source filings" : `${cleanExpenseRows.length} parsed vendor row${cleanExpenseRows.length === 1 ? "" : "s"}`,
      date: null,
      sourceUrl: summary.totalExpensesSourceUrl,
      reportLabel: latestLabel,
    },
    {
      id: "refunds-reimbursements",
      name: ACCOUNTING_CATEGORIES.refunds,
      amount: refundRows.reduce((sum, row) => sum + row.amount, 0),
      percentage: 0,
      count: refundRows.length,
      note: "Separated from donor/influence charts",
      date: refundRows[0]?.date ?? null,
      sourceUrl: refundRows[0]?.sourceUrl ?? null,
      reportLabel: refundRows[0]?.reportLabel ?? null,
    },
    {
      id: "loans-self-funding",
      name: ACCOUNTING_CATEGORIES.loans,
      amount: loanRows.reduce((sum, row) => sum + row.amount, 0),
      percentage: 0,
      count: loanRows.length,
      note: "Identified from row text or candidate-name match",
      date: loanRows[0]?.date ?? null,
      sourceUrl: loanRows[0]?.sourceUrl ?? null,
      reportLabel: loanRows[0]?.reportLabel ?? null,
    },
    {
      id: "transfers",
      name: ACCOUNTING_CATEGORIES.transfers,
      amount: transferRows.reduce((sum, row) => sum + row.amount, 0),
      percentage: 0,
      count: transferRows.length,
      note: "Rows with transfer language where available",
      date: transferRows[0]?.date ?? null,
      sourceUrl: transferRows[0]?.sourceUrl ?? null,
      reportLabel: transferRows[0]?.reportLabel ?? null,
    },
    {
      id: "other-adjustments",
      name: ACCOUNTING_CATEGORIES.otherAdjustments,
      amount: otherAdjustmentRows.reduce((sum, row) => sum + row.amount, 0),
      percentage: 0,
      count: otherAdjustmentRows.length,
      note: "Corrections, voids, or accounting rows not treated as funders",
      date: otherAdjustmentRows[0]?.date ?? null,
      sourceUrl: otherAdjustmentRows[0]?.sourceUrl ?? null,
      reportLabel: otherAdjustmentRows[0]?.reportLabel ?? null,
    },
  ].filter((row) => row.amount > 0 || row.count > 0 || row.name === ACCOUNTING_CATEGORIES.receipts || row.name === ACCOUNTING_CATEGORIES.expenditures);
  const total = rows.reduce((sum, row) => sum + Math.abs(row.amount), 0);
  return rows.map((row) => ({
    ...row,
    percentage: total > 0 ? (Math.abs(row.amount) / total) * 100 : 0,
  }));
}

function buildDataStatus({
  incomingFundingRows,
  rawContributorRows,
  rawPayeeRows,
  rawAdjustmentRows,
  summary,
}: {
  incomingFundingRows: CampaignFinanceRawRow[];
  rawContributorRows: CampaignFinanceRawRow[];
  rawPayeeRows: CampaignFinanceRawRow[];
  rawAdjustmentRows: CampaignFinanceRawRow[];
  summary: NvSosProfileFinanceSummary;
}): CampaignFinanceDataStatus {
  const cleanRows = incomingFundingRows.filter((row) => !row.isBoilerplate && !row.isAdjustment && row.amount > 0);
  const cleanAmount = cleanRows.reduce((sum, row) => sum + row.amount, 0);
  const adjustmentAmount = rawAdjustmentRows.reduce((sum, row) => sum + row.amount, 0);
  const rawRows = [...rawContributorRows, ...rawPayeeRows].filter((row) => !row.isBoilerplate);
  const hasAggregateTotals = summary.totalContributions !== null || summary.totalExpenses !== null || summary.cashOnHand !== null;
  const hasRefundHeavyData = rawAdjustmentRows.length > 0 && (cleanRows.length === 0 || rawAdjustmentRows.length >= cleanRows.length || adjustmentAmount >= cleanAmount);
  const hasCleanItemizedContributions = cleanRows.length > 0;
  const hasFullBreakdown = cleanRows.length >= 5 && cleanAmount > 0;
  const voterFacingMode: CampaignFinanceDataStatus["voterFacingMode"] = hasFullBreakdown
    ? "full_breakdown"
    : hasCleanItemizedContributions
      ? "limited_breakdown"
      : hasAggregateTotals
        ? "aggregate_only"
        : summary.reportCount > 0
          ? "source_documents_only"
          : "source_documents_only";
  const confidenceLevel: CampaignFinanceDataStatus["confidenceLevel"] =
    voterFacingMode === "full_breakdown" ? "high" : voterFacingMode === "source_documents_only" ? "low" : hasAggregateTotals ? "medium" : "low";

  return {
    hasCleanItemizedContributions,
    hasRefundHeavyData,
    hasAggregateTotals,
    contributionRowsCount: cleanRows.length,
    excludedRefundAdjustmentRowsCount: rawAdjustmentRows.length,
    rawRowsCount: rawRows.length,
    confidenceLevel,
    voterFacingMode,
  };
}

function buildRaceComparison(
  profileRecords: NvSosCampaignFinanceRecord[],
  allRecords: NvSosCampaignFinanceRecord[] | null | undefined,
  currentCandidateName: string | null,
): CampaignFinanceRaceComparison | null {
  if (!allRecords?.length || !currentCandidateName) return null;
  const office = profileRecords.find((record) => record.office)?.office ?? null;
  if (!office) return null;
  const sameOfficeRecords = allRecords.filter((record) => record.candidate_name && record.office && normalizeName(record.office) === normalizeName(office));
  const byCandidate = new Map<string, NvSosCampaignFinanceRecord[]>();
  for (const record of sameOfficeRecords) {
    if (!record.candidate_name) continue;
    byCandidate.set(record.candidate_name, [...(byCandidate.get(record.candidate_name) ?? []), record]);
  }
  if (byCandidate.size < 2) return null;
  const candidates = [...byCandidate.entries()]
    .map(([candidateName, records]) => {
      const deduped = dedupeFinanceReports(records);
      return {
        candidateName,
        totalContributions: sumNullable(deduped.map((record) => record.total_contributions)),
        totalExpenses: sumNullable(deduped.map((record) => record.total_expenses)),
        reportCount: deduped.length,
        percentageOfRaceFunding: 0,
        sourceUrl: deduped.sort(sortReportsDescending).at(0)?.source_url ?? null,
        isCurrentProfile: namesMatch(candidateName, currentCandidateName),
      };
    })
    .sort((left, right) => (right.totalContributions ?? 0) - (left.totalContributions ?? 0));
  const totalRaceContributions = candidates.reduce((sum, candidate) => sum + (candidate.totalContributions ?? 0), 0);
  return {
    office,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      percentageOfRaceFunding: totalRaceContributions > 0 && candidate.totalContributions !== null ? (candidate.totalContributions / totalRaceContributions) * 100 : 0,
    })),
  };
}

function buildVoterInsights({
  summary,
  industryBreakdown,
  donorTypeBreakdown,
  topOrganizations,
  fundingSplit,
  validation,
  raceComparison,
}: {
  summary: NvSosProfileFinanceSummary;
  industryBreakdown: CampaignFinanceCategoryRow[];
  donorTypeBreakdown: CampaignFinanceCategoryRow[];
  topOrganizations: CampaignFinanceOrganizationRow[];
  fundingSplit: CampaignFinanceFundingSplit;
  validation: CampaignFinanceValidationSummary;
  raceComparison: CampaignFinanceRaceComparison | null;
}) {
  const insights: string[] = [];
  if (summary.totalContributions !== null) {
    insights.push(`Official Nevada Secretary of State reports show ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(summary.totalContributions)} raised across ${summary.reportCount} parsed report${summary.reportCount === 1 ? "" : "s"}.`);
  }
  if (validation.incomingFundingRowsUsedForCharts === 0 && validation.excludedRefundOrAdjustmentRows > 0) {
    insights.push("The available itemized contributor rows for this profile are refunds, returned contributions, reimbursements, or accounting adjustments, so we do not treat those rows as financial support or show donor-source charts from them.");
  }
  const topIndustry = industryBreakdown.at(0);
  if (topIndustry) {
    insights.push(`${topIndustry.name} is the largest classified incoming funding category at ${topIndustry.percentage.toFixed(0)}% of classified itemized contributions.`);
  }
  const topDonorType = donorTypeBreakdown.at(0);
  if (topDonorType) {
    insights.push(`${topDonorType.name} donors make up the largest classified donor-type share at ${topDonorType.percentage.toFixed(0)}%.`);
  }
  if (fundingSplit.totalAmount > 0) {
    if (fundingSplit.organizationalPercentage >= 60) insights.push("Classified itemized funding is primarily organizational rather than individual.");
    else if (fundingSplit.individualPercentage >= 60) insights.push("Classified itemized funding is primarily from individuals.");
  }
  if (topOrganizations.length) {
    insights.push(`${topOrganizations[0].name} is the largest classified organizational contributor in the parsed incoming itemized rows.`);
  }
  const currentRace = raceComparison?.candidates.find((candidate) => candidate.isCurrentProfile);
  if (currentRace && raceComparison && raceComparison.candidates.length > 1) {
    insights.push(`Within parsed ${raceComparison.office} records, this profile accounts for ${currentRace.percentageOfRaceFunding.toFixed(0)}% of official contribution totals among matched candidates.`);
  }
  return insights.slice(0, 5);
}

function latestFetchForSource(sourceId: string, entries: NvSosFetchLogEntry[]) {
  return entries
    .filter((entry) => entry.source_id === sourceId && (entry.status === "success_html" || entry.status === "success_pdf"))
    .sort((left, right) => left.fetched_at.localeCompare(right.fetched_at))
    .at(-1) ?? null;
}

export function getFinanceTimeSeries(records: NvSosCampaignFinanceRecord[]): CampaignFinanceTimePoint[] {
  const sorted = dedupeFinanceReports(records)
    .filter((record) => record.total_contributions !== null || record.total_expenses !== null)
    .sort(sortReportsAscending);
  let cumulativeRaised = 0;
  let cumulativeSpent = 0;
  return sorted.map((record, index) => {
    cumulativeRaised += record.total_contributions ?? 0;
    cumulativeSpent += record.total_expenses ?? 0;
    const label = record.report_year ? `${record.report_year} ${record.report_name ?? `Report ${index + 1}`}` : record.report_name ?? `Report ${index + 1}`;
    return {
      key: `${record.source_id}-${index}`,
      label,
      reportLabel: record.report_name,
      reportPeriod: record.report_period,
      reportYear: record.report_year,
      raised: record.total_contributions,
      spent: record.total_expenses,
      cumulativeRaised,
      cumulativeSpent,
      sourceUrl: record.source_url,
    };
  });
}

export function createEmptyCampaignFinanceDashboard(lastFetchedAt: string | null = null): CampaignFinanceDashboard {
  const validation = {
    officialTotalContributionsParsed: null,
    itemizedContributionRowsParsed: 0,
    itemizedExpenseRowsParsed: 0,
    itemizedContributionAmountParsed: 0,
    itemizedExpenseAmountParsed: 0,
    itemizedContributionAmountCategorized: 0,
    excludedRefundOrAdjustmentRows: 0,
    excludedRefundOrAdjustmentAmount: 0,
    rawContributorRowCountPreserved: 0,
    rawPayeeRowCountPreserved: 0,
    needsReviewRowCount: 0,
    topContributionCategories: [],
    donorClassificationCount: 0,
    highConfidenceClassificationCount: 0,
    mediumConfidenceClassificationCount: 0,
    lowConfidenceClassificationCount: 0,
    incomingFundingRowsUsedForCharts: 0,
  };
  return {
    summary: {
      reportCount: 0,
      totalContributions: null,
      totalContributionsSourceUrl: null,
      totalExpenses: null,
      totalExpensesSourceUrl: null,
      netTotal: null,
      netTotalSourceUrl: null,
      cashOnHand: null,
      cashOnHandSourceUrl: null,
      latestReportLabel: null,
      latestReportPeriod: null,
      latestReportYear: null,
      latestReportUrl: null,
      lastFetchedAt,
      recordsWithTotals: 0,
      topContributors: [],
      topPayees: [],
    },
    dataStatus: {
      hasCleanItemizedContributions: false,
      hasRefundHeavyData: false,
      hasAggregateTotals: false,
      contributionRowsCount: 0,
      excludedRefundAdjustmentRowsCount: 0,
      rawRowsCount: 0,
      confidenceLevel: "low",
      voterFacingMode: "source_documents_only",
    },
    timeSeries: [],
    accountingBreakdown: [],
    contributionBreakdown: [],
    fundingSourceBreakdown: [],
    donorSizeBreakdown: [],
    industrySectorBreakdown: [],
    donorTypeBreakdown: [],
    expenseBreakdown: [],
    spendingCategoryBreakdown: [],
    adjustmentBreakdown: [],
    topOrganizations: [],
    topContributors: [],
    topPayees: [],
    rawContributorRows: [],
    rawPayeeRows: [],
    rawAdjustmentRows: [],
    reviewQueues: {
      missingNameRows: [],
      ambiguousRows: [],
      excludedAdjustmentRows: [],
      lowConfidenceRows: [],
    },
    donorClassifications: [],
    individualVsOrganizational: {
      individualAmount: 0,
      organizationalAmount: 0,
      unknownAmount: 0,
      totalAmount: 0,
      individualPercentage: 0,
      organizationalPercentage: 0,
      unknownPercentage: 0,
    },
    raceComparison: null,
    voterInsights: [],
    sourceReports: [],
    validation,
    itemizationStatus: {
      hasContributorRows: false,
      hasExpenseRows: false,
      hasCategorizedContributions: false,
      hasSpendingCategories: false,
      contributorNote: "Itemized contributor rows have not been parsed for this profile yet.",
      expenseNote: "Itemized payee or vendor rows have not been parsed for this profile yet.",
    },
  };
}

export function buildCampaignFinanceDashboard(
  records: NvSosCampaignFinanceRecord[],
  fetchEntries: NvSosFetchLogEntry[] = [],
  fallbackLastFetchedAt: string | null = null,
  raceComparisonRecords: NvSosCampaignFinanceRecord[] | null = null,
): CampaignFinanceDashboard {
  const deduped = dedupeFinanceReports(records);
  if (!deduped.length) return createEmptyCampaignFinanceDashboard(fallbackLastFetchedAt);

  const sortedDescending = deduped.slice().sort(sortReportsDescending);
  const latest = sortedDescending.at(0) ?? null;
  const candidateName = deduped.find((record) => record.candidate_name)?.candidate_name ?? null;
  const totalContributions = sumNullable(deduped.map((record) => record.total_contributions));
  const totalExpenses = sumNullable(deduped.map((record) => record.total_expenses));
  const latestCashRecord = sortedDescending.find((record) => typeof record.cash_on_hand === "number") ?? null;
  const contributionSource = sortedDescending.find((record) => typeof record.total_contributions === "number") ?? latest;
  const expenseSource = sortedDescending.find((record) => typeof record.total_expenses === "number") ?? latest;
  const latestFetch =
    deduped
      .map((record) => latestFetchForSource(record.source_id, fetchEntries)?.fetched_at ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? fallbackLastFetchedAt;

  const rawContributorRows = buildRawRows(deduped, "itemized_contributors", candidateName);
  const rawPayeeRows = buildRawRows(deduped, "itemized_expenses", candidateName);
  const rawAdjustmentRows = [...rawContributorRows, ...rawPayeeRows].filter((row) => row.isAdjustment && !row.isBoilerplate).sort((left, right) => right.amount - left.amount);
  const incomingFundingRows = rawContributorRows.filter((row) => !row.isBoilerplate && !row.isAdjustment);
  const fundingSourceBreakdown = buildCategoryRows(rawContributorRows, "fundingCategory", { excludeOther: false, limit: 8 });
  const donorSizeBreakdown = buildCategoryRows(rawContributorRows, "sizeCategory", { excludeOther: true, limit: 4 });
  const industrySectorBreakdown = buildCategoryRows(rawContributorRows, "industry", { excludeOther: true, limit: 8 });
  const donorTypeBreakdown = buildCategoryRows(rawContributorRows, "entityType", { excludeOther: true, limit: 8 });
  const spendingCategoryBreakdown = buildCategoryRows(rawPayeeRows, "spendingCategory", { includeAdjustments: false, limit: 8 });
  const adjustmentBreakdown = buildCategoryRows(rawAdjustmentRows, "fundingCategory", { includeAdjustments: true, limit: 3 });
  const topOrganizations = buildTopOrganizations(rawContributorRows);
  const donorClassifications = buildDonorClassifications(rawContributorRows);
  const individualVsOrganizational = buildFundingSplit(rawContributorRows);
  const raceComparison = buildRaceComparison(deduped, raceComparisonRecords, candidateName);
  const timeSeries = getFinanceTimeSeries(deduped);
  const sourceReports = sortedDescending.map((record) => ({
    label: record.report_name ?? "Campaign finance report",
    filingDate: null,
    period: record.report_period,
    year: record.report_year,
    sourceUrl: record.source_url,
    cachedPath: record.cached_path,
    totalContributions: record.total_contributions,
    totalExpenses: record.total_expenses,
    cashOnHand: record.cash_on_hand,
    contributionRowCount: parsedRowCount(record, "itemized_contributors"),
    expenditureRowCount: parsedRowCount(record, "itemized_expenses"),
    excludedAdjustmentRowCount: adjustmentRowCount(record),
    parseConfidence: record.parse_confidence,
    parserStatus: parserStatus(record),
  }));

  const categorizedContributionRows = rawContributorRows.filter((row) => !row.isBoilerplate && !row.isAdjustment && row.fundingCategory !== FUNDING_CATEGORIES.other);
  const adjustmentContributionRows = rawContributorRows.filter((row) => !row.isBoilerplate && row.isAdjustment);
  const cleanExpenseRows = rawPayeeRows.filter((row) => !row.isBoilerplate && !row.isAdjustment);
  const reviewQueues = buildReviewQueues({ records: deduped, rawContributorRows, rawPayeeRows, rawAdjustmentRows });
  const needsReviewRowCount =
    reviewQueues.missingNameRows.length + reviewQueues.ambiguousRows.length + reviewQueues.excludedAdjustmentRows.length + reviewQueues.lowConfidenceRows.length;
  const highConfidenceClassificationCount = donorClassifications.filter((row) => row.confidenceScore >= 85).length;
  const mediumConfidenceClassificationCount = donorClassifications.filter((row) => row.confidenceScore >= 60 && row.confidenceScore < 85).length;
  const lowConfidenceClassificationCount = donorClassifications.filter((row) => row.confidenceScore < 60).length;
  const validation: CampaignFinanceValidationSummary = {
    officialTotalContributionsParsed: totalContributions,
    itemizedContributionRowsParsed: rawContributorRows.length,
    itemizedExpenseRowsParsed: rawPayeeRows.length,
    itemizedContributionAmountParsed: rawContributorRows.filter((row) => !row.isBoilerplate).reduce((sum, row) => sum + row.amount, 0),
    itemizedExpenseAmountParsed: rawPayeeRows.filter((row) => !row.isBoilerplate).reduce((sum, row) => sum + row.amount, 0),
    itemizedContributionAmountCategorized: categorizedContributionRows.reduce((sum, row) => sum + row.amount, 0),
    excludedRefundOrAdjustmentRows: adjustmentContributionRows.length,
    excludedRefundOrAdjustmentAmount: adjustmentContributionRows.reduce((sum, row) => sum + row.amount, 0),
    rawContributorRowCountPreserved: rawContributorRows.length,
    rawPayeeRowCountPreserved: rawPayeeRows.length,
    needsReviewRowCount,
    topContributionCategories: fundingSourceBreakdown.slice(0, 5).map((row) => ({ name: row.name, amount: row.amount, count: row.count })),
    donorClassificationCount: donorClassifications.length,
    highConfidenceClassificationCount,
    mediumConfidenceClassificationCount,
    lowConfidenceClassificationCount,
    incomingFundingRowsUsedForCharts: incomingFundingRows.length,
  };
  const summary: NvSosProfileFinanceSummary = {
    reportCount: deduped.length,
    totalContributions,
    totalContributionsSourceUrl: contributionSource?.source_url ?? null,
    totalExpenses,
    totalExpensesSourceUrl: expenseSource?.source_url ?? null,
    netTotal: totalContributions !== null && totalExpenses !== null ? totalContributions - totalExpenses : null,
    netTotalSourceUrl: contributionSource?.source_url ?? expenseSource?.source_url ?? latest?.source_url ?? null,
    cashOnHand: latestCashRecord?.cash_on_hand ?? null,
    cashOnHandSourceUrl: latestCashRecord?.source_url ?? null,
    latestReportLabel: latest?.report_name ?? null,
    latestReportPeriod: latest?.report_period ?? null,
    latestReportYear: latest?.report_year ?? null,
    latestReportUrl: latest?.source_url ?? null,
    lastFetchedAt: latestFetch,
    recordsWithTotals: deduped.filter((record) => record.total_contributions !== null || record.total_expenses !== null || record.cash_on_hand !== null).length,
    topContributors: fundingSourceBreakdown,
    topPayees: spendingCategoryBreakdown,
  };
  const accountingBreakdown = buildAccountingBreakdown({
    rawContributorRows,
    rawPayeeRows,
    rawAdjustmentRows,
    summary,
  });
  const dataStatus = buildDataStatus({
    incomingFundingRows,
    rawContributorRows,
    rawPayeeRows,
    rawAdjustmentRows,
    summary,
  });
  const voterInsights = buildVoterInsights({
    summary,
    industryBreakdown: industrySectorBreakdown,
    donorTypeBreakdown,
    topOrganizations,
    fundingSplit: individualVsOrganizational,
    validation,
    raceComparison,
  });

  return {
    summary,
    dataStatus,
    timeSeries,
    accountingBreakdown,
    contributionBreakdown: fundingSourceBreakdown,
    fundingSourceBreakdown,
    donorSizeBreakdown,
    industrySectorBreakdown,
    donorTypeBreakdown,
    expenseBreakdown: spendingCategoryBreakdown,
    spendingCategoryBreakdown,
    adjustmentBreakdown,
    topOrganizations,
    topContributors: rawContributorRows.filter((row) => !row.isBoilerplate && !row.isAdjustment).slice(0, 12),
    topPayees: rawPayeeRows.filter((row) => !row.isBoilerplate && !row.isAdjustment).slice(0, 12),
    rawContributorRows,
    rawPayeeRows,
    rawAdjustmentRows,
    reviewQueues,
    donorClassifications,
    individualVsOrganizational,
    raceComparison,
    voterInsights,
    sourceReports,
    validation,
    itemizationStatus: {
      hasContributorRows: rawContributorRows.some((row) => !row.isBoilerplate),
      hasExpenseRows: rawPayeeRows.some((row) => !row.isBoilerplate),
      hasCategorizedContributions: fundingSourceBreakdown.some((row) => row.name !== FUNDING_CATEGORIES.adjustment),
      hasSpendingCategories: cleanExpenseRows.length > 0 && spendingCategoryBreakdown.length > 0,
      contributorNote: fundingSourceBreakdown.some((row) => row.name !== FUNDING_CATEGORIES.adjustment)
        ? null
        : "Parsed itemized contribution rows are missing or appear to be refunds/accounting adjustments, so donor categories are not inferred from them.",
      expenseNote: cleanExpenseRows.length ? null : "Totals are parsed, but current itemized spending rows are missing or appear to be refunds/accounting adjustments.",
    },
  };
}

export function getFinanceSummaryForProfile(
  profileName: string,
  records: NvSosCampaignFinanceRecord[],
  fetchEntries: NvSosFetchLogEntry[] = [],
  fallbackLastFetchedAt: string | null = null,
) {
  return buildCampaignFinanceDashboard(
    records.filter((record) => namesMatch(profileName, record.candidate_name)),
    fetchEntries,
    fallbackLastFetchedAt,
  );
}
