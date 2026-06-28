import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { parseMeetingVotingCardFinancialImpact } from "@/lib/public-meetings/financial-impact";
import { buildPlainLanguageMeetingVotingCardFields } from "@/lib/public-meetings/plain-language";
import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, normalizeWhitespace, slugify, summarizeText } from "@/lib/public-meetings/shared";
import type {
  MeetingVotingCardOutcomeStatus,
  MeetingVotingCardRecord,
  OfficialMeetingActionRecord,
  PublicBodyRecord,
  PublicMeetingItemRecord,
  PublicMeetingRecord,
} from "@/lib/public-meetings/types";

type BuildContext = {
  meetings: PublicMeetingRecord[];
  bodies: PublicBodyRecord[];
  items: PublicMeetingItemRecord[];
  officialActions: OfficialMeetingActionRecord[];
  actionResults?: PublicMeetingActionResultRecord[];
};

type PublicMeetingActionResultRecord = {
  meetingItemId: string;
  outcome: string | null;
  voteCount: { yes: number; no: number; abstain: number | null } | null;
  unanimous: boolean;
  sourceSnippet: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  confidence: number;
  needsReview: boolean;
};

export type MeetingVotingCardFilters = {
  jurisdiction?: string;
  body?: string;
  policyArea?: string;
  meetingStatus?: "upcoming" | "completed";
  outcome?: "approved" | "pending" | "all";
  review?: "approved" | "needs_review" | "all";
  financial?: "with_financial" | "tax_stated" | "tax_unknown" | "tax_unlikely" | "tax_needs_review" | "all";
};

