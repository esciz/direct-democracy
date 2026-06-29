import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import {
  buildResidentQuestionAnswerSummary,
  buildResidentStoryPublicSummary,
  normalizeResidentStoryIntake,
  type ResidentQuestionAnswerSummary,
  type ResidentStoryIntake,
  type ResidentStoryPublicSummary,
  type ResidentStoryReviewStatus,
} from "@/lib/cases/resident-intake";

const PRIVATE_QUEUE_PATH = path.join(process.cwd(), "data/private/resident-story-intake-review-queue.json");
const PUBLIC_RUNTIME_PATH = path.join(process.cwd(), "data/generated/resident-civic-intake-runtime.json");
const PUBLIC_ANSWERS_RUNTIME_PATH = path.join(process.cwd(), "data/generated/resident-question-answers-runtime.json");

export type ResidentStoryReviewQueueFile = {
  schemaVersion: 1;
  generatedAt: string;
  policy: "resident_submissions_private_pending_review";
  records: ResidentStoryIntake[];
};

export type ResidentStoryPublicRuntimeFile = {
  schemaVersion: 1;
  generatedAt: string;
  policy: "Only reviewed redacted resident story summaries are public. Raw submissions remain private.";
  records: ResidentStoryPublicSummary[];
  totals: {
    reviewedPublicSummaries: number;
    anonymousSummaries: number;
  };
};

export type ResidentQuestionAnswersRuntimeFile = {
  schemaVersion: 1;
  generatedAt: string;
  policy: "Only reviewed answer summaries are public. Raw resident submissions and routing notes remain private.";
  records: ResidentQuestionAnswerSummary[];
  totals: {
    reviewedAnswers: number;
    answersWithSourceUrl: number;
  };
};

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`[resident-intake] Unable to read ${filePath}`, error);
    }
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function emptyQueue(): ResidentStoryReviewQueueFile {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: "resident_submissions_private_pending_review",
    records: [],
  };
}

function sortRecords(records: ResidentStoryIntake[]) {
  return [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getResidentStoryReviewQueue() {
  const queue = await readJsonFile<ResidentStoryReviewQueueFile>(PRIVATE_QUEUE_PATH, emptyQueue());
  return {
    ...queue,
    records: sortRecords(Array.isArray(queue.records) ? queue.records.map(normalizeResidentStoryIntake) : []),
  };
}

export async function saveResidentStoryReviewQueue(records: ResidentStoryIntake[]) {
  await writeJsonFile(PRIVATE_QUEUE_PATH, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: "resident_submissions_private_pending_review",
    records: sortRecords(records),
  } satisfies ResidentStoryReviewQueueFile);
}

export async function appendResidentStoryIntake(intake: ResidentStoryIntake) {
  const queue = await getResidentStoryReviewQueue();
  await saveResidentStoryReviewQueue([intake, ...queue.records.filter((record) => record.id !== intake.id)]);
  await regenerateResidentStoryPublicRuntime();
}

function shouldPublish(record: ResidentStoryIntake) {
  return record.review.publicSummary && (record.review.status === "approved_public_summary" || record.review.status === "approved_anonymous_summary");
}

export async function regenerateResidentStoryPublicRuntime() {
  const queue = await getResidentStoryReviewQueue();
  const records = queue.records.filter(shouldPublish).flatMap((record) => (record.review.publicSummary ? [record.review.publicSummary] : []));
  const anonymousSummaries = records.filter((record) => record.publicationStatus === "published_anonymous").length;
  const answers = queue.records.flatMap((record) => {
    const answer = buildResidentQuestionAnswerSummary(record);
    return answer ? [answer] : [];
  });
  await writeJsonFile(PUBLIC_RUNTIME_PATH, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: "Only reviewed redacted resident story summaries are public. Raw submissions remain private.",
    records,
    totals: {
      reviewedPublicSummaries: records.length,
      anonymousSummaries,
    },
  } satisfies ResidentStoryPublicRuntimeFile);
  await writeJsonFile(PUBLIC_ANSWERS_RUNTIME_PATH, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: "Only reviewed answer summaries are public. Raw resident submissions and routing notes remain private.",
    records: answers,
    totals: {
      reviewedAnswers: answers.length,
      answersWithSourceUrl: answers.filter((answer) => Boolean(answer.sourceUrl)).length,
    },
  } satisfies ResidentQuestionAnswersRuntimeFile);
}

export async function getResidentStoryPublicRuntime() {
  return readJsonFile<ResidentStoryPublicRuntimeFile>(PUBLIC_RUNTIME_PATH, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: "Only reviewed redacted resident story summaries are public. Raw submissions remain private.",
    records: [],
    totals: {
      reviewedPublicSummaries: 0,
      anonymousSummaries: 0,
    },
  });
}

export async function getResidentQuestionAnswersRuntime() {
  return readJsonFile<ResidentQuestionAnswersRuntimeFile>(PUBLIC_ANSWERS_RUNTIME_PATH, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: "Only reviewed answer summaries are public. Raw resident submissions and routing notes remain private.",
    records: [],
    totals: {
      reviewedAnswers: 0,
      answersWithSourceUrl: 0,
    },
  });
}

function normalizeMatchValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export async function getResidentQuestionAnswersForTarget(options: {
  targetType?: ResidentQuestionAnswerSummary["targetType"];
  targetId?: string | null;
  community?: string | null;
  limit?: number;
}) {
  const runtime = await getResidentQuestionAnswersRuntime();
  const targetType = options.targetType;
  const targetId = normalizeMatchValue(options.targetId);
  const community = normalizeMatchValue(options.community);
  const limit = options.limit ?? 4;
  return runtime.records
    .filter((answer) => {
      if (targetType && answer.targetType !== targetType) return false;
      if (targetId && normalizeMatchValue(answer.targetId) === targetId) return true;
      if (community && normalizeMatchValue(answer.community) === community) return true;
      return !targetId && !community;
    })
    .slice(0, limit);
}

export function buildReviewedResidentStorySummary(
  record: ResidentStoryIntake,
  options: {
    status: Extract<ResidentStoryReviewStatus, "approved_public_summary" | "approved_anonymous_summary">;
    reviewerTitle?: string;
    reviewerSummary?: string;
    reviewedAt: string;
  },
): ResidentStoryPublicSummary {
  return buildResidentStoryPublicSummary(record, options);
}
