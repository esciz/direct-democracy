import { buildMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import { parseMeetingVotingCardFinancialImpact } from "@/lib/public-meetings/financial-impact";
import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const now = new Date("2026-01-01T00:00:00.000Z").toISOString();

const body: PublicBodyRecord = {
  id: "body-test",
  name: "Test City Council",
  jurisdiction: "Test City",
  level: "city",
  website: null,
  source_url: "https://example.gov",
  meeting_index_url: "https://example.gov/meetings",
  scraper_type: "manual",
  active: true,
  seed_source_id: "test",
  notes: null,
  created_at: now,
  updated_at: now,
};

const meeting: PublicMeetingRecord = {
  id: "meeting-test",
  public_body_id: body.id,
  meeting_date: "2025-06-10T17:00:00.000Z",
  meeting_type: "Regular meeting",
  title: "Test City Council Regular Meeting",
  agenda_url: "https://example.gov/agenda",
  minutes_url: "https://example.gov/minutes",
  packet_url: null,
  video_url: null,
  transcript_url: null,
  meeting_summary: null,
  key_actions: [],
  vote_results: [],
  source_document_count: 1,
  source_urls: ["https://example.gov/minutes"],
  ingestion_status: "parsed",
  document_hashes: [],
  created_at: now,
  updated_at: now,
};

function item(id: string, title: string, sourceText: string, overrides: Partial<PublicMeetingItemRecord> = {}): PublicMeetingItemRecord {
  return {
    id,
    meeting_id: meeting.id,
    item_number: "8",
    title,
    description: null,
    one_sentence_summary: title,
    plain_english_explanation: title,
    why_it_matters: "This affects local public services.",
    affected_groups: ["Residents"],
    financial_impact: null,
    vote_outcome: null,
    related_official_names: [],
    related_organization_names: [],
    agenda_section: null,
    item_type: "action",
    staff_recommendation: null,
    fiscal_impact_summary: null,
    policy_area: "Transportation",
    source_page: null,
    source_text: sourceText,
    source_url: "https://example.gov/minutes",
    source_snippet: sourceText,
    source_document_hash: null,
    cached_text_path: null,
    confidence_score: 0.88,
    ...overrides,
  };
}

const cards = buildMeetingVotingCards({
  meetings: [meeting],
  bodies: [body],
  officialActions: [],
  items: [
    item(
      "item-policy",
      "Approve road improvement contract",
      "Recommendation to approve a contract not to exceed $500,000 for road improvements. Motion carried unanimously.",
      {
        staff_recommendation: "Approve a contract not to exceed $500,000 for road improvements.",
        fiscal_impact_summary: "$500,000 contract authority.",
        vote_outcome: "Motion carried unanimously.",
      },
    ),
    item("item-minutes", "Approval of minutes", "Approval of minutes for the previous meeting.", {
      item_type: "consent",
      affected_groups: [],
      confidence_score: 0.92,
    }),
  ],
});

if (cards.length !== 1) throw new Error(`Expected 1 voting card, got ${cards.length}`);
const [card] = cards;
if (!card.question_text.includes("city")) throw new Error(`Question did not use citizen-facing jurisdiction language: ${card.question_text}`);
if (card.outcome_status !== "approved") throw new Error(`Expected approved outcome, got ${card.outcome_status}`);
if (card.review_status !== "approved") throw new Error(`Expected approved review status, got ${card.review_status}`);
if (!card.financial_impact) throw new Error("Expected fiscal impact on generated card");
if (!card.financial_impact_context) throw new Error("Expected tax/cost context on generated card");

function assertFinancialCase(
  name: string,
  text: string,
  expectation: {
    amount?: string;
    directTaxImpact: "stated" | "unlikely" | "unknown" | "needs_review";
    summaryIncludes: string;
    typeIncludes?: string;
  },
) {
  const parsed = parseMeetingVotingCardFinancialImpact({
    fiscalImpactSummary: text,
    sourceText: text,
    sourceSnippet: text,
  });
  if (!parsed) throw new Error(`${name}: expected financial context`);
  if (expectation.amount && parsed.amount !== expectation.amount) throw new Error(`${name}: expected amount ${expectation.amount}, got ${parsed.amount}`);
  if (parsed.direct_tax_impact !== expectation.directTaxImpact) {
    throw new Error(`${name}: expected direct tax impact ${expectation.directTaxImpact}, got ${parsed.direct_tax_impact}`);
  }
  if (!parsed.tax_cost_summary.includes(expectation.summaryIncludes)) {
    throw new Error(`${name}: expected summary to include "${expectation.summaryIncludes}", got "${parsed.tax_cost_summary}"`);
  }
  if (expectation.typeIncludes && !parsed.impact_types.includes(expectation.typeIncludes as never)) {
    throw new Error(`${name}: expected type ${expectation.typeIncludes}, got ${parsed.impact_types.join(", ")}`);
  }
}

assertFinancialCase("dollar amount only", "$600,000 fiscal impact.", {
  amount: "$600,000",
  directTaxImpact: "unknown",
  summaryIncludes: "does not state whether this directly changes voter taxes or fees",
});

assertFinancialCase("revenue and expense authority", "Augment the Building and Safety Fund by $600,000 to increase Fiscal Year 2026 revenue and expense authority.", {
  amount: "$600,000",
  directTaxImpact: "unlikely",
  summaryIncludes: "$600,000 Building and Safety Fund revenue/expense authority increase",
  typeIncludes: "budget_authority",
});

assertFinancialCase("grant funded", "Accept a $250,000 federal grant for park improvements.", {
  amount: "$250,000",
  directTaxImpact: "unlikely",
  summaryIncludes: "grant funding",
  typeIncludes: "grant",
});

assertFinancialCase("bond debt", "Authorize issuance of up to $12,000,000 in bonds for utility improvements.", {
  amount: "$12,000,000",
  directTaxImpact: "needs_review",
  summaryIncludes: "Source review needed",
  typeIncludes: "bond_debt",
});

assertFinancialCase("tax increase", "Increase property tax by $0.03 per $100 of assessed value.", {
  amount: "$0.03",
  directTaxImpact: "stated",
  summaryIncludes: "direct tax impact",
  typeIncludes: "tax",
});

assertFinancialCase("fee increase", "Increase permit fees by $75 for expedited review.", {
  amount: "$75",
  directTaxImpact: "stated",
  summaryIncludes: "direct fee impact",
  typeIncludes: "fee",
});

const noImpact = parseMeetingVotingCardFinancialImpact({
  fiscalImpactSummary: null,
  financialImpact: null,
  sourceText: "Ceremonial proclamation recognizing community volunteers.",
});
if (noImpact) throw new Error("Expected no financial context for non-fiscal text");

console.log("Meeting voting card fixtures passed.");
console.log(JSON.stringify({ generated: cards.length, question: card.question_text, outcome: card.outcome_status, review: card.review_status, taxCost: card.financial_impact_context.tax_cost_summary }, null, 2));
