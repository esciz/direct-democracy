#!/usr/bin/env node

import crypto from "node:crypto";
import { CivicEntityType, CivicRecordReviewStatus, PrismaClient, SourceSyncStatus } from "@prisma/client";

import { courtSourceDefinitions } from "./court-source-definitions.mjs";

const prisma = new PrismaClient();

function checksum(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function upsertCourtSource(definition) {
  const now = new Date();
  const source = await prisma.source.upsert({
    where: { slug: definition.slug },
    create: {
      name: definition.name,
      slug: definition.slug,
      sourceType: definition.sourceType,
      url: definition.url,
      adapterKey: definition.adapterKey,
      dataCategory: definition.dataCategory,
      accessMethod: definition.accessMethod,
      refreshFrequency: "manual or scheduled after adapter approval",
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastSyncAt: now,
      syncStatus: SourceSyncStatus.SUCCESS,
      notes: definition.court.notes,
      metadata: definition,
    },
    update: {
      name: definition.name,
      sourceType: definition.sourceType,
      url: definition.url,
      adapterKey: definition.adapterKey,
      dataCategory: definition.dataCategory,
      accessMethod: definition.accessMethod,
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastSyncAt: now,
      syncStatus: SourceSyncStatus.SUCCESS,
      errorLog: null,
      notes: definition.court.notes,
      metadata: definition,
    },
  });

  const court = await prisma.courtJurisdiction.upsert({
    where: { name_sourceUrl: { name: definition.court.name, sourceUrl: definition.url } },
    create: {
      name: definition.court.name,
      level: definition.court.level,
      jurisdiction: definition.court.jurisdiction,
      sourceUrl: definition.url,
      accessMethod: definition.court.accessMethod,
      notes: definition.court.notes,
      sourceId: source.id,
    },
    update: {
      level: definition.court.level,
      jurisdiction: definition.court.jurisdiction,
      accessMethod: definition.court.accessMethod,
      notes: definition.court.notes,
      sourceId: source.id,
    },
  });

  const run = await prisma.sourceSyncRun.create({
    data: {
      sourceId: source.id,
      completedAt: now,
      status: SourceSyncStatus.SUCCESS,
      recordsSeen: 1,
      recordsFound: 1,
      recordsUpdated: 1,
      recordsUnchanged: 0,
      recordsFlaggedForReview: 0,
      checksum: checksum(definition),
    },
  });

  const record = await prisma.sourceRecord.upsert({
    where: { sourceId_checksum: { sourceId: source.id, checksum: checksum(definition) } },
    create: {
      sourceId: source.id,
      sourceSyncRunId: run.id,
      entityType: CivicEntityType.COURT_JURISDICTION,
      entityId: court.id,
      externalId: definition.slug,
      checksum: checksum(definition),
      dedupeKey: definition.slug,
      rawData: definition,
      normalizedData: {
        name: court.name,
        level: court.level,
        jurisdiction: court.jurisdiction,
        sourceUrl: court.sourceUrl,
        accessMethod: court.accessMethod,
      },
      reviewStatus: CivicRecordReviewStatus.imported,
    },
    update: {
      sourceSyncRunId: run.id,
      entityType: CivicEntityType.COURT_JURISDICTION,
      entityId: court.id,
      normalizedData: {
        name: court.name,
        level: court.level,
        jurisdiction: court.jurisdiction,
        sourceUrl: court.sourceUrl,
        accessMethod: court.accessMethod,
      },
      reviewStatus: CivicRecordReviewStatus.imported,
    },
  });

  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: CivicEntityType.COURT_JURISDICTION,
        entityId: court.id,
        fieldName: "court_source_registry",
        sourceUrl: definition.url,
      },
    },
    create: {
      entityType: CivicEntityType.COURT_JURISDICTION,
      entityId: court.id,
      fieldName: "court_source_registry",
      sourceId: source.id,
      sourceRecordId: record.id,
      sourceName: definition.name,
      sourceUrl: definition.url,
      fieldsDerived: ["court source", "access method", "jurisdiction", "safety notes"],
      confidenceScore: 0.9,
      reviewStatus: CivicRecordReviewStatus.imported,
      lastImportedAt: now,
      metadata: { safetyRules: ["no page-render scraping", "public records only", "privacy review required"] },
    },
    update: {
      sourceId: source.id,
      sourceRecordId: record.id,
      sourceName: definition.name,
      fieldsDerived: ["court source", "access method", "jurisdiction", "safety notes"],
      confidenceScore: 0.9,
      reviewStatus: CivicRecordReviewStatus.imported,
      lastImportedAt: now,
      metadata: { safetyRules: ["no page-render scraping", "public records only", "privacy review required"] },
    },
  });

  return { source, court };
}

async function main() {
  let recordsCreatedOrUpdated = 0;
  for (const definition of courtSourceDefinitions) {
    await upsertCourtSource(definition);
    recordsCreatedOrUpdated += 1;
  }

  console.log(JSON.stringify({
    import: "court-sources",
    sourcesFound: courtSourceDefinitions.length,
    recordsCreatedOrUpdated,
    courtJurisdictions: await prisma.courtJurisdiction.count(),
    note: "Only source registry rows were imported. No court portal scraping was performed.",
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