async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const filePath = absolutePublicMeetingPath(relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function hasPublicPolicySignal(item: PublicMeetingItemRecord) {
  if (item.item_type === "public_comment" || item.item_type === "closed_session" || item.item_type === "presentation") return false;
  if (item.item_type === "consent" && !item.vote_outcome && !item.financial_impact && !item.fiscal_impact_summary) return false;
  const text = `${item.title} ${item.source_text}`;
  if (/\b(?:skip to main content|session information\s+\(2011-current\)|interim committee exhibits are available|toggle navigation interim committees|committee list members\/staff|apply to serve on a legislatively appointed committee|nevada award and honor board selection committee|apply to serve on a legislative committee)\b/i.test(text)) {
    return false;
  }
  if (/\b(?:search\s+-\s+primegov\s+portal|toggle navigation primegov|advanced search boards and commissions|sign in \{placeholderfrom\} search)\b/i.test(text)) {
    return false;
  }
  if (/<\/(?:description|guid|title)>|<gran:|ispermalink=|&amp;clip_id=/i.test(text)) {
    return false;
  }
  if (/\b(?:fiscal brief all standing committees|bill and resolution information|journals and histories|bills that became law|bills vetoed by the governor|budgets by number|budgets by title|budgets by department|senate joint resolutions all previous session bills)\b/i.test(text)) {
    return false;
  }
  if (/\b(?:other plans or special requirements compliance trails|las vegas redevelopment plan area\s+n\/a|interlocal agreement\s+n\/a|project of significant impact|staff report page (?:five|eight|nine|ten)|master plan area: .+ overlay district.+ compliance)\b/i.test(text)) {
    return false;
  }
  if (/^\s*(?:\d+\s+)?(?:\d{1,3}\s+of\s+\d+\s+--\s+)?(?:master plan area|feet\)\s+y|of\s+\d+\s+--)/i.test(text)) {
    return false;
  }
  if (/\b(?:as of june 30|for the year ended june 30|current assets cash and cash equivalents|current liabilities accounts payable|reconciliation of operating loss|functional classification of expenses|sensitivity of .* liability|actuarial assumptions|net opeb liability|net pension liability|target asset allocation|long-term geometric expected real rate|direct borrowing - finance purchase obligations)\b/i.test(text)) {
    return false;
  }
  if (/\b(?:per occurrence per named insured|licensed vehicles, unlicensed vehicles|contractor's equipment|financial size category|non-admitted|boiler & machinery|earthquake shock on licensed vehicles)\b/i.test(text)) {
    return false;
  }
  const completedActionSignal = /\b(?:approved|adopted|passed|motion carried|motion passed|moved to approve|moved to adopt|voted to approve|voted to adopt)\b/i;
  if (item.vote_outcome && completedActionSignal.test(`${item.vote_outcome} ${text}`)) return true;
  if (/\bAdvisory Committee for the Office of Minority Health and Equity Advisory Committee on Housing\b/i.test(text)) {
    return false;
  }
  if (/\bmeeting materials\b/i.test(item.title) && !item.vote_outcome && !item.staff_recommendation && !item.financial_impact && !item.fiscal_impact_summary) {
    return false;
  }
  if (/\b(minutes?|agenda|roll call|pledge|adjourn|approval of agenda)\b/i.test(item.title) && !item.financial_impact && !item.fiscal_impact_summary) {
    return false;
  }
  return /\b(approve|approved|adopt|adopted|authorize|authorized|award|awarded|fund|funded|budget|contract|grant|ordinance|resolution|zoning|development|appoint|appointed|purchase|allocate|allocated|amend|amended|accept|accepted|deny|denied|continue|continued|table|tabled|motion carried|motion passed)\b/i.test(text);
}

function outcomeStatus(item: PublicMeetingItemRecord, meeting: PublicMeetingRecord): MeetingVotingCardOutcomeStatus {
  const text = normalizeWhitespace(`${item.vote_outcome ?? ""} ${item.source_text}`);
  if (/\b(denied|failed|not approved|motion failed)\b/i.test(text)) return "denied";
  if (/\b(continued|tabled|no action taken)\b/i.test(text)) return "continued";
  if (/\b(approved|adopted|passed|motion carried|motion passed)\b/i.test(text)) return "approved";
  const meetingTime = meeting.meeting_date ? Date.parse(meeting.meeting_date) : Number.NaN;
  if (Number.isFinite(meetingTime) && meetingTime > Date.now()) return "proposed";
  if (item.staff_recommendation) return "pending";
  return "unknown";
}

function outcomeStatusFromText(text: string, meeting: PublicMeetingRecord): MeetingVotingCardOutcomeStatus {
  const normalized = normalizeWhitespace(text);
  if (/\b(denied|failed|not approved|motion failed|rejected)\b/i.test(normalized)) return "denied";
  if (/\b(continued|tabled|postponed|withdrawn|no action taken)\b/i.test(normalized)) return "continued";
  if (/\b(approved|adopted|passed|accepted|authorized|awarded|motion carried|motion passed)\b/i.test(normalized)) return "approved";
  const meetingTime = meeting.meeting_date ? Date.parse(meeting.meeting_date) : Number.NaN;
  if (Number.isFinite(meetingTime) && meetingTime > Date.now()) return "proposed";
  return "unknown";
}

function meetingStatus(meeting: PublicMeetingRecord) {
  const meetingTime = meeting.meeting_date ? Date.parse(meeting.meeting_date) : Number.NaN;
  if (!Number.isFinite(meetingTime)) return "unknown" as const;
  return meetingTime > Date.now() ? "upcoming" as const : "completed" as const;
}

function actionPhrase(item: PublicMeetingItemRecord) {
  const candidate = item.staff_recommendation ?? item.vote_outcome ?? item.one_sentence_summary ?? item.title;
  return summarizeText(candidate.replace(/^recommendation\s+to\s+/i, "").replace(/^action\s+item\s+/i, ""), 150).replace(/[?.!]+$/, "");
}

function questionFor(item: PublicMeetingItemRecord, meeting: PublicMeetingRecord, body: PublicBodyRecord | null) {
  const phrase = actionPhrase(item);
  const jurisdiction = body?.jurisdiction ?? "this jurisdiction";
  const bodyName = body?.name ?? "this public body";
  const fiscalText = `${item.financial_impact ?? ""} ${item.fiscal_impact_summary ?? ""} ${item.source_text}`;
  if (/\b(\$|fund|budget|grant|contract|allocation|appropriation|expenditure|purchase|award)\b/i.test(fiscalText)) {
    return `Should ${bodyName} fund or approve ${phrase}?`;
  }
  if (meetingStatus(meeting) === "upcoming" || outcomeStatus(item, meeting) === "proposed") {
    return `Should ${bodyName} move forward with ${phrase}?`;
  }
  return `Do you support ${jurisdiction} approving ${phrase}?`;
}

function confidenceFor(item: PublicMeetingItemRecord) {
  let score = item.confidence_score;
  if (item.vote_outcome) score += 0.08;
  if (item.staff_recommendation) score += 0.05;
  if (item.fiscal_impact_summary || item.financial_impact) score += 0.04;
  if (item.source_snippet || item.source_url || item.source_local_path) score += 0.04;
  if (item.parser_status === "needs_review") score -= 0.18;
  if (item.roll_call_status === "needs_roll_call_review") score -= 0.04;
  return Math.max(0.1, Math.min(0.98, Number(score.toFixed(2))));
}

function reviewStatusFor(item: PublicMeetingItemRecord, confidence: number, effectiveOutcome: string | null, actionResult: PublicMeetingActionResultRecord | undefined): MeetingVotingCardRecord["review_status"] {
  const sourceBacked = Boolean(item.source_snippet || item.source_url || item.source_local_path);
  const actionText = normalizeWhitespace(`${item.title} ${item.source_text}`);
  const sourceBackedCompletedAction =
    sourceBacked &&
    confidence >= 0.6 &&
    Boolean(effectiveOutcome) &&
    /\b(?:approved|adopted|passed|accepted|authorized|awarded|continued|denied|rejected|withdrawn|motion carried|motion passed|moved to approve|moved to adopt|voted to approve|voted to adopt)\b/i.test(`${effectiveOutcome} ${actionText}`);
  const sourceBackedAgendaAction =
    sourceBacked &&
    confidence >= 0.72 &&
    /\b(?:action item|recommendation|public hearing|ordinance|resolution|approve|adopt|authorize|award|appoint|accept|deny|continue|table)\b/i.test(actionText);

  if (actionResult?.outcome && actionResult.confidence >= 0.72 && sourceBacked) return actionResult.needsReview ? "ready" : "approved";
  if (item.parser_status === "needs_review" && !sourceBackedAgendaAction && !sourceBackedCompletedAction) return "needs_review";
  if (confidence < 0.72 && !sourceBackedCompletedAction) return "needs_review";
  if (!effectiveOutcome && !item.staff_recommendation && !item.financial_impact && !item.fiscal_impact_summary) {
    return sourceBackedAgendaAction ? "ready" : "needs_review";
  }
  return confidence >= 0.8 && sourceBacked ? "approved" : "ready";
}

function stableId(prefix: string, value: string) {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 10);
  return `${prefix}-${slugify(value)}-${hash}`;
}

