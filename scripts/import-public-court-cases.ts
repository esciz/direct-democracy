import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  CivicDataAccessMethod,
  CivicEntityType,
  CivicRecordReviewStatus,
  CourtAccessMethod,
  CourtCasePublicVisibilityStatus,
  CourtCaseType,
  CourtJurisdictionLevel,
  Prisma,
  PrismaClient,
  SourceSyncStatus,
  SourceType,
} from "@prisma/client";

const DEFAULT_MANIFEST = "data/manual-sources/court-cases/reviewed-public-cases/manifest.json";
const DEFAULT_RUNTIME = "data/generated/public-court-cases-runtime.json";
const DEFAULT_REPORT = "data/generated/public-court-cases-report.json";

type ManifestRecord = {
  id?: string;
  caseNumber?: string | null;
  caption?: string | null;
  caseType?: string | null;
  status?: string | null;
  courtName?: string | null;
  courtLevel?: string | null;
  jurisdictionId?: string | null;
  jurisdictionName?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  officialSourceUrl?: string | null;
  sourceFile?: string | null;
  sourceKind?: string | null;
  filedDate?: string | null;
  dispositionDate?: string | null;
  lastCheckedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewStatus?: string | null;
  publicVisibilityStatus?: string | null;
  exclusionReason?: string | null;
  plainEnglishSummary?: string | null;
  issueTags?: string[];
  keyDates?: Array<{ label: string; date: string }>;
  documents?: Array<Record<string, unknown>>;
  docketEntries?: Array<Record<string, unknown>>;
  parties?: Array<Record<string, unknown>>;
  notes?: string | null;
  communityTags?: string[];
  relatedAgencies?: string[];
  relatedOfficials?: string[];
  metadata?: Record<string, unknown>;
};

type Manifest = {
  schemaVersion?: number;
  sourceLane?: string;
  records?: ManifestRecord[];
};

const prisma = new PrismaClient();

function argValue(name: string, fallback: string) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function checksum(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCaseType(value?: string | null): CourtCaseType {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z_]/g, "_") ?? "";
  return Object.values(CourtCaseType).includes(normalized as CourtCaseType) ? (normalized as CourtCaseType) : CourtCaseType.unknown;
}

function normalizeCourtLevel(value?: string | null): CourtJurisdictionLevel {
  const normalized = value?.trim().toLowerCase() ?? "";
  return Object.values(CourtJurisdictionLevel).includes(normalized as CourtJurisdictionLevel)
    ? (normalized as CourtJurisdictionLevel)
    : CourtJurisdictionLevel.district;
}

function runtimeStatus(value?: string | null) {
  const normalized = value?.toLowerCase() ?? "";
  if (/(closed|disposed|resolved|dismissed|decided|completed)/.test(normalized)) return "closed";
  if (/(pending|active|open|filed)/.test(normalized)) return "active";
  return "watching";
}

function isUnsafeText(record: ManifestRecord) {
  const text = [
    record.caption,
    record.caseType,
    record.status,
    record.exclusionReason,
    record.notes,
    record.plainEnglishSummary,
    record.publicVisibilityStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    /\b(sealed|confidential|juvenile|protected|non[- ]public|adoption|guardianship|termination of parental rights)\b/.test(text) ||
    /\b\d{3}-\d{2}-\d{4}\b/.test(text)
  );
}

function reviewGate(record: ManifestRecord) {
  const reviewStatus = record.reviewStatus?.trim().toLowerCase();
  const visibility = record.publicVisibilityStatus?.trim().toLowerCase();
  if (reviewStatus !== "reviewed_public" && reviewStatus !== "approved" && reviewStatus !== "verified") {
    return "not_reviewed_public";
  }
  if (visibility !== "public") {
    return `visibility_${visibility || "missing"}`;
  }
  if (record.exclusionReason) {
    return "has_exclusion_reason";
  }
  if (isUnsafeText(record)) {
    return "privacy_or_sensitivity_risk";
  }
  if (!record.caseNumber || !record.caption || !record.courtName || !record.sourceUrl) {
    return "missing_required_public_fields";
  }
  return null;
}

