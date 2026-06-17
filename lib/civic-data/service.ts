import { CivicDataAccessMethod, CivicEntityType, CivicRecordReviewStatus, DataQualityIssueStatus, JurisdictionType, Prisma, SourceSyncStatus } from "@prisma/client";

import { getCivicDataAdapter } from "@/lib/civic-data/adapters";
import { NEVADA_BETA_SOURCE_DEFINITIONS, getSourceDefinition } from "@/lib/civic-data/source-definitions";
import type { CivicSourceDefinition, ImportMode, IngestionIssue, NormalizedCivicData } from "@/lib/civic-data/types";
import { prisma } from "@/lib/prisma";

export type AdminSourceRow = CivicSourceDefinition & {
  id?: string;
  dataCategory?: string | null;
  accessMethod?: CivicDataAccessMethod | null;
  importPriority?: number | null;
  refreshFrequency?: string | null;
  lastCheckedAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastSyncAt?: Date | null;
  syncStatus: SourceSyncStatus;
  errorLog?: string | null;
  notes?: string | null;
  syncCursor?: string | null;
  isPersisted: boolean;
};

export type AdminImportRunRow = {
  id: string;
  sourceName: string;
  sourceSlug: string;
  startedAt: Date;
  completedAt: Date | null;
  status: SourceSyncStatus;
  recordsSeen: number;
  recordsChanged: number;
  recordsFound: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsFlaggedForReview: number;
  errorLog: string | null;
};

export type CivicDataMetrics = {
  jurisdictions: number;
  offices: number;
  districts: number;
  officials: number;
  elections: number;
  bills: number;
  initiatives: number;
  meetings: number;
  ads: number;
  dataSources: number;
};

export type CivicDataDashboard = {
  sources: Array<{
    id: string;
    name: string;
    slug: string;
    sourceType: string;
    dataCategory: string | null;
    accessMethod: CivicDataAccessMethod;
    importPriority: number;
    refreshFrequency: string | null;
    lastCheckedAt: Date | null;
    lastSuccessAt: Date | null;
    syncStatus: SourceSyncStatus;
    errorLog: string | null;
  }>;
  importRuns: AdminImportRunRow[];
  pendingReviews: Array<{
    id: string;
    entityType: string;
    entityName: string;
    summary: string | null;
    sourceName: string | null;
    updatedAt: Date;
  }>;
  recentlyUpdatedRecords: Array<{
    id: string;
    entityType: string;
    entityId: string;
    changeType: string;
    changedFields: string[];
    sourceName: string;
    recordedAt: Date;
  }>;
  completeness: Array<{
    label: string;
    count: number;
    status: "ready" | "pending";
  }>;
  qa: {
    missingCandidateBios: number;
    missingCampaignWebsites: number;
    missingDistrictMatches: number;
    duplicateCandidates: number;
    staleSources: number;
    openQualityIssues: number;
  };
  dataQualityIssues: Array<{
    id: string;
    recordType: string;
    recordId: string | null;
    issueType: string;
    severity: string;
    status: string;
    notes: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }>;
};

export type AdminOfficialRow = {
  id: string;
  fullName: string;
  officeTitle: string;
  jurisdictionName: string;
  partyText: string | null;
  status: string;
  sourceName: string | null;
  updatedAt: Date;
};

export type AdminElectionRow = {
  id: string;
  title: string;
  jurisdictionName: string;
  officeTitle: string;
  electionDate: Date;
  electionType: string;
  status: string;
  sourceName: string | null;
};

export type AdminCandidateRow = {
  id: string;
  fullName: string;
  ballotName: string | null;
  partyText: string | null;
  electionTitle: string;
  officeTitle: string | null;
  districtName: string | null;
  jurisdictionName: string;
  status: string;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  sourceUrl: string | null;
  filingStatus: string | null;
  sourceName: string | null;
  updatedAt: Date;
};

export type AdminInitiativeRow = {
  id: string;
  title: string;
  jurisdictionName: string;
  electionTitle: string;
  measureNumber: string | null;
  status: string;
  sourceName: string | null;
  updatedAt: Date;
};

export type AdminBallotQuestionRow = {
  id: string;
  title: string;
  questionNumber: string | null;
  jurisdictionName: string;
  electionTitle: string;
  questionType: string;
  petitionStatus: string;
  passed: boolean | null;
  sourceName: string | null;
  updatedAt: Date;
};

const emptyMetrics: CivicDataMetrics = {
  jurisdictions: 0,
  offices: 0,
  districts: 0,
  officials: 0,
  elections: 0,
  bills: 0,
  initiatives: 0,
  meetings: 0,
  ads: 0,
  dataSources: NEVADA_BETA_SOURCE_DEFINITIONS.length,
};

type ImportMutationStats = {
  recordsFound: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsFlaggedForReview: number;
};

type ImportableDelegate = {
  findUnique(args: unknown): Promise<Record<string, unknown> | null>;
  upsert(args: unknown): Promise<Record<string, unknown>>;
};

const emptyImportStats = (): ImportMutationStats => ({
  recordsFound: 0,
  recordsCreated: 0,
  recordsUpdated: 0,
  recordsUnchanged: 0,
  recordsFlaggedForReview: 0,
});

function sourceDataCategory(definition: CivicSourceDefinition) {
  return definition.dataCategory ?? definition.adapterKey.replaceAll("-", "_");
}

function sourceAccessMethod(definition: CivicSourceDefinition) {
  return definition.accessMethod ?? CivicDataAccessMethod.html;
}

function sourceImportPriority(definition: CivicSourceDefinition) {
  return definition.importPriority ?? 100;
}

function mergeImportStats(...stats: ImportMutationStats[]) {
  return stats.reduce((merged, item) => ({
    recordsFound: merged.recordsFound + item.recordsFound,
    recordsCreated: merged.recordsCreated + item.recordsCreated,
    recordsUpdated: merged.recordsUpdated + item.recordsUpdated,
    recordsUnchanged: merged.recordsUnchanged + item.recordsUnchanged,
    recordsFlaggedForReview: merged.recordsFlaggedForReview + item.recordsFlaggedForReview,
  }), emptyImportStats());
}

function serializeIssues(issues: IngestionIssue[]) {
  return issues.length > 0 ? issues.map((issue) => `[${issue.severity}] ${issue.message}`).join("\n") : null;
}

const foundationalJurisdictions: Array<{
  slug: string;
  name: string;
  type: JurisdictionType;
  parentSlug?: string;
}> = [
  { slug: "united-states", name: "United States", type: JurisdictionType.COUNTRY },
  { slug: "nevada", name: "Nevada", type: JurisdictionType.STATE, parentSlug: "united-states" },
  { slug: "washoe-county", name: "Washoe County", type: JurisdictionType.COUNTY, parentSlug: "nevada" },
  { slug: "reno", name: "Reno", type: JurisdictionType.CITY, parentSlug: "washoe-county" },
  { slug: "carson-city", name: "Carson City", type: JurisdictionType.CITY, parentSlug: "nevada" },
] as const;

