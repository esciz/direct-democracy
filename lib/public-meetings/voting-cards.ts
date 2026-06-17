import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { parseMeetingVotingCardFinancialImpact } from "@/lib/public-meetings/financial-impact";
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
};

export type MeetingVotingCardFilters = {
  jurisdiction?: string;
  body?: string;
  policyArea?: string;
  meetingStatus?: "upcoming" | "completed";
  outcome?: "approved" | "pending" | "all";
  review?: "approved" | "needs_review" | "all";
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
  if (/\b(minutes?|agenda|roll call|pledge|adjourn|approval of agenda)\b/i.test(item.title) && !item.financial_impact && !item.fiscal_impact_summary) {
    return false;
  }
  return /\b(approve|adopt|authorize|award|fund|budget|contract|grant|ordinance|resolution|zoning|development|appoint|purchase|allocate|amend|accept|deny|continue|table)\b/i.test(text);
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

function reviewStatusFor(item: PublicMeetingItemRecord, confidence: number): MeetingVotingCardRecord["review_status"] {
  if (item.parser_status === "needs_review" || confidence < 0.72) return "needs_review";
  if (!item.vote_outcome && !item.staff_recommendation && !item.financial_impact && !item.fiscal_impact_summary) return "needs_review";
  return confidence >= 0.8 && Boolean(item.source_snippet || item.source_url || item.source_local_path) ? "approved" : "ready";
}

export function buildMeetingVotingCards(context: BuildContext): MeetingVotingCardRecord[] {
  const meetingById = new Map(context.meetings.map((meeting) => [meeting.id, meeting]));
  const bodyById = new Map(context.bodies.map((body) => [body.id, body]));
  const actionsByItemId = new Map<string, OfficialMeetingActionRecord[]>();
  for (const action of context.officialActions) {
    actionsByItemId.set(action.topic_item_id, [...(actionsByItemId.get(action.topic_item_id) ?? []), action]);
  }

  return context.items.flatMap((item): MeetingVotingCardRecord[] => {
    const meeting = meetingById.get(item.meeting_id);
    if (!meeting || !hasPublicPolicySignal(item)) return [];
    const body = bodyById.get(meeting.public_body_id) ?? null;
    const confidence = confidenceFor(item);
    const now = new Date().toISOString();
    const financialImpact = item.fiscal_impact_summary ?? item.financial_impact;
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
      id: `meeting-voting-card-${slugify(item.id)}`,
      generation_key: `meeting-voting-card:${item.id}`,
      meeting_id: meeting.id,
      topic_item_id: item.id,
      jurisdiction: body?.jurisdiction ?? "Jurisdiction pending",
      body_name: body?.name ?? "Public body pending",
      meeting_date: meeting.meeting_date,
      meeting_status: meetingStatus(meeting),
      policy_area: item.policy_area,
      title: summarizeText(item.title, 180),
      question_text: questionFor(item, meeting, body),
      plain_language_summary: item.plain_english_explanation || item.one_sentence_summary,
      source_event_href: `/events/${meeting.id}`,
      source_topic_href: `/events/${meeting.id}#${item.id}`,
      source_url: item.source_url ?? meeting.source_urls[0] ?? null,
      source_snippets: [item.source_snippet ?? summarizeText(item.source_text, 900)].filter(Boolean).slice(0, 2),
      financial_impact: financialImpact,
      financial_impact_context: financialImpactContext,
      affected_groups: item.affected_groups,
      outcome_status: outcomeStatus(item, meeting),
      outcome_text: item.vote_outcome,
      review_status: reviewStatusFor(item, confidence),
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