function toRuntimeRecord(record: ManifestRecord, manifestPath: string) {
  const courtLevel = normalizeCourtLevel(record.courtLevel);
  const filedDate = record.filedDate ?? null;
  const dispositionDate = record.dispositionDate ?? null;
  const keyDates = Array.isArray(record.keyDates)
    ? record.keyDates.filter((entry) => entry?.label && entry?.date)
    : [
        filedDate ? { label: "Filing date", date: filedDate } : null,
        dispositionDate ? { label: "Disposition date", date: dispositionDate } : null,
      ].filter((entry): entry is { label: string; date: string } => Boolean(entry));

  return {
    id: record.id ?? `${record.courtName}-${record.caseNumber}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: record.caption ?? "Caption pending review",
    summary:
      record.plainEnglishSummary ??
      `Reviewed public court record for ${record.caption}. Direct Democracy displays stored public case metadata only and does not provide legal advice.`,
    courtLevel: courtLevel === CourtJurisdictionLevel.federal ? "federal" : courtLevel === CourtJurisdictionLevel.appellate || courtLevel === CourtJurisdictionLevel.district ? "state" : "local",
    stage: courtLevel === CourtJurisdictionLevel.appellate ? "appeal" : "trial",
    jurisdictionId: record.jurisdictionId ?? record.jurisdictionName?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "unknown",
    jurisdictionName: record.jurisdictionName ?? "Unknown jurisdiction",
    communityName: Array.isArray(record.communityTags) ? record.communityTags[0] ?? null : null,
    issueTags: Array.isArray(record.issueTags) ? record.issueTags : [],
    keyDates,
    status: runtimeStatus(record.status),
    createdAt: record.reviewedAt ?? new Date().toISOString(),
    isRealCourtRecord: true,
    caseSourceType: "public_court_record",
    caseNumber: record.caseNumber,
    courtName: record.courtName,
    caseType: normalizeCaseType(record.caseType),
    filingDate: filedDate,
    dispositionDate: dispositionDate,
    sourceName: record.sourceName ?? record.courtName,
    sourceUrl: record.sourceUrl,
    sourceFile: record.sourceFile ? path.posix.join(path.posix.dirname(manifestPath.replaceAll(path.sep, "/")), record.sourceFile) : null,
    sourceKind: record.sourceKind ?? "manual_reviewed_source",
    lastCheckedAt: record.lastCheckedAt ?? record.reviewedAt ?? null,
    reviewedAt: record.reviewedAt ?? null,
    reviewedBy: record.reviewedBy ?? null,
    reviewStatus: "approved",
    publicVisibilityStatus: "public",
    docketEntries: Array.isArray(record.docketEntries) ? record.docketEntries : [],
    documents: Array.isArray(record.documents) ? record.documents : [],
    parties: Array.isArray(record.parties) ? record.parties : [],
    sourceAttributions: [
      {
        id: `${record.id ?? record.caseNumber}-source`,
        sourceName: record.sourceName ?? record.courtName ?? "Court source",
        sourceUrl: record.sourceUrl ?? null,
        fieldsDerived: ["case number", "caption", "case type", "status", "court", "source URL", "review status"],
        reviewStatus: "approved",
        lastImportedAt: new Date().toISOString(),
      },
    ],
    communityTags: Array.isArray(record.communityTags) ? record.communityTags : [],
    relatedAgencies: Array.isArray(record.relatedAgencies) ? record.relatedAgencies : [],
    relatedOfficials: Array.isArray(record.relatedOfficials) ? record.relatedOfficials : [],
    metadata: record.metadata ?? {},
  };
}

async function upsertDbRecord(record: ManifestRecord, runtimeRecord: ReturnType<typeof toRuntimeRecord>) {
  const now = new Date();
  const sourceSlug = `${record.sourceName ?? record.courtName ?? "court-source"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const sourceUrl = record.sourceUrl ?? record.officialSourceUrl;
  if (!sourceUrl || !record.courtName || !record.caseNumber || !record.caption) {
    return { upserted: false, reason: "missing_db_required_fields" };
  }

  const source = await prisma.source.upsert({
    where: { slug: sourceSlug },
    create: {
      name: record.sourceName ?? record.courtName,
      slug: sourceSlug,
      sourceType: SourceType.GOVERNMENT_PORTAL,
      url: sourceUrl,
      adapterKey: "manual-reviewed-public-court-case-manifest",
      dataCategory: "court_cases",
      accessMethod: CivicDataAccessMethod.manual_download,
      refreshFrequency: "manual reviewed source manifest",
      isActive: true,
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastSyncAt: now,
      syncStatus: SourceSyncStatus.SUCCESS,
      notes: "Manual reviewed public court case source. No sealed, confidential, juvenile, protected, or non-public records are eligible.",
      metadata: { sourceKind: record.sourceKind, sourceFile: record.sourceFile, reviewedAt: record.reviewedAt },
    },
    update: {
      name: record.sourceName ?? record.courtName,
      url: sourceUrl,
      dataCategory: "court_cases",
      accessMethod: CivicDataAccessMethod.manual_download,
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastSyncAt: now,
      syncStatus: SourceSyncStatus.SUCCESS,
      errorLog: null,
      metadata: { sourceKind: record.sourceKind, sourceFile: record.sourceFile, reviewedAt: record.reviewedAt },
    },
  });

  const court = await prisma.courtJurisdiction.upsert({
    where: { name_sourceUrl: { name: record.courtName, sourceUrl } },
    create: {
      name: record.courtName,
      level: normalizeCourtLevel(record.courtLevel),
      jurisdiction: record.jurisdictionName ?? "Unknown jurisdiction",
      sourceUrl,
      accessMethod: CourtAccessMethod.manual_download,
      notes: "Manual reviewed public court case source. Records require privacy/public-visibility review before publication.",
      sourceId: source.id,
    },
    update: {
      level: normalizeCourtLevel(record.courtLevel),
      jurisdiction: record.jurisdictionName ?? "Unknown jurisdiction",
      accessMethod: CourtAccessMethod.manual_download,
      sourceId: source.id,
    },
  });

  const courtCase = await prisma.courtCase.upsert({
    where: { courtJurisdictionId_caseNumber: { courtJurisdictionId: court.id, caseNumber: record.caseNumber } },
    create: {
      id: runtimeRecord.id,
      courtJurisdictionId: court.id,
      sourceId: source.id,
      caseNumber: record.caseNumber,
      caption: record.caption,
      caseType: normalizeCaseType(record.caseType),
      status: record.status ?? null,
      filingDate: parseDate(record.filedDate),
      dispositionDate: parseDate(record.dispositionDate),
      jurisdiction: record.jurisdictionName ?? court.jurisdiction,
      courtLevel: court.level,
      sourceUrl,
      publicVisibilityStatus: CourtCasePublicVisibilityStatus.public,
      reviewStatus: CivicRecordReviewStatus.approved,
      plainEnglishSummary: runtimeRecord.summary,
      lastCheckedAt: parseDate(record.lastCheckedAt) ?? now,
      rawData: toPrismaJson({ ...record, importPolicy: "reviewed_public_manual_manifest" }),
    },
    update: {
      sourceId: source.id,
      caption: record.caption,
      caseType: normalizeCaseType(record.caseType),
      status: record.status ?? null,
      filingDate: parseDate(record.filedDate),
      dispositionDate: parseDate(record.dispositionDate),
      jurisdiction: record.jurisdictionName ?? court.jurisdiction,
      courtLevel: court.level,
      sourceUrl,
      publicVisibilityStatus: CourtCasePublicVisibilityStatus.public,
      reviewStatus: CivicRecordReviewStatus.approved,
      plainEnglishSummary: runtimeRecord.summary,
      lastCheckedAt: parseDate(record.lastCheckedAt) ?? now,
      rawData: toPrismaJson({ ...record, importPolicy: "reviewed_public_manual_manifest" }),
    },
  });

  const recordChecksum = checksum(record);
  const run = await prisma.sourceSyncRun.create({
    data: {
      sourceId: source.id,
      completedAt: now,
      status: SourceSyncStatus.SUCCESS,
      recordsSeen: 1,
      recordsFound: 1,
      recordsCreated: 0,
      recordsUpdated: 1,
      recordsFlaggedForReview: 0,
      checksum: recordChecksum,
    },
  });

  const sourceRecord = await prisma.sourceRecord.upsert({
    where: { sourceId_checksum: { sourceId: source.id, checksum: recordChecksum } },
    create: {
      sourceId: source.id,
      sourceSyncRunId: run.id,
      entityType: CivicEntityType.COURT_CASE,
      entityId: courtCase.id,
      externalId: record.caseNumber,
      checksum: recordChecksum,
      dedupeKey: `${court.id}:${record.caseNumber}`,
      rawData: toPrismaJson(record),
      normalizedData: toPrismaJson(runtimeRecord),
      reviewStatus: CivicRecordReviewStatus.approved,
    },
    update: {
      sourceSyncRunId: run.id,
      entityId: courtCase.id,
      normalizedData: toPrismaJson(runtimeRecord),
      reviewStatus: CivicRecordReviewStatus.approved,
    },
  });

  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: CivicEntityType.COURT_CASE,
        entityId: courtCase.id,
        fieldName: "reviewed_public_case_manifest",
        sourceUrl,
      },
    },
    create: {
      entityType: CivicEntityType.COURT_CASE,
      entityId: courtCase.id,
      fieldName: "reviewed_public_case_manifest",
      sourceId: source.id,
      sourceRecordId: sourceRecord.id,
      sourceName: record.sourceName ?? court.name,
      sourceUrl,
      fieldsDerived: ["case number", "caption", "case type", "status", "court", "public visibility", "review status"],
      confidenceScore: 0.9,
      reviewStatus: CivicRecordReviewStatus.approved,
      lastImportedAt: now,
      metadata: { reviewedAt: record.reviewedAt, reviewedBy: record.reviewedBy, sourceFile: record.sourceFile },
    },
    update: {
      sourceId: source.id,
      sourceRecordId: sourceRecord.id,
      sourceName: record.sourceName ?? court.name,
      fieldsDerived: ["case number", "caption", "case type", "status", "court", "public visibility", "review status"],
      confidenceScore: 0.9,
      reviewStatus: CivicRecordReviewStatus.approved,
      lastImportedAt: now,
      metadata: { reviewedAt: record.reviewedAt, reviewedBy: record.reviewedBy, sourceFile: record.sourceFile },
    },
  });

  return { upserted: true };
}