function parseOptionalDate(value?: string) {
  return value ? new Date(value) : undefined;
}

function toJsonInput(value: unknown) {
  return value === undefined ? undefined : (value as Prisma.InputJsonValue);
}

function normalizeComparableValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparableValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeComparableValue(item)]));
  }
  return value;
}

function collectChangedFields(existing: Record<string, unknown> | null, nextValues: Record<string, unknown>) {
  if (!existing) {
    return Object.keys(nextValues);
  }

  return Object.entries(nextValues)
    .filter(([key, value]) => JSON.stringify(normalizeComparableValue(existing[key])) !== JSON.stringify(normalizeComparableValue(value)))
    .map(([key]) => key);
}

async function isProtectedImportedRecord(entityType: CivicEntityType, entityId: string) {
  const review = await prisma.civicEntityReview.findUnique({
    where: {
      entityType_entityId: {
        entityType,
        entityId,
      },
    },
    select: {
      reviewStatus: true,
      verificationStatus: true,
    },
  });

  return Boolean(
    review &&
      (review.reviewStatus === CivicRecordReviewStatus.verified ||
        review.reviewStatus === CivicRecordReviewStatus.approved ||
        review.verificationStatus === CivicRecordReviewStatus.verified ||
        review.verificationStatus === CivicRecordReviewStatus.approved),
  );
}

async function createImportedRecordVersion(input: {
  sourceId: string;
  sourceSyncRunId?: string;
  entityType: CivicEntityType;
  entityId: string;
  sourceExternalId?: string | null;
  changeType: "created" | "updated" | "unchanged" | "pending_review";
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields: string[];
  reviewStatus?: CivicRecordReviewStatus;
}) {
  if (input.changeType === "unchanged") {
    return;
  }

  await prisma.importedRecordVersion.create({
    data: {
      sourceId: input.sourceId,
      sourceSyncRunId: input.sourceSyncRunId,
      entityType: input.entityType,
      entityId: input.entityId,
      sourceExternalId: input.sourceExternalId,
      changeType: input.changeType,
      previousValues: input.previousValues ? (normalizeComparableValue(input.previousValues) as Prisma.InputJsonValue) : undefined,
      newValues: input.newValues ? (normalizeComparableValue(input.newValues) as Prisma.InputJsonValue) : undefined,
      changedFields: input.changedFields as Prisma.InputJsonValue,
      reviewStatus: input.reviewStatus ?? CivicRecordReviewStatus.imported,
    },
  });
}

async function flagImportConflict(input: {
  entityType: CivicEntityType;
  entityId: string;
  entityName: string;
  jurisdictionId?: string | null;
  sourceId: string;
  sourceUrl?: string | null;
  sourceName: string;
  summary: string;
}) {
  await prisma.civicEntityReview.upsert({
    where: {
      entityType_entityId: {
        entityType: input.entityType,
        entityId: input.entityId,
      },
    },
    create: {
      entityType: input.entityType,
      entityId: input.entityId,
      entityName: input.entityName,
      jurisdictionId: input.jurisdictionId,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      summary: input.summary,
      reviewStatus: CivicRecordReviewStatus.pending_review,
      verificationStatus: CivicRecordReviewStatus.imported,
    },
    update: {
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      summary: input.summary,
      reviewStatus: CivicRecordReviewStatus.pending_review,
      lastUpdatedAt: new Date(),
    },
  });
}

async function upsertTrackedImport(input: {
  model: ImportableDelegate;
  where: Record<string, unknown>;
  createData: Record<string, unknown>;
  updateData: Record<string, unknown>;
  sourceId: string;
  sourceSyncRunId: string;
  sourceExternalId?: string | null;
  entityType: CivicEntityType;
  entityName: string;
  jurisdictionId?: string | null;
  sourceUrl?: string | null;
  sourceName: string;
}) {
  const stats = emptyImportStats();
  stats.recordsFound = 1;

  const existing = await input.model.findUnique({ where: input.where });
  const changedFields = collectChangedFields(existing, input.updateData);

  if (existing && changedFields.length === 0) {
    stats.recordsUnchanged = 1;
    return { record: existing, stats };
  }

  if (existing?.id && (await isProtectedImportedRecord(input.entityType, String(existing.id)))) {
    stats.recordsFlaggedForReview = 1;
    await createImportedRecordVersion({
      sourceId: input.sourceId,
      sourceSyncRunId: input.sourceSyncRunId,
      entityType: input.entityType,
      entityId: String(existing.id),
      sourceExternalId: input.sourceExternalId,
      changeType: "pending_review",
      previousValues: existing,
      newValues: input.updateData,
      changedFields,
      reviewStatus: CivicRecordReviewStatus.pending_review,
    });
    await flagImportConflict({
      entityType: input.entityType,
      entityId: String(existing.id),
      entityName: input.entityName,
      jurisdictionId: input.jurisdictionId,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      summary: `Import found changes to protected fields: ${changedFields.join(", ")}.`,
    });
    return { record: existing, stats };
  }

  const record = await input.model.upsert({
    where: input.where,
    create: input.createData,
    update: input.updateData,
  });

  if (existing) {
    stats.recordsUpdated = 1;
  } else {
    stats.recordsCreated = 1;
  }

  await createImportedRecordVersion({
    sourceId: input.sourceId,
    sourceSyncRunId: input.sourceSyncRunId,
    entityType: input.entityType,
    entityId: String(record.id),
    sourceExternalId: input.sourceExternalId,
    changeType: existing ? "updated" : "created",
    previousValues: existing,
    newValues: existing ? input.updateData : input.createData,
    changedFields,
  });

  return { record, stats };
}

