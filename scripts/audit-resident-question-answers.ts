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
  publicAnswersRouteExists: fileContains("app/answers/page.tsx", "Reviewed civic Q&A"),
  casesLinksToAnswers: fileContains("app/cases/page.tsx", 'href="/answers"'),
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
