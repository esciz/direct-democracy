#!/usr/bin/env node

import {
  CandidateKnowledgeSourceType,
  CivicRecordReviewStatus,
  PrismaClient,
  ProfileEnrichmentReviewStatus,
  ProfileEnrichmentStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const OFFICIAL_HOME_URL = "https://www.rosen.senate.gov/";
const OFFICIAL_BIO_URL = "https://www.rosen.senate.gov/about-jacky/";
const FEC_CANDIDATE_URL = "https://www.fec.gov/data/candidate/S8NV00156/";
const FEC_CANDIDATE_ID = "S8NV00156";
const FEC_COMMITTEE_ID = "C00606939";
const FINANCE_PERIOD = "January 1, 2019 through December 31, 2024";
const FINANCE_TOTALS = {
  totalRaised: 52_192_355.94,
  totalSpent: 50_590_450,
  cashOnHand: 1_780_095.8,
  debtsOwedByCommittee: 0,
};

const BIO_SUMMARY =
  "Jacky Rosen is a U.S. Senator for Nevada. Her official Senate biography says she was elected to the U.S. House in 2016 and the U.S. Senate in 2018 after a career as a computer programmer and service as president of Congregation Ner Tamid. She earned degrees from the University of Minnesota and Clark County Community College and has lived in Nevada for more than 40 years.";

const EXPERIENCE_SUMMARY =
  "Rosen's official biography describes prior work as a computer programmer, service as president of Congregation Ner Tamid, election to the U.S. House in 2016, and election to the U.S. Senate in 2018.";

const ISSUE_POSITIONS = [
  {
    issueText: "Affordable Housing",
    issueSlug: "affordable-housing",
    summary: "Supports expanding access to affordable housing and lowering household costs, alongside middle-class tax relief and affordable child care.",
  },
  {
    issueText: "Healthcare Access",
    issueSlug: "healthcare-access",
    summary: "Supports lowering health care and prescription drug costs, addressing Nevada's doctor shortage, expanding telemedicine and rural care, and protecting Medicare and Social Security.",
  },
  {
    issueText: "Comprehensive Immigration Reform",
    issueSlug: "comprehensive-immigration-reform",
    summary: "Supports comprehensive immigration reform with a pathway to citizenship, stronger border security, and protections that keep families together.",
  },
  {
    issueText: "Reproductive Rights",
    issueSlug: "reproductive-rights",
    summary: "Supports women's reproductive health rights, along with LGBTQ+ rights and voting rights.",
  },
  {
    issueText: "Environment",
    issueSlug: "environment",
    summary: "Supports drought and wildfire resilience, public-land conservation, clean energy development, and continued opposition to reviving Yucca Mountain as a nuclear-waste site.",
  },
  {
    issueText: "Veterans and National Security",
    issueSlug: "veterans-and-national-security",
    summary: "Supports resources for Nevada servicemembers, military families, defense installations, veterans' benefits, law enforcement, and first responders.",
  },
];

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

async function findProfiles() {
  const [candidate, official] = await Promise.all([
    prisma.candidate.findFirst({
      where: {
        fullName: { equals: "Jacky Rosen", mode: "insensitive" },
        office: { title: { contains: "Senator", mode: "insensitive" } },
      },
      include: { election: true, jurisdiction: true, office: true },
      orderBy: { election: { electionDate: "desc" } },
    }),
    prisma.official.findFirst({
      where: {
        fullName: { equals: "Jacky Rosen", mode: "insensitive" },
        office: { title: { contains: "Senator", mode: "insensitive" } },
      },
      include: { jurisdiction: true, office: true },
    }),
  ]);

  if (!candidate || !official) {
    throw new Error(`Missing Jacky Rosen records. candidate=${Boolean(candidate)} official=${Boolean(official)}`);
  }

  return { candidate, official };
}

async function upsertGovernmentSource(jurisdictionId) {
  const checkedAt = new Date();
  return prisma.source.upsert({
    where: { slug: "us-senate-jacky-rosen-profile" },
    create: {
      name: "U.S. Senate - Jacky Rosen",
      slug: "us-senate-jacky-rosen-profile",
      sourceType: "GOVERNMENT_PORTAL",
      url: OFFICIAL_BIO_URL,
      jurisdictionId,
      adapterKey: "manual_rosen_official_profile",
      dataCategory: "candidate_profile",
      accessMethod: "html",
      refreshFrequency: "monthly",
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastSyncAt: checkedAt,
      syncStatus: "SUCCESS",
      notes: "Reviewed official Senate biography and policy-priority source for Jacky Rosen.",
    },
    update: {
      url: OFFICIAL_BIO_URL,
      jurisdictionId,
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastSyncAt: checkedAt,
      syncStatus: "SUCCESS",
      errorLog: null,
    },
  });
}

async function upsertFecSource(jurisdictionId) {
  const checkedAt = new Date();
  return prisma.source.upsert({
    where: { slug: "fec-jacky-rosen-candidate-finance" },
    create: {
      name: "Federal Election Commission - Jacky Rosen",
      slug: "fec-jacky-rosen-candidate-finance",
      sourceType: "GOVERNMENT_PORTAL",
      url: FEC_CANDIDATE_URL,
      jurisdictionId,
      adapterKey: "manual_fec_rosen_totals",
      dataCategory: "campaign_finance",
      accessMethod: "api",
      refreshFrequency: "quarterly",
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastSyncAt: checkedAt,
      syncStatus: "SUCCESS",
      metadata: json({ candidateId: FEC_CANDIDATE_ID, principalCommitteeId: FEC_COMMITTEE_ID }),
      notes: `Reviewed FEC election-full totals covering ${FINANCE_PERIOD}.`,
    },
    update: {
      url: FEC_CANDIDATE_URL,
      jurisdictionId,
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastSyncAt: checkedAt,
      syncStatus: "SUCCESS",
      errorLog: null,
      metadata: json({ candidateId: FEC_CANDIDATE_ID, principalCommitteeId: FEC_COMMITTEE_ID }),
    },
  });
}

async function upsertOfficialEnrichment(targetType, targetId, targetName, official) {
  const fetchedAt = new Date();
  const proposedFields = {
    shortBioSummary: BIO_SUMMARY,
    websiteUrl: OFFICIAL_HOME_URL,
    officeTitle: official.office.title,
    districtOrJurisdiction: official.jurisdiction.name,
    incumbentOfficialId: official.id,
    sourceType: "official_federal_website",
  };

  await prisma.profileWebsiteEnrichment.upsert({
    where: { targetType_targetId_sourceUrl: { targetType, targetId, sourceUrl: OFFICIAL_BIO_URL } },
    create: {
      targetType,
      targetId,
      targetName,
      sourceUrl: OFFICIAL_BIO_URL,
      sourceName: "Official government source",
      officialWebsiteUrl: OFFICIAL_HOME_URL,
      shortBio: BIO_SUMMARY,
      longBioSourceUrl: OFFICIAL_BIO_URL,
      socialLinks: [],
      publicContactEmail: official.email,
      publicContactPhone: official.phone,
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: ProfileEnrichmentStatus.FETCHED,
      fetchedAt,
      proposedFields: json(proposedFields),
      fieldSources: json(Object.fromEntries(Object.keys(proposedFields).map((field) => [field, [OFFICIAL_BIO_URL]]))),
      confidenceScore: 0.97,
      reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
      reviewNotes: "Verified against the official U.S. Senate biography page.",
    },
    update: {
      targetName,
      sourceName: "Official government source",
      officialWebsiteUrl: OFFICIAL_HOME_URL,
      shortBio: BIO_SUMMARY,
      longBioSourceUrl: OFFICIAL_BIO_URL,
      publicContactEmail: official.email,
      publicContactPhone: official.phone,
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: ProfileEnrichmentStatus.FETCHED,
      fetchedAt,
      proposedFields: json(proposedFields),
      fieldSources: json(Object.fromEntries(Object.keys(proposedFields).map((field) => [field, [OFFICIAL_BIO_URL]]))),
      confidenceScore: 0.97,
      reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
      reviewNotes: "Verified against the official U.S. Senate biography page.",
      errorLog: null,
    },
  });
}

async function upsertKnowledge(candidate) {
  const fetchedAt = new Date();
  const issues = ISSUE_POSITIONS.map((position) => ({
    label: position.issueText,
    summary: position.summary,
    sourceUrl: OFFICIAL_BIO_URL,
  }));

  await prisma.candidateKnowledgeEnrichment.upsert({
    where: { candidateId_sourceUrl: { candidateId: candidate.id, sourceUrl: OFFICIAL_BIO_URL } },
    create: {
      candidateId: candidate.id,
      sourceUrl: OFFICIAL_BIO_URL,
      sourceName: "U.S. Senate - Jacky Rosen",
      sourceType: CandidateKnowledgeSourceType.OFFICIAL_WEBSITE,
      sourcePriority: 1,
      title: "About Jacky",
      aboutSummary: BIO_SUMMARY,
      issues: json(issues),
      experienceSummary: EXPERIENCE_SUMMARY,
      newsItems: [],
      socialLinks: [],
      sourceAttribution: json([{ sourceName: "U.S. Senate - Jacky Rosen", sourceUrl: OFFICIAL_BIO_URL, sourceType: "OFFICIAL_WEBSITE" }]),
      confidenceScore: 0.97,
      reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
      reviewNotes: "Reviewed paraphrases of the official Senate biography and issue-priority statements.",
      fetchedAt,
      lastUpdatedAt: fetchedAt,
    },
    update: {
      sourceName: "U.S. Senate - Jacky Rosen",
      sourceType: CandidateKnowledgeSourceType.OFFICIAL_WEBSITE,
      sourcePriority: 1,
      title: "About Jacky",
      aboutSummary: BIO_SUMMARY,
      issues: json(issues),
      experienceSummary: EXPERIENCE_SUMMARY,
      sourceAttribution: json([{ sourceName: "U.S. Senate - Jacky Rosen", sourceUrl: OFFICIAL_BIO_URL, sourceType: "OFFICIAL_WEBSITE" }]),
      confidenceScore: 0.97,
      reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
      reviewNotes: "Reviewed paraphrases of the official Senate biography and issue-priority statements.",
      fetchedAt,
      lastUpdatedAt: fetchedAt,
      errorLog: null,
    },
  });
}

async function upsertPosition(target, source, position) {
  const where = {
    ...(target.type === "candidate" ? { candidateId: target.id } : { officialId: target.id }),
    issueSlug: position.issueSlug,
    evidenceUrl: OFFICIAL_BIO_URL,
  };
  const data = {
    ...where,
    issueText: position.issueText,
    stance: "SUPPORTS",
    derivation: "OFFICIAL",
    summary: position.summary,
    evidenceTitle: "About Jacky",
    evidenceSourceName: "U.S. Senate - Jacky Rosen",
    sourceId: source.id,
    confidenceScore: 0.97,
    reviewStatus: CivicRecordReviewStatus.verified,
    verificationStatus: CivicRecordReviewStatus.verified,
    lastObservedAt: new Date(),
  };
  const existing = await prisma.issuePosition.findFirst({ where, select: { id: true } });
  if (existing) return prisma.issuePosition.update({ where: { id: existing.id }, data });
  return prisma.issuePosition.create({ data });
}

async function upsertFinance(candidate, official, source) {
  const checkedAt = new Date();
  const summaryText =
    `FEC-reported totals for ${FINANCE_PERIOD}: $52.19 million in receipts, $50.59 million in disbursements, $1.78 million cash on hand, and $0 in debts owed by the committee.`;
  const existingSummary = await prisma.campaignFinanceSummary.findFirst({
    where: { candidateId: candidate.id, sourceUrl: FEC_CANDIDATE_URL },
    select: { id: true },
  });
  const summaryData = {
    candidateId: candidate.id,
    totalRaised: FINANCE_TOTALS.totalRaised,
    totalSpent: FINANCE_TOTALS.totalSpent,
    cashOnHand: FINANCE_TOTALS.cashOnHand,
    reportingPeriod: FINANCE_PERIOD,
    sourceName: source.name,
    sourceUrl: FEC_CANDIDATE_URL,
    reviewStatus: CivicRecordReviewStatus.verified,
    lastUpdated: checkedAt,
  };
  if (existingSummary) await prisma.campaignFinanceSummary.update({ where: { id: existingSummary.id }, data: summaryData });
  else await prisma.campaignFinanceSummary.create({ data: summaryData });

  await prisma.campaignFinanceFiling.upsert({
    where: { sourceId_externalId: { sourceId: source.id, externalId: `${FEC_CANDIDATE_ID}-2024-election-full-totals` } },
    create: {
      jurisdictionId: candidate.jurisdictionId,
      candidateId: candidate.id,
      sourceId: source.id,
      externalId: `${FEC_CANDIDATE_ID}-2024-election-full-totals`,
      filingType: "COMMITTEE_REPORT",
      filerName: "Rosen for Nevada",
      periodStart: new Date("2019-01-01T00:00:00.000Z"),
      periodEnd: new Date("2024-12-31T00:00:00.000Z"),
      amountRaised: FINANCE_TOTALS.totalRaised,
      amountSpent: FINANCE_TOTALS.totalSpent,
      filingUrl: FEC_CANDIDATE_URL,
      rawData: json({ filingName: "2019-2024 FEC election-cycle totals", candidateId: FEC_CANDIDATE_ID, committeeId: FEC_COMMITTEE_ID, cashOnHand: FINANCE_TOTALS.cashOnHand, debtsOwedByCommittee: 0 }),
    },
    update: {
      candidateId: candidate.id,
      periodStart: new Date("2019-01-01T00:00:00.000Z"),
      periodEnd: new Date("2024-12-31T00:00:00.000Z"),
      amountRaised: FINANCE_TOTALS.totalRaised,
      amountSpent: FINANCE_TOTALS.totalSpent,
      filingUrl: FEC_CANDIDATE_URL,
      rawData: json({ filingName: "2019-2024 FEC election-cycle totals", candidateId: FEC_CANDIDATE_ID, committeeId: FEC_COMMITTEE_ID, cashOnHand: FINANCE_TOTALS.cashOnHand, debtsOwedByCommittee: 0 }),
    },
  });

  const metadata = json({
    filingSummaries: [{ name: "2019-2024 FEC election-cycle totals", filedAt: "2024-12-31T00:00:00.000Z", url: FEC_CANDIDATE_URL }],
    sourceLinks: [{ label: "FEC candidate overview", url: FEC_CANDIDATE_URL, note: `Federal candidate and committee totals covering ${FINANCE_PERIOD}` }],
    campaignReportedSummary: summaryText,
    donorExtractionStatus: "Official FEC summary totals are available. Itemized contribution classification has not been imported.",
  });

  for (const target of [
    { entityType: "CANDIDATE", entityId: candidate.id },
    { entityType: "OFFICIAL", entityId: official.id },
  ]) {
    await prisma.sourceAttribution.upsert({
      where: { entityType_entityId_fieldName_sourceUrl: { ...target, fieldName: "campaign_finance", sourceUrl: FEC_CANDIDATE_URL } },
      create: {
        ...target,
        fieldName: "campaign_finance",
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: FEC_CANDIDATE_URL,
        fieldsDerived: json(["total receipts", "total disbursements", "cash on hand", "committee debt", "coverage period"]),
        confidenceScore: 0.99,
        reviewStatus: CivicRecordReviewStatus.verified,
        lastImportedAt: checkedAt,
        verifiedAt: checkedAt,
        metadata,
      },
      update: {
        sourceId: source.id,
        sourceName: source.name,
        fieldsDerived: json(["total receipts", "total disbursements", "cash on hand", "committee debt", "coverage period"]),
        confidenceScore: 0.99,
        reviewStatus: CivicRecordReviewStatus.verified,
        lastImportedAt: checkedAt,
        verifiedAt: checkedAt,
        metadata,
      },
    });
  }
}

async function resolveQualityIssues(candidateId, officialId) {
  const resolvedAt = new Date();
  await prisma.dataQualityIssue.updateMany({
    where: {
      recordType: { in: ["CANDIDATE", "OFFICIAL"] },
      recordId: { in: [candidateId, officialId] },
      issueType: { in: ["missing_bio", "missing_campaign_finance", "missing_issue_positions"] },
      status: { in: ["open", "in_review"] },
    },
    data: { status: "resolved", resolvedAt, notes: "Resolved by reviewed official Senate and FEC source imports." },
  });
}

async function main() {
  const { candidate, official } = await findProfiles();
  const [governmentSource, fecSource] = await Promise.all([
    upsertGovernmentSource(candidate.jurisdictionId),
    upsertFecSource(candidate.jurisdictionId),
  ]);

  await prisma.candidate.update({ where: { id: candidate.id }, data: { isIncumbent: true } });
  await prisma.official.update({ where: { id: official.id }, data: { websiteUrl: OFFICIAL_HOME_URL } });
  await upsertOfficialEnrichment("CANDIDATE", candidate.id, candidate.ballotName ?? candidate.fullName, official);
  await upsertOfficialEnrichment("OFFICIAL", official.id, official.fullName, official);
  await upsertKnowledge(candidate);

  for (const position of ISSUE_POSITIONS) {
    await upsertPosition({ type: "candidate", id: candidate.id }, governmentSource, position);
    await upsertPosition({ type: "official", id: official.id }, governmentSource, position);
  }

  await upsertFinance(candidate, official, fecSource);
  await resolveQualityIssues(candidate.id, official.id);

  console.log(JSON.stringify({
    candidateId: candidate.id,
    officialId: official.id,
    bioSource: OFFICIAL_BIO_URL,
    issuePositions: ISSUE_POSITIONS.length,
    financeSource: FEC_CANDIDATE_URL,
    financePeriod: FINANCE_PERIOD,
    financeTotals: FINANCE_TOTALS,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