function validateOfficialsFoundation(data: NormalizedCivicData) {
  const issues: IngestionIssue[] = [];
  const jurisdictionSlugs = new Set(data.jurisdictions.map((jurisdiction) => jurisdiction.slug));
  const districtExternalIds = new Set(data.districts.map((district) => district.externalId));
  const officeExternalIds = new Set(data.offices.map((office) => office.externalId));

  const districts = data.districts.filter((district) => {
    if (!district.externalId || !district.name || !district.jurisdictionSlug) {
      issues.push({ severity: "error", message: "Skipped district with missing externalId, name, or jurisdiction.", externalId: district.externalId });
      return false;
    }
    return true;
  });

  const offices = data.offices.filter((office) => {
    if (!office.externalId || !office.title || !office.jurisdictionSlug) {
      issues.push({ severity: "error", message: "Skipped office with missing externalId, title, or jurisdiction.", externalId: office.externalId });
      return false;
    }
    if (office.districtExternalId && !districtExternalIds.has(office.districtExternalId)) {
      issues.push({ severity: "error", message: `Skipped office because district ${office.districtExternalId} was not present.`, externalId: office.externalId });
      return false;
    }
    return true;
  });

  const officials = data.officials.filter((official) => {
    if (!official.externalId || !official.fullName || !official.officeExternalId || !official.jurisdictionSlug) {
      issues.push({ severity: "error", message: "Skipped official with missing externalId, name, office, or jurisdiction.", externalId: official.externalId });
      return false;
    }
    if (!officeExternalIds.has(official.officeExternalId)) {
      issues.push({ severity: "error", message: `Skipped official because office ${official.officeExternalId} was not present.`, externalId: official.externalId });
      return false;
    }
    if (official.districtExternalId && !districtExternalIds.has(official.districtExternalId)) {
      issues.push({ severity: "error", message: `Skipped official because district ${official.districtExternalId} was not present.`, externalId: official.externalId });
      return false;
    }
    return true;
  });

  for (const jurisdiction of data.jurisdictions) {
    if (!jurisdiction.slug || !jurisdiction.name) {
      issues.push({ severity: "error", message: "Skipped jurisdiction with missing slug or name.", externalId: jurisdiction.externalId });
    }
  }

  return {
    data: {
      ...data,
      jurisdictions: data.jurisdictions.filter((jurisdiction) => jurisdiction.slug && jurisdiction.name),
      districts: districts.filter((district) => jurisdictionSlugs.has(district.jurisdictionSlug) || foundationalJurisdictions.some((item) => item.slug === district.jurisdictionSlug)),
      offices: offices.filter((office) => jurisdictionSlugs.has(office.jurisdictionSlug) || foundationalJurisdictions.some((item) => item.slug === office.jurisdictionSlug)),
      officials: officials.filter((official) => jurisdictionSlugs.has(official.jurisdictionSlug) || foundationalJurisdictions.some((item) => item.slug === official.jurisdictionSlug)),
    },
    issues,
  };
}

function validateElectionFoundation(data: NormalizedCivicData) {
  const issues: IngestionIssue[] = [];
  const jurisdictionSlugs = new Set([
    ...foundationalJurisdictions.map((jurisdiction) => jurisdiction.slug),
    ...data.jurisdictions.map((jurisdiction) => jurisdiction.slug),
  ]);
  const officeExternalIds = new Set(data.offices.map((office) => office.externalId));
  const districtExternalIds = new Set(data.districts.map((district) => district.externalId));
  const electionExternalIds = new Set(data.elections.map((election) => election.externalId));
  const candidateExternalIds = new Set(data.candidates.map((candidate) => candidate.externalId));
  const initiativeExternalIds = new Set(data.ballotInitiatives.map((initiative) => initiative.externalId));

  const elections = data.elections.filter((election) => {
    if (!election.externalId || !election.slug || !election.title || !election.jurisdictionSlug || !election.electionDate) {
      issues.push({ severity: "error", message: "Skipped election with missing externalId, slug, title, jurisdiction, or date.", externalId: election.externalId });
      return false;
    }
    if (!jurisdictionSlugs.has(election.jurisdictionSlug)) {
      issues.push({ severity: "error", message: `Skipped election because jurisdiction ${election.jurisdictionSlug} is not known.`, externalId: election.externalId });
      return false;
    }
    if (election.officeExternalId && !officeExternalIds.has(election.officeExternalId)) {
      issues.push({ severity: "error", message: `Skipped election because office ${election.officeExternalId} was not present.`, externalId: election.externalId });
      return false;
    }
    if (election.districtExternalId && !districtExternalIds.has(election.districtExternalId)) {
      issues.push({ severity: "error", message: `Skipped election because district ${election.districtExternalId} was not present.`, externalId: election.externalId });
      return false;
    }
    return true;
  });

  const validElectionExternalIds = new Set(elections.map((election) => election.externalId));

  const candidates = data.candidates.filter((candidate) => {
    if (!candidate.externalId || !candidate.fullName || !candidate.electionExternalId || !candidate.jurisdictionSlug) {
      issues.push({ severity: "error", message: "Skipped candidate with missing externalId, name, election, or jurisdiction.", externalId: candidate.externalId });
      return false;
    }
    if (!validElectionExternalIds.has(candidate.electionExternalId)) {
      issues.push({ severity: "error", message: `Skipped candidate because election ${candidate.electionExternalId} was not present.`, externalId: candidate.externalId });
      return false;
    }
    if (candidate.officeExternalId && !officeExternalIds.has(candidate.officeExternalId)) {
      issues.push({ severity: "error", message: `Skipped candidate because office ${candidate.officeExternalId} was not present.`, externalId: candidate.externalId });
      return false;
    }
    if (candidate.districtExternalId && !districtExternalIds.has(candidate.districtExternalId)) {
      issues.push({ severity: "error", message: `Skipped candidate because district ${candidate.districtExternalId} was not present.`, externalId: candidate.externalId });
      return false;
    }
    return true;
  });

  const ballotInitiatives = data.ballotInitiatives.filter((initiative) => {
    if (!initiative.externalId || !initiative.slug || !initiative.title || !initiative.electionExternalId || !initiative.jurisdictionSlug) {
      issues.push({ severity: "error", message: "Skipped ballot initiative with missing externalId, slug, title, election, or jurisdiction.", externalId: initiative.externalId });
      return false;
    }
    if (!validElectionExternalIds.has(initiative.electionExternalId)) {
      issues.push({ severity: "error", message: `Skipped ballot initiative because election ${initiative.electionExternalId} was not present.`, externalId: initiative.externalId });
      return false;
    }
    return true;
  });

  const ballotQuestions = data.ballotQuestions.filter((question) => {
    if (!question.externalId || !question.slug || !question.title || !question.electionExternalId || !question.jurisdictionSlug) {
      issues.push({ severity: "error", message: "Skipped ballot question with missing externalId, slug, title, election, or jurisdiction.", externalId: question.externalId });
      return false;
    }
    if (!validElectionExternalIds.has(question.electionExternalId)) {
      issues.push({ severity: "error", message: `Skipped ballot question because election ${question.electionExternalId} was not present.`, externalId: question.externalId });
      return false;
    }
    if (question.initiativeExternalId && !initiativeExternalIds.has(question.initiativeExternalId)) {
      issues.push({ severity: "warning", message: `Ballot question references initiative ${question.initiativeExternalId}, which was not present.`, externalId: question.externalId });
    }
    return true;
  });

  const electionResults = data.electionResults.filter((result) => {
    if (!result.externalId || !result.electionExternalId || result.votes < 0) {
      issues.push({ severity: "error", message: "Skipped election result with missing externalId, election, or invalid votes.", externalId: result.externalId });
      return false;
    }
    if (!validElectionExternalIds.has(result.electionExternalId)) {
      issues.push({ severity: "error", message: `Skipped election result because election ${result.electionExternalId} was not present.`, externalId: result.externalId });
      return false;
    }
    if (result.candidateExternalId && !candidateExternalIds.has(result.candidateExternalId)) {
      issues.push({ severity: "error", message: `Skipped election result because candidate ${result.candidateExternalId} was not present.`, externalId: result.externalId });
      return false;
    }
    return true;
  });

  return {
    data: {
      ...data,
      elections,
      candidates,
      ballotInitiatives,
      ballotQuestions,
      electionResults,
    },
    issues,
  };
}

