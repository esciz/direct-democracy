const LEADING_AGENDA_LANGUAGE = [
  /^for\s+possible\s+action\s*[:\-–—]?\s*/i,
  /^(?:presentation,?\s+)?discussion\s+and\s+possible\s+action\s+(?:regarding|concerning)\s+/i,
  /^consideration\s+and\s+possible\s+action\s+(?:regarding|concerning)\s+/i,
  /^discussion\s+(?:regarding|concerning|on)\s+/i,
  /^agenda\s+item\s*[:#-]?\s*/i,
  /^item\s+[\w.-]+\s*[:\-–—]\s*/i,
] as const;

function normalizeText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBodyName(value: string | null | undefined, fallback: string) {
  return normalizeText(value ?? "").replace(/,?\s+(?:NV|Nevada)$/i, "") || fallback;
}

function topicHeadline(sourceText: string) {
  if (/risk management|risk reduction|risk mitigation/i.test(sourceText)) return "risk-management program";
  if (/lobbying expense|lobbyist/i.test(sourceText)) return "operating and lobbying expenses";
  if (/final budget/i.test(sourceText)) return "final budget";
  if (/budget|fiscal year|estimated expenditures/i.test(sourceText)) return "budget proposal";
  if (/interlocal|interagency|public agencies to contract/i.test(sourceText)) return "interagency agreement";
  if (/grant|award activity/i.test(sourceText)) return "grant funding";
  if (/zoning|zone change|land use/i.test(sourceText)) return "land-use proposal";
  if (/appointment|appoint|personnel/i.test(sourceText)) return "personnel appointment";
  if (/purchase|procurement|equipment|supplies/i.test(sourceText)) return "public purchase";
  return null;
}

function clampAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const shortened = value.slice(0, maxLength + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > maxLength * 0.65 ? lastSpace : maxLength).trim()}…`;
}

/** Removes procedural agenda phrasing while preserving the actual subject. */
export function plainLanguageTitle(value: string, maxLength = 110) {
  let title = normalizeText(value);
  for (const pattern of LEADING_AGENDA_LANGUAGE) title = title.replace(pattern, "");
  title = title.replace(/^approval\s+of\s+/i, "Approve ");
  title = title.replace(/^consideration\s+of\s+/i, "Consider ");
  return clampAtWord(title || "Civic item", maxLength);
}

/** Keeps cards skimmable. The complete source language belongs in expanded details. */
export function highLevelSummary(value: string | null | undefined, fallback: string, maxLength = 180) {
  const normalized = normalizeText(value ?? "");
  if (!normalized) return fallback;

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized];
  const useful = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 15)
    .slice(0, 2)
    .join(" ");

  return clampAtWord(useful || normalized, maxLength);
}

type ProjectHeadlineInput = {
  title: string;
  description?: string | null;
  sourceText?: string | null;
  responsibleBody?: string | null;
  agency?: string | null;
  jurisdiction?: string | null;
  needsReview?: boolean;
};

export function projectHeadline(input: ProjectHeadlineInput) {
  const body = cleanBodyName(input.responsibleBody ?? input.agency ?? input.jurisdiction, "Public project");
  const sourceText = normalizeText([input.title, input.description, input.sourceText].filter(Boolean).join(" "));
  const topic = topicHeadline(sourceText);
  if (topic) return `${body}: ${topic}`;

  const cleaned = plainLanguageTitle(input.title);
  const looksExtracted = /\b(?:whereas|herewith|pursuant|nrs\s+\d|entity\s*:|total\s+\$)\b/i.test(sourceText) || /^[/$\d]/.test(cleaned);
  return input.needsReview && looksExtracted ? `${body}: project awaiting review` : cleaned;
}

export function projectCardSummary(input: ProjectHeadlineInput) {
  const headline = projectHeadline(input);
  const description = normalizeText(input.description ?? "");
  if (!description || /source text is available for manual interpretation|needs review/i.test(description)) {
    return `The official record appears to concern ${headline.toLowerCase()}, but the scope and cost still need review.`;
  }
  return highLevelSummary(description, `More information about ${headline.toLowerCase()} is being reviewed.`);
}

type DecisionHeadlineInput = {
  title: string;
  summary?: string | null;
  sourceText?: string | null;
  bodyName?: string | null;
  jurisdiction?: string | null;
  needsReview?: boolean;
};

export function decisionHeadline(input: DecisionHeadlineInput) {
  const body = cleanBodyName(input.bodyName ?? input.jurisdiction, "Public body");
  const sourceText = normalizeText([input.title, input.summary, input.sourceText].filter(Boolean).join(" "));
  const topic = topicHeadline(sourceText);
  if (topic) return `${body}: ${topic}`;

  const cleaned = plainLanguageTitle(input.title, 135)
    .replace(/^Should\s+(?:the\s+)?(?:city|county|board)\s+(?:approve|fund|adopt)\s+/i, "")
    .replace(/^Should\s+/i, "");
  const looksExtracted = /\b(?:whereas|herewith|pursuant|nrs\s+\d|entity\s*:|director\s*\(|trustee\s*\()\b/i.test(sourceText);
  return input.needsReview && looksExtracted ? `${body}: decision awaiting review` : clampAtWord(cleaned || `${body}: public decision`, 120);
}

export function decisionCardSummary(input: DecisionHeadlineInput) {
  const headline = decisionHeadline(input);
  const summary = normalizeText(input.summary ?? "");
  if (!summary || /source text is available for manual interpretation|needs review/i.test(summary)) {
    return `This appears to concern ${headline.toLowerCase()}, but the exact action and outcome still need review.`;
  }
  return highLevelSummary(summary, `More information about ${headline.toLowerCase()} is being reviewed.`);
}
