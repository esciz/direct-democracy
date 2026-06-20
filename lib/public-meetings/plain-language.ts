import { getCivicJurisdictionContext } from "@/lib/civic/jurisdiction-context";
import { normalizeWhitespace, summarizeText } from "@/lib/public-meetings/shared";
import type { PublicBodyRecord, PublicMeetingItemRecord } from "@/lib/public-meetings/types";

function stripAgendaPrefixes(value: string) {
  return normalizeWhitespace(value)
    .replace(/^\d+(?:\.[A-Za-z0-9]+)*\.?\s*/i, "")
    .replace(/^(resolution|ordinance)?\s*recommendation\s+to\s+(approve|adopt|authorize|accept|award|deny|continue|amend)\s*:?\s*/i, "$2 ")
    .replace(/^(appearance|donation|contract|budget|grant)\s+recommendation\s+to\s+/i, "")
    .replace(/^acknowledge\s*:?\s*receipt\s+of\s+/i, "acknowledge receipt of ")
    .replace(/^acknowledge\s+a\s*:?\s*/i, "acknowledge ")
    .replace(/^donation\s+(accept|acknowledge)\s+/i, "$1 ")
    .replace(/^(recommendation|action)\s+to\s+/i, "")
    .replace(/^discussion\s+and\s+possible\s+action\s+(to|regarding|on)\s+/i, "")
    .replace(/^for\s+possible\s+action\s*:?\s*/i, "")
    .replace(/\bresolution\s+[A-Z]?\d{2,4}[-–][A-Z]?\d+\b\s*(to|authorizing|approving)?\s*/gi, "")
    .replace(/\bagenda\s+item\s+\w+\.?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstDollarAmount(value: string) {
  return normalizeWhitespace(value).match(/\$[\d,]+(?:\.\d{2})?/)?.[0] ?? null;
}

function sourceItemNumber(item: PublicMeetingItemRecord) {
  return item.item_number ? `Agenda Item ${item.item_number}` : null;
}

function plainPurpose(item: PublicMeetingItemRecord, plainAction: string) {
  const text = `${item.staff_recommendation ?? ""} ${item.one_sentence_summary ?? ""} ${item.plain_english_explanation ?? ""} ${item.source_text ?? ""}`;
  const lower = text.toLowerCase();
  if (/\bbuilding and safety|permit|permitting|inspection/i.test(lower)) return "permitting and safety operations";
  if (/\broad|street|transportation|traffic|sidewalk|bridge/i.test(lower)) return "transportation and road work";
  if (/\bsheriff|police|fire|emergency|public safety/i.test(lower)) return "public safety services";
  if (/\bschool|student|teacher|classroom/i.test(lower)) return "school services";
  if (/\bhousing|homeless|shelter|rental/i.test(lower)) return "housing and homelessness response";
  if (/\bwater|sewer|utility|stormwater/i.test(lower)) return "utility services";
  if (/\bzoning|development|land use|permit/i.test(lower)) return "land-use and development decisions";
  return summarizeText(plainAction, 96).toLowerCase();
}

function plainAction(item: PublicMeetingItemRecord) {
  const candidate = item.staff_recommendation ?? item.vote_outcome ?? item.one_sentence_summary ?? item.title;
  return summarizeText(stripAgendaPrefixes(candidate), 180).replace(/[?.!]+$/, "");
}

function actionVerb(item: PublicMeetingItemRecord, action: string) {
  const text = `${item.staff_recommendation ?? ""} ${item.vote_outcome ?? ""} ${item.title} ${action}`.toLowerCase();
  if (/\bdonation|donor|donated\b/.test(text)) return "accept";
  if (/\bdeny|denied|reject|rejected\b/.test(text)) return "reject";
  if (/\bcontinue|continued|table|tabled|postpone\b/.test(text)) return "continue";
  if (/\bfund|budget|appropriate|augment|allocate|spend\b/.test(text)) return "fund";
  if (/\badopt|ordinance|resolution\b/.test(text)) return "adopt";
  if (/\bauthorize|award|contract|agreement|purchase\b/.test(text)) return "approve";
  return "approve";
}

export function buildPlainLanguageMeetingVotingCardFields(item: PublicMeetingItemRecord, body: PublicBodyRecord | null) {
  const context = getCivicJurisdictionContext({
    jurisdiction: body?.jurisdiction,
    body_name: body?.name,
  });
  const action = plainAction(item);
  const purpose = plainPurpose(item, action);
  const amount = firstDollarAmount(`${item.financial_impact ?? ""} ${item.fiscal_impact_summary ?? ""} ${item.source_text ?? ""}`);
  const verb = actionVerb(item, action);
  const jurisdictionNoun =
    context.civicLayer === "county"
      ? "the county"
      : context.civicLayer === "city"
        ? "the city"
        : context.civicLayer === "school_district"
          ? "the school district"
          : context.civicLayer === "state"
            ? "the state"
            : "this public body";
  const publicAction = amount && verb === "fund"
    ? `${verb} ${amount} for ${purpose}`
    : amount && verb === "accept" && /\bdonation|donor|donated\b/i.test(`${item.title} ${action}`)
      ? `accept a ${amount} donation for ${purpose}`
    : `${verb} ${action}`;
  const publicQuestion = `Should ${jurisdictionNoun} ${publicAction}?`;
  const sourceTitle = summarizeText(item.title, 220);
  const itemNumber = sourceItemNumber(item);
  const citizenSummary = item.plain_english_explanation || item.one_sentence_summary || `This asks whether ${context.primaryLabel} should ${publicAction}.`;

  return {
    public_title: publicQuestion.replace(/^Should\s+/i, "").replace(/\?$/, ""),
    public_question: publicQuestion,
    source_title: sourceTitle,
    source_item_number: itemNumber,
    plain_action: publicAction,
    plain_purpose: purpose,
    citizen_summary: summarizeText(citizenSummary, 420),
    agenda_language_original: item.title,
    civic_layer: context.civicLayer,
    civic_layer_label: context.civicLayerLabel,
    jurisdiction_display_name: context.primaryLabel,
    governing_body_display_name: context.secondaryLabel,
  };
}
