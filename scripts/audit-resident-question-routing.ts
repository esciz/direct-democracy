import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "resident-question-routing-audit.json");
const PRIVATE_QUEUE_PATH = path.join(ROOT, "data", "private", "resident-story-intake-review-queue.json");

function readText(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function fileContains(relativePath: string, needle: string) {
  return readText(relativePath).includes(needle);
}

const queue = readJson<{ records?: Array<{ routing?: { status?: string; publicStatus?: string; targetType?: string; targetId?: string | null } }> }>(PRIVATE_QUEUE_PATH, {
  records: [],
});
const records = Array.isArray(queue.records) ? queue.records : [];
const recordsWithRouting = records.filter((record) => record.routing);
const recordsMissingRouting = records.length - recordsWithRouting.length;

const decisions = readJson<unknown[] | { cards?: unknown[]; records?: unknown[] }>(path.join(GENERATED_DIR, "voting-cards.json"), []);
const projects = readJson<unknown[] | { projects?: unknown[]; records?: unknown[] }>(path.join(GENERATED_DIR, "projects-runtime.json"), []);
const decisionCount = Array.isArray(decisions) ? decisions.length : Array.isArray(decisions.cards) ? decisions.cards.length : Array.isArray(decisions.records) ? decisions.records.length : 0;
const projectCount = Array.isArray(projects) ? projects.length : Array.isArray(projects.projects) ? projects.projects.length : Array.isArray(projects.records) ? projects.records.length : 0;

const checks = {
  intakeModelHasRouting: fileContains("lib/cases/resident-intake.ts", "export type ResidentQuestionRouting"),
  intakeDefaultsPrivate: fileContains("lib/cases/resident-intake.ts", 'publicStatus: "received"'),
  submitCarriesTargetType: fileContains("app/cases/submit/page.tsx", 'name="routingTargetType"'),
  submitExplainsNoAutoSend: fileContains("app/cases/submit/page.tsx", "not emailed or published automatically"),
  decisionEntryPointRouted: fileContains("app/decisions/[decisionId]/page.tsx", "targetType=decision"),
  projectEntryPointRouted: fileContains("app/projects/[projectId]/page.tsx", "targetType=project"),
  communityEntryPointRouted: fileContains("app/community/[communitySlug]/page.tsx", "targetType=community"),
  adminRoutingWorkflow: fileContains("app/admin/cases/resident-intake/page.tsx", 'value="update_routing"'),
  adminReadyToSendStatus: fileContains("app/admin/cases/resident-intake/page.tsx", "ready_to_send"),
  adminAnsweredStatus: fileContains("app/admin/cases/resident-intake/page.tsx", "answered"),
  actionHandlesRoutingOnlyUpdate: fileContains("lib/cases/resident-intake-actions.ts", 'decision === "update_routing"'),
};

const errors = Object.entries(checks)
  .filter(([, ok]) => !ok)
  .map(([name]) => `${name} check failed`);

const audit = {
  generatedAt: new Date().toISOString(),
  totals: {
    residentQuestionQueueRecords: records.length,
    recordsWithRouting: recordsWithRouting.length,
    recordsMissingRouting,
    generatedDecisionRecordsAvailable: decisionCount,
    generatedProjectRecordsAvailable: projectCount,
  },
  routingQueue: {
    pending: recordsWithRouting.filter((record) => record.routing?.status === "pending").length,
    needsSource: recordsWithRouting.filter((record) => record.routing?.status === "needs_source").length,
    readyToSend: recordsWithRouting.filter((record) => record.routing?.status === "ready_to_send").length,
    sentExternally: recordsWithRouting.filter((record) => record.routing?.status === "sent_externally").length,
    answered: recordsWithRouting.filter((record) => record.routing?.status === "answered").length,
    closed: recordsWithRouting.filter((record) => record.routing?.status === "closed").length,
  },
  productBoundary: {
    privateByDefault: checks.intakeDefaultsPrivate,
    noAutomaticExternalSend: checks.submitExplainsNoAutoSend && !readText("lib/cases/resident-intake-actions.ts").includes("sendEmail"),
    noAutomaticPublication: checks.submitExplainsNoAutoSend,
  },
  checks,
  errors,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

if (errors.length) {
  console.error("Resident question routing audit failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Resident question routing audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