function presentText(value: string | null | undefined): value is string {
  return Boolean(value);
}

export function buildMeetingVotingCards(context: BuildContext): MeetingVotingCardRecord[] {
  const meetingById = new Map(context.meetings.map((meeting) => [meeting.id, meeting]));
  const bodyById = new Map(context.bodies.map((body) => [body.id, body]));
  const actionsByItemId = new Map<string, OfficialMeetingActionRecord[]>();
  for (const action of context.officialActions) {
    actionsByItemId.set(action.topic_item_id, [...(actionsByItemId.get(action.topic_item_id) ?? []), action]);
  }
  const actionResultByItemId = new Map<string, PublicMeetingActionResultRecord>();
  for (const actionResult of context.actionResults ?? []) {
    const current = actionResultByItemId.get(actionResult.meetingItemId);
    if (!current || actionResult.confidence > current.confidence) actionResultByItemId.set(actionResult.meetingItemId, actionResult);
  }

  return context.items.flatMap((item): MeetingVotingCardRecord[] => {
    const meeting = meetingById.get(item.meeting_id);
    if (!meeting || !hasPublicPolicySignal(item)) return [];
    const body = bodyById.get(meeting.public_body_id) ?? null;
    const actionResult = actionResultByItemId.get(item.id);
    const effectiveOutcome = item.vote_outcome ?? actionResult?.outcome ?? null;
    const confidence = Math.min(0.98, Number((confidenceFor(item) + (actionResult?.outcome ? 0.08 : 0)).toFixed(2)));
    const now = new Date().toISOString();
    const financialImpact = item.fiscal_impact_summary ?? item.financial_impact;
    const plainFields = buildPlainLanguageMeetingVotingCardFields(item, body);
    const financialImpactContext = parseMeetingVotingCardFinancialImpact({
      financialImpact: item.financial_impact,
      fiscalImpactSummary: item.fiscal_impact_summary,
      sourceText: item.source_text,
      sourceSnippet: item.source_snippet,
    });
    const approvedActions = (actionsByItemId.get(item.id) ?? [])
      .filter((action) => action.review_status === "approved" && action.official_id && !action.needs_review)
      .slice(0, 8)
      .map((action) => ({
        id: action.id,
        official_id: action.official_id,
        official_name_raw: action.official_name_raw,
        action_type: action.action_type,
        action_text: action.action_text,
        review_status: action.review_status,
      }));
    const card: MeetingVotingCardRecord = {
      id: stableId("meeting-voting-card", item.id),
      generation_key: `meeting-voting-card:${item.id}`,
      meeting_id: meeting.id,
      topic_item_id: item.id,
      jurisdiction: body?.jurisdiction ?? "Jurisdiction pending",
      body_name: body?.name ?? "Public body pending",
      civic_layer: plainFields.civic_layer,
      civic_layer_label: plainFields.civic_layer_label,
      jurisdiction_display_name: plainFields.jurisdiction_display_name,
      governing_body_display_name: plainFields.governing_body_display_name,
      meeting_date: meeting.meeting_date,
      meeting_status: meetingStatus(meeting),
      policy_area: item.policy_area,
      title: plainFields.public_title,
      question_text: plainFields.public_question || questionFor(item, meeting, body),
      public_title: plainFields.public_title,
      public_question: plainFields.public_question,
      source_title: plainFields.source_title,
      source_item_number: plainFields.source_item_number,
      plain_action: plainFields.plain_action,
      plain_purpose: plainFields.plain_purpose,
      citizen_summary: plainFields.citizen_summary,
      agenda_language_original: plainFields.agenda_language_original,
      plain_language_summary: plainFields.citizen_summary || item.plain_english_explanation || item.one_sentence_summary,
      source_event_href: `/events/${meeting.id}`,
      source_topic_href: `/events/${meeting.id}#${item.id}`,
      source_url: item.source_url ?? meeting.source_urls[0] ?? null,
      source_snippets: [actionResult?.sourceSnippet, item.source_snippet ?? summarizeText(item.source_text, 900)].filter(presentText).slice(0, 2),
      financial_impact: financialImpact,
      financial_impact_context: financialImpactContext,
      affected_groups: item.affected_groups,
      outcome_status: effectiveOutcome ? outcomeStatusFromText(effectiveOutcome, meeting) : outcomeStatus(item, meeting),
      outcome_text: effectiveOutcome,
      review_status: reviewStatusFor(item, confidence, effectiveOutcome, actionResult),
      confidence_score: confidence,
      related_official_actions: approvedActions,
      needs_roll_call_review: item.roll_call_status === "needs_roll_call_review",
      created_at: now,
      updated_at: now,
    };
    return [card];
  });
}

