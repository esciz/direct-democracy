#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  CivicEntityType,
  CivicRecordReviewStatus,
  CourtCasePublicVisibilityStatus,
  CourtCaseType,
  PrismaClient,
  SourceSyncStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_MANIFEST = "data/imports/court-cases/manifest.csv";

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function checksum(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }

  const [header, ...dataRows] = rows;
  if (!header) return [];
  const keys = header.map((value) => value.trim());
  return dataRows.map((values) => Object.fromEntries(keys.map((key, index) => [key, values[index]?.trim() ?? ""])));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCaseType(value) {
  const normalized = value?.trim().toLowerCase();
  return Object.values(CourtCaseType).includes(normalized) ? normalized : CourtCaseType.unknown;
}

function hasPrivacyRisk(row) {
  const haystack = `${row.caption ?? ""} ${row.notes ?? ""} ${row.case_type ?? ""}`.toLowerCase();
  return (
    /(sealed|juvenile|confidential|protected|victim|minor child|adoption|guardianship|termination of parental rights)/i.test(haystack) ||
    /\b\d{3}-\d{2}-\d{4}\b/.test(haystack) ||
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b.*\b(dob|birth)\b/i.test(haystack)
  );
}

async function findCourt(row) {
  const courtName = row.court_name?.trim();
  if (!courtName) return null;
  return prisma.courtJurisdiction.findFirst({
    where: { name: { equals: courtName, mode: "insensitive" } },
    include: { source: true },
  });
}

