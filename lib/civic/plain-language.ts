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

