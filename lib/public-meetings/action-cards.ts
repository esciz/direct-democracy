import "server-only";

import { getPublicMeetingAdminDashboard } from "@/lib/public-meetings/public";
import type { CitizenQuestionReviewStatus, PublicMeetingItemRecord } from "@/lib/public-meetings/types";

export type MeetingActionCardReviewMode = "all" | "ready" | "needs_review";

export type MeetingActionCardFilters = {
  body?: string;
  dateFrom?: string;
  dateTo?: string;
  topic?: string;
  review?: MeetingActionCardReviewMode;
  hasFiscalImpact?: boolean;
  hasOutcome?: boolean;
  rollCallPending?: boolean;
};

export type MeetingActionCard = {
  id: string;
  jurisdiction: string;
  bodyName: string;
  meetingDate: string | null;
  meetingTitle: string;
  itemNumber: string | null;
  title: string;
  plainEnglishSummary: string;
  explanation: string;
  recommendedAction: string | null;
  finalOutcome: string | null;
  fiscalImpact: string | null;
  departments: string[];
  affectedGroups: string[];
  sourceSnippet: string;
  sourceUrl: string | null;
  sourceLocalPath: string | null;
  policyArea: string;
  itemType: string;
  confidenceScore: number;
  reviewStatuses: CitizenQuestionReviewStatus[];
  badges: string[];
  isReady: boolean;
  priority: number;
  priorityReason: string;
  namedRollCallPending: boolean;
  lowConfidencePdfParse: boolean;
};

function hasFiscalLanguage(item: PublicMeetingItemRecord) {
  return /\b(\$|budget|fiscal|contract|grant|allocation|appropriation|expenditure|not to exceed|purchase|award)\b/i.test(item.source_text);
}

function hasOutcomeLanguage(item: PublicMeetingItemRecord) {
  return /\b(approved|adopted|passed|failed|denied|continued|tabled|motion|vote|ayes?|nays?)\b/i.test(item.source_text);
}

function isLowConfidencePdf(item: PublicMeetingItemRecord) {
  return Boolean(item.source_local_path?.toLowerCase().endsWith(".pdf") && item.confidence_score < 0.65);
}

function reviewStatusesFor(item: PublicMeetingItemRecord): CitizenQuestionReviewStatus[] {
  const statuses = new Set<CitizenQuestionReviewStatus>();
  if (item.confidence_score < 0.65 || item.parser_status === "needs_review") statuses.add("needs_context");
  if (hasFiscalLanguage(item) && !item.fiscal_impact_summary) statuses.add("needs_financial_review");
  if (item.fiscal_impact_summary && item.confidence_score < 0.75) statuses.add("needs_financial_review");
  if (hasOutcomeLanguage(item) && !item.vote_outcome) statuses.add("needs_vote_outcome");
  return [...statuses];
}

function priorityFor(item: PublicMeetingItemRecord, reviewStatuses: CitizenQuestionReviewStatus[]) {
  if (item.roll_call_status === "needs_roll_call_review" && hasOutcomeLanguage(item)) {
    return { priority: 1, reason: "Vote/action language with named roll call pending review" };
  }
  if (hasFiscalLanguage(item) && reviewStatuses.includes("needs_financial_review")) {
    return { priority: 2, reason: "Fiscal impact language needs financial review" };
  }
  if (hasOutcomeLanguage(item) && reviewStatuses.includes("needs_vote_outcome")) {
    return { priority: 3, reason: "Outcome language needs final action review" };
  }
  if (isLowConfidencePdf(item)) {
    return { priority: 4, reason: "Low-confidence PDF packet chunk" };
  }
  if (reviewStatuses.length) return { priority: 5, reason: "Needs context review" };
  return { priority: 9, reason: "Ready for public review" };
}

