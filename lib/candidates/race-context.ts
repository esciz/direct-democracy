import { CivicEntityType, CivicRecordReviewStatus, ProfileEnrichmentReviewStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const APPROVED_KNOWLEDGE = [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED];
const APPROVED_CIVIC = [CivicRecordReviewStatus.approved, CivicRecordReviewStatus.verified];

export type CandidateRaceContext = {
  candidateId: string;
  electionId: string;
  electionTitle: string;
  electionDate: string | null;
  officeTitle: string;
  jurisdictionName: string;
  districtName: string | null;
  filingStatus: string | null;
  partyText: string | null;
  isContested: boolean;
  sourceName: string;
  sourceUrl: string | null;
  candidates: Array<{
    id: string;
    name: string;
    partyText: string | null;
    filingStatus: string | null;
    isCurrent: boolean;
  }>;
  missingFields: string[];
  suggestedSearchQuery: string;
};

function normalized(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hasArrayJson(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function missingField(label: string, present: boolean) {
  return present ? null : label;
}

export async function getCandidateRaceContext(candidateId: string): Promise<CandidateRaceContext | null> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      election: { select: { id: true, title: true, electionDate: true } },
      office: { select: { id: true, title: true } },
      jurisdiction: { select: { name: true } },
      district: { select: { name: true } },
      source: { select: { name: true, url: true } },
      knowledgeEnrichments: {
        where: { reviewStatus: { in: APPROVED_KNOWLEDGE } },
        select: {
          aboutSummary: true,
          ownWordsSummary: true,
          issues: true,
          financeContext: true,
          socialLinks: true,
        },
      },
      issuePositions: {
        where: { reviewStatus: { in: APPROVED_CIVIC } },
        select: { id: true },
        take: 1,
      },
      newsMentions: {
        where: { reviewStatus: { in: APPROVED_CIVIC } },
        select: { id: true },
        take: 1,
      },
      campaignFinanceFilings: { select: { id: true }, take: 1 },
    },
  });

  if (!candidate) return null;

  const electionCandidates = await prisma.candidate.findMany({
    where: { electionId: candidate.electionId },
    include: {
      office: { select: { title: true } },
      district: { select: { name: true } },
    },
    orderBy: [{ ballotName: "asc" }, { fullName: "asc" }],
  });

  const officeTitle = candidate.office?.title ?? "Office needs review";
  const officeKey = normalized(officeTitle);
  const districtKey = normalized(candidate.district?.name);
  const raceCandidates = electionCandidates.filter((row) => {
    const sameOffice = candidate.officeId ? row.officeId === candidate.officeId : normalized(row.office?.title) === officeKey;
    const sameDistrict = candidate.districtId ? row.districtId === candidate.districtId : normalized(row.district?.name) === districtKey;
    return sameOffice && sameDistrict;
  });

  const approvedKnowledge = candidate.knowledgeEnrichments;
  const hasBio = Boolean(candidate.campaignStatement) || approvedKnowledge.some((entry) => Boolean(entry.aboutSummary));
  const hasStatement = Boolean(candidate.campaignStatement) || approvedKnowledge.some((entry) => Boolean(entry.ownWordsSummary));
  const hasIssues = candidate.issuePositions.length > 0 || approvedKnowledge.some((entry) => hasArrayJson(entry.issues));
  const hasFinance = candidate.campaignFinanceFilings.length > 0 || approvedKnowledge.some((entry) => Boolean(entry.financeContext));
  const hasSocial = hasArrayJson(candidate.socialLinks) || approvedKnowledge.some((entry) => hasArrayJson(entry.socialLinks));
  const hasCampaignWebsite = Boolean(candidate.websiteUrl);
  const hasNews = candidate.newsMentions.length > 0;

  const sourceAttributions = await prisma.sourceAttribution.findMany({
    where: {
      entityType: CivicEntityType.CANDIDATE,
      entityId: candidate.id,
      fieldName: { in: ["campaign_website", "campaign_finance", "bio", "candidate_statement", "social_links"] },
      reviewStatus: { in: APPROVED_CIVIC },
    },
    select: { fieldName: true },
  });
  const attributed = new Set(sourceAttributions.map((row) => row.fieldName));

  const missingFields = [
    missingField("Candidate bio", hasBio || attributed.has("bio")),
    missingField("Campaign website", hasCampaignWebsite || attributed.has("campaign_website")),
    missingField("Candidate statement", hasStatement || attributed.has("candidate_statement")),
    missingField("Issue priorities", hasIssues),
    missingField("Campaign finance", hasFinance || attributed.has("campaign_finance")),
    missingField("News mentions", hasNews),
    missingField("Social links", hasSocial || attributed.has("social_links")),
  ].filter((field): field is string => Boolean(field));

  const displayName = candidate.ballotName ?? candidate.fullName;
  const suggestedSearchQuery = `"${displayName}" ${officeTitle} Nevada`;

  return {
    candidateId: candidate.id,
    electionId: candidate.election.id,
    electionTitle: candidate.election.title,
    electionDate: candidate.election.electionDate?.toISOString() ?? null,
    officeTitle,
    jurisdictionName: candidate.jurisdiction.name,
    districtName: candidate.district?.name ?? null,
    filingStatus: candidate.filingStatus ?? candidate.status,
    partyText: candidate.partyText,
    isContested: raceCandidates.length > 1,
    sourceName: candidate.source?.name ?? "Nevada SOS candidate filing source",
    sourceUrl: candidate.sourceUrl ?? candidate.source?.url ?? null,
    candidates: raceCandidates.map((row) => ({
      id: row.id,
      name: row.ballotName ?? row.fullName,
      partyText: row.partyText,
      filingStatus: row.filingStatus ?? row.status,
      isCurrent: row.id === candidate.id,
    })),
    missingFields,
    suggestedSearchQuery,
  };
}
