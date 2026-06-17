import { resolveOfficialActionMatch } from "@/lib/public-meetings/official-action-matcher";
import { extractOfficialActionsForItem, itemHasUnnamedVoteOutcome } from "@/lib/public-meetings/official-actions";
import type { OfficialMeetingActionType, PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const now = new Date("2026-01-01T00:00:00.000Z").toISOString();

const body: PublicBodyRecord = {
  id: "body-test",
  name: "Test City Council",
  jurisdiction: "Test City",
  level: "city",
  website: null,
  source_url: "https://example.gov/meetings",
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

function item(id: string, sourceText: string): PublicMeetingItemRecord {
  return {
    id,
    meeting_id: meeting.id,
    item_number: "7",
    title: "Approve road improvement contract",
    description: null,
    one_sentence_summary: "Council considered a source-backed action.",
    plain_english_explanation: "Council considered a source-backed action.",
    why_it_matters: "This affects local public services.",
    affected_groups: [],
    financial_impact: null,
    vote_outcome: null,
    related_official_names: [],
    related_organization_names: [],
    agenda_section: null,
    item_type: "action",
    staff_recommendation: null,
    fiscal_impact_summary: null,
    policy_area: "Other",
    source_page: null,
    source_text: sourceText,
    source_url: "https://example.gov/minutes",
    source_document_hash: null,
    cached_text_path: null,
    confidence_score: 0.92,
  };
}

function countByType(actions: ReturnType<typeof extractOfficialActionsForItem>) {
  return actions.reduce<Record<string, number>>((counts, action) => {
    counts[action.action_type] = (counts[action.action_type] ?? 0) + 1;
    return counts;
  }, {});
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertTypeCount(counts: Record<string, number>, type: OfficialMeetingActionType, expected: number) {
  assertEqual(counts[type] ?? 0, expected, type);
}

const explicitRollCall = item(
  "item-explicit-roll-call",
  "Motion by Commissioner Alice Smith. Seconded by Bob Jones. Ayes: Alice Smith, Bob Jones. Nays: Carol Lee. Abstain: Dana Roe. Absent: Evan Kim. Motion carried.",
);
const explicitActions = extractOfficialActionsForItem(explicitRollCall, { meeting, body });
const explicitCounts = countByType(explicitActions);
assertTypeCount(explicitCounts, "MOTION_MADE", 1);
assertTypeCount(explicitCounts, "MOTION_SECONDED", 1);
assertTypeCount(explicitCounts, "VOTE_YES", 2);
assertTypeCount(explicitCounts, "VOTE_NO", 1);
assertTypeCount(explicitCounts, "ABSTAIN", 1);
assertTypeCount(explicitCounts, "ABSENT", 1);

const unnamedUnanimous = item("item-unnamed-unanimous", "Following discussion, the item was approved unanimously.");
assertEqual(extractOfficialActionsForItem(unnamedUnanimous, { meeting, body }).length, 0, "unnamed unanimous action count");
assertEqual(itemHasUnnamedVoteOutcome(unnamedUnanimous), true, "unnamed unanimous review flag");

const noisyText = item("item-noisy", "License No: 19927. Agenda item public notice was received by the department.");
assertEqual(extractOfficialActionsForItem(noisyText, { meeting, body }).length, 0, "noisy non-vote action count");
assertEqual(itemHasUnnamedVoteOutcome(noisyText), false, "noisy non-vote review flag");

const surnameAction = explicitActions.find((action) => action.official_name_raw === "Alice Smith" && action.action_type === "MOTION_MADE");
if (!surnameAction) throw new Error("Expected fixture action was not extracted.");
const uniqueBodyMatch = resolveOfficialActionMatch(
  { ...surnameAction, official_name_raw: "Smith" },
  {
    meeting,
    body,
    candidates: [
      { id: "official-smith", name: "Alice Smith", jurisdictionName: "Test City", officeTitle: "City Council Member" },
      { id: "official-smith-county", name: "Jordan Smith", jurisdictionName: "Other County", officeTitle: "County Commissioner" },
    ],
  },
);
assertEqual(uniqueBodyMatch.review_status, "approved", "unique body surname review status");
assertEqual(uniqueBodyMatch.official_id, "official-smith", "unique body surname official id");

const weakSurnameMatch = resolveOfficialActionMatch(
  { ...surnameAction, official_name_raw: "Smith" },
  {
    meeting,
    body,
    candidates: [
      { id: "official-smith-1", name: "Alice Smith", jurisdictionName: "Test City", officeTitle: "City Council Member" },
      { id: "official-smith-2", name: "Alicia Smith", jurisdictionName: "Test City", officeTitle: "City Council Member" },
    ],
  },
);
assertEqual(weakSurnameMatch.review_status, "unmatched", "ambiguous surname review status");

console.log("Official action extraction fixtures passed.");
console.log(`Extracted ${explicitActions.length} actions from explicit roll-call fixture.`);
console.log(JSON.stringify(explicitCounts, null, 2));
