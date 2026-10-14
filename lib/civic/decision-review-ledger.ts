import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeWhitespace } from "@/lib/public-meetings/shared";
import type { MeetingVotingCardReviewStatus } from "@/lib/public-meetings/types";

export type DecisionReviewLedgerEntry = {
  id: string;
  cardId: string;
  previousStatus: MeetingVotingCardReviewStatus | "unknown";
  nextStatus: MeetingVotingCardReviewStatus;
  reviewerId: string;
  reviewedAt: string;
  note: string | null;
  reason: string | null;
  source: "admin_voting_card_review";
};

export type DecisionReviewLedgerFile = {
  schemaVersion: 1;
  generatedAt: string;
  policy: "Decision review ledger records human review actions without storing secrets.";
  records: DecisionReviewLedgerEntry[];
};

export const DECISION_REVIEW_LEDGER_PATH = path.join(process.cwd(), "data", "generated", "decision-review-overrides.json");

function emptyLedger(): DecisionReviewLedgerFile {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    policy: "Decision review ledger records human review actions without storing secrets.",
    records: [],
  };
}

export async function readDecisionReviewLedger(): Promise<DecisionReviewLedgerFile> {
  if (!existsSync(DECISION_REVIEW_LEDGER_PATH)) return emptyLedger();
  try {
    const parsed = JSON.parse(await readFile(DECISION_REVIEW_LEDGER_PATH, "utf8")) as DecisionReviewLedgerFile;
    return {
      ...emptyLedger(),
      ...parsed,
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch (error) {
    console.warn("[decision-review] Unable to read review ledger", error);
    return emptyLedger();
  }
}

export async function writeDecisionReviewLedger(records: DecisionReviewLedgerEntry[]) {
  await mkdir(path.dirname(DECISION_REVIEW_LEDGER_PATH), { recursive: true });
  await writeFile(
    DECISION_REVIEW_LEDGER_PATH,
    `${JSON.stringify(
      {
        ...emptyLedger(),
        generatedAt: new Date().toISOString(),
        records,
      } satisfies DecisionReviewLedgerFile,
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export async function appendDecisionReviewEntry(entry: Omit<DecisionReviewLedgerEntry, "id" | "note" | "reason" | "reviewedAt" | "source"> & {
  note?: string | null;
  reason?: string | null;
  reviewedAt?: string;
}) {
  const reviewedAt = entry.reviewedAt ?? new Date().toISOString();
  const note = normalizeWhitespace(entry.note) || null;
  const reason = normalizeWhitespace(entry.reason) || null;
  const ledger = await readDecisionReviewLedger();
  const id = `decision-review-${entry.cardId}-${reviewedAt}`.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 180);
  await writeDecisionReviewLedger([
    {
      id,
      cardId: entry.cardId,
      previousStatus: entry.previousStatus,
      nextStatus: entry.nextStatus,
      reviewerId: entry.reviewerId,
      reviewedAt,
      note,
      reason,
      source: "admin_voting_card_review",
    },
    ...ledger.records,
  ]);
}

