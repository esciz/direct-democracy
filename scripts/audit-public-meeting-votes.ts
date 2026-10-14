import { readFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const NAMED_VOTE_EVIDENCE = new Set(["explicit_roll_call_group", "inline_named_vote", "unanimous_with_attendance_roster", "aggregate_full_roster_match", "attendance_absent", "attendance_excused"]);
const MOTION_EVIDENCE = new Set(["motion_mover", "motion_second"]);
const VALID_VOTES = new Set(["yes", "no", "abstain", "absent"]);
const VALID_EVIDENCE_TYPES = new Set([
  "explicit_roll_call_group",
  "inline_named_vote",
  "motion_mover",
  "motion_second",
  "unanimous_with_attendance_roster",
  "aggregate_full_roster_match",
  "aggregate_partial_distribution",
  "aggregate_only",
  "ambiguous_vote_language",
  "attendance_present",
  "attendance_absent",
  "attendance_excused",
  "attendance_recused",
]);

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
}

const votes = readJson<Array<{ official_name?: string; source_url?: string | null; source_snippet?: string | null; vote?: string; evidenceType?: string; confidence_score?: number }>>("public-meeting-votes.json");
const audit = readJson<{
  totals: Record<string, number>;
  aggregateOnlyOutcomes?: unknown[];
  ambiguousVoteActions?: unknown[];
  attendanceReviewActions?: unknown[];
  distributionReviewActions?: unknown[];
}>("public-meeting-vote-extraction-audit.json");
const failures: string[] = [];
const namedVotes = votes.filter((vote) => NAMED_VOTE_EVIDENCE.has(vote.evidenceType ?? ""));
const motionRows = votes.filter((vote) => MOTION_EVIDENCE.has(vote.evidenceType ?? ""));

for (const vote of votes) {
  if (!vote.official_name) failures.push("Parsed vote missing official_name");
  if (!vote.evidenceType) failures.push(`Vote for ${vote.official_name ?? "unknown"} missing evidenceType`);
  if (vote.evidenceType && !VALID_EVIDENCE_TYPES.has(vote.evidenceType)) failures.push(`Vote for ${vote.official_name ?? "unknown"} has invalid evidenceType ${vote.evidenceType}`);
  if (NAMED_VOTE_EVIDENCE.has(vote.evidenceType ?? "") && !VALID_VOTES.has(vote.vote ?? "")) {
    failures.push(`Named vote for ${vote.official_name ?? "unknown"} has invalid vote choice ${vote.vote ?? "missing"}`);
  }
  if (NAMED_VOTE_EVIDENCE.has(vote.evidenceType ?? "") && (vote.confidence_score ?? 0) < 0.85) {
    failures.push(`Named vote for ${vote.official_name ?? "unknown"} has confidence below high threshold`);
  }
  if (MOTION_EVIDENCE.has(vote.evidenceType ?? "") && (vote.confidence_score ?? 0) < 0.75) {
    failures.push(`Motion metadata for ${vote.official_name ?? "unknown"} has confidence below medium threshold`);
  }
  if (!vote.source_url && !vote.source_snippet) failures.push(`Vote for ${vote.official_name ?? "unknown"} missing source reference`);
  if (vote.evidenceType === "aggregate_only") failures.push("Aggregate-only evidence must not be written as a named vote row");
}

if ((audit.totals.parsedNamedVotes ?? 0) !== namedVotes.length) {
  failures.push(`Audit parsedNamedVotes ${audit.totals.parsedNamedVotes} does not match named vote rows ${namedVotes.length}`);
}

if ((audit.totals.motionSecondParsed ?? 0) !== motionRows.length) {
  failures.push(`Audit motionSecondParsed ${audit.totals.motionSecondParsed} does not match motion rows ${motionRows.length}`);
}

if ((audit.totals.aggregateOnlyOutcomes ?? 0) > (audit.aggregateOnlyOutcomes?.length ?? 0)) {
  failures.push("Audit aggregateOnlyOutcomes total exceeds available aggregate evidence rows");
}

if ((audit.totals.ambiguousVoteActionsNeedingReview ?? 0) !== (audit.ambiguousVoteActions?.length ?? 0)) {
  failures.push("Audit ambiguousVoteActionsNeedingReview does not match ambiguous action rows");
}

if ((audit.totals.actionsNeedingAttendanceReview ?? 0) !== (audit.attendanceReviewActions?.length ?? 0)) {
  failures.push("Audit actionsNeedingAttendanceReview does not match attendance review rows");
}

if ((audit.totals.actionsNeedingDistributionReview ?? 0) !== (audit.distributionReviewActions?.length ?? 0)) {
  failures.push("Audit actionsNeedingDistributionReview does not match distribution review rows");
}

const expectedNeedsReview =
  (audit.totals.ambiguousVoteActionsNeedingReview ?? 0) +
  (audit.totals.actionsNeedingAttendanceReview ?? 0) +
  (audit.totals.actionsNeedingDistributionReview ?? 0);
if ((audit.totals.needsReview ?? 0) !== expectedNeedsReview) {
  failures.push(`Audit needsReview ${audit.totals.needsReview} does not match review bucket total ${expectedNeedsReview}`);
}

if (failures.length) {
  console.error("Public meeting vote audit failed:");
  for (const failure of failures.slice(0, 25)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public meeting vote audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