async function main() {
  const manifestPath = argValue("--manifest", DEFAULT_MANIFEST);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.mkdir("data/imports/court-documents", { recursive: true });
  await fs.mkdir("data/imports/appellate-cases", { recursive: true });

  let text = "";
  try {
    text = await fs.readFile(manifestPath, "utf8");
  } catch {
    console.log(JSON.stringify({
      import: "court-cases-local",
      manifestPath,
      recordsFound: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFlaggedForReview: 0,
      note: "Manifest not found. Create data/imports/court-cases/manifest.csv with the documented headers.",
    }, null, 2));
    return;
  }

  const rows = parseCsv(text);
  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsFlaggedForReview = 0;
  let unmatchedCourts = 0;
  let documentsCreated = 0;

  for (const row of rows) {
    const court = await findCourt(row);
    if (!court) {
      unmatchedCourts += 1;
      continue;
    }

    const privacyRisk = hasPrivacyRisk(row);
    const visibility = privacyRisk ? CourtCasePublicVisibilityStatus.pending_privacy_review : CourtCasePublicVisibilityStatus.public;
    const reviewStatus = privacyRisk ? CivicRecordReviewStatus.pending_review : CivicRecordReviewStatus.pending_review;
    const now = new Date();
    const raw = { ...row, importPolicy: "manual_public_records_manifest" };
    const caseNumber = row.case_number || checksum(raw).slice(0, 12);
    const existing = await prisma.courtCase.findUnique({
      where: { courtJurisdictionId_caseNumber: { courtJurisdictionId: court.id, caseNumber } },
      select: { id: true },
    });
    const courtCase = await prisma.courtCase.upsert({
      where: { courtJurisdictionId_caseNumber: { courtJurisdictionId: court.id, caseNumber } },
      create: {
        courtJurisdictionId: court.id,
        sourceId: court.sourceId,
        caseNumber,
        caption: row.caption || "Caption pending review",
        caseType: normalizeCaseType(row.case_type),
        status: row.status || null,
        filingDate: parseDate(row.filing_date),
        jurisdiction: row.jurisdiction || court.jurisdiction,
        courtLevel: court.level,
        sourceUrl: row.source_url || court.sourceUrl,
        publicVisibilityStatus: visibility,
        reviewStatus,
        lastCheckedAt: now,
        rawData: raw,
      },
      update: {
        sourceId: court.sourceId,
        caption: row.caption || "Caption pending review",
        caseType: normalizeCaseType(row.case_type),
        status: row.status || null,
        filingDate: parseDate(row.filing_date),
        jurisdiction: row.jurisdiction || court.jurisdiction,
        courtLevel: court.level,
        sourceUrl: row.source_url || court.sourceUrl,
        publicVisibilityStatus: visibility,
        reviewStatus,
        lastCheckedAt: now,
        rawData: raw,
      },
    });

    if (existing) recordsUpdated += 1;
    else recordsCreated += 1;
    if (privacyRisk) recordsFlaggedForReview += 1;

    const recordChecksum = checksum(raw);
    const run = await prisma.sourceSyncRun.create({
      data: {
        sourceId: court.sourceId,
        completedAt: now,
        status: SourceSyncStatus.SUCCESS,
        recordsSeen: 1,
        recordsFound: 1,
        recordsCreated: existing ? 0 : 1,
        recordsUpdated: existing ? 1 : 0,
        recordsFlaggedForReview: privacyRisk ? 1 : 0,
        checksum: recordChecksum,
      },
    });

    const sourceRecord = await prisma.sourceRecord.upsert({
      where: { sourceId_checksum: { sourceId: court.sourceId, checksum: recordChecksum } },
      create: {
        sourceId: court.sourceId,
        sourceSyncRunId: run.id,
        entityType: CivicEntityType.COURT_CASE,
        entityId: courtCase.id,
        externalId: caseNumber,
        checksum: recordChecksum,
        dedupeKey: `${court.id}:${caseNumber}`,
        rawData: raw,
        normalizedData: {
          caseNumber,
          caption: courtCase.caption,
          caseType: courtCase.caseType,
          court: court.name,
          publicVisibilityStatus: visibility,
        },
        reviewStatus,
      },
      update: {
        sourceSyncRunId: run.id,
        entityId: courtCase.id,
        normalizedData: {
          caseNumber,
          caption: courtCase.caption,
          caseType: courtCase.caseType,
          court: court.name,
          publicVisibilityStatus: visibility,
        },
        reviewStatus,
      },
    });

    await prisma.sourceAttribution.upsert({
      where: {
        entityType_entityId_fieldName_sourceUrl: {
          entityType: CivicEntityType.COURT_CASE,
          entityId: courtCase.id,
          fieldName: "case_record",
          sourceUrl: courtCase.sourceUrl,
        },
      },
      create: {
        entityType: CivicEntityType.COURT_CASE,
        entityId: courtCase.id,
        fieldName: "case_record",
        sourceId: court.sourceId,
        sourceRecordId: sourceRecord.id,
        sourceName: court.source?.name ?? court.name,
        sourceUrl: courtCase.sourceUrl,
        fieldsDerived: ["case number", "caption", "case type", "status", "filing date"],
        confidenceScore: privacyRisk ? 0.4 : 0.75,
        reviewStatus,
        lastImportedAt: now,
        metadata: { privacyRisk, notes: row.notes || null },
      },
      update: {
        sourceId: court.sourceId,
        sourceRecordId: sourceRecord.id,
        sourceName: court.source?.name ?? court.name,
        fieldsDerived: ["case number", "caption", "case type", "status", "filing date"],
        confidenceScore: privacyRisk ? 0.4 : 0.75,
        reviewStatus,
        lastImportedAt: now,
        metadata: { privacyRisk, notes: row.notes || null },
      },
    });

    if (row.document_url || row.local_file_path) {
      await prisma.courtDocument.create({
        data: {
          caseId: courtCase.id,
          sourceId: court.sourceId,
          title: row.document_url ? "Public court document" : path.basename(row.local_file_path),
          documentUrl: row.document_url || null,
          localFilePath: row.local_file_path || null,
          sourceName: court.source?.name ?? court.name,
          sourceUrl: row.source_url || court.sourceUrl,
          documentType: "source_document",
          extractedTextStatus: row.local_file_path ? "pending" : "not_started",
          reviewStatus: CivicRecordReviewStatus.pending_review,
        },
      });
      documentsCreated += 1;
    }
  }

  console.log(JSON.stringify({
    import: "court-cases-local",
    manifestPath,
    recordsFound: rows.length,
    recordsCreated,
    recordsUpdated,
    recordsFlaggedForReview,
    unmatchedCourts,
    documentsCreated,
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
