import {
  namesMatch,
  normalizeWhitespace,
  slugify,
  summarizeText,
} from "@/lib/public-meetings/shared";
import type {
  OfficialMeetingActionRecord,
  OfficialMeetingActionType,
  PublicBodyRecord,
  PublicMeetingItemRecord,
  PublicMeetingRecord,
} from "@/lib/public-meetings/types";

type ExtractContext = {
  meeting: PublicMeetingRecord;
  body: PublicBodyRecord | null;
};

const TITLE_WORDS = /\b(?:mayor|councilmember|council member|commissioner|trustee|senator|assemblymember|assembly member|chair|vice chair|director|secretary|clerk|member)\b\.?/gi;
const NON_NAME_WORDS = /\b(?:none|unanimous|all|motion|vote|votes|present|approved|passed|carried|failed|absent|abstain|nays?|ayes?|yeas?|noes?|license|agenda|item|public|staff|department|division|office|state|nevada)\b/i;

function cleanName(value: string) {
  return normalizeWhitespace(value.replace(TITLE_WORDS, "").replace(/\([^)]*\)/g, ""));
}

function splitNames(value: string) {
  return value
    .split(/,|;|\band\b/i)
    .map(cleanName)
    .filter((name) => /^[A-Z][A-Za-z'. -]{2,80}$/.test(name))
    .filter((name) => !NON_NAME_WORDS.test(name))
    .slice(0, 32);
}

function extractNamedGroup(text: string, labels: string[]) {
  const labelPattern = labels.join("|");
  const match = text.match(new RegExp(`\\b(?:${labelPattern})\\s*(?:vote|votes)?\\s*[:\\-]\\s*([^.;\\n]{2,420})`, "i"));
  return match?.[1] ? splitNames(match[1]) : [];
}

function extractSingleName(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const names = splitNames(match[1]);
    if (names.length) return names[0];
  }
  return null;
}

function actionId(item: PublicMeetingItemRecord, actionType: OfficialMeetingActionType, officialName: string, index: number) {
  return `official-action-${item.id}-${slugify(actionType)}-${slugify(officialName)}-${index}`;
}

function confidenceForName(officialName: string, explicitPatternConfidence: number) {
  const tokenCount = officialName.split(/\s+/).filter(Boolean).length;
  return tokenCount >= 2 ? explicitPatternConfidence : Math.min(explicitPatternConfidence, 0.74);
}

function makeAction({
  item,
  meeting,
  body,
  officialName,
  actionType,
  snippet,
  confidence,
  index,
}: {
  item: PublicMeetingItemRecord;
  meeting: PublicMeetingRecord;
  body: PublicBodyRecord | null;
  officialName: string;
  actionType: OfficialMeetingActionType;
  snippet: string;
  confidence: number;
  index: number;
}): OfficialMeetingActionRecord {
  const finalConfidence = confidenceForName(officialName, confidence);
  return {
    id: actionId(item, actionType, officialName, index),
    official_id: null,
    official_name_raw: officialName,
    jurisdiction_body: body ? `${body.name} · ${body.jurisdiction}` : "Public body pending",
    meeting_id: meeting.id,
    topic_item_id: item.id,
    action_type: actionType,
    action_text: summarizeText(snippet, 520),
    source_url: item.source_url ?? meeting.source_urls[0] ?? null,
    source_snippet: summarizeText(snippet, 900),
    confidence: finalConfidence,
    match_confidence: null,
    match_reason: null,
    review_status: "unmatched",
    needs_review: finalConfidence < 0.82,
    created_at: new Date().toISOString(),
  };
}

export function extractTopicOutcome(text: string) {
  const value = normalizeWhitespace(text);
  const explicitVote = value.match(/\b(?:ayes?|yeas?|yes\s+votes?)\s*[:\-]\s*([^.;\n]{2,220})(?:[.;\n]|$)/i);
  const explicitNo = value.match(/\b(?:nays?|noes?|no\s+votes?)\s*[:\-]\s*([^.;\n]{2,220})(?:[.;\n]|$)/i);
  if (explicitVote || explicitNo) {
    return summarizeText(`Ayes: ${explicitVote?.[1] ?? "not listed"}${explicitNo ? `; Nays: ${explicitNo[1]}` : ""}`, 240);
  }
  const approved = value.match(/\b(approved unanimously|unanimous(?:ly)? approved|motion\s+(?:carried|passed)|approved|adopted|passed|carried)\b[^.\n;]*/i);
  if (approved) return summarizeText(approved[0], 220);
  const failed = value.match(/\b(motion\s+failed|failed|denied|not\s+approved)\b[^.\n;]*/i);
  if (failed) return summarizeText(failed[0], 220);
  const continued = value.match(/\b(continued|tabled|no\s+action\s+taken)\b[^.\n;]*/i);
  if (continued) return summarizeText(continued[0], 220);
  return null;
}

export function itemHasUnnamedVoteOutcome(item: PublicMeetingItemRecord) {
  const text = normalizeWhitespace(item.source_text);
  const hasOutcome = Boolean(extractTopicOutcome(text));
  const hasNamedVotes = ["ayes?|yeas?", "nays?|noes?", "abstain(?:ed|ing)?", "absent"].some((label) => extractNamedGroup(text, [label]).length > 0);
  return hasOutcome && !hasNamedVotes;
}

export function extractOfficialActionsForItem(item: PublicMeetingItemRecord, context: ExtractContext): OfficialMeetingActionRecord[] {
  const text = normalizeWhitespace(item.source_text);
  if (!text) return [];
  const actions: OfficialMeetingActionRecord[] = [];
  let index = 0;

  const motionBy = extractSingleName(text, [
    /\bmotion\s+(?:made\s+)?by\s+([^.;\n]{2,140})/i,
    /\bmoved\s+by\s+([^.;\n]{2,140})/i,
  ]);
  if (motionBy) {
    actions.push(makeAction({ item, ...context, officialName: motionBy, actionType: "MOTION_MADE", snippet: text, confidence: 0.86, index: index++ }));
  }

  const secondBy = extractSingleName(text, [
    /\bsecond(?:ed)?\s+by\s+([^.;\n]{2,140})/i,
  ]);
  if (secondBy) {
    actions.push(makeAction({ item, ...context, officialName: secondBy, actionType: "MOTION_SECONDED", snippet: text, confidence: 0.86, index: index++ }));
  }

  const voteGroups: Array<{ labels: string[]; actionType: OfficialMeetingActionType }> = [
    { labels: ["ayes?", "yeas?", "yes\\s+votes?"], actionType: "VOTE_YES" },
    { labels: ["nays?", "noes?", "no\\s+votes?"], actionType: "VOTE_NO" },
    { labels: ["abstain(?:ed|ing)?"], actionType: "ABSTAIN" },
    { labels: ["absent"], actionType: "ABSENT" },
  ];

  for (const group of voteGroups) {
    for (const officialName of extractNamedGroup(text, group.labels)) {
      actions.push(makeAction({ item, ...context, officialName, actionType: group.actionType, snippet: text, confidence: 0.9, index: index++ }));
    }
  }

  return actions;
}

export function matchOfficialActionIds<T extends { official_name_raw: string; official_id: string | null }>(
  actions: T[],
  officials: Array<{ id: string; name: string; jurisdictionName?: string | null }>,
) {
  return actions.map((action) => {
    const match = officials.find((official) => namesMatch(official.name, action.official_name_raw));
    return match ? { ...action, official_id: match.id } : action;
  });
}
