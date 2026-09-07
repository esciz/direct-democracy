import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "dd-meeting-runtime-"));
const repositoryRoot = process.cwd();
const timestamp = "2026-09-06T18:00:00Z";
const item = {
  id: "item-public", meeting_id: "meeting-public", item_number: "4", title: "Park access proposal", description: "Review park access.",
  one_sentence_summary: "Discuss park access.", plain_english_explanation: "Review the proposal and recorded response.", why_it_matters: "Residents use the park.",
  affected_groups: ["Residents"], financial_impact: null, vote_outcome: null, related_official_names: ["Example Member"], related_organization_names: [],
  agenda_section: "Discussion", item_type: "action", staff_recommendation: null, fiscal_impact_summary: null, department_names: ["Parks"],
  policy_area: "Other", source_page: 2, source_text: "Official source excerpt. ".repeat(200), source_url: "https://example.gov/agenda.pdf",
  source_method: "automated_archive", source_local_path: "/private/worker/document.pdf", parser_status: "partially_parsed", roll_call_status: null,
  source_document_hash: "example-hash", cached_text_path: "/private/worker/text.txt", confidence_score: 0.9,
};
const card = {
  id: "card-public", generation_key: "generation-public", meeting_id: item.meeting_id, topic_item_id: item.id,
  jurisdiction: "Nevada", body_name: "Example Commission", meeting_date: "2026-09-06", meeting_status: "upcoming", policy_area: "Other",
  title: "Park access", question_text: "Should park access change?", plain_language_summary: "Consider park access.",
  source_event_href: "/events/meeting-public", source_topic_href: "/issues/park-access", source_url: item.source_url,
  source_snippets: [item.source_text], financial_impact: null, affected_groups: ["Residents"], outcome_status: "pending", outcome_text: null,
  review_status: "approved", confidence_score: 0.9, related_official_actions: [], needs_roll_call_review: false, created_at: timestamp, updated_at: timestamp,
};
const inputs = {
  bodies: [],
  meetings: [{ id: item.meeting_id, public_body_id: "body-public", meeting_date: "2026-09-06", meeting_type: "Regular", title: "Example meeting", agenda_url: item.source_url,
    minutes_url: null, packet_url: null, video_url: null, transcript_url: null, meeting_summary: null, key_actions: [], vote_results: [], source_document_count: 1,
    source_urls: [item.source_url], source_method: "automated_archive", ingestion_status: "parsed", document_hashes: [], created_at: timestamp, updated_at: timestamp }],
  items: [item, { ...item, id: "item-needs-review", parser_status: "needs_review" }, { ...item, id: "item-low-confidence", confidence_score: 0.5 }],
  votingCards: [card, { ...card, id: "card-needs-review", review_status: "needs_review" }],
  officialActions: [],
};

try {
  writeFileSync(path.join(fixtureRoot, "inputs.json"), JSON.stringify(inputs));
  const output = execFileSync(process.execPath, ["--import", "tsx", path.join(repositoryRoot, "scripts/lib/check-public-meeting-runtime-fixture.cjs"), fixtureRoot], { cwd: repositoryRoot, encoding: "utf8", timeout: 30_000 });
  assert.match(output, /runtime parity passed/);
  console.log("Meeting runtime parity passed: deployed topics/questions and graph links survive without full files; public gates and full admin queues are preserved.");
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