async function ensureFoundationalJurisdictions() {
  const idsBySlug = new Map<string, string>();

  for (const jurisdiction of foundationalJurisdictions) {
    const parentId = jurisdiction.parentSlug ? idsBySlug.get(jurisdiction.parentSlug) : undefined;
    const upserted = await prisma.jurisdiction.upsert({
      where: { slug: jurisdiction.slug },
      create: {
        name: jurisdiction.name,
        slug: jurisdiction.slug,
        type: jurisdiction.type,
        parentId,
      },
      update: {
        name: jurisdiction.name,
        type: jurisdiction.type,
        parentId,
      },
      select: { id: true, slug: true },
    });
    idsBySlug.set(upserted.slug, upserted.id);
  }

  return idsBySlug;
}

async function upsertOfficialsFoundation(sourceId: string, data: NormalizedCivicData) {
  const jurisdictionIds = await ensureFoundationalJurisdictions();
  const stats = emptyImportStats();

  for (const jurisdiction of data.jurisdictions) {
    const parentId = jurisdiction.parentSlug ? jurisdictionIds.get(jurisdiction.parentSlug) : undefined;
    const upserted = await prisma.jurisdiction.upsert({
      where: { slug: jurisdiction.slug },
      create: {
        name: jurisdiction.name,
        slug: jurisdiction.slug,
        type: jurisdiction.type,
        code: jurisdiction.code,
        parentId,
      },
      update: {
        name: jurisdiction.name,
        type: jurisdiction.type,
        code: jurisdiction.code,
        parentId,
      },
      select: { id: true, slug: true },
    });
    jurisdictionIds.set(upserted.slug, upserted.id);
    stats.recordsFound += 1;
    stats.recordsUpdated += 1;
  }

  const districtIds = new Map<string, string>();
  for (const district of data.districts) {
    const jurisdictionId = jurisdictionIds.get(district.jurisdictionSlug);
    if (!jurisdictionId) continue;

    const upserted = await prisma.district.upsert({
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: district.externalId,
        },
      },
      create: {
        sourceId,
        externalId: district.externalId,
        jurisdictionId,
        slug: district.slug,
        name: district.name,
        districtType: district.districtType,
        code: district.code,
        boundaryGeoJson: toJsonInput(district.boundaryGeoJson),
      },
      update: {
        jurisdictionId,
        slug: district.slug,
        name: district.name,
        districtType: district.districtType,
        code: district.code,
        boundaryGeoJson: toJsonInput(district.boundaryGeoJson),
      },
      select: { id: true, externalId: true },
    });
    districtIds.set(upserted.externalId ?? district.externalId, upserted.id);
    stats.recordsFound += 1;
    stats.recordsUpdated += 1;
  }

  const officeIds = new Map<string, string>();
  for (const office of data.offices) {
    const jurisdictionId = jurisdictionIds.get(office.jurisdictionSlug);
    if (!jurisdictionId) continue;

    const upserted = await prisma.office.upsert({
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: office.externalId,
        },
      },
      create: {
        sourceId,
        externalId: office.externalId,
        jurisdictionId,
        districtId: office.districtExternalId ? districtIds.get(office.districtExternalId) : undefined,
        slug: office.slug,
        title: office.title,
        level: office.level,
        selectionMethod: office.selectionMethod,
        termLengthYears: office.termLengthYears,
        seats: office.seats ?? 1,
        description: office.description,
      },
      update: {
        jurisdictionId,
        districtId: office.districtExternalId ? districtIds.get(office.districtExternalId) : null,
        slug: office.slug,
        title: office.title,
        level: office.level,
        selectionMethod: office.selectionMethod,
        termLengthYears: office.termLengthYears,
        seats: office.seats ?? 1,
        description: office.description,
      },
      select: { id: true, externalId: true },
    });
    officeIds.set(upserted.externalId ?? office.externalId, upserted.id);
    stats.recordsFound += 1;
    stats.recordsUpdated += 1;
  }

  for (const official of data.officials) {
    const officeId = officeIds.get(official.officeExternalId);
    const jurisdictionId = jurisdictionIds.get(official.jurisdictionSlug);
    if (!officeId || !jurisdictionId) continue;

    await prisma.official.upsert({
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: official.externalId,
        },
      },
      create: {
        sourceId,
        externalId: official.externalId,
        officeId,
        jurisdictionId,
        districtId: official.districtExternalId ? districtIds.get(official.districtExternalId) : undefined,
        fullName: official.fullName,
        partyText: official.partyText,
        email: official.email,
        phone: official.phone,
        websiteUrl: official.websiteUrl,
        photoUrl: official.photoUrl,
        status: official.status,
        termStart: parseOptionalDate(official.termStart),
        termEnd: parseOptionalDate(official.termEnd),
      },
      update: {
        officeId,
        jurisdictionId,
        districtId: official.districtExternalId ? districtIds.get(official.districtExternalId) : null,
        fullName: official.fullName,
        partyText: official.partyText,
        email: official.email,
        phone: official.phone,
        websiteUrl: official.websiteUrl,
        photoUrl: official.photoUrl,
        status: official.status,
        termStart: parseOptionalDate(official.termStart),
        termEnd: parseOptionalDate(official.termEnd),
      },
    });
    stats.recordsFound += 1;
    stats.recordsUpdated += 1;
  }

  return stats;
}

async function loadSourceEntityIds<T extends { id: string; externalId: string | null }>(
  records: T[],
) {
  return new Map(records.flatMap((record) => (record.externalId ? [[record.externalId, record.id] as const] : [])));
}

