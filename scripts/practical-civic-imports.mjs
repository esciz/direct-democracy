#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  CandidateKnowledgeSourceType,
  CivicDataAccessMethod,
  CivicEntityType,
  CivicRecordReviewStatus,
  CampaignFinanceFilingType,
  DataQualityIssueSeverity,
  DataQualityIssueStatus,
  DataQualityIssueType,
  JurisdictionType,
  NewsMentionTargetType,
  PrismaClient,
  SourceSyncStatus,
  SourceType,
} from "@prisma/client";

const prisma = new PrismaClient();
const mode = process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1] ?? process.argv[2] ?? "help";
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1];
const importLimit = limitArg ? Number(limitArg) : null;

function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalizeWebsite(value) {
  return value?.trim() || null;
}

function auroraCandidateSearchUrl(name) {
  const url = new URL("https://www.nvsos.gov/elections/aurora-public-search");
  url.searchParams.set("search", name);
  return url.toString();
}

function normalizePersonName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|governor|gov)\b\.?/g, " ")
    .replace(/[^a-z,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function personNameAliases(value) {
  const normalized = normalizePersonName(value);
  const aliases = new Set([normalized]);
  if (normalized.includes(",")) {
    const [last, ...rest] = normalized.split(",");
    aliases.add(`${rest.join(" ").trim()} ${last}`.replace(/\s+/g, " ").trim());
  }
  if (normalized === "joe lombardo" || normalized === "joseph lombardo" || normalized === "joseph michael lombardo") {
    ["joe lombardo", "joseph lombardo", "joseph michael lombardo", "lombardo joe", "lombardo joseph"].forEach((alias) => aliases.add(alias));
  }
  return [...aliases].filter(Boolean);
}

function filingDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getOrCreateJurisdiction({ name, slug, type, code }) {
  return prisma.jurisdiction.upsert({
    where: { slug },
    create: { name, slug, type, code },
    update: { name, type, code },
  });
}

async function getOrCreateSource(definition) {
  const jurisdiction = definition.jurisdiction
    ? await getOrCreateJurisdiction(definition.jurisdiction)
    : definition.jurisdictionSlug
      ? await prisma.jurisdiction.findUnique({ where: { slug: definition.jurisdictionSlug } })
      : null;

  return prisma.source.upsert({
    where: { slug: definition.slug },
    create: {
      name: definition.name,
      slug: definition.slug,
      sourceType: definition.sourceType,
      url: definition.url,
      jurisdictionId: jurisdiction?.id ?? null,
      adapterKey: definition.adapterKey,
      dataCategory: definition.dataCategory,
      accessMethod: definition.accessMethod,
      importPriority: definition.importPriority ?? 80,
      refreshFrequency: definition.refreshFrequency,
      isActive: true,
      syncStatus: SourceSyncStatus.SUCCESS,
      lastCheckedAt: new Date(),
      lastSuccessAt: new Date(),
      notes: definition.notes,
      metadata: definition.metadata ?? {},
    },
    update: {
      name: definition.name,
      url: definition.url,
      jurisdictionId: jurisdiction?.id ?? null,
      sourceType: definition.sourceType,
      dataCategory: definition.dataCategory,
      accessMethod: definition.accessMethod,
      refreshFrequency: definition.refreshFrequency,
      isActive: true,
      syncStatus: SourceSyncStatus.SUCCESS,
      lastCheckedAt: new Date(),
      lastSuccessAt: new Date(),
      notes: definition.notes,
      metadata: definition.metadata ?? {},
    },
  });
}

async function createImportRun(source, stats, errorLog = null) {
  return prisma.sourceSyncRun.create({
    data: {
      sourceId: source.id,
      startedAt: new Date(),
      completedAt: new Date(),
      status: errorLog ? SourceSyncStatus.ERROR : SourceSyncStatus.SUCCESS,
      recordsSeen: stats.recordsFound ?? 0,
      recordsChanged: (stats.recordsCreated ?? 0) + (stats.recordsUpdated ?? 0),
      recordsFound: stats.recordsFound ?? 0,
      recordsCreated: stats.recordsCreated ?? 0,
      recordsUpdated: stats.recordsUpdated ?? 0,
      recordsUnchanged: stats.recordsUnchanged ?? 0,
      recordsFlaggedForReview: stats.recordsFlaggedForReview ?? 0,
      checksum: hash(stats),
      errorLog,
    },
  });
}

async function upsertSourceRecord({ source, run, entityType, entityId, externalId, dedupeKey, rawData, normalizedData, reviewStatus = CivicRecordReviewStatus.imported }) {
  const checksum = hash({ sourceId: source.id, entityType, entityId, externalId, rawData, normalizedData });
  const existing = await prisma.sourceRecord.findUnique({
    where: { sourceId_checksum: { sourceId: source.id, checksum } },
    select: { id: true },
  });
  const row = await prisma.sourceRecord.upsert({
    where: { sourceId_checksum: { sourceId: source.id, checksum } },
    create: {
      sourceId: source.id,
      sourceSyncRunId: run?.id ?? null,
      entityType,
      entityId,
      externalId,
      checksum,
      dedupeKey,
      rawData,
      normalizedData,
      reviewStatus,
    },
    update: {
      sourceSyncRunId: run?.id ?? null,
      entityType,
      entityId,
      externalId,
      dedupeKey,
      rawData,
      normalizedData,
      reviewStatus,
      updatedAt: new Date(),
    },
  });

  return { row, created: !existing };
}

async function upsertAttribution({ entityType, entityId, fieldName, source, sourceRecord, sourceName, sourceUrl, fieldsDerived, confidenceScore = 0.6, reviewStatus = CivicRecordReviewStatus.imported, metadata = undefined }) {
  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType,
        entityId,
        fieldName,
        sourceUrl,
      },
    },
    create: {
      entityType,
      entityId,
      fieldName,
      sourceId: source?.id ?? null,
      sourceRecordId: sourceRecord?.id ?? null,
      sourceName,
      sourceUrl,
      fieldsDerived,
      confidenceScore,
      reviewStatus,
      lastImportedAt: new Date(),
      metadata,
    },
    update: {
      sourceId: source?.id ?? null,
      sourceRecordId: sourceRecord?.id ?? null,
      sourceName,
      sourceUrl,
      fieldsDerived,
      confidenceScore,
      reviewStatus,
      lastImportedAt: new Date(),
      metadata,
    },
  });
}

