import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import {
  buildResidentQuestionAnswerSummary,
  buildResidentStoryPublicSummary,
  normalizeResidentStoryIntake,
  publicTitleForResidentQuestionAnswer,
  residentQuestionPublicStatusLabel,
  residentQuestionRoutingStatusLabel,
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

export type ResidentRequestStatusSummary = {
  id: string;
  title: string;
  submittedAt: string;
  location: string | null;
  targetType: ResidentStoryIntake["routing"]["targetType"];
  targetId: string | null;
  community: string | null;
  routingStatus: ResidentStoryIntake["routing"]["status"];
  routingStatusLabel: string;
  publicStatus: ResidentStoryIntake["routing"]["publicStatus"];
  publicStatusLabel: string;
  reviewStatus: ResidentStoryIntake["review"]["status"];
  privacyStatus: "private_pending_review" | "private_reviewed" | "public_answer_available" | "closed_or_rejected";
  nextStep: string;
  publicAnswerHref: string | null;
  sourceUrl: string | null;
  sourceLabel: string;
  hasSensitiveFlags: boolean;
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

function privacyStatusFor(record: ResidentStoryIntake): ResidentRequestStatusSummary["privacyStatus"] {
  if (record.routing.publicStatus === "answer_published") return "public_answer_available";
  if (record.review.status === "rejected" || record.routing.status === "closed") return "closed_or_rejected";
  if (record.review.status === "reviewed_private") return "private_reviewed";
  return "private_pending_review";
}

function nextStepFor(record: ResidentStoryIntake) {
  if (record.routing.publicStatus === "answer_published") return "A reviewed answer is available publicly without exposing your raw submission.";
  if (record.routing.status === "needs_source") return "Reviewers need a source, official record, or clearer routing target before this can move forward.";
  if (record.routing.status === "ready_to_send") return "A reviewer has identified a likely recipient/body. It has not been sent or published automatically.";
  if (record.routing.status === "sent_externally") return "The question has been marked as sent externally and is waiting for a reviewed answer.";
  if (record.routing.status === "answered") return "A reviewed answer exists internally. It must be marked published before it appears publicly.";
  if (record.routing.status === "closed") return "This request is closed. Raw submission details remain private.";
  if (record.review.status === "rejected") return "This request was rejected during moderation review.";
  return "A reviewer still needs to classify the request, confirm the right body, and decide whether source review is needed.";
}

export function summarizeResidentRequestStatus(record: ResidentStoryIntake): ResidentRequestStatusSummary {
  const publishedAnswer = buildResidentQuestionAnswerSummary(record);
  const hasSensitiveFlags = record.safety.containsPersonalData || record.safety.containsAllegation || record.safety.involvesMinor || record.safety.involvesLegalMatter;
  return {
    id: record.id,
    title: publicTitleForResidentQuestionAnswer(record),
    submittedAt: record.createdAt,
    location: record.location,
    targetType: record.routing.targetType,
    targetId: record.routing.targetId,
    community: record.routing.community ?? record.location,
    routingStatus: record.routing.status,
    routingStatusLabel: residentQuestionRoutingStatusLabel(record.routing.status),
    publicStatus: record.routing.publicStatus,
    publicStatusLabel: residentQuestionPublicStatusLabel(record.routing.publicStatus),
    reviewStatus: record.review.status,
    privacyStatus: privacyStatusFor(record),
    nextStep: nextStepFor(record),
    publicAnswerHref: publishedAnswer ? `/answers#${publishedAnswer.id}` : null,
    sourceUrl: record.routing.suggestedRecipientSourceUrl,
    sourceLabel: record.routing.suggestedRecipientSourceUrl ? "Reviewed source/contact linked" : "No public source linked yet",
    hasSensitiveFlags,
  };
}

export async function getResidentRequestStatusesForUser(userId: string | null | undefined, limit = 6) {
  if (!userId) return [];
  const queue = await getResidentStoryReviewQueue();
  return queue.records
    .filter((record) => record.submitterUserId === userId)
    .slice(0, limit)
    .map(summarizeResidentRequestStatus);
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