async function upsertElectionFoundation(sourceId: string, sourceSyncRunId: string, sourceName: string, data: NormalizedCivicData) {
  const neededJurisdictionSlugs = new Set<string>([
    ...foundationalJurisdictions.map((jurisdiction) => jurisdiction.slug),
    ...data.elections.map((election) => election.jurisdictionSlug),
    ...data.candidates.map((candidate) => candidate.jurisdictionSlug),
    ...data.ballotInitiatives.map((initiative) => initiative.jurisdictionSlug),
    ...data.ballotQuestions.map((question) => question.jurisdictionSlug),
    ...data.electionResults.flatMap((result) => (result.jurisdictionSlug ? [result.jurisdictionSlug] : [])),
  ]);

  await ensureFoundationalJurisdictions();

  const jurisdictions = await prisma.jurisdiction.findMany({
    where: { slug: { in: [...neededJurisdictionSlugs] } },
    select: { id: true, slug: true },
  });
  const jurisdictionIds = new Map(jurisdictions.map((jurisdiction) => [jurisdiction.slug, jurisdiction.id]));
  const [sourceOffices, sourceDistricts] = await Promise.all([
    prisma.office.findMany({
      where: { sourceId, externalId: { in: data.offices.map((office) => office.externalId) } },
      select: { id: true, externalId: true },
    }),
    prisma.district.findMany({
      where: { sourceId, externalId: { in: data.districts.map((district) => district.externalId) } },
      select: { id: true, externalId: true },
    }),
  ]);
  const officeIds = await loadSourceEntityIds(sourceOffices);
  const districtIds = await loadSourceEntityIds(sourceDistricts);
  const electionIds = new Map<string, string>();
  const candidateIds = new Map<string, string>();
  const initiativeIds = new Map<string, string>();
  let stats = emptyImportStats();

  for (const election of data.elections) {
    const jurisdictionId = jurisdictionIds.get(election.jurisdictionSlug);
    if (!jurisdictionId) continue;

    const createData = {
      sourceId,
      externalId: election.externalId,
      jurisdictionId,
      officeId: election.officeExternalId ? officeIds.get(election.officeExternalId) : undefined,
      districtId: election.districtExternalId ? districtIds.get(election.districtExternalId) : undefined,
      slug: election.slug,
      title: election.title,
      officeTitle: election.officeTitle,
      electionDate: new Date(election.electionDate),
      electionType: election.electionType,
      status: election.status,
    };
    const updateData = {
      jurisdictionId,
      officeId: election.officeExternalId ? officeIds.get(election.officeExternalId) : null,
      districtId: election.districtExternalId ? districtIds.get(election.districtExternalId) : null,
      slug: election.slug,
      title: election.title,
      officeTitle: election.officeTitle,
      electionDate: new Date(election.electionDate),
      electionType: election.electionType,
      status: election.status,
    };
    const { record: upserted, stats: rowStats } = await upsertTrackedImport({
      model: prisma.election as unknown as ImportableDelegate,
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: election.externalId,
        },
      },
      createData,
      updateData,
      sourceId,
      sourceSyncRunId,
      sourceExternalId: election.externalId,
      entityType: CivicEntityType.ELECTION,
      entityName: election.title,
      jurisdictionId,
      sourceUrl: undefined,
      sourceName,
    });
    electionIds.set(String(upserted.externalId ?? election.externalId), String(upserted.id));
    stats = mergeImportStats(stats, rowStats);
  }

  for (const candidate of data.candidates) {
    const electionId = electionIds.get(candidate.electionExternalId);
    const jurisdictionId = jurisdictionIds.get(candidate.jurisdictionSlug);
    if (!electionId || !jurisdictionId) continue;

    const createData = {
      sourceId,
      externalId: candidate.externalId,
      electionId,
      jurisdictionId,
      officeId: candidate.officeExternalId ? officeIds.get(candidate.officeExternalId) : undefined,
      districtId: candidate.districtExternalId ? districtIds.get(candidate.districtExternalId) : undefined,
      fullName: candidate.fullName,
      partyText: candidate.partyText,
      ballotName: candidate.ballotName,
      websiteUrl: candidate.websiteUrl,
      email: candidate.email,
      phone: candidate.phone,
      photoUrl: candidate.photoUrl,
      campaignStatement: candidate.campaignStatement,
      socialLinks: toJsonInput(candidate.socialLinks),
      sourceUrl: candidate.sourceUrl,
      filingStatus: candidate.filingStatus,
      filingDate: parseOptionalDate(candidate.filingDate),
      status: candidate.status,
      isIncumbent: candidate.isIncumbent ?? false,
    };
    const updateData = {
      electionId,
      jurisdictionId,
      officeId: candidate.officeExternalId ? officeIds.get(candidate.officeExternalId) : null,
      districtId: candidate.districtExternalId ? districtIds.get(candidate.districtExternalId) : null,
      fullName: candidate.fullName,
      partyText: candidate.partyText,
      ballotName: candidate.ballotName,
      websiteUrl: candidate.websiteUrl,
      email: candidate.email,
      phone: candidate.phone,
      photoUrl: candidate.photoUrl,
      campaignStatement: candidate.campaignStatement,
      socialLinks: toJsonInput(candidate.socialLinks),
      sourceUrl: candidate.sourceUrl,
      filingStatus: candidate.filingStatus,
      filingDate: parseOptionalDate(candidate.filingDate),
      status: candidate.status,
      isIncumbent: candidate.isIncumbent ?? false,
    };
    const { record: upserted, stats: rowStats } = await upsertTrackedImport({
      model: prisma.candidate as unknown as ImportableDelegate,
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: candidate.externalId,
        },
      },
      createData,
      updateData,
      sourceId,
      sourceSyncRunId,
      sourceExternalId: candidate.externalId,
      entityType: CivicEntityType.CANDIDATE,
      entityName: candidate.fullName,
      jurisdictionId,
      sourceUrl: candidate.sourceUrl,
      sourceName,
    });
    candidateIds.set(String(upserted.externalId ?? candidate.externalId), String(upserted.id));
    stats = mergeImportStats(stats, rowStats);
  }

  for (const initiative of data.ballotInitiatives) {
    const electionId = electionIds.get(initiative.electionExternalId);
    const jurisdictionId = jurisdictionIds.get(initiative.jurisdictionSlug);
    if (!electionId || !jurisdictionId) continue;

    const upserted = await prisma.ballotInitiative.upsert({
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: initiative.externalId,
        },
      },
      create: {
        sourceId,
        externalId: initiative.externalId,
        electionId,
        jurisdictionId,
        slug: initiative.slug,
        title: initiative.title,
        summary: initiative.summary,
        measureNumber: initiative.measureNumber,
        fullTextUrl: initiative.fullTextUrl,
        status: initiative.status,
        petitionStatus: initiative.petitionStatus,
        resultStatus: initiative.resultStatus,
        yesVotes: initiative.yesVotes,
        noVotes: initiative.noVotes,
        totalVotes: initiative.totalVotes,
        passed: initiative.passed,
      },
      update: {
        electionId,
        jurisdictionId,
        slug: initiative.slug,
        title: initiative.title,
        summary: initiative.summary,
        measureNumber: initiative.measureNumber,
        fullTextUrl: initiative.fullTextUrl,
        status: initiative.status,
        petitionStatus: initiative.petitionStatus,
        resultStatus: initiative.resultStatus,
        yesVotes: initiative.yesVotes,
        noVotes: initiative.noVotes,
        totalVotes: initiative.totalVotes,
        passed: initiative.passed,
      },
      select: { id: true, externalId: true },
    });
    initiativeIds.set(upserted.externalId ?? initiative.externalId, upserted.id);
    stats.recordsFound += 1;
    stats.recordsUpdated += 1;
  }

  for (const question of data.ballotQuestions) {
    const electionId = electionIds.get(question.electionExternalId);
    const jurisdictionId = jurisdictionIds.get(question.jurisdictionSlug);
    if (!electionId || !jurisdictionId) continue;

    await prisma.ballotQuestion.upsert({
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: question.externalId,
        },
      },
      create: {
        sourceId,
        externalId: question.externalId,
        electionId,
        ballotInitiativeId: question.initiativeExternalId ? initiativeIds.get(question.initiativeExternalId) : undefined,
        jurisdictionId,
        slug: question.slug,
        questionNumber: question.questionNumber,
        title: question.title,
        summary: question.summary,
        officialText: question.officialText,
        questionType: question.questionType,
        petitionStatus: question.petitionStatus,
        resultStatus: question.resultStatus,
        yesVotes: question.yesVotes,
        noVotes: question.noVotes,
        totalVotes: question.totalVotes,
        passed: question.passed,
        fullTextUrl: question.fullTextUrl,
      },
      update: {
        electionId,
        ballotInitiativeId: question.initiativeExternalId ? initiativeIds.get(question.initiativeExternalId) : null,
        jurisdictionId,
        slug: question.slug,
        questionNumber: question.questionNumber,
        title: question.title,
        summary: question.summary,
        officialText: question.officialText,
        questionType: question.questionType,
        petitionStatus: question.petitionStatus,
        resultStatus: question.resultStatus,
        yesVotes: question.yesVotes,
        noVotes: question.noVotes,
        totalVotes: question.totalVotes,
        passed: question.passed,
        fullTextUrl: question.fullTextUrl,
      },
    });
    stats.recordsFound += 1;
    stats.recordsUpdated += 1;
  }

  for (const result of data.electionResults) {
    const electionId = electionIds.get(result.electionExternalId);
    if (!electionId) continue;

    const createData = {
      sourceId,
      externalId: result.externalId,
      electionId,
      candidateId: result.candidateExternalId ? candidateIds.get(result.candidateExternalId) : undefined,
      jurisdictionId: result.jurisdictionSlug ? jurisdictionIds.get(result.jurisdictionSlug) : undefined,
      reportingArea: result.reportingArea,
      resultStatus: result.resultStatus,
      votes: result.votes,
      votePercentage: result.votePercentage,
      rank: result.rank,
      isWinner: result.isWinner ?? false,
    };
    const updateData = {
      electionId,
      candidateId: result.candidateExternalId ? candidateIds.get(result.candidateExternalId) : null,
      jurisdictionId: result.jurisdictionSlug ? jurisdictionIds.get(result.jurisdictionSlug) : null,
      reportingArea: result.reportingArea,
      resultStatus: result.resultStatus,
      votes: result.votes,
      votePercentage: result.votePercentage,
      rank: result.rank,
      isWinner: result.isWinner ?? false,
    };
    const { stats: rowStats } = await upsertTrackedImport({
      model: prisma.electionResult as unknown as ImportableDelegate,
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: result.externalId,
        },
      },
      createData,
      updateData,
      sourceId,
      sourceSyncRunId,
      sourceExternalId: result.externalId,
      entityType: CivicEntityType.ELECTION_RESULT,
      entityName: `Election result ${result.externalId}`,
      jurisdictionId: result.jurisdictionSlug ? jurisdictionIds.get(result.jurisdictionSlug) : undefined,
      sourceUrl: undefined,
      sourceName,
    });
    stats = mergeImportStats(stats, rowStats);
  }

  return stats;
}

