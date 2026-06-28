import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "sprint-2l-review-workbench.json");

type DocumentTextRecord = {
  documentId: string;
  meetingId: string;
  documentType?: string | null;
  sourceUrl?: string | null;
  extractionMethod?: string | null;
  extractionQuality?: string | null;
  textLength?: number | null;
  failureReason?: string | null;
};

type RetrievalRecord = {
  documentId: string;
  meetingId: string;
  organizationId?: string | null;
  jurisdiction?: string | null;
  documentType?: string | null;
  sourceUrl?: string | null;
  sourceHost?: string | null;
  sourcePlatform?: string | null;
  retrievalState?: string | null;
  retrievalStatus?: string | null;
  failureReason?: string | null;
  recommendedNextAction?: string | null;
};

type VoteAudit = {
  totals?: Record<string, number>;
  ambiguousVoteActions?: Array<{ title: string; source_url: string | null; reason: string; sourceSnippet: string }>;
  attendanceReviewActions?: Array<{ title: string; source_url: string | null; reason: string; outcome?: { raw?: string; sourceSnippet?: string } | null }>;
  distributionReviewActions?: Array<{ title: string; source_url: string | null; reason: string; outcome?: { raw?: string; sourceSnippet?: string } | null }>;
};

type AttendanceRecord = {
  personName: string;
  meetingId: string;
  bodyId: string | null;
  organizationId: string | null;
  matchConfidence: string;
  votingEligibility: string;
  sourceSnippet: string;
};

type OfficialsCoverage = {
  totals?: Record<string, number>;
  rows?: Array<{
    jurisdictionId: string;
    jurisdictionName: string;
    adapterStatus: string;
    publicRuntimeCount: number;
    currentElectedGoverningOfficials: number;
    emptyPublicSectionRisk: boolean;
    manualFallbackStatus: string;
  }>;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function recordsFrom<T>(fileName: string): T[] {
  const value = readJson<unknown>(fileName, []);
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { records?: unknown[] }).records)) {
    return (value as { records: T[] }).records;
  }
  return [];
}

function hostFor(url: string | null | undefined) {
  try {
    return new URL(url ?? "").host || "unknown";
  } catch {
    return "unknown";
  }
}

function countBy<T>(records: T[], keyFor: (record: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const key = keyFor(record) || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function summarizeUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}${parsed.search ? parsed.search.slice(0, 80) : ""}`;
  } catch {
    return url.slice(0, 140);
  }
}

const generatedAt = new Date().toISOString();
const documentText = recordsFrom<DocumentTextRecord>("public-meeting-document-text.json");
const retrievalQueue = recordsFrom<RetrievalRecord>("public-meeting-retrieval-queue.json");
const voteAudit = readJson<VoteAudit>("public-meeting-vote-extraction-audit.json", {});
const attendance = recordsFrom<AttendanceRecord>("public-meeting-attendance.json");
const officialsCoverage = readJson<OfficialsCoverage>("officials-coverage-audit.json", {});

const documentFailures = documentText.filter((record) => record.extractionMethod === "failed" || Boolean(record.failureReason));
const retrievalBlocked = retrievalQueue.filter((record) => ["failed", "unavailable", "blocked_by_network", "ocr_required"].includes(record.retrievalState ?? ""));
const ambiguous = voteAudit.ambiguousVoteActions ?? [];
const attendanceReview = voteAudit.attendanceReviewActions ?? [];
const distributionReview = voteAudit.distributionReviewActions ?? [];
const unmatchedAttendance = attendance.filter((record) => record.matchConfidence === "unmatched_name");
const officialGaps = (officialsCoverage.rows ?? []).filter((row) => row.adapterStatus !== "complete" || row.emptyPublicSectionRisk);

const report = {
  generatedAt,
  totals: {
    documentTextRecords: documentText.length,
    documentFailures: documentFailures.length,
    retrievalBlocked: retrievalBlocked.length,
    voteReviewActions: ambiguous.length + attendanceReview.length + distributionReview.length,
    ambiguousVoteActions: ambiguous.length,
    attendanceReviewActions: attendanceReview.length,
    distributionReviewActions: distributionReview.length,
    unmatchedAttendanceNames: unmatchedAttendance.length,
    officialCoverageGaps: officialGaps.length,
  },
  documentRecovery: {
    byFailureReason: countBy(documentFailures, (record) => record.failureReason ?? record.extractionMethod),
    byHost: countBy(documentFailures, (record) => hostFor(record.sourceUrl)),
    blockedRetrievalByState: countBy(retrievalBlocked, (record) => record.retrievalState),
    blockedRetrievalByHost: countBy(retrievalBlocked, (record) => record.sourceHost ?? hostFor(record.sourceUrl)),
    samples: documentFailures.slice(0, 25).map((record) => ({
      documentId: record.documentId,
      meetingId: record.meetingId,
      documentType: record.documentType ?? null,
      host: hostFor(record.sourceUrl),
      source: summarizeUrl(record.sourceUrl),
      failureReason: record.failureReason ?? record.extractionMethod ?? "unknown",
    })),
  },
  voteReview: {
    byBucket: [
      { key: "ambiguous_vote_language", count: ambiguous.length },
      { key: "attendance_not_verified", count: attendanceReview.length },
      { key: "distribution_review", count: distributionReview.length },
    ],
    attendanceReviewReasons: countBy(attendanceReview, (record) => record.reason),
    distributionReviewReasons: countBy(distributionReview, (record) => record.reason),
    ambiguousSamples: ambiguous.slice(0, 15).map((record) => ({
      title: record.title,
      reason: record.reason,
      source: summarizeUrl(record.source_url),
      snippet: record.sourceSnippet,
    })),
  },
  attendanceIdentity: {
    unmatchedByBody: countBy(unmatchedAttendance, (record) => record.bodyId ?? record.organizationId),
    topUnmatchedNames: countBy(unmatchedAttendance, (record) => record.personName).slice(0, 50),
    samples: unmatchedAttendance.slice(0, 25).map((record) => ({
      personName: record.personName,
      meetingId: record.meetingId,
      bodyId: record.bodyId,
      organizationId: record.organizationId,
      votingEligibility: record.votingEligibility,
      snippet: record.sourceSnippet,
    })),
  },
  officialCoverage: {
    totals: officialsCoverage.totals ?? {},
    gaps: officialGaps.map((row) => ({
      jurisdictionId: row.jurisdictionId,
      jurisdictionName: row.jurisdictionName,
      status: row.adapterStatus,
      officials: row.publicRuntimeCount,
      governingOfficials: row.currentElectedGoverningOfficials,
      emptyPublicSectionRisk: row.emptyPublicSectionRisk,
      nextAction: row.publicRuntimeCount ? "review remaining expected offices" : row.manualFallbackStatus === "seed_roster_available" ? "promote reviewed source roster" : "add official source adapter",
    })),
  },
  recommendedNextActions: [
    "Build source-specific adapters for the highest-count blocked hosts before adding new jurisdictions.",
    "Review attendance_not_verified actions by body; add governing rosters only where source text supports voting membership.",
    "Treat distribution_review as human-review work unless the source explicitly names no/abstain voters.",
    "Keep reviewed manual officials separate from unverified attendance names.",
  ],
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Generated Sprint 2L review workbench at ${OUTPUT_PATH}`);
console.log(JSON.stringify(report.totals, null, 2));
