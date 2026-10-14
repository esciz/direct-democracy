import { readFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
}

const artifact = readJson<{
  records: Array<{
    id?: string;
    meetingId?: string;
    meetingItemId?: string;
    actionTitle?: string;
    outcome?: string | null;
    voteCount?: unknown;
    namedVotes?: unknown[];
    sourceSnippet?: string;
    sourceUrl?: string | null;
    sourcePath?: string | null;
    confidence?: number;
    needsReview?: boolean;
  }>;
}>("public-meeting-action-results.json");
const audit = readJson<{ totals: Record<string, number> }>("public-meeting-action-results-audit.json");

const failures: string[] = [];
for (const record of artifact.records) {
  if (!record.id) failures.push("Action result missing id");
  if (!record.meetingId) failures.push(`Action result ${record.id ?? "unknown"} missing meetingId`);
  if (!record.meetingItemId) failures.push(`Action result ${record.id ?? "unknown"} missing meetingItemId`);
  if (!record.actionTitle) failures.push(`Action result ${record.id ?? "unknown"} missing title`);
  if (!record.sourceSnippet) failures.push(`Action result ${record.id ?? "unknown"} missing sourceSnippet`);
  if (!record.sourceUrl && !record.sourcePath) failures.push(`Action result ${record.id ?? "unknown"} missing source reference`);
  if (typeof record.confidence !== "number") failures.push(`Action result ${record.id ?? "unknown"} missing confidence`);
  if (!record.outcome && !record.voteCount && !(record.namedVotes ?? []).length && record.needsReview !== true) {
    failures.push(`Action result ${record.id ?? "unknown"} lacks outcome/vote evidence but is not marked needsReview`);
  }
}

if ((audit.totals.actionResultsExtracted ?? 0) !== artifact.records.length) {
  failures.push(`Audit actionResultsExtracted ${audit.totals.actionResultsExtracted} does not match records ${artifact.records.length}`);
}

if (failures.length) {
  console.error("Public meeting action result audit failed:");
  for (const failure of failures.slice(0, 30)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public meeting action result audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