function badgesFor(item: PublicMeetingItemRecord, reviewStatuses: CitizenQuestionReviewStatus[]) {
  const badges = new Set<string>();
  if (item.source_method || item.source_url || item.source_local_path) badges.add("Source-backed");
  if (reviewStatuses.includes("needs_context")) badges.add("Needs context");
  if (reviewStatuses.includes("needs_financial_review")) badges.add("Needs financial review");
  if (reviewStatuses.includes("needs_vote_outcome")) badges.add("Needs vote outcome");
  if (item.roll_call_status === "needs_roll_call_review") badges.add("Roll call pending");
  if (isLowConfidencePdf(item)) badges.add("Low-confidence PDF parse");
  return [...badges];
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesFilters(card: MeetingActionCard, filters: MeetingActionCardFilters) {
  if (filters.body && card.bodyName !== filters.body) return false;
  const meetingTime = card.meetingDate ? Date.parse(card.meetingDate) : null;
  const from = parseDate(filters.dateFrom);
  const to = parseDate(filters.dateTo);
  if (from && (!meetingTime || meetingTime < from)) return false;
  if (to && (!meetingTime || meetingTime > to + 86_399_999)) return false;
  if (filters.topic && card.policyArea !== filters.topic) return false;
  if (filters.review === "ready" && !card.isReady) return false;
  if (filters.review === "needs_review" && card.isReady) return false;
  if (filters.hasFiscalImpact && !card.fiscalImpact) return false;
  if (filters.hasOutcome && !card.finalOutcome) return false;
  if (filters.rollCallPending && !card.namedRollCallPending) return false;
  return true;
}

export async function getMeetingActionCards(filters: MeetingActionCardFilters = {}) {
  const dashboard = await getPublicMeetingAdminDashboard();
  const meetingsById = new Map(dashboard.meetings.map((meeting) => [meeting.id, meeting]));
  const bodiesById = new Map(dashboard.publicBodies.map((body) => [body.id, body]));

  const cards = dashboard.meetingItems.map((item): MeetingActionCard | null => {
    const meeting = meetingsById.get(item.meeting_id);
    if (!meeting) return null;
    const body = bodiesById.get(meeting.public_body_id);
    const reviewStatuses = reviewStatusesFor(item);
    const priority = priorityFor(item, reviewStatuses);
    const lowConfidencePdfParse = isLowConfidencePdf(item);
    const namedRollCallPending = item.roll_call_status === "needs_roll_call_review";
    const isReady = reviewStatuses.length === 0 && !namedRollCallPending && !lowConfidencePdfParse && item.confidence_score >= 0.65;

    return {
      id: item.id,
      jurisdiction: body?.jurisdiction ?? "Jurisdiction pending",
      bodyName: body?.name ?? "Public body pending",
      meetingDate: meeting.meeting_date,
      meetingTitle: meeting.title,
      itemNumber: item.item_number,
      title: item.title,
      plainEnglishSummary: item.one_sentence_summary,
      explanation: item.plain_english_explanation,
      recommendedAction: item.staff_recommendation,
      finalOutcome: item.vote_outcome,
      fiscalImpact: item.fiscal_impact_summary ?? item.financial_impact,
      departments: item.department_names ?? [],
      affectedGroups: item.affected_groups,
      sourceSnippet: item.source_snippet ?? item.source_text.slice(0, 900),
      sourceUrl: item.source_url ?? meeting.source_urls[0] ?? null,
      sourceLocalPath: item.source_local_path ?? null,
      policyArea: item.policy_area,
      itemType: item.item_type,
      confidenceScore: item.confidence_score,
      reviewStatuses,
      badges: badgesFor(item, reviewStatuses),
      isReady,
      priority: priority.priority,
      priorityReason: priority.reason,
      namedRollCallPending,
      lowConfidencePdfParse,
    };
  }).filter((card): card is MeetingActionCard => Boolean(card));

  const filteredCards = cards.filter((card) => matchesFilters(card, filters));
  const bodies = [...new Set(cards.map((card) => card.bodyName))].sort((a, b) => a.localeCompare(b));
  const topics = [...new Set(cards.map((card) => card.policyArea))].sort((a, b) => a.localeCompare(b));

  return {
    cards: filteredCards.sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority;
      return (Date.parse(right.meetingDate ?? "") || 0) - (Date.parse(left.meetingDate ?? "") || 0);
    }),
    allCards: cards,
    bodies,
    topics,
  };
}
