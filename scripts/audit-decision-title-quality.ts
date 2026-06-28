import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type DecisionCard = {
  id: string;
  title: string;
  summary: string;
  jurisdiction: string;
  reviewStatus: string;
  confidence: number;
  sourceReferences?: Array<{ url?: string | null; path?: string | null; snippet?: string | null }>;
};

type Artifact<T> = { generatedAt?: string; records?: T[] };

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "decision-title-quality-audit.json");

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function reasonForTitle(card: DecisionCard) {
  const title = card.title.trim();
  const reasons: string[] = [];
  if (!title) reasons.push("missing_title");
  if (/\bneeds review\b/i.test(title)) reasons.push("review_phrase_in_public_title");
  if (/\b(search\s+-\s+primegov\s+portal|toggle navigation|sign in|advanced search|placeHolderFrom)\b/i.test(title)) reasons.push("portal_navigation_text");
  if (/\b(approve approved|approve approve|adopt adopted|authorize authorized|fund funded)\b/i.test(title)) reasons.push("duplicate_action_verb");
  if (/^should\s+(?:the\s+)?(?:city|state|county|school district|public body|this public body)\s+(?:approve|adopt|authorize|fund|review)\?$/i.test(title)) reasons.push("generic_empty_question");
  if (title.length > 170) reasons.push("title_too_long");
  if (!/^source review needed/i.test(title) && !/\?$/.test(title)) reasons.push("decision_question_missing_question_mark");
  return reasons;
}

const artifact = readJson<Artifact<DecisionCard>>("voting-cards.json", { records: [] });
const records = artifact.records ?? [];
const titleRows = records.map((card) => ({
  id: card.id,
  title: card.title,
  jurisdiction: card.jurisdiction,
  reviewStatus: card.reviewStatus,
  confidence: card.confidence,
  reasons: reasonForTitle(card),
  sourceCount: card.sourceReferences?.length ?? 0,
}));

const failingRows = titleRows.filter((row) => row.reasons.length > 0);
const sourceReviewRows = titleRows.filter((row) => /^source review needed/i.test(row.title));
const readyRowsWithFailures = failingRows.filter((row) => !row.reviewStatus.includes("review") && row.confidence >= 0.7);
const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    decisions: records.length,
    titleFailures: failingRows.length,
    readyTitleFailures: readyRowsWithFailures.length,
    sourceReviewNeededTitles: sourceReviewRows.length,
    sourceBackedDecisions: records.filter((card) => (card.sourceReferences?.length ?? 0) > 0).length,
  },
  reasonCounts: failingRows.reduce<Record<string, number>>((counts, row) => {
    for (const reason of row.reasons) counts[reason] = (counts[reason] ?? 0) + 1;
    return counts;
  }, {}),
  samples: {
    failures: failingRows.slice(0, 20),
    sourceReviewNeeded: sourceReviewRows.slice(0, 20),
  },
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log("Decision title quality audit complete.");
console.log(JSON.stringify(report.totals, null, 2));

if (failingRows.length) {
  console.error(JSON.stringify({ reasonCounts: report.reasonCounts, samples: report.samples.failures.slice(0, 5) }, null, 2));
  process.exit(1);
}
