#!/usr/bin/env node

import { CandidateKnowledgeSourceType, PrismaClient, ProfileEnrichmentReviewStatus, ProfileEnrichmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

const OFFICIAL_BIO_URL = "https://www.gov.nv.gov/about/governor-joe-lombardo/";
const GOVERNOR_HOME_URL = "https://www.gov.nv.gov/";
const CAMPAIGN_URL = "https://www.joelombardofornv.com/";
const CAMPAIGN_PRESS_URL = "https://www.joelombardofornv.com/press-releases";
const OFFICIAL_HEADSHOT_URL = "https://www.gov.nv.gov/uploadedImages/gov2022nvgov/content/AboutUs/Governor%20Joe%20Lombardo_Official%20Photo_600px.jpg";
const SOS_FINANCE_URL = "https://www.nvsos.gov/soscandidateservices/anonymousaccess/cefdsearchuu/CandidateDetails.aspx?o=NZZn4mEHsNMU0L1EsD6oJg%253d%253d";
const CAMPAIGN_FINANCE_PRESS_URL = "https://www.joelombardofornv.com/governor-lombardo-announces-recordbreaking-15-million-cashonhand";
const FINANCE_FILINGS = [
  { externalId: "lombardo-2026-ce-report-1", name: "CE Report 1", filedAt: "2026-04-15T00:00:00.000Z", filingType: "CONTRIBUTION_EXPENSE" },
  { externalId: "lombardo-2026-candidate-financial-disclosure", name: "2026 Candidate Financial Disclosure", filedAt: "2026-03-23T00:00:00.000Z", filingType: "CANDIDATE_REPORT" },
  { externalId: "lombardo-2026-annual-ce-filing", name: "2026 Annual CE Filing", filedAt: "2026-01-15T00:00:00.000Z", filingType: "CONTRIBUTION_EXPENSE" },
];

const OFFICIAL_SUMMARY =
  "Joe Lombardo is the 31st Governor of Nevada. The Governor's Office biography says he grew up in a military family, attended Rancho High School in North Las Vegas, earned a Bachelor of Science from UNLV, served in the United States Army and Nevada National Guard, worked for the Las Vegas Metropolitan Police Department, earned a Master of Science in Crisis Management from UNLV, and was elected Clark County Sheriff before becoming governor in January 2023.";

const OFFICE_RESPONSIBILITIES =
  "The Governor of Nevada leads the state's executive branch. The official Governor's Office site connects the office to constituent services, executive actions, appointments, strategic planning, and statewide administration.";

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

async function findLombardoCandidate() {
  return prisma.candidate.findFirst({
    where: {
      OR: [
        { fullName: { contains: "Lombardo", mode: "insensitive" } },
        { ballotName: { contains: "Lombardo", mode: "insensitive" } },
      ],
      office: { title: { contains: "Governor", mode: "insensitive" } },
    },
    include: { office: true, jurisdiction: true, election: true },
  });
}

async function findLombardoOfficial() {
  return prisma.official.findFirst({
    where: {
      OR: [
        { fullName: { contains: "Joe Lombardo", mode: "insensitive" } },
        { fullName: { contains: "Joseph Lombardo", mode: "insensitive" } },
      ],
      office: { title: { contains: "Governor", mode: "insensitive" } },
    },
    include: { office: true, jurisdiction: true },
  });
}

async function upsertOfficialGovernmentEnrichment(targetType, targetId, targetName, official) {
  const fetchedAt = new Date();
  const proposedFields = {
    shortBioSummary: OFFICIAL_SUMMARY,
    websiteUrl: OFFICIAL_BIO_URL,
    publicPhone: official.phone ?? "(775) 684-5670",
    officeTitle: official.office.title,
    districtOrJurisdiction: official.jurisdiction.name,
    officeResponsibilities: OFFICE_RESPONSIBILITIES,
    headshotImageUrl: OFFICIAL_HEADSHOT_URL,
    priorRole: "Clark County Sheriff",
    sourceType: "official_jurisdiction_website",
    incumbentOfficialId: official.id,
    aliases: ["Joe Lombardo", "Joseph Lombardo", "Joseph Michael Lombardo", "Governor Joe Lombardo", "Lombardo, Joe", "Lombardo, Joseph"],
  };

  await prisma.profileWebsiteEnrichment.upsert({
    where: { targetType_targetId_sourceUrl: { targetType, targetId, sourceUrl: OFFICIAL_BIO_URL } },
    create: {
      targetType,
      targetId,
      targetName,
      sourceUrl: OFFICIAL_BIO_URL,
      sourceName: "Official government source",
      campaignWebsiteUrl: null,
      officialWebsiteUrl: OFFICIAL_BIO_URL,
      headshotUrl: OFFICIAL_HEADSHOT_URL,
      shortBio: OFFICIAL_SUMMARY,
      longBioSourceUrl: OFFICIAL_BIO_URL,
      socialLinks: [],
      publicContactEmail: official.email,
      publicContactPhone: official.phone ?? "(775) 684-5670",
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: ProfileEnrichmentStatus.FETCHED,
      fetchedAt,
      proposedFields,
      fieldSources: Object.fromEntries(Object.keys(proposedFields).map((key) => [key, [OFFICIAL_BIO_URL]])),
      confidenceScore: 0.96,
      reviewStatus: ProfileEnrichmentReviewStatus.APPROVED,
      reviewNotes: "Emergency approved official government source for statewide incumbent profile display. Summary is derived from the Nevada Governor's Office biography page.",
    },
    update: {
      targetName,
      sourceName: "Official government source",
      officialWebsiteUrl: OFFICIAL_BIO_URL,
      headshotUrl: OFFICIAL_HEADSHOT_URL,
      shortBio: OFFICIAL_SUMMARY,
      longBioSourceUrl: OFFICIAL_BIO_URL,
      publicContactEmail: official.email,
      publicContactPhone: official.phone ?? "(775) 684-5670",
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: ProfileEnrichmentStatus.FETCHED,
      fetchedAt,
      proposedFields,
      fieldSources: Object.fromEntries(Object.keys(proposedFields).map((key) => [key, [OFFICIAL_BIO_URL]])),
      confidenceScore: 0.96,
      reviewStatus: ProfileEnrichmentReviewStatus.APPROVED,
      reviewNotes: "Emergency approved official government source for statewide incumbent profile display. Summary is derived from the Nevada Governor's Office biography page.",
      errorLog: null,
    },
  });
}

async function upsertWebsiteSource(candidate, sourceUrl, sourceName, reviewStatus = ProfileEnrichmentReviewStatus.APPROVED) {
  const fetchedAt = new Date();
  await prisma.profileWebsiteEnrichment.upsert({
    where: { targetType_targetId_sourceUrl: { targetType: "CANDIDATE", targetId: candidate.id, sourceUrl } },
    create: {
      targetType: "CANDIDATE",
      targetId: candidate.id,
      targetName: candidate.ballotName ?? candidate.fullName,
      sourceUrl,
      sourceName,
      campaignWebsiteUrl: sourceUrl === CAMPAIGN_URL ? sourceUrl : null,
      officialWebsiteUrl: sourceUrl === GOVERNOR_HOME_URL ? sourceUrl : null,
      headshotUrl: null,
      shortBio: null,
      longBioSourceUrl: null,
      socialLinks: [],
      publicContactEmail: null,
      publicContactPhone: null,
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: ProfileEnrichmentStatus.DISCOVERED,
      fetchedAt,
      proposedFields: { websiteUrl: sourceUrl, sourceType: sourceUrl.includes("joelombardo") ? "campaign_site" : "official_site" },
      fieldSources: { websiteUrl: [sourceUrl] },
      confidenceScore: 0.9,
      reviewStatus,
      reviewNotes: "Known source URL added for statewide incumbent profile repair. URL only; no campaign text is published from this row.",
    },
    update: {
      targetName: candidate.ballotName ?? candidate.fullName,
      sourceName,
      campaignWebsiteUrl: sourceUrl === CAMPAIGN_URL ? sourceUrl : null,
      officialWebsiteUrl: sourceUrl === GOVERNOR_HOME_URL ? sourceUrl : null,
      lastEnrichedAt: fetchedAt,
      enrichmentStatus: ProfileEnrichmentStatus.DISCOVERED,
      fetchedAt,
      proposedFields: { websiteUrl: sourceUrl, sourceType: sourceUrl.includes("joelombardo") ? "campaign_site" : "official_site" },
      fieldSources: { websiteUrl: [sourceUrl] },
      confidenceScore: 0.9,
      reviewStatus,
      reviewNotes: "Known source URL added for statewide incumbent profile repair. URL only; no campaign text is published from this row.",
      errorLog: null,
    },
  });
}

async function upsertCandidateKnowledgeSource(candidate, sourceUrl, sourceName, sourceType, reviewStatus) {
  const fetchedAt = new Date();
  await prisma.candidateKnowledgeEnrichment.upsert({
    where: { candidateId_sourceUrl: { candidateId: candidate.id, sourceUrl } },
    create: {
      candidateId: candidate.id,
      sourceUrl,
      sourceName,
      sourceType,
      sourcePriority: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? 1 : 2,
      title: sourceName,
      aboutSummary: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? OFFICIAL_SUMMARY : null,
      ownWordsSummary: null,
      issues: [],
      experienceSummary: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? "Official source references military service, UNLV education, law enforcement experience, and service as Clark County Sheriff before becoming governor." : null,
      financeContext: null,
      newsItems: [],
      socialLinks: [],
      sourceAttribution: json([{ sourceName, sourceUrl, sourceType, sourcePolicy: "source_link_or_official_summary_only" }]),
      confidenceScore: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? 0.96 : 0.82,
      reviewStatus,
      reviewNotes: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? "Emergency approved official government biography summary." : "Known campaign source URL queued for review.",
      fetchedAt,
      lastUpdatedAt: fetchedAt,
    },
    update: {
      sourceName,
      sourceType,
      sourcePriority: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? 1 : 2,
      title: sourceName,
      aboutSummary: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? OFFICIAL_SUMMARY : null,
      experienceSummary: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? "Official source references military service, UNLV education, law enforcement experience, and service as Clark County Sheriff before becoming governor." : null,
      sourceAttribution: json([{ sourceName, sourceUrl, sourceType, sourcePolicy: "source_link_or_official_summary_only" }]),
      confidenceScore: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? 0.96 : 0.82,
      reviewStatus,
      reviewNotes: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? "Emergency approved official government biography summary." : "Known campaign source URL queued for review.",
      fetchedAt,
      lastUpdatedAt: fetchedAt,
      errorLog: null,
    },
  });
}

async function upsertLombardoFinance(candidate, official) {
  const fetchedAt = new Date();
  const source = await prisma.source.upsert({
    where: { slug: "nevada-sos-lombardo-campaign-finance-details" },
    create: {
      name: "Nevada SOS Candidate Finance Details - Joe Lombardo",
      slug: "nevada-sos-lombardo-campaign-finance-details",
      sourceType: "ELECTIONS_PORTAL",
      url: SOS_FINANCE_URL,
      jurisdictionId: candidate.jurisdictionId,
      adapterKey: "manual_lombardo_campaign_finance_details",
      dataCategory: "campaign_finance",
      accessMethod: "html",
      refreshFrequency: "weekly during election season",
      lastCheckedAt: fetchedAt,
      lastSuccessAt: fetchedAt,
      lastSyncAt: fetchedAt,
      syncStatus: "SUCCESS",
      notes: "Candidate-specific Nevada SOS finance/details page. Filing rows are source-linked; detailed donor extraction is pending.",
    },
    update: {
      url: SOS_FINANCE_URL,
      jurisdictionId: candidate.jurisdictionId,
      sourceType: "ELECTIONS_PORTAL",
      dataCategory: "campaign_finance",
      accessMethod: "html",
      lastCheckedAt: fetchedAt,
      lastSuccessAt: fetchedAt,
      lastSyncAt: fetchedAt,
      syncStatus: "SUCCESS",
      errorLog: null,
      notes: "Candidate-specific Nevada SOS finance/details page. Filing rows are source-linked; detailed donor extraction is pending.",
    },
  });

  for (const filing of FINANCE_FILINGS) {
    await prisma.campaignFinanceFiling.upsert({
      where: { sourceId_externalId: { sourceId: source.id, externalId: filing.externalId } },
      create: {
        jurisdictionId: candidate.jurisdictionId,
        candidateId: candidate.id,
        sourceId: source.id,
        externalId: filing.externalId,
        filingType: filing.filingType,
        filerName: candidate.ballotName ?? candidate.fullName,
        filedAt: new Date(filing.filedAt),
        filingUrl: SOS_FINANCE_URL,
        rawData: json({
          filingName: filing.name,
          sourcePolicy: "filing_metadata_only_donor_extraction_pending",
        }),
      },
      update: {
        candidateId: candidate.id,
        filingType: filing.filingType,
        filerName: candidate.ballotName ?? candidate.fullName,
        filedAt: new Date(filing.filedAt),
        filingUrl: SOS_FINANCE_URL,
        rawData: json({
          filingName: filing.name,
          sourcePolicy: "filing_metadata_only_donor_extraction_pending",
        }),
      },
    });
  }

  const filingSummaries = FINANCE_FILINGS.map((filing) => ({
    name: filing.name,
    filedAt: filing.filedAt,
    url: SOS_FINANCE_URL,
  }));

  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: "CANDIDATE",
        entityId: candidate.id,
        fieldName: "campaign_finance",
        sourceUrl: SOS_FINANCE_URL,
      },
    },
    create: {
      entityType: "CANDIDATE",
      entityId: candidate.id,
      fieldName: "campaign_finance",
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: SOS_FINANCE_URL,
      fieldsDerived: json(["campaign finance source link", "filing names", "filing dates", "campaign-reported cash on hand source"]),
      confidenceScore: 0.88,
      reviewStatus: "approved",
      lastImportedAt: fetchedAt,
      metadata: json({
        filingSummaries,
        sourceLinks: [
          { label: "Nevada SOS finance details", url: SOS_FINANCE_URL, note: "Official candidate-specific finance/details page" },
          { label: "Campaign finance press release", url: CAMPAIGN_FINANCE_PRESS_URL, note: "Campaign-reported cash-on-hand source" },
        ],
        campaignReportedSummary: "Campaign-reported $15 million cash on hand, sourced to the Joe Lombardo for Governor campaign press release.",
        donorExtractionStatus: "Detailed donor extraction pending",
      }),
    },
    update: {
      sourceId: source.id,
      sourceName: source.name,
      fieldsDerived: json(["campaign finance source link", "filing names", "filing dates", "campaign-reported cash on hand source"]),
      confidenceScore: 0.88,
      reviewStatus: "approved",
      lastImportedAt: fetchedAt,
      metadata: json({
        filingSummaries,
        sourceLinks: [
          { label: "Nevada SOS finance details", url: SOS_FINANCE_URL, note: "Official candidate-specific finance/details page" },
          { label: "Campaign finance press release", url: CAMPAIGN_FINANCE_PRESS_URL, note: "Campaign-reported cash-on-hand source" },
        ],
        campaignReportedSummary: "Campaign-reported $15 million cash on hand, sourced to the Joe Lombardo for Governor campaign press release.",
        donorExtractionStatus: "Detailed donor extraction pending",
      }),
    },
  });

  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: "OFFICIAL",
        entityId: official.id,
        fieldName: "campaign_finance",
        sourceUrl: SOS_FINANCE_URL,
      },
    },
    create: {
      entityType: "OFFICIAL",
      entityId: official.id,
      fieldName: "campaign_finance",
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: SOS_FINANCE_URL,
      fieldsDerived: json(["candidate campaign finance source link", "filing names", "filing dates"]),
      confidenceScore: 0.82,
      reviewStatus: "approved",
      lastImportedAt: fetchedAt,
      metadata: json({
        filingSummaries,
        sourceLinks: [
          { label: "Nevada SOS finance details", url: SOS_FINANCE_URL, note: "Official candidate-specific finance/details page" },
          { label: "Campaign finance press release", url: CAMPAIGN_FINANCE_PRESS_URL, note: "Campaign-reported cash-on-hand source" },
        ],
        campaignReportedSummary: "Campaign-reported $15 million cash on hand, sourced to the Joe Lombardo for Governor campaign press release.",
        donorExtractionStatus: "Detailed donor extraction pending",
      }),
    },
    update: {
      sourceId: source.id,
      sourceName: source.name,
      fieldsDerived: json(["candidate campaign finance source link", "filing names", "filing dates"]),
      confidenceScore: 0.82,
      reviewStatus: "approved",
      lastImportedAt: fetchedAt,
      metadata: json({
        filingSummaries,
        sourceLinks: [
          { label: "Nevada SOS finance details", url: SOS_FINANCE_URL, note: "Official candidate-specific finance/details page" },
          { label: "Campaign finance press release", url: CAMPAIGN_FINANCE_PRESS_URL, note: "Campaign-reported cash-on-hand source" },
        ],
        campaignReportedSummary: "Campaign-reported $15 million cash on hand, sourced to the Joe Lombardo for Governor campaign press release.",
        donorExtractionStatus: "Detailed donor extraction pending",
      }),
    },
  });

  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: "CANDIDATE",
        entityId: candidate.id,
        fieldName: "profile_image",
        sourceUrl: OFFICIAL_BIO_URL,
      },
    },
    create: {
      entityType: "CANDIDATE",
      entityId: candidate.id,
      fieldName: "profile_image",
      sourceName: "Nevada Governor's Office",
      sourceUrl: OFFICIAL_BIO_URL,
      fieldsDerived: json(["official headshot"]),
      confidenceScore: 0.96,
      reviewStatus: "approved",
      lastImportedAt: fetchedAt,
      metadata: json({ imageUrl: OFFICIAL_HEADSHOT_URL, imagePolicy: "official government site image" }),
    },
    update: {
      sourceName: "Nevada Governor's Office",
      fieldsDerived: json(["official headshot"]),
      confidenceScore: 0.96,
      reviewStatus: "approved",
      lastImportedAt: fetchedAt,
      metadata: json({ imageUrl: OFFICIAL_HEADSHOT_URL, imagePolicy: "official government site image" }),
    },
  });

  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: "OFFICIAL",
        entityId: official.id,
        fieldName: "profile_image",
        sourceUrl: OFFICIAL_BIO_URL,
      },
    },
    create: {
      entityType: "OFFICIAL",
      entityId: official.id,
      fieldName: "profile_image",
      sourceName: "Nevada Governor's Office",
      sourceUrl: OFFICIAL_BIO_URL,
      fieldsDerived: json(["official headshot"]),
      confidenceScore: 0.96,
      reviewStatus: "approved",
      lastImportedAt: fetchedAt,
      metadata: json({ imageUrl: OFFICIAL_HEADSHOT_URL, imagePolicy: "official government site image" }),
    },
    update: {
      sourceName: "Nevada Governor's Office",
      fieldsDerived: json(["official headshot"]),
      confidenceScore: 0.96,
      reviewStatus: "approved",
      lastImportedAt: fetchedAt,
      metadata: json({ imageUrl: OFFICIAL_HEADSHOT_URL, imagePolicy: "official government site image" }),
    },
  });
}

