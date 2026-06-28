import { parseMeetingVotingCardFinancialImpact } from "@/lib/public-meetings/financial-impact";
import { normalizeWhitespace, summarizeText } from "@/lib/public-meetings/shared";
import type {
  MeetingVotingCardRecord,
  PublicBodyRecord,
  PublicMeetingItemRecord,
  PublicMeetingRecord,
  VoteRecord,
} from "@/lib/public-meetings/types";

export type DecisionIntelligenceInput = {
  meeting?: PublicMeetingRecord | null;
  agendaItem?: PublicMeetingItemRecord | null;
  publicBody?: PublicBodyRecord | null;
  votingCard?: MeetingVotingCardRecord | null;
  resolutionText?: string | null;
  ordinanceText?: string | null;
  motionText?: string | null;
  votes?: VoteRecord[];
};

export type DecisionIntelligence = {
  citizenTitle: string;
  citizenSummary: string;
  whyItMatters: string;
  affectedGroups: string[];
  estimatedFinancialImpact?: number;
  financialImpactDescription?: string;
  decisionType: string;
  confidence: number;
};

const DECISION_TYPE_PATTERNS: Array<[string, RegExp]> = [
  ["spending", /\b(spend|fund|budget|appropriat|allocate|expenditure|expense|purchase|award|contract|grant)\b/i],
  ["ordinance", /\bordinance\b/i],
  ["resolution", /\bresolution\b/i],
  ["motion", /\bmotion\b/i],
  ["land use", /\b(zoning|rezon|land use|development|parcel|variance|subdivision|permit)\b/i],
  ["public safety", /\b(police|sheriff|fire|emergency|911|public safety)\b/i],
  ["infrastructure", /\b(road|street|bridge|water|sewer|utility|construction|capital improvement|facility|plant)\b/i],
  ["policy", /\b(policy|rule|regulation|plan|program|agreement)\b/i],
];

const GROUP_PATTERNS: Array<[string, RegExp]> = [
  ["Residents", /\b(resident|public|community|neighborhood|household|voter)\b/i],
  ["Taxpayers", /\b(tax|taxpayer|fee|assessment|bond|debt|budget)\b/i],
  ["Drivers and commuters", /\b(road|street|traffic|transportation|transit|sidewalk|bridge|airport)\b/i],
  ["Students and schools", /\b(school|student|teacher|trustee|classroom|district)\b/i],
  ["Businesses and permit applicants", /\b(business|license|permit|developer|development|building|inspection)\b/i],
  ["Utility customers", /\b(water|sewer|stormwater|utility|utilities|ratepayer|surcharge)\b/i],
  ["Public safety staff and service users", /\b(police|sheriff|fire|emergency|dispatch|911|public safety)\b/i],
  ["Housing applicants and neighbors", /\b(housing|rental|tenant|apartment|residential|homeless|shelter)\b/i],
];