async function main() {
  const manifestPath = argValue("--manifest", DEFAULT_MANIFEST);
  const runtimePath = argValue("--runtime", DEFAULT_RUNTIME);
  const reportPath = argValue("--report", DEFAULT_REPORT);
  const skipDb = hasFlag("--skip-db");

  const manifestText = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as Manifest;
  const records = Array.isArray(manifest.records) ? manifest.records : [];
  const runtimeRecords = [];
  const exclusions: Array<{ id?: string; caseNumber?: string | null; caption?: string | null; reason: string }> = [];
  let dbUpserted = 0;
  let dbSkipped = 0;
  const dbFailures: Array<{ id?: string; reason: string }> = [];

  for (const record of records) {
    const exclusionReason = reviewGate(record);
    if (exclusionReason) {
      exclusions.push({ id: record.id, caseNumber: record.caseNumber, caption: record.caption, reason: exclusionReason });
      continue;
    }

    const runtimeRecord = toRuntimeRecord(record, manifestPath);
    runtimeRecords.push(runtimeRecord);

    if (skipDb) {
      dbSkipped += 1;
      continue;
    }

    try {
      const result = await upsertDbRecord(record, runtimeRecord);
      if (result.upserted) dbUpserted += 1;
      else {
        dbSkipped += 1;
        dbFailures.push({ id: record.id, reason: result.reason ?? "db_skipped" });
      }
    } catch (error) {
      dbSkipped += 1;
      dbFailures.push({ id: record.id, reason: error instanceof Error ? error.message : "unknown_db_error" });
    }
  }

  const generatedAt = new Date().toISOString();
  const runtime = {
    schemaVersion: 1,
    generatedAt,
    sourceManifest: manifestPath,
    counts: {
      manifestRecords: records.length,
      runtimeRecords: runtimeRecords.length,
      excludedRecords: exclusions.length,
    },
    records: runtimeRecords,
  };
  const report = {
    generatedAt,
    sourceManifest: manifestPath,
    runtimePath,
    counts: {
      manifestRecords: records.length,
      reviewedPublic: runtimeRecords.length,
      excluded: exclusions.length,
      needsReview: records.filter((record) => record.reviewStatus === "needs_review" || record.publicVisibilityStatus === "pending_privacy_review").length,
      dbUpserted,
      dbSkipped,
    },
    exclusions,
    dbFailures,
    safetyRules: [
      "Only reviewed_public/approved/verified records with public visibility are eligible.",
      "Sealed, confidential, juvenile, protected, non-public, adoption, guardianship, and sensitive identifiers are excluded.",
      "Runtime output contains public metadata only and no legal advice.",
    ],
  };

  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(runtimePath, `${JSON.stringify(runtime, null, 2)}\n`);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        import: "public-court-records",
        ...report.counts,
        runtimePath,
        reportPath,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