async function main() {
  const candidate = await findLombardoCandidate();
  const official = await findLombardoOfficial();
  if (!candidate || !official) {
    throw new Error(`Missing Lombardo records. candidate=${Boolean(candidate)} official=${Boolean(official)}`);
  }

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: {
      isIncumbent: true,
      websiteUrl: CAMPAIGN_URL,
      photoUrl: OFFICIAL_HEADSHOT_URL,
      phone: candidate.phone,
    },
  });

  await prisma.official.update({
    where: { id: official.id },
    data: {
      websiteUrl: GOVERNOR_HOME_URL,
      photoUrl: OFFICIAL_HEADSHOT_URL,
      phone: official.phone ?? "(775) 684-5670",
    },
  });

  await upsertOfficialGovernmentEnrichment("CANDIDATE", candidate.id, candidate.ballotName ?? candidate.fullName, official);
  await upsertOfficialGovernmentEnrichment("OFFICIAL", official.id, official.fullName, official);
  await upsertWebsiteSource(candidate, CAMPAIGN_URL, "Joe Lombardo for Governor", ProfileEnrichmentReviewStatus.APPROVED);
  await upsertWebsiteSource(candidate, CAMPAIGN_PRESS_URL, "Joe Lombardo for Governor Press Releases", ProfileEnrichmentReviewStatus.PENDING_REVIEW);
  await upsertWebsiteSource(candidate, CAMPAIGN_FINANCE_PRESS_URL, "Joe Lombardo for Governor Campaign Finance Press Release", ProfileEnrichmentReviewStatus.PENDING_REVIEW);
  await upsertCandidateKnowledgeSource(candidate, OFFICIAL_BIO_URL, "Nevada Governor's Office", CandidateKnowledgeSourceType.OFFICIAL_WEBSITE, ProfileEnrichmentReviewStatus.APPROVED);
  await upsertCandidateKnowledgeSource(candidate, CAMPAIGN_URL, "Joe Lombardo for Governor", CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE, ProfileEnrichmentReviewStatus.PENDING_REVIEW);
  await upsertCandidateKnowledgeSource(candidate, CAMPAIGN_PRESS_URL, "Joe Lombardo for Governor Press Releases", CandidateKnowledgeSourceType.PRESS_RELEASE, ProfileEnrichmentReviewStatus.PENDING_REVIEW);
  await upsertCandidateKnowledgeSource(candidate, CAMPAIGN_FINANCE_PRESS_URL, "Joe Lombardo for Governor Campaign Finance Press Release", CandidateKnowledgeSourceType.PRESS_RELEASE, ProfileEnrichmentReviewStatus.PENDING_REVIEW);
  await upsertLombardoFinance(candidate, official);

  const officialMentions = await prisma.newsMention.findMany({
    where: {
      officialId: official.id,
      reviewStatus: { in: ["approved", "verified"] },
    },
    orderBy: [{ publishedAt: "desc" }],
    take: 6,
  });

  for (const mention of officialMentions) {
    await prisma.newsMention.upsert({
      where: { duplicateHash: `${mention.duplicateHash}:candidate:${candidate.id}` },
      create: {
        targetType: "CANDIDATE",
        targetId: candidate.id,
        candidateId: candidate.id,
        title: mention.title,
        sourceName: mention.sourceName,
        sourceDomain: mention.sourceDomain,
        url: mention.url,
        canonicalUrl: mention.canonicalUrl,
        publishedAt: mention.publishedAt,
        discoveredAt: mention.discoveredAt,
        snippetOrSummary: mention.snippetOrSummary,
        matchedQuery: mention.matchedQuery,
        matchedTerms: mention.matchedTerms,
        confidenceScore: mention.confidenceScore,
        provider: mention.provider,
        reviewStatus: mention.reviewStatus,
        duplicateHash: `${mention.duplicateHash}:candidate:${candidate.id}`,
      },
      update: {
        targetId: candidate.id,
        candidateId: candidate.id,
        title: mention.title,
        sourceName: mention.sourceName,
        sourceDomain: mention.sourceDomain,
        url: mention.url,
        canonicalUrl: mention.canonicalUrl,
        publishedAt: mention.publishedAt,
        snippetOrSummary: mention.snippetOrSummary,
        matchedQuery: mention.matchedQuery,
        matchedTerms: mention.matchedTerms,
        confidenceScore: mention.confidenceScore,
        provider: mention.provider,
        reviewStatus: mention.reviewStatus,
      },
    });
  }

  console.log(JSON.stringify({
    candidateId: candidate.id,
    officialId: official.id,
    aliases: ["Joe Lombardo", "Joseph Lombardo", "Joseph Michael Lombardo", "Governor Joe Lombardo", "Lombardo, Joe", "Lombardo, Joseph"],
    sources: [OFFICIAL_BIO_URL, GOVERNOR_HOME_URL, CAMPAIGN_URL, CAMPAIGN_PRESS_URL, SOS_FINANCE_URL, CAMPAIGN_FINANCE_PRESS_URL],
    headshotUrl: OFFICIAL_HEADSHOT_URL,
    financeFilings: FINANCE_FILINGS.length,
    mirroredApprovedNewsMentions: officialMentions.length,
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
