import { readFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

type ProjectRecord = {
  id: string;
  status: string;
  statusReason?: string;
  sourceReferences?: unknown[];
  confidence?: number;
  needsReview?: boolean;
  relatedVotingCards?: string[];
  relatedMeetings?: string[];
};

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
}

const artifact = readJson<{ records: ProjectRecord[] }>("projects-runtime.json");
const audit = readJson<{ totals: Record<string, number>; statusCounts: Record<string, number> }>("project-status-audit.json");
const allowedStatuses = new Set(["proposed", "approved", "funded", "in_progress", "delayed", "completed", "canceled", "unknown"]);
const failures: string[] = [];

for (const project of artifact.records) {
  if (!allowedStatuses.has(project.status)) failures.push(`${project.id} has invalid status ${project.status}`);
  if (!project.statusReason) failures.push(`${project.id} missing statusReason`);
  if (!project.sourceReferences?.length) failures.push(`${project.id} missing sourceReferences`);
  if (!project.relatedVotingCards?.length) failures.push(`${project.id} missing relatedVotingCards`);
  if (!project.relatedMeetings?.length) failures.push(`${project.id} missing relatedMeetings`);
  if (typeof project.confidence !== "number") failures.push(`${project.id} missing numeric confidence`);
  if (project.status === "unknown" && project.needsReview !== true) failures.push(`${project.id} unknown status should need review`);
}

if ((audit.totals.projects ?? 0) !== artifact.records.length) {
  failures.push(`Audit project total ${audit.totals.projects} does not match records ${artifact.records.length}`);
}

if (failures.length) {
  console.error("Project status audit failed:");
  for (const failure of failures.slice(0, 30)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Project status audit passed.");
console.log(JSON.stringify({ totals: audit.totals, statusCounts: audit.statusCounts }, null, 2));
