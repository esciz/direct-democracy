import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, summarizeText } from "@/lib/public-meetings/shared";
import type {
  MeetingVotingCardRecord,
  OfficialMeetingActionRecord,
  PublicBodyRecord,
  PublicMeetingRecord,
} from "@/lib/public-meetings/types";

async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const filePath = absolutePublicMeetingPath(relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJsonFile(relativePath: string, value: unknown) {
  const filePath = absolutePublicMeetingPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writePublicMeetingRuntimeArtifacts(input?: {
  bodies?: PublicBodyRecord[];
  meetings?: PublicMeetingRecord[];
  votingCards?: MeetingVotingCardRecord[];
  officialActions?: OfficialMeetingActionRecord[];
}) {
  const [bodies, meetings, votingCards, officialActions] = await Promise.all([
    input?.bodies ? Promise.resolve(input.bodies) : readJsonFile<PublicBodyRecord[]>(PUBLIC_MEETING_PATHS.bodies, []),
    input?.meetings ? Promise.resolve(input.meetings) : readJsonFile<PublicMeetingRecord[]>(PUBLIC_MEETING_PATHS.meetings, []),
    input?.votingCards ? Promise.resolve(input.votingCards) : readJsonFile<MeetingVotingCardRecord[]>(PUBLIC_MEETING_PATHS.meetingVotingCards, []),
    input?.officialActions ? Promise.resolve(input.officialActions) : readJsonFile<OfficialMeetingActionRecord[]>(PUBLIC_MEETING_PATHS.officialActions, []),
  ]);
  const bodyById = new Map(bodies.map((body) => [body.id, body]));

  const runtimeVotingCards = votingCards.map((card) => ({
    id: card.id,
    generation_key: card.generation_key,
    meeting_id: card.meeting_id,
    topic_item_id: card.topic_item_id,
    jurisdiction: card.jurisdiction,
    body_name: card.body_name,
    civic_layer: card.civic_layer,
    civic_layer_label: card.civic_layer_label,
    jurisdiction_display_name: card.jurisdiction_display_name,
    governing_body_display_name: card.governing_body_display_name,
    meeting_date: card.meeting_date,
    meeting_status: card.meeting_status,
    policy_area: card.policy_area,
    title: card.title,
    question_text: card.question_text,
    public_title: card.public_title,
    public_question: card.public_question,
    source_title: card.source_title,
    source_item_number: card.source_item_number,
    plain_action: card.plain_action,
    plain_purpose: card.plain_purpose,
    citizen_summary: card.citizen_summary ? summarizeText(card.citizen_summary, 420) : undefined,
    agenda_language_original: card.agenda_language_original ? summarizeText(card.agenda_language_original, 260) : undefined,
    plain_language_summary: summarizeText(card.plain_language_summary, 420),
    source_event_href: card.source_event_href,
    source_topic_href: card.source_topic_href,
    source_url: card.source_url,
    financial_impact: card.financial_impact,
    financial_impact_context: card.financial_impact_context
      ? {
          amount: card.financial_impact_context.amount,
          fund_source: card.financial_impact_context.fund_source,
          fiscal_year: card.financial_impact_context.fiscal_year,
          impact_types: card.financial_impact_context.impact_types,
          direct_tax_impact: card.financial_impact_context.direct_tax_impact,
          tax_cost_summary: card.financial_impact_context.tax_cost_summary,
          badges: card.financial_impact_context.badges,
          needs_review: card.financial_impact_context.needs_review,
        }
      : null,
    affected_groups: card.affected_groups.slice(0, 6),
    outcome_status: card.outcome_status,
    outcome_text: card.outcome_text ? summarizeText(card.outcome_text, 280) : null,
    review_status: card.review_status,
    confidence_score: card.confidence_score,
    needs_roll_call_review: card.needs_roll_call_review,
    updated_at: card.updated_at,
  }));

  const runtimeEvents = meetings.map((meeting) => {
    const body = bodyById.get(meeting.public_body_id);
    return {
      id: meeting.id,
      public_body_id: meeting.public_body_id,
      title: meeting.title,
      governing_body: body?.name ?? null,
      jurisdiction: body?.jurisdiction ?? null,
      meeting_date: meeting.meeting_date,
      meeting_type: meeting.meeting_type,
      agenda_url: meeting.agenda_url,
      minutes_url: meeting.minutes_url,
      packet_url: meeting.packet_url,
      video_url: meeting.video_url,
      transcript_url: meeting.transcript_url,
      meeting_summary: meeting.meeting_summary ? summarizeText(meeting.meeting_summary, 900) : null,
      key_actions: meeting.key_actions.slice(0, 8),
      vote_results: meeting.vote_results.slice(0, 12),
      source_document_count: meeting.source_document_count,
      source_urls: meeting.source_urls,
      source_method: meeting.source_method,
      parser_status: meeting.parser_status,
      roll_call_status: meeting.roll_call_status,
      ingestion_status: meeting.ingestion_status,
      document_hashes: [],
      created_at: meeting.created_at,
      updated_at: meeting.updated_at,
    };
  });

  const runtimeOfficialActions = officialActions
    .filter((action) => action.review_status === "approved" && action.official_id && !action.needs_review)
    .map((action) => ({
      id: action.id,
      official_id: action.official_id,
      official_name_raw: action.official_name_raw,
      jurisdiction_body: action.jurisdiction_body,
      meeting_id: action.meeting_id,
      topic_item_id: action.topic_item_id,
      action_type: action.action_type,
      action_text: summarizeText(action.action_text, 280),
      source_url: action.source_url,
      confidence: action.confidence,
      match_confidence: action.match_confidence,
      review_status: action.review_status,
      created_at: action.created_at,
    }));

  await Promise.all([
    writeJsonFile(PUBLIC_MEETING_PATHS.meetingVotingCardsRuntime, runtimeVotingCards),
    writeJsonFile(PUBLIC_MEETING_PATHS.eventsRuntime, runtimeEvents),
    writeJsonFile(PUBLIC_MEETING_PATHS.officialsRuntime, runtimeOfficialActions),
  ]);

  return {
    votingCards: runtimeVotingCards.length,
    events: runtimeEvents.length,
    officialActions: runtimeOfficialActions.length,
  };
}
