import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "resident-question-answers-audit.json");
const ANSWERS_RUNTIME_PATH = path.join(GENERATED_DIR, "resident-question-answers-runtime.json");
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
  return existsSync(path.join(ROOT, relativePath)) && readText(relativePath).includes(needle);
}

const queue = readJson<{ records?: Array<{ routing?: { publicStatus?: string; answerSummary?: string | null } }> }>(PRIVATE_QUEUE_PATH, { records: [] });
const runtime = readJson<{ records?: Array<{ sourceStatus?: string; answerSummary?: string; questionTitle?: string }>; totals?: { reviewedAnswers?: number } }>(
  ANSWERS_RUNTIME_PATH,
  { records: [], totals: { reviewedAnswers: 0 } },
);

const queueRecords = Array.isArray(queue.records) ? queue.records : [];
const answerPublishedInPrivateQueue = queueRecords.filter((record) => record.routing?.publicStatus === "answer_published" && record.routing.answerSummary).length;
const runtimeRecords = Array.isArray(runtime.records) ? runtime.records : [];

const checks = {
  answerBuilderExists: fileContains("lib/cases/resident-intake.ts", "buildResidentQuestionAnswerSummary"),
  answerRuntimeGeneratedSeparately: fileContains("lib/cases/resident-intake-store.ts", "resident-question-answers-runtime.json"),
  contextualLookupHelperExists: fileContains("lib/cases/resident-intake-store.ts", "getResidentQuestionAnswersForTarget"),
  publicAnswersRouteExists: fileContains("app/answers/page.tsx", "Reviewed civic Q&A"),
  casesLinksToAnswers: fileContains("app/cases/page.tsx", 'href="/answers"'),
  decisionsShowContextualAnswers: fileContains("app/decisions/[decisionId]/page.tsx", "getResidentQuestionAnswersForTarget") && fileContains("app/decisions/[decisionId]/page.tsx", "Reviewed questions about this decision"),
  projectsShowContextualAnswers: fileContains("app/projects/[projectId]/page.tsx", "getResidentQuestionAnswersForTarget") && fileContains("app/projects/[projectId]/page.tsx", "Reviewed resident answers"),
  communitiesShowContextualAnswers: fileContains("app/community/[communitySlug]/page.tsx", "getResidentQuestionAnswersForTarget") && fileContains("app/community/[communitySlug]/page.tsx", "Questions residents have asked here"),
  adminAnswerWorkbenchExists: fileContains("app/admin/cases/resident-intake/page.tsx", "Answer review workbench"),
  adminAnswerQueueFiltersExist: fileContains("app/admin/cases/resident-intake/page.tsx", "ready-to-publish") && fileContains("app/admin/cases/resident-intake/page.tsx", "answer-workbench"),
  adminAnswerReadinessChecklistExists: fileContains("app/admin/cases/resident-intake/page.tsx", "Not ready to publish") && fileContains("app/admin/cases/resident-intake/page.tsx", "Checklist complete"),
  submissionsTrackSignedInOwner: fileContains("lib/cases/resident-intake-actions.ts", "getCurrentSessionUser") && fileContains("lib/cases/resident-intake.ts", "submitterUserId"),
  citizenRequestStatusHelperExists: fileContains("lib/cases/resident-intake-store.ts", "getResidentRequestStatusesForUser"),
  profileUpdatesShowRequestStatuses: fileContains("app/profile/updates/page.tsx", "My Civic Requests") && fileContains("app/profile/updates/page.tsx", "getResidentRequestStatusesForUser"),
  adminCanMarkAnswerPublished: fileContains("app/admin/cases/resident-intake/page.tsx", "answer_published"),
  runtimeDoesNotExposeRawStory: !readText("lib/cases/resident-intake-store.ts").includes("story,"),
  runtimeCountMatchesPublishedQueue: runtimeRecords.length === answerPublishedInPrivateQueue,
};

const errors = Object.entries(checks)
  .filter(([, ok]) => !ok)
  .map(([name]) => `${name} check failed`);

const audit = {
  generatedAt: new Date().toISOString(),
  totals: {
    answerPublishedInPrivateQueue,
    publicAnswerRuntimeRecords: runtimeRecords.length,
    reviewedAnswers: runtime.totals?.reviewedAnswers ?? runtimeRecords.length,
    contextualSurfaces: 3,
    adminAnswerReviewSurfaces: 1,
    citizenPrivateStatusSurfaces: 1,
  },
  privacyBoundary: {
    publicRuntimePath: "data/generated/resident-question-answers-runtime.json",
    privateQueuePath: "data/private/resident-story-intake-review-queue.json",
    rawStoryPublic: false,
    internalRoutingNotesPublic: false,
  },
  checks,
  errors,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

if (errors.length) {
  console.error("Resident question answers audit failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Resident question answers audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