async function flagIssue({ sourceId = null, recordType, recordId, issueType, severity = DataQualityIssueSeverity.warning, notes }) {
  const existing = await prisma.dataQualityIssue.findFirst({
    where: {
      recordType,
      recordId,
      issueType,
      status: { in: [DataQualityIssueStatus.open, DataQualityIssueStatus.in_review] },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.dataQualityIssue.update({
      where: { id: existing.id },
      data: { sourceId, severity, notes, updatedAt: new Date() },
    });
    return "updated";
  }

  await prisma.dataQualityIssue.create({
    data: {
      sourceId,
      recordType,
      recordId,
      issueType,
      severity,
      status: DataQualityIssueStatus.open,
      notes,
    },
  });
  return "created";
}

async function auditCandidateKnowledge() {
  const [candidates, officials] = await Promise.all([
    prisma.candidate.findMany({
      include: {
        source: true,
        knowledgeEnrichments: true,
        issuePositions: true,
        newsMentions: true,
        campaignFinanceFilings: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.official.findMany({
      include: {
        source: true,
        issuePositions: true,
        newsMentions: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const candidateIds = candidates.map((candidate) => candidate.id);
  const officialIds = officials.map((official) => official.id);
  const [candidateAttributions, officialAttributions] = await Promise.all([
    prisma.sourceAttribution.groupBy({
      by: ["entityId"],
      where: { entityType: CivicEntityType.CANDIDATE, entityId: { in: candidateIds } },
      _count: { _all: true },
    }),
    prisma.sourceAttribution.groupBy({
      by: ["entityId"],
      where: { entityType: CivicEntityType.OFFICIAL, entityId: { in: officialIds } },
      _count: { _all: true },
    }),
  ]);
  const attributionCounts = new Map([
    ...candidateAttributions.map((row) => [`CANDIDATE:${row.entityId}`, row._count._all]),
    ...officialAttributions.map((row) => [`OFFICIAL:${row.entityId}`, row._count._all]),
  ]);
  const stats = {
    candidatesAudited: candidates.length,
    officialsAudited: officials.length,
    qualityIssuesCreated: 0,
    qualityIssuesUpdated: 0,
    averageCompleteness: 0,
    topGaps: new Map(),
    candidatesWithNoBio: 0,
    candidatesWithNoWebsite: 0,
    candidatesWithNoNews: 0,
    candidatesWithNoIssuePositions: 0,
    candidatesWithNoFinanceSource: 0,
    highestPriorityCandidates: [],
  };

  function addGap(gap) {
    stats.topGaps.set(gap, (stats.topGaps.get(gap) ?? 0) + 1);
  }

  async function handleIssue(result) {
    if (result === "created") stats.qualityIssuesCreated += 1;
    if (result === "updated") stats.qualityIssuesUpdated += 1;
  }

  let completenessTotal = 0;

  for (const candidate of candidates) {
    const approvedKnowledge = candidate.knowledgeEnrichments.filter((entry) => ["APPROVED", "VERIFIED"].includes(entry.reviewStatus));
    const hasBio = Boolean(candidate.campaignStatement || approvedKnowledge.some((entry) => entry.aboutSummary));
    const hasCandidateStatement = Boolean(candidate.campaignStatement || approvedKnowledge.some((entry) => entry.ownWordsSummary));
    const socialLinks = Array.isArray(candidate.socialLinks) ? candidate.socialLinks : [];
    const checks = {
      hasFilingSource: Boolean(candidate.sourceUrl || candidate.source?.url),
      hasCampaignWebsite: Boolean(normalizeWebsite(candidate.websiteUrl) || approvedKnowledge.some((entry) => entry.sourceType === CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE)),
      hasOfficialWebsite: approvedKnowledge.some((entry) => entry.sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE),
      hasBio,
      hasCandidateStatement,
      hasIssuePositions: candidate.issuePositions.some((entry) => ["approved", "verified"].includes(entry.reviewStatus)),
      hasNewsMentions: candidate.newsMentions.length > 0,
      hasCampaignFinanceSource: candidate.campaignFinanceFilings.length > 0,
      hasSocialLinks: socialLinks.length > 0 || approvedKnowledge.some((entry) => Array.isArray(entry.socialLinks) && entry.socialLinks.length > 0),
      hasSourceAttribution: (attributionCounts.get(`CANDIDATE:${candidate.id}`) ?? 0) > 0 || Boolean(candidate.sourceUrl || candidate.source?.url),
    };
    const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
    completenessTotal += score;

    if (!checks.hasBio) {
      stats.candidatesWithNoBio += 1;
      addGap("missing bio");
      await handleIssue(await flagIssue({
        sourceId: candidate.sourceId,
        recordType: CivicEntityType.CANDIDATE,
        recordId: candidate.id,
        issueType: DataQualityIssueType.missing_bio,
        notes: `${candidate.fullName} has no approved bio or candidate statement.`,
      }));
    }
    if (!checks.hasCampaignWebsite) {
      stats.candidatesWithNoWebsite += 1;
      addGap("missing campaign website");
      await handleIssue(await flagIssue({
        sourceId: candidate.sourceId,
        recordType: CivicEntityType.CANDIDATE,
        recordId: candidate.id,
        issueType: DataQualityIssueType.missing_campaign_site,
        notes: `${candidate.fullName} has no stored campaign website.`,
      }));
    }
    if (!checks.hasIssuePositions) {
      stats.candidatesWithNoIssuePositions += 1;
      addGap("missing issue positions");
      await handleIssue(await flagIssue({
        sourceId: candidate.sourceId,
        recordType: CivicEntityType.CANDIDATE,
        recordId: candidate.id,
        issueType: DataQualityIssueType.missing_issue_positions,
        severity: DataQualityIssueSeverity.info,
        notes: `${candidate.fullName} has no approved sourced issue positions.`,
      }));
    }
    if (!checks.hasCampaignFinanceSource) {
      stats.candidatesWithNoFinanceSource += 1;
      addGap("missing campaign finance");
      await handleIssue(await flagIssue({
        sourceId: candidate.sourceId,
        recordType: CivicEntityType.CANDIDATE,
        recordId: candidate.id,
        issueType: DataQualityIssueType.missing_campaign_finance,
        severity: DataQualityIssueSeverity.info,
        notes: `${candidate.fullName} has no campaign finance source link or filing metadata attached yet.`,
      }));
    }
    if (!checks.hasNewsMentions) stats.candidatesWithNoNews += 1;
    if (score < 0.45) {
      stats.highestPriorityCandidates.push({
        id: candidate.id,
        name: candidate.fullName,
        score: Number(score.toFixed(2)),
        missing: Object.entries(checks)
          .filter(([, value]) => !value)
          .map(([key]) => key),
      });
    }

    console.log(JSON.stringify({ targetType: "candidate", id: candidate.id, name: candidate.fullName, ...checks, dataCompletenessScore: Number(score.toFixed(2)) }));
  }

  for (const official of officials) {
    const checks = {
      hasFilingSource: Boolean(official.source?.url),
      hasCampaignWebsite: false,
      hasOfficialWebsite: Boolean(official.websiteUrl),
      hasBio: false,
      hasCandidateStatement: false,
      hasIssuePositions: official.issuePositions.some((entry) => ["approved", "verified"].includes(entry.reviewStatus)),
      hasNewsMentions: official.newsMentions.length > 0,
      hasCampaignFinanceSource: false,
      hasSocialLinks: false,
      hasSourceAttribution: (attributionCounts.get(`OFFICIAL:${official.id}`) ?? 0) > 0 || Boolean(official.source?.url),
    };
    const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
    completenessTotal += score;

    if (!checks.hasOfficialWebsite) {
      addGap("missing official website");
      await handleIssue(await flagIssue({
        sourceId: official.sourceId,
        recordType: CivicEntityType.OFFICIAL,
        recordId: official.id,
        issueType: DataQualityIssueType.missing_campaign_site,
        severity: DataQualityIssueSeverity.info,
        notes: `${official.fullName} has no stored official website.`,
      }));
    }
    if (!checks.hasIssuePositions) {
      addGap("missing official issue positions");
      await handleIssue(await flagIssue({
        sourceId: official.sourceId,
        recordType: CivicEntityType.OFFICIAL,
        recordId: official.id,
        issueType: DataQualityIssueType.missing_issue_positions,
        severity: DataQualityIssueSeverity.info,
        notes: `${official.fullName} has no approved sourced issue positions.`,
      }));
    }

    console.log(JSON.stringify({ targetType: "official", id: official.id, name: official.fullName, ...checks, dataCompletenessScore: Number(score.toFixed(2)) }));
  }

  stats.averageCompleteness = candidates.length + officials.length ? Number((completenessTotal / (candidates.length + officials.length)).toFixed(2)) : 0;
  console.log("\nCandidate knowledge audit summary");
  console.log(JSON.stringify({
    ...stats,
    highestPriorityCandidates: stats.highestPriorityCandidates.slice(0, 25),
    topGaps: [...stats.topGaps.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
  }, null, 2));
}

const financeSources = [
  {
    name: "Nevada SOS Aurora Public Search",
    slug: "nevada-sos-aurora-public-search",
    url: "https://www.nvsos.gov/elections/aurora-public-search",
    sourceType: SourceType.ELECTIONS_PORTAL,
    dataCategory: "campaign_finance_search",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-campaign-finance-search",
    refreshFrequency: "daily_election_season_weekly_offseason",
    jurisdiction: { name: "Nevada", slug: "nevada", type: JurisdictionType.STATE, code: "NV" },
  },
  {
    name: "Nevada SOS Campaign Finance Reporting Requirements",
    slug: "nevada-sos-campaign-finance-reporting-requirements",
    url: "https://www.nvsos.gov/elections/candidate-information/campaign-finance-reporting-requirements",
    sourceType: SourceType.ELECTIONS_PORTAL,
    dataCategory: "campaign_finance_requirements",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-campaign-finance-reference",
    refreshFrequency: "monthly",
    jurisdiction: { name: "Nevada", slug: "nevada", type: JurisdictionType.STATE, code: "NV" },
  },
  {
    name: "Nevada SOS Contributions & Expenses Reports",
    slug: "nevada-sos-contributions-expenses-reports",
    url: "https://www.nvsos.gov/elections/candidate-information/campaign-finance-reporting-requirements/contributions-expenses-reports",
    sourceType: SourceType.ELECTIONS_PORTAL,
    dataCategory: "campaign_finance_reports",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-campaign-finance-reference",
    refreshFrequency: "monthly",
    jurisdiction: { name: "Nevada", slug: "nevada", type: JurisdictionType.STATE, code: "NV" },
  },
  {
    name: "Clark County Campaign Finance",
    slug: "clark-county-campaign-finance",
    url: "https://www.clarkcountynv.gov/government/departments/elections/services/campaign-finance",
    sourceType: SourceType.COUNTY_PORTAL,
    dataCategory: "campaign_finance_local",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-campaign-finance-reference",
    refreshFrequency: "monthly",
    jurisdiction: { name: "Clark County, Nevada", slug: "clark-county", type: JurisdictionType.COUNTY, code: "NV-003" },
  },
];

const districtSources = [
  {
    name: "Nevada SOS County Precinct Maps",
    slug: "nevada-sos-county-precinct-maps",
    url: "https://www.nvsos.gov/elections/county-precinct-maps",
    sourceType: SourceType.ELECTIONS_PORTAL,
    dataCategory: "district_precinct_maps",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-district-source",
    refreshFrequency: "monthly",
    jurisdiction: { name: "Nevada", slug: "nevada", type: JurisdictionType.STATE, code: "NV" },
  },
  {
    name: "Washoe County Election Maps",
    slug: "washoe-county-election-maps",
    url: "https://www.washoecounty.gov/voters/data/maps.php",
    sourceType: SourceType.COUNTY_PORTAL,
    dataCategory: "district_election_maps",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-district-source",
    refreshFrequency: "monthly",
    jurisdiction: { name: "Washoe County, Nevada", slug: "washoe-county", type: JurisdictionType.COUNTY, code: "NV-031" },
  },
  {
    name: "Washoe Open Data Election Layers",
    slug: "washoe-open-data-election-layers",
    url: "https://gis.washoecounty.us/portal/apps/sites/#/opendata",
    sourceType: SourceType.JSON,
    dataCategory: "district_boundary_layers",
    accessMethod: CivicDataAccessMethod.arcgis,
    adapterKey: "washoe-open-data-election-layers",
    refreshFrequency: "monthly",
    jurisdiction: { name: "Washoe County, Nevada", slug: "washoe-county", type: JurisdictionType.COUNTY, code: "NV-031" },
  },
];

const meetingSources = [
  {
    name: "Reno City Council",
    slug: "reno-city-council",
    url: "https://www.reno.gov/government/city-council",
    sourceType: SourceType.MUNICIPAL_PORTAL,
    dataCategory: "meeting_source_city_council",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-meeting-source",
    refreshFrequency: "weekly",
    jurisdiction: { name: "Reno, Nevada", slug: "reno", type: JurisdictionType.CITY, code: "NV-REN" },
  },
  {
    name: "Reno PrimeGov Public Portal",
    slug: "reno-primegov-public-portal",
    url: "https://reno.primegov.com/public/portal",
    sourceType: SourceType.MUNICIPAL_PORTAL,
    dataCategory: "meeting_agenda_portal",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-meeting-source",
    refreshFrequency: "weekly",
    jurisdiction: { name: "Reno, Nevada", slug: "reno", type: JurisdictionType.CITY, code: "NV-REN" },
  },
  {
    name: "Reno Watch and Learn",
    slug: "reno-watch-and-learn",
    url: "https://www.reno.gov/services/watch-and-learn",
    sourceType: SourceType.MUNICIPAL_PORTAL,
    dataCategory: "meeting_video_archive",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-meeting-source",
    refreshFrequency: "weekly",
    jurisdiction: { name: "Reno, Nevada", slug: "reno", type: JurisdictionType.CITY, code: "NV-REN" },
  },
  {
    name: "Reno Agenda Memos to Mayor and Council",
    slug: "reno-agenda-memos-mayor-council",
    url: "https://www.reno.gov/government/city-council/memos-to-the-mayor-and-council/agenda-memos-to-the-mayor-and-council",
    sourceType: SourceType.MUNICIPAL_PORTAL,
    dataCategory: "meeting_agenda_memos",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-meeting-source",
    refreshFrequency: "weekly",
    jurisdiction: { name: "Reno, Nevada", slug: "reno", type: JurisdictionType.CITY, code: "NV-REN" },
  },
];

async function importCatalogSources(definitions, entityType, fieldName, fieldsDerived) {
  let recordsCreated = 0;
  let recordsUpdated = 0;
  const sourceRows = [];

  for (const definition of definitions) {
    const source = await getOrCreateSource(definition);
    const run = await createImportRun(source, { recordsFound: 1, recordsCreated: 0, recordsUpdated: 1 });
    const { row, created } = await upsertSourceRecord({
      source,
      run,
      entityType,
      entityId: source.id,
      externalId: definition.slug,
      dedupeKey: definition.slug,
      rawData: definition,
      normalizedData: { name: definition.name, url: definition.url, dataCategory: definition.dataCategory },
      reviewStatus: CivicRecordReviewStatus.imported,
    });
    if (created) recordsCreated += 1;
    else recordsUpdated += 1;
    await upsertAttribution({
      entityType,
      entityId: source.id,
      fieldName,
      source,
      sourceRecord: row,
      sourceName: definition.name,
      sourceUrl: definition.url,
      fieldsDerived,
      confidenceScore: 0.75,
      reviewStatus: CivicRecordReviewStatus.imported,
    });
    sourceRows.push(source);
  }

  return { recordsFound: definitions.length, recordsCreated, recordsUpdated, sourceRows };
}

async function importCampaignFinanceSources() {
  const summary = await importCatalogSources(financeSources, CivicEntityType.CAMPAIGN_FINANCE, "campaign_finance_source", ["source link", "reporting metadata"]);
  const aurora = summary.sourceRows.find((source) => source.slug === "nevada-sos-aurora-public-search");
  const nevadaSosDetails = await getOrCreateSource({
    name: "Nevada SOS Candidate Finance Details",
    slug: "nevada-sos-candidate-finance-details",
    url: "https://www.nvsos.gov/soscandidateservices/anonymousaccess/cefdsearchuu/CandidateDetails.aspx?o=NZZn4mEHsNMU0L1EsD6oJg%253d%253d",
    sourceType: SourceType.ELECTIONS_PORTAL,
    dataCategory: "campaign_finance_candidate_detail",
    accessMethod: CivicDataAccessMethod.html,
    adapterKey: "manual-campaign-finance-candidate-detail",
    refreshFrequency: "daily_election_season_weekly_offseason",
    jurisdiction: { name: "Nevada", slug: "nevada", type: JurisdictionType.STATE, code: "NV" },
    metadata: {
      knownCandidateAliases: ["Joe Lombardo", "Joseph Lombardo", "Joseph Michael Lombardo", "Lombardo, Joe", "Lombardo, Joseph"],
      extractionStatus: "Manual filing-list fallback seeded from public SOS candidate details page",
    },
  });
  const lombardoFilings = [
    { reportName: "CE Report 1", reportYear: 2026, reportType: "CONTRIBUTION_EXPENSE", filedAt: filingDate("2026-04-15") },
    { reportName: "2026 Candidate Financial Disclosure", reportYear: 2026, reportType: "CANDIDATE_FINANCIAL_DISCLOSURE", filedAt: filingDate("2026-03-23") },
    { reportName: "2026 Annual CE Filing", reportYear: 2025, reportType: "ANNUAL_CE_FILING", filedAt: filingDate("2026-01-15") },
  ];
  const candidates = await prisma.candidate.findMany({
    include: { jurisdiction: true, campaignFinanceFilings: true },
    orderBy: { updatedAt: "desc" },
    take: importLimit && Number.isFinite(importLimit) ? importLimit : undefined,
  });
  let profileLinksCreated = 0;
  let profileLinksUpdated = 0;
  let filingRowsUpserted = 0;

  if (aurora) {
    const run = await createImportRun(aurora, { recordsFound: candidates.length });
    for (const candidate of candidates) {
      const searchUrl = auroraCandidateSearchUrl(candidate.ballotName ?? candidate.fullName);
      const { row, created } = await upsertSourceRecord({
        source: aurora,
        run,
        entityType: CivicEntityType.CANDIDATE,
        entityId: candidate.id,
        externalId: `campaign-finance-search:${candidate.id}`,
        dedupeKey: `campaign-finance-search:${candidate.id}`,
        rawData: { candidateId: candidate.id, candidateName: candidate.fullName, searchUrl },
        normalizedData: {
          candidateName: candidate.fullName,
          searchUrl,
          status: "Detailed finance extraction pending",
          reviewStatus: CivicRecordReviewStatus.pending_review,
        },
        reviewStatus: CivicRecordReviewStatus.pending_review,
      });
      if (created) profileLinksCreated += 1;
      else profileLinksUpdated += 1;
      await upsertAttribution({
        entityType: CivicEntityType.CANDIDATE,
        entityId: candidate.id,
        fieldName: "campaign_finance",
        source: aurora,
        sourceRecord: row,
        sourceName: aurora.name,
        sourceUrl: searchUrl,
        fieldsDerived: ["campaign finance source link", "finance extraction pending"],
        confidenceScore: 0.55,
        reviewStatus: CivicRecordReviewStatus.pending_review,
        metadata: {
          sourceLinks: [{ label: "Nevada SOS Aurora Public Search", url: searchUrl, note: "Candidate search URL generated from stored candidate name" }],
          donorExtractionStatus: "Detailed donor extraction pending",
        },
      });
    }
  }

  const lombardoCandidate =
    candidates.find((candidate) => personNameAliases(candidate.ballotName ?? candidate.fullName).some((alias) => personNameAliases("Joe Lombardo").includes(alias))) ??
    (await prisma.candidate.findFirst({
      where: {
        OR: [
          { fullName: { contains: "Lombardo", mode: "insensitive" } },
          { ballotName: { contains: "Lombardo", mode: "insensitive" } },
        ],
        office: { title: { contains: "Governor", mode: "insensitive" } },
      },
      include: { jurisdiction: true, campaignFinanceFilings: true },
    }));
  const lombardoOfficial = await prisma.official.findFirst({
    where: {
      OR: [
        { fullName: { contains: "Joe Lombardo", mode: "insensitive" } },
        { fullName: { contains: "Joseph Lombardo", mode: "insensitive" } },
        { fullName: { contains: "Lombardo", mode: "insensitive" } },
      ],
      office: { title: { contains: "Governor", mode: "insensitive" } },
    },
  });

  if (lombardoCandidate) {
    const run = await createImportRun(nevadaSosDetails, { recordsFound: lombardoFilings.length });
    const { row } = await upsertSourceRecord({
      source: nevadaSosDetails,
      run,
      entityType: CivicEntityType.CANDIDATE,
      entityId: lombardoCandidate.id,
      externalId: `campaign-finance-detail:${lombardoCandidate.id}`,
      dedupeKey: `campaign-finance-detail:${lombardoCandidate.id}`,
      rawData: {
        candidateId: lombardoCandidate.id,
        candidateName: lombardoCandidate.fullName,
        aliases: ["Joe Lombardo", "Joseph Lombardo", "Joseph Michael Lombardo", "Lombardo, Joe", "Lombardo, Joseph"],
        sourceUrl: nevadaSosDetails.url,
        filings: lombardoFilings.map((filing) => ({ ...filing, filedAt: filing.filedAt?.toISOString() ?? null })),
      },
      normalizedData: {
        filingCount: lombardoFilings.length,
        extractionStatus: "Detailed donor extraction pending",
        reviewStatus: CivicRecordReviewStatus.approved,
      },
      reviewStatus: CivicRecordReviewStatus.approved,
    });

    for (const filing of lombardoFilings) {
      await prisma.campaignFinanceFiling.upsert({
        where: {
          sourceId_externalId: {
            sourceId: nevadaSosDetails.id,
            externalId: `lombardo:${filing.reportYear}:${filing.reportName}`,
          },
        },
        create: {
          jurisdictionId: lombardoCandidate.jurisdictionId,
          candidateId: lombardoCandidate.id,
          sourceId: nevadaSosDetails.id,
          externalId: `lombardo:${filing.reportYear}:${filing.reportName}`,
          filingType: CampaignFinanceFilingType.CONTRIBUTION_EXPENSE,
          filerName: lombardoCandidate.fullName,
          filedAt: filing.filedAt,
          filingUrl: nevadaSosDetails.url,
          rawData: {
            filingName: filing.reportName,
            reportName: filing.reportName,
            reportYear: filing.reportYear,
            reportType: filing.reportType,
            sourceName: nevadaSosDetails.name,
            sourceUrl: nevadaSosDetails.url,
            extractionStatus: "Detailed donor extraction pending",
            reviewStatus: "approved",
          },
        },
        update: {
          candidateId: lombardoCandidate.id,
          jurisdictionId: lombardoCandidate.jurisdictionId,
          filedAt: filing.filedAt,
          filingUrl: nevadaSosDetails.url,
          rawData: {
            filingName: filing.reportName,
            reportName: filing.reportName,
            reportYear: filing.reportYear,
            reportType: filing.reportType,
            sourceName: nevadaSosDetails.name,
            sourceUrl: nevadaSosDetails.url,
            extractionStatus: "Detailed donor extraction pending",
            reviewStatus: "approved",
          },
        },
      });
      filingRowsUpserted += 1;
    }

    const metadata = {
      filingSummaries: lombardoFilings.map((filing) => ({ name: filing.reportName, filedAt: filing.filedAt?.toISOString() ?? null, url: nevadaSosDetails.url })),
      sourceLinks: [{ label: "Nevada SOS candidate finance details", url: nevadaSosDetails.url, note: "Official SOS candidate finance/details page" }],
      donorExtractionStatus: "Detailed donor extraction pending",
      lastCheckedAt: new Date().toISOString(),
    };
    await upsertAttribution({
      entityType: CivicEntityType.CANDIDATE,
      entityId: lombardoCandidate.id,
      fieldName: "campaign_finance",
      source: nevadaSosDetails,
      sourceRecord: row,
      sourceName: nevadaSosDetails.name,
      sourceUrl: nevadaSosDetails.url,
      fieldsDerived: ["campaign finance source link", "filing metadata"],
      confidenceScore: 0.82,
      reviewStatus: CivicRecordReviewStatus.approved,
      metadata,
    });
    if (lombardoOfficial) {
      await upsertAttribution({
        entityType: CivicEntityType.OFFICIAL,
        entityId: lombardoOfficial.id,
        fieldName: "campaign_finance",
        source: nevadaSosDetails,
        sourceRecord: row,
        sourceName: nevadaSosDetails.name,
        sourceUrl: nevadaSosDetails.url,
        fieldsDerived: ["campaign finance source link", "filing metadata"],
        confidenceScore: 0.75,
        reviewStatus: CivicRecordReviewStatus.approved,
        metadata,
      });
    }
  }

  console.log(JSON.stringify({
    import: "campaign-finance-sources",
    ...summary,
    sourceRows: summary.sourceRows.length,
    profileLinksCreated,
    profileLinksUpdated,
    filingRowsUpserted,
    lombardoCandidateId: lombardoCandidate?.id ?? null,
    lombardoOfficialId: lombardoOfficial?.id ?? null,
    pendingReviewCount: await prisma.sourceAttribution.count({ where: { fieldName: "campaign_finance", reviewStatus: CivicRecordReviewStatus.pending_review } }),
  }, null, 2));
}

async function importDistrictSources() {
  const summary = await importCatalogSources(districtSources, CivicEntityType.JURISDICTION, "district_boundary_source", ["district source", "precinct map", "future boundary matching"]);
  for (const source of summary.sourceRows) {
    await flagIssue({
      sourceId: source.id,
      recordType: CivicEntityType.JURISDICTION,
      recordId: source.jurisdictionId,
      issueType: DataQualityIssueType.unmatched_district,
      severity: DataQualityIssueSeverity.info,
      notes: `${source.name} is registered for district matching. Boundary import and point-in-polygon matching are pending.`,
    });
  }
  console.log(JSON.stringify({
    import: "district-sources",
    ...summary,
    sourceRows: summary.sourceRows.length,
    missingDistrictSources: await prisma.dataQualityIssue.count({ where: { issueType: DataQualityIssueType.unmatched_district, status: DataQualityIssueStatus.open } }),
  }, null, 2));
}

async function importMeetingSources() {
  const summary = await importCatalogSources(meetingSources, CivicEntityType.MEETING, "meeting_source", ["meeting source", "agenda source", "video/archive source"]);
  for (const source of summary.sourceRows) {
    await flagIssue({
      sourceId: source.id,
      recordType: CivicEntityType.MEETING,
      recordId: source.id,
      issueType: DataQualityIssueType.missing_meeting_data,
      severity: DataQualityIssueSeverity.info,
      notes: `${source.name} is registered. Meeting data import pending.`,
    });
  }
  console.log(JSON.stringify({
    import: "meeting-sources",
    ...summary,
    sourceRows: summary.sourceRows.length,
    missingMeetingSources: await prisma.dataQualityIssue.count({ where: { issueType: DataQualityIssueType.missing_meeting_data, status: DataQualityIssueStatus.open } }),
  }, null, 2));
}

async function main() {
  switch (mode) {
    case "audit-candidate-knowledge":
      await auditCandidateKnowledge();
      break;
    case "import-campaign-finance-sources":
      await importCampaignFinanceSources();
      break;
    case "import-district-sources":
      await importDistrictSources();
      break;
    case "import-meeting-sources":
      await importMeetingSources();
      break;
    default:
      console.log("Available modes:");
      console.log("  audit-candidate-knowledge");
      console.log("  import-campaign-finance-sources");
      console.log("  import-district-sources");
      console.log("  import-meeting-sources");
      process.exitCode = mode === "help" ? 0 : 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
