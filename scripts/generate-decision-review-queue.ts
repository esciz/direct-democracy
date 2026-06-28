import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "decision-review-queue.json");

type GeneratedVotingCard = {
  id: string;
  sourceVotingCardId: string;
  agendaItemId: string;
  meetingId: string;
  title: string;
  summary: string;
  jurisdiction: string;
  meeting: { date: string | null; bodyName: string };
  voteOutcome: string;
  voteCount: { totalKnown: number; display: string };
  financialImpact: { estimatedAmount: number | null; description: string | null; raw: string | null };
  sourceReferences: unknown[];
  confidence: number;
  reviewStatus: string;
};

type Artifact<T> = { records?: T[] };
type DocumentTextRecord = {
  meetingId: string;
  documentType: string;
  extractionMethod: string;
  textLength: number;
  sourceSnippet: string | null;
};
type ActionResultRecord = {
  meetingItemId: string;
  outcome: string | null;
  voteCount: unknown;
  sourceSnippet: string;
  confidence: number;
};

function records<T>(fileName: string): T[] {
  const value = JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T[] | Artifact<T>;
  return Array.isArray(value) ? value : value.records ?? [];
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function reviewReasons(card: GeneratedVotingCard) {
  const reasons = new Set<string>();
  const text = normalize(`${card.title} ${card.summary}`);
  if (card.confidence < 0.5) reasons.add("low_confidence_source_parse");
  if (card.voteOutcome === "unknown") reasons.add("missing_outcome");
  if (["proposed", "pending"].includes(card.voteOutcome)) reasons.add("future_or_pending_action");
  if (card.voteCount.totalKnown === 0) reasons.add("no_named_or_parsed_vote_count");
  if (/source review needed|needs review/.test(text)) reasons.add("plain_language_summary_needs_review");
  if (/apply to serve|selection committee|meeting materials/.test(text)) reasons.add("possible_non_decision_or_directory_content");
  if (card.sourceReferences.length === 0) reasons.add("missing_source_reference");
  if (card.financialImpact.estimatedAmount || card.financialImpact.description || card.financialImpact.raw) reasons.add("financial_impact_requires_review");
  if (card.voteCount.totalKnown > 0) reasons.add("named_vote_card_ready_for_review");
  return [...reasons];
}

function sourceRecoveryFor(card: GeneratedVotingCard, documentTextByMeeting: Map<string, DocumentTextRecord[]>, actionResultByItem: Map<string, ActionResultRecord>) {
  if (card.voteOutcome !== "unknown") {
    return { status: "outcome_present", reason: "This decision already has a parsed outcome." };
  }
  const actionResult = actionResultByItem.get(card.agendaItemId);
  if (actionResult?.outcome || actionResult?.voteCount) {
    return { status: "action_result_available", reason: "A generated action-result record exists for this agenda item." };
  }
  const meetingTime = Date.parse(card.meeting.date ?? "");
  if (Number.isFinite(meetingTime) && meetingTime > Date.now()) {
    return { status: "meeting_pending", reason: "The meeting has not happened yet." };
  }
  const documents = documentTextByMeeting.get(card.meetingId) ?? [];
  const usableDocuments = documents.filter((document) => document.extractionMethod !== "failed" && document.textLength >= 300);
  const resultLikeDocuments = usableDocuments.filter(
    (document) =>
      /minutes|result|transcript|unknown/i.test(document.documentType) &&
      /\b(?:motion|second|vote|approved|adopted|passed|denied|continued|unanimous|ayes?|nays?)\b/i.test(document.sourceSnippet ?? ""),
  );
  if (resultLikeDocuments.length) {
    return { status: "source_text_available_for_recovery", reason: "Result-like meeting text exists and should be parsed for this item." };
  }
  if (usableDocuments.length) {
    return { status: "agenda_only_no_result_source", reason: "Only agenda or packet text is available; no source-backed action result was found yet." };
  }
  return { status: "awaiting_minutes_or_result_source", reason: "No usable minutes, results, or transcript source is available yet." };
}

function nextAction(reasons: string[], sourceRecoveryStatus: string) {
  if (reasons.includes("named_vote_card_ready_for_review")) return "review_named_vote_card_for_public_approval";
  if (reasons.includes("possible_non_decision_or_directory_content")) return "reject_or_reclassify_non_decision";
  if (reasons.includes("financial_impact_requires_review")) return "review_tax_cost_language";
  if (reasons.includes("missing_outcome")) {
    return sourceRecoveryStatus === "source_text_available_for_recovery" || sourceRecoveryStatus === "action_result_available"
      ? "recover_minutes_or_action_result"
      : "await_minutes_or_result_source";
  }
  if (reasons.includes("plain_language_summary_needs_review")) return "rewrite_citizen_summary_from_source";
  if (reasons.includes("future_or_pending_action")) return "keep_as_source_backed_preview_until_meeting_result";
  return "manual_source_review";
}

function priorityScore(card: GeneratedVotingCard, reasons: string[]) {
  let score = 0;
  if (card.voteCount.totalKnown > 0) score += 80;
  if (card.financialImpact.estimatedAmount || card.financialImpact.description || card.financialImpact.raw) score += 30;
  if (["approved", "denied", "continued"].includes(card.voteOutcome)) score += 25;
  if (["Las Vegas, NV", "Clark County, NV", "North Las Vegas, NV", "Henderson, NV", "Reno, NV", "Washoe County, NV", "Elko, NV", "Elko County, NV", "Nevada"].includes(card.jurisdiction)) score += 15;
  if (card.confidence >= 0.7) score += 12;
  if (reasons.includes("possible_non_decision_or_directory_content")) score -= 20;
  const dateMs = Date.parse(card.meeting.date ?? "");
  if (Number.isFinite(dateMs)) score += Math.max(0, 10 - Math.floor((Date.now() - dateMs) / (1000 * 60 * 60 * 24 * 60)));
  return score;
}

const cards = records<GeneratedVotingCard>("voting-cards.json");
const documentTextByMeeting = records<DocumentTextRecord>("public-meeting-document-text.json").reduce((map, record) => {
  map.set(record.meetingId, [...(map.get(record.meetingId) ?? []), record]);
  return map;
}, new Map<string, DocumentTextRecord[]>());
const actionResultByItem = new Map(records<ActionResultRecord>("public-meeting-action-results.json").map((record) => [record.meetingItemId, record]));
const reviewCards = cards.filter((card) => card.reviewStatus === "needs_review");

const queue = reviewCards
  .map((card) => {
    const reasons = reviewReasons(card);
    const sourceRecovery = sourceRecoveryFor(card, documentTextByMeeting, actionResultByItem);
    const action = nextAction(reasons, sourceRecovery.status);
    return {
      id: card.id,
      sourceVotingCardId: card.sourceVotingCardId,
      agendaItemId: card.agendaItemId,
      title: card.title,
      jurisdiction: card.jurisdiction,
      bodyName: card.meeting.bodyName,
      meetingDate: card.meeting.date,
      voteOutcome: card.voteOutcome,
      voteCount: card.voteCount.display,
      confidence: card.confidence,
      hasFinancialImpact: Boolean(card.financialImpact.estimatedAmount || card.financialImpact.description || card.financialImpact.raw),
      sourceCount: card.sourceReferences.length,
      reasons,
      sourceRecoveryStatus: sourceRecovery.status,
      sourceRecoveryReason: sourceRecovery.reason,
      nextAction: action,
      priorityScore: priorityScore(card, reasons),
      adminHref: `/admin/voting-cards?review=needs_review&jurisdiction=${encodeURIComponent(card.jurisdiction)}&nextAction=${encodeURIComponent(action)}#${encodeURIComponent(card.sourceVotingCardId)}`,
      publicHref: `/decisions/${card.id}`,
    };
  })
  .sort((left, right) => right.priorityScore - left.priorityScore || (Date.parse(right.meetingDate ?? "") || 0) - (Date.parse(left.meetingDate ?? "") || 0));

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    decisions: cards.length,
    needsReview: queue.length,
    withParsedVoteCount: queue.filter((card) => card.voteCount !== "Vote count not parsed").length,
    withFinancialImpact: queue.filter((card) => card.hasFinancialImpact).length,
    possibleNonDecision: queue.filter((card) => card.reasons.includes("possible_non_decision_or_directory_content")).length,
  },
  byJurisdiction: countBy(queue, (card) => card.jurisdiction),
  byNextAction: countBy(queue, (card) => card.nextAction),
  bySourceRecoveryStatus: countBy(queue, (card) => card.sourceRecoveryStatus),
  byReason: countBy(queue.flatMap((card) => card.reasons), (reason) => reason),
  records: queue,
  priorityQueue: queue.slice(0, 100),
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Generated decision review queue at ${OUTPUT_PATH}`);
console.log(JSON.stringify(report.totals, null, 2));
