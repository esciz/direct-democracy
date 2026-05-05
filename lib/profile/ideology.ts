import type { IdeologicalLeaningLabel } from "@/types/domain";

const LEFT_KEYWORDS = [
  "healthcare",
  "clean energy",
  "climate",
  "teacher",
  "teachers",
  "transit",
  "housing affordability",
  "consumer protection",
  "public lands",
  "student affordability",
] as const;

const RIGHT_KEYWORDS = [
  "tax",
  "taxes",
  "public safety",
  "energy reliability",
  "energy production",
  "business",
  "manufacturing",
  "policing",
  "permitting",
  "licensing",
] as const;

function normalize(text: string) {
  return text.trim().toLowerCase();
}

export function getLeaningLabel(score: number): IdeologicalLeaningLabel {
  if (score <= -1.4) return "Left";
  if (score <= -0.45) return "Lean Left";
  if (score < 0.45) return "Center";
  if (score < 1.4) return "Lean Right";
  return "Right";
}

export function getPartyLeaningScore(value?: string | null) {
  const text = normalize(value ?? "");

  if (!text) return 0;
  if (text.includes("democrat") || text.includes("progressive") || text.includes("liberal")) return -1.35;
  if (text.includes("republican") || text.includes("conservative")) return 1.35;
  if (text.includes("independent") || text.includes("nonpartisan")) return 0;
  return 0;
}

export function getKeywordLeaningScore(texts: string[]) {
  let score = 0;

  for (const rawText of texts) {
    const text = normalize(rawText);

    for (const keyword of LEFT_KEYWORDS) {
      if (text.includes(keyword)) {
        score -= 0.35;
      }
    }

    for (const keyword of RIGHT_KEYWORDS) {
      if (text.includes(keyword)) {
        score += 0.35;
      }
    }
  }

  return Math.max(-2, Math.min(2, score));
}

export function inferIdeologicalLeaningLabel({
  partyText,
  sourceTexts,
}: {
  partyText?: string | null;
  sourceTexts: string[];
}): IdeologicalLeaningLabel | null {
  const keywordScore = getKeywordLeaningScore(sourceTexts);
  const partyScore = getPartyLeaningScore(partyText);
  const normalizedParty = normalize(partyText ?? "");
  const hasSignal =
    partyScore !== 0 ||
    keywordScore !== 0 ||
    normalizedParty.includes("independent") ||
    normalizedParty.includes("nonpartisan");

  if (!hasSignal) {
    return null;
  }

  return getLeaningLabel(partyScore + keywordScore);
}
