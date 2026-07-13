import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import type {
  AdClaim,
  PoliticalAd,
  PoliticalAdEntityRelation,
  PoliticalAdGeography,
  PoliticalAdMedia,
  PoliticalAdRelationType,
  PoliticalAdSourceType,
  PoliticalAdSponsorType,
} from "@/types/domain";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const MANUAL_INTAKE_PATH = path.join(process.cwd(), "data/manual-sources/political-ads/nevada-reviewed-ads.json");
const CAMPAIGN_FINANCE_PATH = path.join(GENERATED_DIR, "nv-sos-campaign-finance-records.json");
const OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-political-ads.json");
const REVIEW_QUEUE_PATH = path.join(GENERATED_DIR, "nevada-political-ads-review-queue.json");

type ManualIntakeFile = {
  records?: ManualAdRecord[];
};

type ManualAdRecord = {
  id?: string;
  title?: string;
  description?: string;
  sourceType?: PoliticalAdSourceType;
  sponsorName?: string;
  sponsorType?: PoliticalAdSponsorType;
  paidForBy?: string;
  producedBy?: string | null;
  authorizedBy?: string | null;
  authorizationText?: string | null;
  totalSpend?: number | null;
  impressions?: number | null;
  firstSeenAt?: string;
  lastSeenAt?: string | null;
  electionCycle?: string;
  geographySummary?: string;
  platformUrl?: string | null;
  archiveUrl?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourcePublisher?: string | null;
  mediaText?: string | null;
  relationType?: PoliticalAdRelationType;
  entityType?: PoliticalAdEntityRelation["entityType"];
  entityId?: string;
  entityLabel?: string;
  issueId?: string;
  issueLabel?: string;
  county?: string | null;
  city?: string | null;
  districtName?: string | null;
  reviewed?: boolean;
  reviewStatus?: "reviewed" | "needs_review" | "rejected";
  claims?: Array<{
    claimText?: string;
    rating?: AdClaim["systemRating"];
    explanation?: string;
    importance?: AdClaim["importance"];
    claimType?: AdClaim["claimType"];
    evidenceUrl?: string;
  }>;
  raw?: unknown;
};

type CampaignFinanceRecord = {
  candidate_name?: string | null;
  office?: string | null;
  report_name?: string | null;
  report_year?: number | null;
  source_url?: string | null;
  itemized_expenses?: Array<{
    name?: string | null;
    amount?: number | null;
    date?: string | null;
  }>;
};

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch (error) {
    console.error(`Failed to read ${filePath}`, error);
    return fallback;
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stableId(prefix: string, record: ManualAdRecord) {
  if (record.id) return record.id;
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify([record.title, record.sponsorName, record.firstSeenAt, record.sourceUrl, record.archiveUrl]))
    .digest("hex")
    .slice(0, 12);
  return `${prefix}-${slugify(record.title ?? "political-ad")}-${hash}`;
}

function hasSource(record: ManualAdRecord) {
  return Boolean(record.sourceUrl || record.archiveUrl || record.platformUrl);
}

function isReviewed(record: ManualAdRecord) {
  return record.reviewed === true || record.reviewStatus === "reviewed";
}

function relationFor(adId: string, record: ManualAdRecord): PoliticalAdEntityRelation[] {
  const entityType = record.entityType ?? (record.issueId || record.issueLabel ? "issue" : null);
  const entityId = record.entityId ?? record.issueId ?? (record.issueLabel ? slugify(record.issueLabel) : null);
  const entityLabel = record.entityLabel ?? record.issueLabel ?? null;

  if (!entityType || !entityId || !entityLabel) {
    return [];
  }

  return [
    {
      id: `${adId}-${entityType}-${entityId}-${record.relationType ?? "mentions"}`,
      politicalAdId: adId,
      entityType,
      entityId,
      entityLabel,
      relationType: record.relationType ?? "mentions",
      createdAt: new Date().toISOString(),
    },
  ];
}

