import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { DecisionReviewLedgerFile } from "@/lib/civic/decision-review-ledger";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "decision-review-workbench-audit.json");
const LEDGER_PATH = path.join(GENERATED_DIR, "decision-review-overrides.json");

type DecisionReviewQueue = {
  generatedAt?: string;
  totals?: {
    decisions?: number;
    needsReview?: number;
    withParsedVoteCount?: number;
    withFinancialImpact?: number;
    possibleNonDecision?: number;
  };
  byNextAction?: Array<{ key: string; count: number }>;
  bySourceRecoveryStatus?: Array<{ key: string; count: number }>;
  records?: Array<{
    id: string;
    sourceVotingCardId: string;
    title: string;
    jurisdiction: string;
    nextAction: string;
    sourceRecoveryStatus: string;
    priorityScore: number;
  }>;
};

type MeetingVotingCard = {
  id: string;
  review_status: string;
  updated_at?: string | null;
};

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function emptyLedger(): DecisionReviewLedgerFile {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: "Decision review ledger records human review actions without storing secrets.",
    records: [],
  };
}

function ensureLedger() {
  if (existsSync(LEDGER_PATH)) return readJson<DecisionReviewLedgerFile>("decision-review-overrides.json", emptyLedger());
  const ledger = emptyLedger();
  writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`);
  return ledger;
}

function countBy<T>(items: T[], keyFor: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFor(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

const queue = readJson<DecisionReviewQueue>("decision-review-queue.json", { records: [] });
const cards = readJson<MeetingVotingCard[]>("public-meeting-voting-cards.json", []);
const ledger = ensureLedger();
const queueRecords = queue.records ?? [];
const cardById = new Map(cards.map((card) => [card.id, card]));
const reviewedCardIds = new Set(ledger.records.map((entry) => entry.cardId));
const queueItemsAlreadyReviewed = queueRecords.filter((item) => {
  const card = cardById.get(item.sourceVotingCardId);
  return card && card.review_status !== "needs_review";
});
const loggedReviewsStillInQueue = queueRecords.filter((item) => reviewedCardIds.has(item.sourceVotingCardId));
const recentReviews = ledger.records.filter((entry) => Date.now() - Date.parse(entry.reviewedAt) < 1000 * 60 * 60 * 24 * 14);
const highPriorityQueue = queueRecords.filter((item) => item.priorityScore >= 60);

const audit = {
  generatedAt: new Date().toISOString(),
  status: "ready",
  totals: {
    cards: cards.length,
    needsReviewCards: cards.filter((card) => card.review_status === "needs_review").length,
    queueItems: queueRecords.length,
    highPriorityQueueItems: highPriorityQueue.length,
    loggedReviewActions: ledger.records.length,
    recentReviewActions14d: recentReviews.length,
    queueItemsAlreadyReviewed: queueItemsAlreadyReviewed.length,
    loggedReviewsStillInQueue: loggedReviewsStillInQueue.length,
  },
  throughput: {
    byNextStatus: countBy(ledger.records, (entry) => entry.nextStatus),
    byReason: countBy(ledger.records.filter((entry) => entry.reason), (entry) => entry.reason ?? "unknown"),
    recentReviews: ledger.records.slice(0, 12),
  },
  queue: {
    byNextAction: queue.byNextAction ?? countBy(queueRecords, (entry) => entry.nextAction),
    bySourceRecoveryStatus: queue.bySourceRecoveryStatus ?? countBy(queueRecords, (entry) => entry.sourceRecoveryStatus),
    topPriorityItems: queueRecords.slice(0, 20),
  },
  findings: [
    ...(queueRecords.length ? [] : ["Decision review queue is empty or missing. Run npm run decisions:review-queue."]),
    ...(queueItemsAlreadyReviewed.length ? ["Decision review queue contains items whose voting-card status is no longer needs_review; regenerate the queue."] : []),
    ...(loggedReviewsStillInQueue.length ? ["Some logged reviews still appear in the generated queue; regenerate after review actions."] : []),
  ],
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

console.log("Decision review workbench audit complete.");
console.log(JSON.stringify(audit.totals, null, 2));

if (audit.findings.length) {
  console.error(JSON.stringify({ findings: audit.findings }, null, 2));
}