async function upsertSourceDefinition(definition: CivicSourceDefinition) {
  const jurisdiction = await prisma.jurisdiction.findUnique({
    where: { slug: definition.jurisdictionSlug },
    select: { id: true },
  });

  return prisma.source.upsert({
    where: { slug: definition.slug },
    create: {
      name: definition.name,
      slug: definition.slug,
      sourceType: definition.sourceType,
      url: definition.url,
      adapterKey: definition.adapterKey,
      dataCategory: sourceDataCategory(definition),
      accessMethod: sourceAccessMethod(definition),
      importPriority: sourceImportPriority(definition),
      refreshFrequency: definition.refreshFrequency,
      notes: definition.notes,
      jurisdictionId: jurisdiction?.id,
      metadata: {
        description: definition.description,
        jurisdictionSlug: definition.jurisdictionSlug,
        accessMethod: sourceAccessMethod(definition),
        dataCategory: sourceDataCategory(definition),
        importPriority: sourceImportPriority(definition),
      },
    },
    update: {
      name: definition.name,
      sourceType: definition.sourceType,
      url: definition.url,
      adapterKey: definition.adapterKey,
      dataCategory: sourceDataCategory(definition),
      accessMethod: sourceAccessMethod(definition),
      importPriority: sourceImportPriority(definition),
      refreshFrequency: definition.refreshFrequency,
      notes: definition.notes,
      jurisdictionId: jurisdiction?.id,
      metadata: {
        description: definition.description,
        jurisdictionSlug: definition.jurisdictionSlug,
        accessMethod: sourceAccessMethod(definition),
        dataCategory: sourceDataCategory(definition),
        importPriority: sourceImportPriority(definition),
      },
    },
  });
}

export async function ensureNevadaBetaSources() {
  return Promise.all(NEVADA_BETA_SOURCE_DEFINITIONS.map((definition) => upsertSourceDefinition(definition)));
}

export async function getAdminDataSources(): Promise<AdminSourceRow[]> {
  try {
    await ensureNevadaBetaSources();
    const persistedSources = await prisma.source.findMany({
      where: {
        slug: {
          in: NEVADA_BETA_SOURCE_DEFINITIONS.map((source) => source.slug),
        },
      },
      orderBy: { name: "asc" },
    });

    return NEVADA_BETA_SOURCE_DEFINITIONS.map((definition) => {
      const persisted = persistedSources.find((source) => source.slug === definition.slug);

      return {
        ...definition,
        id: persisted?.id,
        dataCategory: persisted?.dataCategory ?? sourceDataCategory(definition),
        accessMethod: persisted?.accessMethod ?? sourceAccessMethod(definition),
        importPriority: persisted?.importPriority ?? sourceImportPriority(definition),
        refreshFrequency: persisted?.refreshFrequency ?? definition.refreshFrequency,
        lastCheckedAt: persisted?.lastCheckedAt,
        lastSuccessAt: persisted?.lastSuccessAt,
        lastSyncAt: persisted?.lastSyncAt,
        syncStatus: persisted?.syncStatus ?? SourceSyncStatus.NEVER_SYNCED,
        errorLog: persisted?.errorLog,
        syncCursor: persisted?.syncCursor,
        notes: persisted?.notes ?? definition.notes,
        isPersisted: Boolean(persisted),
      };
    });
  } catch {
    return NEVADA_BETA_SOURCE_DEFINITIONS.map((definition) => ({
      ...definition,
      dataCategory: sourceDataCategory(definition),
      accessMethod: sourceAccessMethod(definition),
      importPriority: sourceImportPriority(definition),
      syncStatus: SourceSyncStatus.NEVER_SYNCED,
      isPersisted: false,
    }));
  }
}

