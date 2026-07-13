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
const FEC_IMPORT_PATH = path.join(process.cwd(), "data/imports/political-ads/fec-nevada-independent-expenditures.json");
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

type FecIndependentExpenditureImport = {
  generatedAt?: string;
  records?: FecIndependentExpenditureRecord[];
};

type FecIndependentExpenditureRecord = {
  candidate_id?: string | null;
  candidate_name?: string | null;
  candidate_office?: string | null;
  candidate_office_district?: string | null;
  candidate_office_state?: string | null;
  candidate_party?: string | null;
  committee_id?: string | null;
  committee?: {
    name?: string | null;
    committee_type_full?: string | null;
    state?: string | null;
  } | null;
  dissemination_date?: string | null;
  election_type?: string | null;
  expenditure_amount?: number | null;
  expenditure_date?: string | null;
  expenditure_description?: string | null;
  filing_date?: string | null;
  filing_form?: string | null;
  image_number?: string | null;
  payee_name?: string | null;
  payee_city?: string | null;
  payee_state?: string | null;
  report_year?: string | number | null;
  schedule_type_full?: string | null;
  source_url?: string | null;
  sub_id?: string | null;
  support_oppose_indicator?: string | null;
  transaction_id?: string | null;
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

function sentenceCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function candidateDisplayName(value: string | null | undefined) {
  if (!value) return "Nevada candidate";
  const [last, rest] = value.split(",").map((part) => part.trim());
  return rest ? `${sentenceCase(rest)} ${sentenceCase(last)}` : sentenceCase(value);
}

function sourceTypeForFecPurpose(purpose: string | null | undefined): PoliticalAdSourceType {
  const text = purpose?.toLowerCase() ?? "";
  if (/\b(phone|text|sms)\b/.test(text)) return "textSmsAd";
  if (/\b(mail|postcard)\b/.test(text)) return "mailer";
  if (/\b(tv|television|broadcast)\b/.test(text)) return "broadcastTvAd";
  if (/\b(radio)\b/.test(text)) return "radioAd";
  if (/\b(digital|internet|online|facebook|google|youtube|streaming)\b/.test(text)) return "internetAd";
  if (/\b(print|banner|sign)\b/.test(text)) return "print";
  return "otherUnknown";
}

function sponsorTypeForFecCommittee(row: FecIndependentExpenditureRecord): PoliticalAdSponsorType {
  const type = row.committee?.committee_type_full?.toLowerCase() ?? "";
  if (type.includes("super pac") || type.includes("independent expenditure-only")) return "superPac";
  if (type.includes("party")) return "politicalParty";
  if (type.includes("pac")) return "pac";
  return "independentExpenditureGroup";
}

function relationForFecIndicator(value: string | null | undefined): PoliticalAdRelationType {
  if (value === "S") return "supports";
  if (value === "O") return "opposes";
  return "mentions";
}

function districtNameForFec(row: FecIndependentExpenditureRecord) {
  if (row.candidate_office === "S") return "Nevada statewide";
  if (row.candidate_office === "P") return "Nevada presidential";
  if (row.candidate_office === "H" && row.candidate_office_district) {
    return `Nevada Congressional District ${Number.parseInt(row.candidate_office_district, 10) || row.candidate_office_district}`;
  }
  return "Nevada";
}

function normalizeFecRecord(row: FecIndependentExpenditureRecord): PoliticalAd | null {
  const sourceUrl = row.source_url ?? (row.image_number ? `https://docquery.fec.gov/cgi-bin/fecimg/?${row.image_number}` : null);
  const candidateName = candidateDisplayName(row.candidate_name);
  const committeeName = row.committee?.name ?? "Independent expenditure committee";
  const relation = relationForFecIndicator(row.support_oppose_indicator);
  const purpose = row.expenditure_description ?? "Independent expenditure communication";
  const firstSeenAt = row.dissemination_date ?? row.expenditure_date ?? row.filing_date;

  if (!sourceUrl || !firstSeenAt || !row.sub_id) {
    return null;
  }

  const id = `fec-nv-ie-${row.sub_id}`;
  const districtName = districtNameForFec(row);
  const relationText = relation === "supports" ? "supporting" : relation === "opposes" ? "opposing" : "mentioning";
  const title = `${committeeName} ${relationText} ${candidateName}`;
  const description = `FEC-reported independent expenditure communication ${relationText} ${candidateName}. Purpose reported as "${purpose}" with ${typeof row.expenditure_amount === "number" ? `$${row.expenditure_amount.toLocaleString()}` : "spend"} in ${districtName}.`;

  return {
    id,
    title,
    description,
    sourceType: sourceTypeForFecPurpose(purpose),
    sponsorName: committeeName,
    sponsorType: sponsorTypeForFecCommittee(row),
    paidForBy: committeeName,
    producedBy: row.payee_name ?? null,
    authorizedBy: null,
    authorizationText: "FEC independent expenditure records are reported as independent communications; review the source filing for exact disclaimer language.",
    totalSpend: typeof row.expenditure_amount === "number" ? row.expenditure_amount : null,
    currency: "USD",
    impressions: null,
    firstSeenAt,
    lastSeenAt: row.expenditure_date ?? null,
    electionCycle: String(row.report_year ?? row.election_type ?? "2026"),
    geographySummary: districtName,
    platformUrl: null,
    archiveUrl: sourceUrl,
    overallSystemRating: "Needs Review",
    overallSystemConfidence: "Low",
    overallSystemExplanation: "This is a source-backed FEC independent-expenditure communication record. The spend, sponsor, candidate, support/oppose direction, and filing source are public; the ad creative itself may still need attachment from platform, broadcast, mailer, or public archive evidence.",
    overallCitizenRating: null,
    citizenAgreementPercent: null,
    citizenRatingCount: 0,
    status: "published",
    media: [
      {
        id: `${id}-fec-source`,
        politicalAdId: id,
        mediaType: "externalEmbed",
        url: sourceUrl,
        altText: `${title} FEC source filing`,
        sortOrder: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: `${id}-fec-summary`,
        politicalAdId: id,
        mediaType: "transcript",
        textContent: description,
        altText: `${title} source-backed summary`,
        sortOrder: 1,
        createdAt: new Date().toISOString(),
      },
    ],
    entityRelations: [
      {
        id: `${id}-candidate-${row.candidate_id ?? slugify(candidateName)}-${relation}`,
        politicalAdId: id,
        entityType: "candidate",
        entityId: row.candidate_id ?? slugify(candidateName),
        entityLabel: candidateName,
        relationType: relation,
        createdAt: new Date().toISOString(),
      },
    ],
    geographies: [
      {
        id: `${id}-geo-nevada`,
        politicalAdId: id,
        country: "United States",
        state: "Nevada",
        county: null,
        city: null,
        districtType: row.candidate_office === "H" ? "congressional" : "statewide",
        districtName,
        precinct: null,
        createdAt: new Date().toISOString(),
      },
    ],
    claims: [],
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
const fecImport = readJson<FecIndependentExpenditureImport>(FEC_IMPORT_PATH, { records: [] });
const fecRecords = Array.isArray(fecImport.records) ? fecImport.records : [];
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
const fecAds = fecRecords.map(normalizeFecRecord).filter((ad): ad is PoliticalAd => Boolean(ad));
const dedupedAds = [...new Map([...ads, ...fecAds].map((ad) => [ad.id, ad])).values()];

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: MANUAL_INTAKE_PATH,
      ads: dedupedAds,
      totals: {
        intakeRecords: records.length,
        reviewedSourceBackedAds: dedupedAds.length,
        manualReviewedAds: ads.length,
        fecIndependentExpenditureAds: fecAds.length,
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
      reviewedSourceBackedAds: dedupedAds.length,
      fecIndependentExpenditureAds: fecAds.length,
      reviewQueueRecords: reviewQueue.length,
      campaignFinanceAdSpendLeads: financeReviewQueue.length,
      output: OUTPUT_PATH,
      reviewQueue: REVIEW_QUEUE_PATH,
    },
    null,
    2,
  ),
);