function geographiesFor(adId: string, record: ManualAdRecord): PoliticalAdGeography[] {
  return [
    {
      id: `${adId}-geo-nevada`,
      politicalAdId: adId,
      country: "United States",
      state: "Nevada",
      county: record.county ?? null,
      city: record.city ?? null,
      districtType: record.districtName ? "district" : "statewide",
      districtName: record.districtName ?? "Nevada",
      precinct: null,
      createdAt: new Date().toISOString(),
    },
  ];
}

function mediaFor(adId: string, record: ManualAdRecord): PoliticalAdMedia[] {
  const media: PoliticalAdMedia[] = [];
  if (record.sourceUrl || record.archiveUrl || record.platformUrl) {
    media.push({
      id: `${adId}-source-link`,
      politicalAdId: adId,
      mediaType: "externalEmbed",
      url: record.sourceUrl ?? record.archiveUrl ?? record.platformUrl ?? null,
      altText: `${record.title ?? "Political ad"} source`,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    });
  }

  if (record.mediaText) {
    media.push({
      id: `${adId}-text`,
      politicalAdId: adId,
      mediaType: "transcript",
      textContent: record.mediaText,
      sortOrder: 1,
      createdAt: new Date().toISOString(),
    });
  }

  return media;
}

function claimsFor(adId: string, record: ManualAdRecord): AdClaim[] {
  return (record.claims ?? [])
    .filter((claim) => claim.claimText)
    .map((claim, index) => {
      const claimId = `${adId}-claim-${index + 1}`;
      const evidenceUrl = claim.evidenceUrl ?? record.sourceUrl ?? record.archiveUrl ?? record.platformUrl ?? "";

      return {
        id: claimId,
        politicalAdId: adId,
        claimText: claim.claimText ?? "",
        normalizedClaim: (claim.claimText ?? "").toLowerCase(),
        claimType: claim.claimType ?? "factual",
        mediaTimestampStart: null,
        mediaTimestampEnd: null,
        mediaLocation: null,
        importance: claim.importance ?? "medium",
        systemRating: claim.rating ?? "Needs Review",
        systemConfidence: claim.rating && claim.rating !== "Needs Review" ? "Medium" : "Low",
        systemExplanation: claim.explanation ?? "Claim captured from a reviewed public ad source; detailed fact-checking is still pending.",
        citizenRating: null,
        citizenAgreementPercent: null,
        citizenRatingCount: 0,
        evidence: evidenceUrl
          ? [
              {
                id: `${claimId}-evidence-1`,
                claimId,
                title: record.sourceTitle ?? "Reviewed public ad source",
                url: evidenceUrl,
                sourceType: "Political ad source",
                publisher: record.sourcePublisher ?? "Public source",
                publishedAt: record.firstSeenAt ?? null,
                excerpt: claim.claimText ?? "",
                supportsOrRefutes: "contextualizes",
                createdAt: new Date().toISOString(),
              },
            ]
          : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
}

function normalizeManualRecord(record: ManualAdRecord): PoliticalAd | null {
  if (!record.title || !record.description || !record.sponsorName || !record.firstSeenAt) {
    return null;
  }

  const id = stableId("nv-ad", record);
  const sourceUrl = record.sourceUrl ?? record.archiveUrl ?? record.platformUrl ?? null;

  return {
    id,
    title: record.title,
    description: record.description,
    sourceType: record.sourceType ?? "otherUnknown",
    sponsorName: record.sponsorName,
    sponsorType: record.sponsorType ?? "unknownUndisclosed",
    paidForBy: record.paidForBy ?? record.sponsorName,
    producedBy: record.producedBy ?? null,
    authorizedBy: record.authorizedBy ?? null,
    authorizationText: record.authorizationText ?? null,
    totalSpend: typeof record.totalSpend === "number" ? record.totalSpend : null,
    currency: "USD",
    impressions: typeof record.impressions === "number" ? record.impressions : null,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt ?? null,
    electionCycle: record.electionCycle ?? "2026",
    geographySummary: record.geographySummary ?? ([record.city, record.county, "Nevada"].filter(Boolean).join(", ") || "Nevada"),
    platformUrl: record.platformUrl ?? null,
    archiveUrl: record.archiveUrl ?? sourceUrl,
    overallSystemRating: "Needs Review",
    overallSystemConfidence: "Low",
    overallSystemExplanation: "This ad is source-backed and reviewed for repository inclusion; claim-level truth ratings may still need expert or community review.",
    overallCitizenRating: null,
    citizenAgreementPercent: null,
    citizenRatingCount: 0,
    status: "published",
    media: mediaFor(id, record),
    entityRelations: relationFor(id, record),
    geographies: geographiesFor(id, record),
    claims: claimsFor(id, record),
    citizenRatings: [],
    challenges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const intake = readJson<ManualIntakeFile>(MANUAL_INTAKE_PATH, { records: [] });
const records = Array.isArray(intake.records) ? intake.records : [];
const campaignFinanceRecords = readJson<CampaignFinanceRecord[] | { records?: CampaignFinanceRecord[]; data?: CampaignFinanceRecord[] }>(
  CAMPAIGN_FINANCE_PATH,
  [],
);
const campaignFinanceArray = Array.isArray(campaignFinanceRecords)
  ? campaignFinanceRecords
  : Array.isArray(campaignFinanceRecords.records)
    ? campaignFinanceRecords.records
    : Array.isArray(campaignFinanceRecords.data)
      ? campaignFinanceRecords.data
      : [];
const adSpendPattern = /\b(advertis|media|mailer|mail |digital|facebook|google|radio|television|tv\b|sign|print|postcard|banner|creative|production)\b/i;
const financeReviewQueue = campaignFinanceArray.flatMap((record) =>
  (record.itemized_expenses ?? [])
    .filter((expense) => adSpendPattern.test(expense.name ?? ""))
    .map((expense) => ({
      id: stableId("nv-ad-finance-lead", {
        title: `${record.candidate_name ?? "Unknown committee"} ${expense.name ?? "advertising expense"}`,
        sponsorName: record.candidate_name ?? undefined,
        firstSeenAt: expense.date ?? undefined,
        sourceUrl: record.source_url ?? undefined,
      }),
      title: `${record.candidate_name ?? "Unknown committee"} advertising expenditure`,
      sponsorName: record.candidate_name ?? "Committee pending",
      reason: "Nevada SOS campaign-finance expenditure appears related to advertising/media, but no ad creative has been attached or reviewed yet.",
      sourceUrl: record.source_url ?? null,
      raw: {
        candidateName: record.candidate_name ?? null,
        office: record.office ?? null,
        reportName: record.report_name ?? null,
        reportYear: record.report_year ?? null,
        expense,
      },
    })),
);
const manualReviewQueue = records
  .filter((record) => !isReviewed(record) || !hasSource(record))
  .map((record) => ({
    id: stableId("nv-ad-review", record),
    title: record.title ?? "Untitled ad capture",
    sponsorName: record.sponsorName ?? "Sponsor pending",
    reason: !hasSource(record)
      ? "Missing public source URL or retained source artifact."
      : "Record is not marked reviewed.",
    sourceUrl: record.sourceUrl ?? record.archiveUrl ?? record.platformUrl ?? null,
    raw: record.raw ?? record,
  }));
const reviewQueue = [...manualReviewQueue, ...financeReviewQueue];

const ads = records
  .filter((record) => isReviewed(record) && hasSource(record))
  .map(normalizeManualRecord)
  .filter((ad): ad is PoliticalAd => Boolean(ad));

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: MANUAL_INTAKE_PATH,
      ads,
      totals: {
        intakeRecords: records.length,
        reviewedSourceBackedAds: ads.length,
        reviewQueueRecords: reviewQueue.length,
        campaignFinanceAdSpendLeads: financeReviewQueue.length,
      },
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  REVIEW_QUEUE_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      records: reviewQueue,
      totals: {
        reviewQueueRecords: reviewQueue.length,
      },
    },
    null,
    2,
  ),
);

console.log("Generated Nevada political ads repository.");
console.log(
  JSON.stringify(
    {
      intakeRecords: records.length,
      reviewedSourceBackedAds: ads.length,
      reviewQueueRecords: reviewQueue.length,
      campaignFinanceAdSpendLeads: financeReviewQueue.length,
      output: OUTPUT_PATH,
      reviewQueue: REVIEW_QUEUE_PATH,
    },
    null,
    2,
  ),
);