function cleanSourceJargon(value: string) {
  return normalizeWhitespace(value)
    .replace(/\b(?:resolution|ordinance)\s+(?:no\.?\s*)?[A-Z]?\d{2,4}[-–][A-Z]?\d+\b/gi, "")
    .replace(/\bagenda\s+item\s+[A-Z0-9.:-]+\b/gi, "")
    .replace(/\bitem\s+[A-Z0-9.:-]+\b/gi, "")
    .replace(/\b(search\s+-\s+primegov\s+portal|toggle navigation|sign in|advanced search)\b/gi, "")
    .replace(/^\s*(?:for\s+possible\s+action|discussion\s+and\s+possible\s+action)\s*:?\s*/i, "")
    .replace(/^\s*(?:recommendation|action)\s+to\s+/i, "")
    .replace(/^\s*and\s+/i, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceText(input: DecisionIntelligenceInput) {
  const item = input.agendaItem;
  const card = input.votingCard;
  return normalizeWhitespace(
    [
      card?.public_question,
      card?.question_text,
      card?.plain_language_summary,
      card?.citizen_summary,
      card?.source_title,
      item?.staff_recommendation,
      item?.one_sentence_summary,
      item?.plain_english_explanation,
      item?.why_it_matters,
      item?.financial_impact,
      item?.fiscal_impact_summary,
      input.resolutionText,
      input.ordinanceText,
      input.motionText,
      item?.source_text,
      input.meeting?.meeting_summary,
    ].filter(Boolean).join(" "),
  );
}

function extractAmounts(text: string) {
  return text.match(/\$[\d,]+(?:\.\d+)?(?:\s+(?:million|billion|thousand)|\s*[mbk]\b)?/gi) ?? [];
}

function amountToNumber(value: string | null | undefined) {
  if (!value) return undefined;
  const match = value.match(/\$?([\d,]+(?:\.\d+)?)(?:\s+(million|billion|thousand)|\s*([mbk])\b)?/i);
  if (!match) return undefined;
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return undefined;
  const multiplier = (match[2] ?? match[3])?.toLowerCase();
  if (multiplier === "billion" || multiplier === "b") return Math.round(base * 1_000_000_000);
  if (multiplier === "million" || multiplier === "m") return Math.round(base * 1_000_000);
  if (multiplier === "thousand" || multiplier === "k") return Math.round(base * 1_000);
  return Math.round(base);
}

function decisionTypeFor(text: string, item?: PublicMeetingItemRecord | null) {
  if (item?.item_type && item.item_type !== "other") return item.item_type.replaceAll("_", " ");
  return DECISION_TYPE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "public action";
}

function isWeakCitizenText(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value ?? "");
  if (normalized.length < 12) return true;
  if (/\bneeds review\b/i.test(normalized)) return true;
  if (/\b(search\s+-\s+primegov\s+portal|toggle navigation|sign in|advanced search|placeHolderFrom)\b/i.test(normalized)) return true;
  if (/^(packet|agenda|minutes|meeting materials)$/i.test(normalized)) return true;
  if (/^(approve|approved|adopt|adopted|authorize|authorized|fund|funded|review|reviewed)$/i.test(normalized)) return true;
  if (/^should\s+(?:the\s+)?(?:city|state|county|school district|public body|this public body)\s+(?:approve|adopt|authorize|fund|review)\?$/i.test(normalized)) return true;
  return false;
}

function polishCitizenTitle(value: string) {
  let next = normalizeWhitespace(value)
    .replace(/\bapprove\s+approved\b/gi, "approve")
    .replace(/\bapprove\s+approval\s+of\b/gi, "approve")
    .replace(/\badopt\s+adopted\b/gi, "adopt")
    .replace(/\bauthorize\s+authorized\b/gi, "authorize")
    .replace(/\baward\s+awarded\b/gi, "award")
    .replace(/\baccept\s+accepted\b/gi, "accept")
    .replace(/\bfund\s+funded\b/gi, "fund")
    .replace(/\bapprove\s+and\s+/gi, "approve ")
    .replace(/\bapprove\s+a\s+request\s+for\s+an?\s+/gi, "approve ")
    .replace(/\bapprove\s+the\s+subject\s+/gi, "approve ")
    .replace(/\bapprove\s+in\s+June\s+\d{4}\b/gi, "review an action approved earlier")
    .replace(/\s+(?:was|were)\s+approved(?=\?)/gi, "")
    .replace(/\bapprove\s+approved\?/gi, "approve this action?")
    .replace(/\s+\?/g, "?")
    .replace(/\?+$/, "?");
  next = next.replace(/\b(\w+)\s+\1\b/gi, "$1");
  if (/^should\b/i.test(next) && !next.endsWith("?")) next += "?";
  return next;
}

function summarizeCitizenTitle(value: string, maxLength = 150) {
  const polished = polishCitizenTitle(value);
  const summary = summarizeText(polished, maxLength);
  if (polished.endsWith("?") && !summary.endsWith("?")) {
    return `${summary.replace(/\.\.\.$/, "").trimEnd()}...?`;
  }
  return summary;
}

function actorFor(input: DecisionIntelligenceInput) {
  const jurisdiction = input.votingCard?.jurisdiction ?? input.publicBody?.jurisdiction ?? "";
  if (/\bnevada\b/i.test(jurisdiction) && !/\b(city|county)\b/i.test(jurisdiction)) return "the state";
  if (/\bcounty\b/i.test(jurisdiction)) return "the county";
  if (/\bschool|district|trustee/i.test(`${jurisdiction} ${input.publicBody?.name ?? ""}`)) return "the school district";
  if (/\bcity\b/i.test(jurisdiction) || /\b(city council|planning commission)\b/i.test(input.publicBody?.name ?? "")) return "the city";
  return input.publicBody?.name ?? input.votingCard?.body_name ?? "this public body";
}

function bestActionText(input: DecisionIntelligenceInput, text: string) {
  const candidates = [
    input.agendaItem?.staff_recommendation,
    input.agendaItem?.one_sentence_summary,
    input.agendaItem?.plain_english_explanation,
    input.votingCard?.plain_language_summary,
    input.votingCard?.citizen_summary,
    input.votingCard?.source_title,
    input.agendaItem?.title,
    input.votingCard?.source_snippets?.[0],
    text,
  ];
  return cleanSourceJargon(candidates.find((candidate) => !isWeakCitizenText(candidate)) ?? "");
}

function affectedGroupsFor(text: string, item?: PublicMeetingItemRecord | null, card?: MeetingVotingCardRecord | null) {
  const groups = new Set<string>([...(item?.affected_groups ?? []), ...(card?.affected_groups ?? [])].filter(Boolean));
  for (const [label, pattern] of GROUP_PATTERNS) {
    if (pattern.test(text)) groups.add(label);
  }
  if (!groups.size) groups.add("Residents");
  return [...groups].slice(0, 6);
}

function titleFor(input: DecisionIntelligenceInput, text: string, decisionType: string, financialDescription?: string) {
  const cardQuestion = cleanSourceJargon(input.votingCard?.public_question || input.votingCard?.question_text || "");
  const polishedCardQuestion = polishCitizenTitle(cardQuestion);
  if (polishedCardQuestion && /\?$/.test(polishedCardQuestion) && !isWeakCitizenText(polishedCardQuestion)) return summarizeCitizenTitle(polishedCardQuestion, 150);

  const actor = actorFor(input);
  const itemAction = bestActionText(input, text);
  if (isWeakCitizenText(itemAction)) {
    const bodyName = input.publicBody?.name ?? input.votingCard?.body_name ?? "public body";
    return summarizeCitizenTitle(`Source review needed for ${bodyName} action`, 150);
  }
  const amount = financialDescription?.match(/\$[\d,]+(?:\.\d+)?(?:\s+(?:million|billion|thousand)|\s*[mbk]\b)?/i)?.[0];
  const spendPrefix = amount && decisionType === "spending" ? `spend ${amount} on` : decisionType === "spending" ? "approve spending for" : "approve";
  const title = polishCitizenTitle(`Should ${actor} ${spendPrefix} ${itemAction}?`);
  if (isWeakCitizenText(title)) {
    const bodyName = input.publicBody?.name ?? input.votingCard?.body_name ?? "public body";
    return summarizeCitizenTitle(`Source review needed for ${bodyName} action`, 150);
  }
  return summarizeCitizenTitle(title, 150);
}

function summaryFor(input: DecisionIntelligenceInput, text: string) {
  const item = input.agendaItem;
  const card = input.votingCard;
  const candidate =
    card?.citizen_summary ||
    card?.plain_language_summary ||
    item?.plain_english_explanation ||
    item?.one_sentence_summary ||
    item?.description ||
    input.meeting?.meeting_summary ||
    text;
  return summarizeText(cleanSourceJargon(candidate), 360);
}

function whyItMattersFor(input: DecisionIntelligenceInput, text: string, groups: string[], financialDescription?: string) {
  const itemWhy = input.agendaItem?.why_it_matters;
  if (itemWhy && !/^it may affect residents/i.test(itemWhy)) return summarizeText(itemWhy, 320);
  const groupText = groups.length ? groups.slice(0, 3).join(", ").toLowerCase() : "residents";
  if (financialDescription) {
    return summarizeText(`${groups[0] ?? "Residents"} may see services, projects, or public costs change. ${financialDescription}`, 340);
  }
  if (/\b(permit|development|zoning|land use)\b/i.test(text)) {
    return `This may affect development timelines, neighborhood growth, builders, applicants, and nearby residents.`;
  }
  if (/\b(road|street|traffic|transportation|water|sewer|utility|facility|construction)\b/i.test(text)) {
    return `This may affect local infrastructure, service reliability, public spending, and daily conditions for ${groupText}.`;
  }
  return `This may affect public services, rules, oversight, or resources for ${groupText}.`;
}

function confidenceFor(input: DecisionIntelligenceInput, hasFinancialContext: boolean) {
  let score = input.votingCard?.confidence_score ?? input.agendaItem?.confidence_score ?? 0.5;
  if (input.votingCard?.source_url || input.agendaItem?.source_url || input.meeting?.source_urls.length) score += 0.12;
  if (input.votingCard?.plain_language_summary || input.agendaItem?.plain_english_explanation) score += 0.08;
  if (input.votingCard?.outcome_status && input.votingCard.outcome_status !== "unknown") score += 0.04;
  if (hasFinancialContext) score += 0.04;
  if (input.votingCard?.review_status === "needs_review" || input.agendaItem?.parser_status === "needs_review") score -= 0.12;
  return Math.max(0.1, Math.min(0.98, Number(score.toFixed(2))));
}

export function buildDecisionIntelligence(input: DecisionIntelligenceInput): DecisionIntelligence {
  const text = sourceText(input);
  const item = input.agendaItem;
  const card = input.votingCard;
  const financialContext =
    parseMeetingVotingCardFinancialImpact({
      financialImpact: item?.financial_impact ?? card?.financial_impact,
      fiscalImpactSummary: item?.fiscal_impact_summary,
      sourceText: item?.source_text ?? text,
      sourceSnippet: item?.source_snippet ?? card?.source_snippets?.[0],
    }) ?? card?.financial_impact_context;
  const amount = amountToNumber(financialContext?.amount ?? extractAmounts(text)[0]);
  const financialImpactDescription = financialContext?.plain_english_summary ?? financialContext?.tax_cost_summary ?? undefined;
  const decisionType = decisionTypeFor(text, item);
  const affectedGroups = affectedGroupsFor(text, item, card);
  const citizenTitle = titleFor(input, text, decisionType, financialImpactDescription);
  const citizenSummary = summaryFor(input, text);
  const whyItMatters = whyItMattersFor(input, text, affectedGroups, financialImpactDescription);

  return {
    citizenTitle,
    citizenSummary,
    whyItMatters,
    affectedGroups,
    estimatedFinancialImpact: amount,
    financialImpactDescription,
    decisionType,
    confidence: confidenceFor(input, Boolean(financialContext)),
  };
}
