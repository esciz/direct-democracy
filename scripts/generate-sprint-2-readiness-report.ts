import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "sprint-2-readiness-report.json");

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
  if (value && typeof value === "object" && Array.isArray((value as { records?: unknown[] }).records)) return (value as { records: T[] }).records;
  return [];
}

function status(ok: boolean, warning: boolean) {
  if (ok) return "green";
  if (warning) return "yellow";
  return "red";
}

type AttendanceRecord = {
  matchConfidence: string;
  votingEligibility: string;
  attendanceStatus: string;
  organizationId: string | null;
};

const generatedAt = new Date().toISOString();
const documentText = recordsFrom<{ extractionMethod: string }>("public-meeting-document-text.json");
const retrievalQueue = recordsFrom<{ retrievalState: string }>("public-meeting-retrieval-queue.json");
const adapterReadiness = readJson<{ audit?: { totals?: Record<string, number> } }>("priority-source-adapter-readiness.json", {});
const officialsCoverage = readJson<{ totals?: Record<string, number> }>("officials-coverage-audit.json", {});
const voteAudit = readJson<{ totals?: Record<string, number>; attendanceReviewActions?: unknown[]; distributionReviewActions?: unknown[]; ambiguousVoteActions?: unknown[] }>("public-meeting-vote-extraction-audit.json", {});
const actionAudit = readJson<{ totals?: Record<string, number> }>("public-meeting-action-results-audit.json", {});
const attendanceAudit = readJson<{ totals?: Record<string, number>; matchConfidenceCounts?: Record<string, number> }>("public-meeting-attendance-audit.json", {});
const attendance = recordsFrom<AttendanceRecord>("public-meeting-attendance.json");
const communityCoverage = readJson<{ totals?: Record<string, number> }>("nevada-community-coverage-report.json", {});
const browseAudit = readJson<{ audit?: { totals?: Record<string, number> } }>("browse-preview-audit.json", {});

const documentFailures = documentText.filter((record) => record.extractionMethod === "failed").length;
const retrievalBlocked = retrievalQueue.filter((record) => ["failed", "unavailable", "blocked_by_network", "ocr_required", "queued"].includes(record.retrievalState)).length;
const adapterTotals = adapterReadiness.audit?.totals ?? {};
const officialTotals = officialsCoverage.totals ?? {};
const voteTotals = voteAudit.totals ?? {};
const attendanceTotals = attendanceAudit.totals ?? {};
const actionTotals = actionAudit.totals ?? {};
const communityTotals = communityCoverage.totals ?? {};
const browseTotals = browseAudit.audit?.totals ?? {};

const unmatchedVoting = attendance.filter((record) => record.matchConfidence === "unmatched_name" && record.votingEligibility === "eligible_voting_member").length;
const unmatchedNonVoting = attendance.filter((record) => record.matchConfidence === "unmatched_name" && record.votingEligibility === "non_voting").length;
const remainingHumanReview = Number(voteTotals.remainingUnresolvedVoteActions ?? voteTotals.needsReview ?? 0);

const report = {
  generatedAt,
  status: status(documentFailures === 0 && retrievalBlocked === 0 && Number(adapterTotals.adapterNeededRows ?? 0) === 0 && Number(officialTotals.failures ?? 0) === 0, remainingHumanReview <= 75),
  recommendation:
    documentFailures === 0 && retrievalBlocked === 0 && Number(adapterTotals.adapterNeededRows ?? 0) === 0 && Number(officialTotals.failures ?? 0) === 0
      ? "Sprint 2 source plumbing is ready to close. Remaining vote items are human-review/identity-quality work, not blockers for the next product sprint."
      : "Do not close Sprint 2 yet; source, adapter, or officials coverage gates still have blockers.",
  gates: {
    documents: {
      status: status(documentFailures === 0 && retrievalBlocked === 0, documentFailures <= 3),
      documentsScanned: documentText.length,
      documentsExtracted: documentText.length - documentFailures,
      documentFailures,
      retrievalBlocked,
    },
    sourceAdapters: {
      status: status(Number(adapterTotals.adapterNeededRows ?? 0) === 0 && Number(adapterTotals.notConfiguredRows ?? 0) === 0, Number(adapterTotals.partialRows ?? 0) > 0),
      ...adapterTotals,
    },
    officials: {
      status: status(Number(officialTotals.failures ?? 0) === 0 && Number(officialTotals.emptyPublicSectionRisks ?? 0) === 0, Number(officialTotals.partial ?? 0) > 0),
      ...officialTotals,
    },
    actionResults: {
      status: status(Number(actionTotals.actionResultsExtracted ?? 0) > 0, Number(actionTotals.needsReview ?? 0) > 0),
      ...actionTotals,
    },
    voteAttribution: {
      status: status(remainingHumanReview <= 75, remainingHumanReview <= 150),
      ...voteTotals,
      remainingHumanReview,
      reviewBuckets: {
        ambiguousVoteActions: voteAudit.ambiguousVoteActions?.length ?? 0,
        attendanceReviewActions: voteAudit.attendanceReviewActions?.length ?? 0,
        distributionReviewActions: voteAudit.distributionReviewActions?.length ?? 0,
      },
    },
    attendanceIdentity: {
      status: status(Number(attendanceTotals.meetingsNeedingAttendanceReview ?? 0) === 0, unmatchedVoting > 0),
      ...attendanceTotals,
      unmatchedVotingMemberNames: unmatchedVoting,
      unmatchedNonVotingNames: unmatchedNonVoting,
      matchConfidenceCounts: attendanceAudit.matchConfidenceCounts ?? {},
      note: "Unmatched names are preserved as source-backed attendance names. They are not used for vote attribution unless attendance and roster evidence are sufficient.",
    },
    communityAndBrowse: {
      status: status(Number(communityTotals.communityPagesReady ?? 0) >= 39 && Number(browseTotals.categoriesWithDemoData ?? 0) === 0, false),
      communityPagesReady: communityTotals.communityPagesReady ?? null,
      communitiesWithUsefulDashboardData: communityTotals.communitiesWithUsefulDashboardData ?? null,
      browseCategoriesWithDemoData: browseTotals.categoriesWithDemoData ?? 0,
    },
  },
  remainingWork: [
    {
      bucket: "vote_distribution_review",
      count: voteAudit.distributionReviewActions?.length ?? 0,
      nextAction: "Human or source-specific roll-call review; do not infer split votes without named distribution.",
    },
    {
      bucket: "attendance_identity_matching",
      count: unmatchedVoting,
      nextAction: "Add reviewed rosters for Carson City special boards and regional bodies when official rosters are source-backed.",
    },
    {
      bucket: "ambiguous_vote_language",
      count: voteAudit.ambiguousVoteActions?.length ?? 0,
      nextAction: "Review manually; parser intentionally refuses to assign votes without explicit name-to-vote evidence.",
    },
  ],
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Generated Sprint 2 readiness report at ${OUTPUT_PATH}`);
console.log(
  JSON.stringify(
    {
      status: report.status,
      documentFailures,
      retrievalBlocked,
      adapterNeededRows: adapterTotals.adapterNeededRows ?? 0,
      officialFailures: officialTotals.failures ?? 0,
      remainingHumanReview,
      unmatchedVotingMemberNames: unmatchedVoting,
    },
    null,
    2,
  ),
);