export async function getAdminImportRuns(): Promise<AdminImportRunRow[]> {
  try {
    const runs = await prisma.sourceSyncRun.findMany({
      include: {
        source: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    return runs.map((run) => ({
      id: run.id,
      sourceName: run.source.name,
      sourceSlug: run.source.slug,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      status: run.status,
      recordsSeen: run.recordsSeen,
      recordsChanged: run.recordsChanged,
      recordsFound: run.recordsFound,
      recordsCreated: run.recordsCreated,
      recordsUpdated: run.recordsUpdated,
      recordsUnchanged: run.recordsUnchanged,
      recordsFlaggedForReview: run.recordsFlaggedForReview,
      errorLog: run.errorLog,
    }));
  } catch {
    return [];
  }
}

export async function getCivicDataMetrics(): Promise<CivicDataMetrics> {
  try {
    const [jurisdictions, offices, districts, officials, elections, bills, initiatives, meetings, ads, dataSources] = await Promise.all([
      prisma.jurisdiction.count(),
      prisma.office.count(),
      prisma.district.count(),
      prisma.official.count(),
      prisma.election.count(),
      prisma.legislativeBill.count(),
      prisma.ballotInitiative.count(),
      prisma.meeting.count(),
      prisma.politicalAdvertisement.count(),
      prisma.source.count(),
    ]);

    return {
      officials,
      jurisdictions,
      offices,
      districts,
      elections,
      bills,
      initiatives,
      meetings,
      ads,
      dataSources: Math.max(dataSources, NEVADA_BETA_SOURCE_DEFINITIONS.length),
    };
  } catch {
    return emptyMetrics;
  }
}

export async function getCivicDataDashboard(): Promise<CivicDataDashboard> {
  try {
    await ensureNevadaBetaSources();
    const duplicateCandidateKeysPromise = prisma.candidate.findMany({
      select: { electionId: true, fullName: true },
      take: 2000,
    }).catch(() => []);
    const staleCutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const [
      sources,
      importRuns,
      pendingReviews,
      recentlyUpdatedRecords,
      candidateCount,
      resultCount,
      registrationStatsCount,
      precinctResultCount,
      missingCandidateBios,
      missingCampaignWebsites,
      missingDistrictMatches,
      staleSources,
      openQualityIssues,
      dataQualityIssues,
      duplicateCandidateRows,
    ] = await Promise.all([
      prisma.source.findMany({
        orderBy: [{ importPriority: "asc" }, { name: "asc" }],
        take: 30,
        select: {
          id: true,
          name: true,
          slug: true,
          sourceType: true,
          dataCategory: true,
          accessMethod: true,
          importPriority: true,
          refreshFrequency: true,
          lastCheckedAt: true,
          lastSuccessAt: true,
          syncStatus: true,
          errorLog: true,
        },
      }),
      getAdminImportRuns(),
      prisma.civicEntityReview.findMany({
        where: { reviewStatus: CivicRecordReviewStatus.pending_review },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          entityType: true,
          entityName: true,
          summary: true,
          sourceName: true,
          updatedAt: true,
        },
      }),
      prisma.importedRecordVersion.findMany({
        orderBy: { recordedAt: "desc" },
        take: 10,
        include: {
          source: {
            select: { name: true },
          },
        },
      }),
      prisma.candidate.count(),
      prisma.electionResult.count(),
      prisma.voterRegistrationStatistic.count(),
      prisma.electionResult.count({
        where: {
          reportingArea: {
            contains: "precinct",
            mode: "insensitive",
          },
        },
      }),
      prisma.candidate.count({
        where: {
          OR: [{ campaignStatement: null }, { campaignStatement: "" }],
        },
      }),
      prisma.candidate.count({
        where: {
          OR: [{ websiteUrl: null }, { websiteUrl: "" }],
        },
      }),
      prisma.candidate.count({
        where: { districtId: null },
      }),
      prisma.source.count({
        where: {
          isActive: true,
          OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleCutoff } }, { syncStatus: SourceSyncStatus.ERROR }],
        },
      }),
      prisma.dataQualityIssue.count({
        where: { status: { in: [DataQualityIssueStatus.open, DataQualityIssueStatus.in_review] } },
      }).catch(() => 0),
      prisma.dataQualityIssue.findMany({
        where: { status: { in: [DataQualityIssueStatus.open, DataQualityIssueStatus.in_review] } },
        orderBy: [{ createdAt: "desc" }],
        take: 10,
      }).catch(() => []),
      duplicateCandidateKeysPromise,
    ]);
    const duplicateCandidateCounts = new Map<string, number>();
    for (const candidate of duplicateCandidateRows) {
      const key = `${candidate.electionId}:${candidate.fullName.trim().toLowerCase()}`;
      duplicateCandidateCounts.set(key, (duplicateCandidateCounts.get(key) ?? 0) + 1);
    }
    const duplicateCandidates = [...duplicateCandidateCounts.values()].filter((count) => count > 1).length;

    return {
      sources,
      importRuns,
      pendingReviews: pendingReviews.map((review) => ({
        id: review.id,
        entityType: review.entityType,
        entityName: review.entityName,
        summary: review.summary,
        sourceName: review.sourceName,
        updatedAt: review.updatedAt,
      })),
      recentlyUpdatedRecords: recentlyUpdatedRecords.map((record) => ({
        id: record.id,
        entityType: record.entityType,
        entityId: record.entityId,
        changeType: record.changeType,
        changedFields: Array.isArray(record.changedFields) ? record.changedFields.map(String) : [],
        sourceName: record.source.name,
        recordedAt: record.recordedAt,
      })),
      completeness: [
        { label: "Candidate filings", count: candidateCount, status: candidateCount > 0 ? "ready" : "pending" },
        { label: "Election results", count: resultCount, status: resultCount > 0 ? "ready" : "pending" },
        { label: "Precinct-level results", count: precinctResultCount, status: precinctResultCount > 0 ? "ready" : "pending" },
        { label: "Voter registration statistics", count: registrationStatsCount, status: registrationStatsCount > 0 ? "ready" : "pending" },
      ],
      qa: {
        missingCandidateBios,
        missingCampaignWebsites,
        missingDistrictMatches,
        duplicateCandidates,
        staleSources,
        openQualityIssues,
      },
      dataQualityIssues: dataQualityIssues.map((issue) => ({
        id: issue.id,
        recordType: issue.recordType,
        recordId: issue.recordId,
        issueType: issue.issueType,
        severity: issue.severity,
        status: issue.status,
        notes: issue.notes,
        createdAt: issue.createdAt,
        resolvedAt: issue.resolvedAt,
      })),
    };
  } catch {
    return {
      sources: [],
      importRuns: [],
      pendingReviews: [],
      recentlyUpdatedRecords: [],
      completeness: [
        { label: "Candidate filings", count: 0, status: "pending" },
        { label: "Election results", count: 0, status: "pending" },
        { label: "Precinct-level results", count: 0, status: "pending" },
        { label: "Voter registration statistics", count: 0, status: "pending" },
      ],
      qa: {
        missingCandidateBios: 0,
        missingCampaignWebsites: 0,
        missingDistrictMatches: 0,
        duplicateCandidates: 0,
        staleSources: 0,
        openQualityIssues: 0,
      },
      dataQualityIssues: [],
    };
  }
}