function matchesFilters(card: MeetingVotingCardRecord, filters: MeetingVotingCardFilters) {
  if (filters.jurisdiction && card.jurisdiction !== filters.jurisdiction) return false;
  if (filters.body && card.body_name !== filters.body) return false;
  if (filters.policyArea && card.policy_area !== filters.policyArea) return false;
  if (filters.meetingStatus && card.meeting_status !== filters.meetingStatus) return false;
  if (filters.outcome === "approved" && card.outcome_status !== "approved") return false;
  if (filters.outcome === "pending" && !["proposed", "pending", "unknown"].includes(card.outcome_status)) return false;
  if (filters.review === "approved" && card.review_status !== "approved") return false;
  if (filters.review === "needs_review" && card.review_status === "approved") return false;
  if (filters.financial === "with_financial" && !card.financial_impact_context) return false;
  if (filters.financial === "tax_stated" && card.financial_impact_context?.direct_tax_impact !== "stated") return false;
  if (filters.financial === "tax_unknown" && card.financial_impact_context?.direct_tax_impact !== "unknown") return false;
  if (filters.financial === "tax_unlikely" && card.financial_impact_context?.direct_tax_impact !== "unlikely") return false;
  if (filters.financial === "tax_needs_review" && card.financial_impact_context?.direct_tax_impact !== "needs_review") return false;
  return true;
}

export async function getMeetingVotingCards(filters: MeetingVotingCardFilters = {}) {
  const cards = await readJsonFile<MeetingVotingCardRecord[]>(PUBLIC_MEETING_PATHS.meetingVotingCards, []);
  const filtered = cards.filter((card) => matchesFilters(card, filters));
  return {
    cards: filtered.sort((left, right) => (Date.parse(right.meeting_date ?? "") || 0) - (Date.parse(left.meeting_date ?? "") || 0)),
    allCards: cards,
    jurisdictions: [...new Set(cards.map((card) => card.jurisdiction))].sort(),
    bodies: [...new Set(cards.map((card) => card.body_name))].sort(),
    policyAreas: [...new Set(cards.map((card) => card.policy_area))].sort(),
  };
}

export function getPublicMeetingVotingCards(cards: MeetingVotingCardRecord[]) {
  return cards.filter((card) => card.review_status === "approved" && card.confidence_score >= 0.8);
}
