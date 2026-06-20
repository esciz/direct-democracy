import { readFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const VALID_STATUSES = new Set(["present", "absent", "excused", "recused", "non_voting_present", "unknown"]);
const VALID_ELIGIBILITY = new Set(["eligible_voting_member", "non_voting", "unknown"]);
const VALID_MATCH = new Set(["exact_name_match", "normalized_name_match", "title_plus_name_match", "unmatched_name"]);

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
}

const artifact = readJson<{
  records: Array<{
    meetingId?: string;
    bodyId?: string | null;
    personName?: string;
    attendanceStatus?: string;
    votingEligibility?: string;
    sourceSnippet?: string | null;
    confidence?: number;
    matchConfidence?: string;
    needsReview?: boolean;
  }>;
}>("public-meeting-attendance.json");
const audit = readJson<{ totals: Record<string, number> }>("public-meeting-attendance-audit.json");
const failures: string[] = [];

for (const record of artifact.records) {
  if (!record.meetingId) failures.push("Attendance record missing meetingId");
  if (!record.personName) failures.push(`Attendance record for ${record.meetingId ?? "unknown meeting"} missing personName`);
  if (!VALID_STATUSES.has(record.attendanceStatus ?? "")) failures.push(`Invalid attendanceStatus ${record.attendanceStatus ?? "missing"}`);
  if (!VALID_ELIGIBILITY.has(record.votingEligibility ?? "")) failures.push(`Invalid votingEligibility ${record.votingEligibility ?? "missing"}`);
  if (!VALID_MATCH.has(record.matchConfidence ?? "")) failures.push(`Invalid matchConfidence ${record.matchConfidence ?? "missing"}`);
  if (!record.sourceSnippet) failures.push(`Attendance record for ${record.personName ?? "unknown"} missing sourceSnippet`);
  if (typeof record.confidence !== "number") failures.push(`Attendance record for ${record.personName ?? "unknown"} missing numeric confidence`);
  if (record.votingEligibility === "unknown" && record.needsReview !== true) {
    failures.push(`Unknown eligibility record ${record.personName ?? "unknown"} should need review`);
  }
}

if ((audit.totals.attendanceRecords ?? 0) !== artifact.records.length) {
  failures.push(`Audit attendanceRecords ${audit.totals.attendanceRecords} does not match record count ${artifact.records.length}`);
}

if (failures.length) {
  console.error("Public meeting attendance audit failed:");
  for (const failure of failures.slice(0, 30)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public meeting attendance audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