export async function getAdminOfficials(): Promise<AdminOfficialRow[]> {
  try {
    const officials = await prisma.official.findMany({
      include: {
        office: { select: { title: true } },
        jurisdiction: { select: { name: true } },
        source: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return officials.map((official) => ({
      id: official.id,
      fullName: official.fullName,
      officeTitle: official.office.title,
      jurisdictionName: official.jurisdiction.name,
      partyText: official.partyText,
      status: official.status,
      sourceName: official.source?.name ?? null,
      updatedAt: official.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function getAdminElections(): Promise<AdminElectionRow[]> {
  try {
    const elections = await prisma.election.findMany({
      include: {
        jurisdiction: { select: { name: true } },
        source: { select: { name: true } },
      },
      orderBy: { electionDate: "desc" },
      take: 100,
    });

    return elections.map((election) => ({
      id: election.id,
      title: election.title,
      jurisdictionName: election.jurisdiction.name,
      officeTitle: election.officeTitle,
      electionDate: election.electionDate,
      electionType: election.electionType,
      status: election.status,
      sourceName: election.source?.name ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getAdminCandidates(): Promise<AdminCandidateRow[]> {
  try {
    const candidates = await prisma.candidate.findMany({
      include: {
        election: { select: { title: true } },
        office: { select: { title: true } },
        district: { select: { name: true } },
        jurisdiction: { select: { name: true } },
        source: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    });

    return candidates.map((candidate) => ({
      id: candidate.id,
      fullName: candidate.fullName,
      ballotName: candidate.ballotName,
      partyText: candidate.partyText,
      electionTitle: candidate.election.title,
      officeTitle: candidate.office?.title ?? null,
      districtName: candidate.district?.name ?? null,
      jurisdictionName: candidate.jurisdiction.name,
      status: candidate.status,
      websiteUrl: candidate.websiteUrl,
      email: candidate.email,
      phone: candidate.phone,
      sourceUrl: candidate.sourceUrl,
      filingStatus: candidate.filingStatus,
      sourceName: candidate.source?.name ?? null,
      updatedAt: candidate.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function getAdminInitiatives(): Promise<AdminInitiativeRow[]> {
  try {
    const initiatives = await prisma.ballotInitiative.findMany({
      include: {
        jurisdiction: { select: { name: true } },
        election: { select: { title: true } },
        source: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    return initiatives.map((initiative) => ({
      id: initiative.id,
      title: initiative.title,
      jurisdictionName: initiative.jurisdiction.name,
      electionTitle: initiative.election.title,
      measureNumber: initiative.measureNumber,
      status: initiative.status,
      sourceName: initiative.source?.name ?? null,
      updatedAt: initiative.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function getAdminBallotQuestions(): Promise<AdminBallotQuestionRow[]> {
  try {
    const questions = await prisma.ballotQuestion.findMany({
      include: {
        jurisdiction: { select: { name: true } },
        election: { select: { title: true } },
        source: { select: { name: true } },
      },
      orderBy: [{ election: { electionDate: "desc" } }, { questionNumber: "asc" }],
      take: 150,
    });

    return questions.map((question) => ({
      id: question.id,
      title: question.title,
      questionNumber: question.questionNumber,
      jurisdictionName: question.jurisdiction.name,
      electionTitle: question.election.title,
      questionType: question.questionType,
      petitionStatus: question.petitionStatus,
      passed: question.passed,
      sourceName: question.source?.name ?? null,
      updatedAt: question.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function syncCivicSource(sourceSlug: string, mode: ImportMode = "manual") {
  const definition = getSourceDefinition(sourceSlug);

  if (!definition) {
    throw new Error(`Unknown civic data source: ${sourceSlug}`);
  }

  const adapter = getCivicDataAdapter(definition.adapterKey);
  const source = await upsertSourceDefinition(definition);
  const run = await prisma.sourceSyncRun.create({
    data: {
      sourceId: source.id,
      status: SourceSyncStatus.SYNCING,
      cursorBefore: source.syncCursor,
    },
  });

  await prisma.source.update({
    where: { id: source.id },
    data: {
      lastCheckedAt: new Date(),
      syncStatus: SourceSyncStatus.SYNCING,
      errorLog: null,
    },
  });

  try {
    const result = await adapter.sync({
      source: definition,
      mode,
      cursor: source.syncCursor,
      requestedAt: new Date(),
    });
    const officialsValidation = validateOfficialsFoundation(result.data);
    const electionValidation = validateElectionFoundation(officialsValidation.data);
    const officialsChanged = await upsertOfficialsFoundation(source.id, electionValidation.data);
    const electionsChanged = await upsertElectionFoundation(source.id, run.id, definition.name, electionValidation.data);
    const importStats = mergeImportStats(officialsChanged, electionsChanged);
    const recordsChanged = importStats.recordsCreated + importStats.recordsUpdated;
    const issues = [...result.issues, ...officialsValidation.issues, ...electionValidation.issues];
    const errorLog = serializeIssues(issues);
    const completedAt = new Date();

    await prisma.$transaction([
      prisma.source.update({
        where: { id: source.id },
        data: {
          lastCheckedAt: completedAt,
          lastSuccessAt: result.status === SourceSyncStatus.SUCCESS ? completedAt : source.lastSuccessAt,
          lastSyncAt: completedAt,
          syncStatus: result.status,
          errorLog,
          syncCursor: result.cursor,
        },
      }),
      prisma.sourceSyncRun.update({
        where: { id: run.id },
        data: {
          completedAt,
          status: result.status,
          recordsSeen: result.recordsSeen,
          recordsChanged,
          recordsFound: result.recordsSeen || importStats.recordsFound,
          recordsCreated: importStats.recordsCreated,
          recordsUpdated: importStats.recordsUpdated,
          recordsUnchanged: importStats.recordsUnchanged,
          recordsFlaggedForReview: importStats.recordsFlaggedForReview,
          errorLog,
          cursorAfter: result.cursor,
        },
      }),
    ]);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";

    await prisma.$transaction([
      prisma.source.update({
        where: { id: source.id },
        data: {
          lastCheckedAt: new Date(),
          lastSyncAt: new Date(),
          syncStatus: SourceSyncStatus.ERROR,
          errorLog: message,
        },
      }),
      prisma.sourceSyncRun.update({
        where: { id: run.id },
        data: {
          completedAt: new Date(),
          status: SourceSyncStatus.ERROR,
          errorLog: message,
        },
      }),
    ]);

    throw error;
  }
}
