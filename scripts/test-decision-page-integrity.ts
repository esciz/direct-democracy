import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { getPublicMeetingItems } from "../lib/public-meetings/public-record-eligibility";
import { getPublicMeetingVotingCards } from "../lib/public-meetings/voting-cards";
import { cachedTopicNeedsEvidenceReview } from "../lib/public-meetings/evidence-review";
import type { DecisionCardRecord } from "../lib/civic/decision-pages";

function decision(overrides: Partial<DecisionCardRecord> = {}): DecisionCardRecord {
  return {
    id: "decision-reviewed-contract", sourceVotingCardId: "card-reviewed-contract",
    agendaItemId: "topic-reviewed-contract", meetingId: "meeting-contract",
    title: "Teacher salary agreement", summary: "Approve the teacher salary agreement.",
    whyItMatters: "The agreement determines teacher compensation.", affectedGroups: ["Teachers"],
    jurisdiction: "School District", meeting: { id: "meeting-contract", title: "Board meeting", date: "2026-08-20", bodyName: "School Board", href: "/events/meeting-contract" },
    decisionType: "contract", voteOutcome: "approved",
    voteCount: { yes: 1, no: 0, abstain: 0, absent: 0, unknown: 0, totalKnown: 1, display: "1–0" },
    financialImpact: { estimatedAmount: null, description: null, raw: null },
    relatedIssues: [], relatedOfficials: [],
    sourceReferences: [{ label: "Minutes", url: "https://example.gov/minutes.pdf", path: null, snippet: "Approve the salary agreement." }],
    confidence: 0.92, reviewStatus: "approved", generatedAt: "2026-09-07T00:00:00Z",
    ...overrides,
  };
}

const publicTopic = {
  id: "topic-reviewed-contract", meeting_id: "meeting-contract", title: "Teacher salary agreement",
  source_text: "Approve the teacher salary agreement.", source_url: "https://example.gov/minutes.pdf",
  source_method: "automated_archive", source_document_type: "minutes",
  parser_status: "partially_parsed", confidence_score: 0.92,
};
const publicCard = {
  id: "card-reviewed-contract", topic_item_id: publicTopic.id, meeting_id: publicTopic.meeting_id,
  review_status: "approved", confidence_score: 0.92, source_url: publicTopic.source_url,
  public_question: "Should the district approve the teacher salary agreement?",
};

function isolatedReader() {
  const artifacts = new Map<string, unknown>();
  const reads: string[] = [];
  const allowed = new Set(["voting-cards.json", "voting-cards-runtime.json", "public-meeting-items-runtime.json", "officials-runtime.json", "public-meeting-votes.json", "public-meeting-action-results.json", "projects-runtime.json", "issues-runtime.json"]);
  const sourcePath = path.resolve("lib/civic/decision-pages.ts");
  const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    fileName: sourcePath,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  type Reader = Pick<typeof import("../lib/civic/decision-pages"), "getDecisionCards" | "getDecisionById" | "getDecisionPageData">;
  const module = { exports: {} as Reader };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, process: { cwd: () => process.cwd() },
    require(name: string) {
      if (name === "server-only") return {};
      if (name === "node:path") return path;
      if (name === "@/lib/public-meetings/public-record-eligibility") return { getPublicMeetingItems };
      if (name === "@/lib/public-meetings/voting-cards") return { getPublicMeetingVotingCards };
      if (name === "@/lib/public-meetings/evidence-review") return { cachedTopicNeedsEvidenceReview };
      if (name === "@/lib/dataops/packed-runtime") return {
        civicJsonPath(file: string) {
          const filename = path.basename(file);
          assert.ok(allowed.has(filename), `Unexpected artifact lookup: ${filename}`);
          assert.equal(file, path.resolve("data/generated", filename));
          return artifacts.has(filename) ? file : null;
        },
        async readCivicJson(file: string) {
          const filename = path.basename(file);
          assert.ok(allowed.has(filename), `Unexpected artifact read: ${filename}`);
          reads.push(filename);
          return structuredClone(artifacts.get(filename));
        },
      };
      throw new Error(`Unstubbed decision reader dependency: ${name}`);
    },
  }, { filename: sourcePath });
  return {
    reader: module.exports, reads,
    set(filename: string, value: unknown) { assert.ok(allowed.has(filename)); artifacts.set(filename, value); },
    remove(filename: string) { artifacts.delete(filename); },
    reset() {
      artifacts.clear();
      artifacts.set("voting-cards.json", { records: [decision()] });
      artifacts.set("voting-cards-runtime.json", [publicCard]);
      artifacts.set("public-meeting-items-runtime.json", [publicTopic]);
    },
  };
}

function vote(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, meeting_item_id: publicTopic.id, meeting_id: publicTopic.meeting_id,
    official_id: "official-reviewed", official_name: "Reviewed Official", vote: "yes", action_type: "VOTE_YES",
    evidenceType: "named_vote", source_snippet: "Reviewed Official voted yes on the agreement.", vote_text: null,
    confidence_score: 0.92, source_url: publicTopic.source_url, needs_roll_call_review: false, review_status: "parsed_named_vote",
    motion_made_by: null, seconded_by: null,
    ...overrides,
  };
}

function actionResult(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, meetingId: publicTopic.meeting_id, meetingItemId: publicTopic.id,
    actionTitle: "Teacher salary agreement", motionText: "Approve the agreement", mover: "Reviewed Official", seconder: null,
    outcome: "approved", voteCount: "1–0", sourceSnippet: "The agreement was approved.",
    sourceUrl: publicTopic.source_url, sourcePath: null, confidence: 0.92, needsReview: false, reviewReason: null,
    ...overrides,
  };
}

function officialAction(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, official_id: "official-reviewed", official_name_raw: "Reviewed Official",
    meeting_id: publicTopic.meeting_id, topic_item_id: publicTopic.id,
    action_type: "VOTE_YES", action_text: "Reviewed Official voted yes on the agreement.",
    source_url: publicTopic.source_url, confidence: 0.92, match_confidence: 0.95,
    review_status: "approved", needs_review: false,
    ...overrides,
  };
}

async function main() {
  const fixture = isolatedReader();
  fixture.reset();
  assert.deepEqual(structuredClone(await fixture.reader.getDecisionCards()), [decision()]);
  assert.deepEqual(structuredClone(await fixture.reader.getDecisionById(decision().id)), decision());
  fixture.set("voting-cards.json", { records: [decision({ reviewStatus: "ready" })] });
  assert.equal((await fixture.reader.getDecisionCards()).length, 1, "A ready decision with currently approved public source evidence survives");

  const rejected: Array<{ label: string; decision?: Partial<DecisionCardRecord>; card?: Record<string, unknown>; topic?: Record<string, unknown> }> = [
    { label: "held decision", decision: { reviewStatus: "needs_review", confidence: 0.99 } },
    { label: "low-confidence decision", decision: { confidence: 0.79 } },
    { label: "missing decision confidence", decision: { confidence: undefined } },
    { label: "invalid decision confidence", decision: { confidence: Number.NaN } },
    { label: "missing source card", decision: { sourceVotingCardId: undefined } },
    { label: "forged source card ID", decision: { sourceVotingCardId: "unrelated-card" } },
    { label: "wrong decision topic", decision: { agendaItemId: "different-topic" } },
    { label: "wrong decision meeting", decision: { meetingId: "different-meeting" } },
    { label: "held source card", card: { review_status: "needs_review", confidence_score: 0.99 } },
    { label: "low-confidence source card", card: { confidence_score: 0.79 } },
    { label: "generic motion source card", card: { public_question: "Should the board approve motion carried?" } },
    { label: "wrong source card topic", card: { topic_item_id: "different-topic" } },
    { label: "wrong source card meeting", card: { meeting_id: "different-meeting" } },
    { label: "held source topic", topic: { parser_status: "needs_review", confidence_score: 0.99 } },
    { label: "source excerpt is not outcome approval", topic: { parser_status: "source_excerpt", confidence_score: 0.99 } },
    { label: "topic belongs to another meeting", topic: { meeting_id: "different-meeting" } },
    { label: "uncited source topic", topic: { source_url: null } },
    { label: "low-confidence source topic", topic: { confidence_score: 0.5 } },
    { label: "fixture source topic", topic: { source_method: "manual_fixture" } },
  ];
  for (const scenario of rejected) {
    fixture.reset();
    fixture.set("voting-cards.json", { records: [decision(scenario.decision)] });
    fixture.set("voting-cards-runtime.json", [{ ...publicCard, ...scenario.card }]);
    fixture.set("public-meeting-items-runtime.json", [{ ...publicTopic, ...scenario.topic }]);
    assert.equal((await fixture.reader.getDecisionCards()).length, 0, `${scenario.label}: list must hold the decision`);
    assert.equal(await fixture.reader.getDecisionById(decision().id), null, `${scenario.label}: ID lookup must not bypass the list guard`);
    assert.equal(await fixture.reader.getDecisionPageData(decision().id), null, `${scenario.label}: detail must not expose attributions`);
  }
  for (const filename of ["voting-cards-runtime.json", "public-meeting-items-runtime.json"]) {
    fixture.reset(); fixture.remove(filename);
    assert.equal((await fixture.reader.getDecisionCards()).length, 0, `Missing ${filename} cannot authorize a stale decision`);
  }

  fixture.reset();
  const legitimateVote = vote("vote-exact-topic", { official_name: "Generated unofficial alias", motion_made_by: "Unrelated Mover", seconded_by: "Unrelated Seconder" });
  const legitimateMotion = vote("motion-exact-topic", { vote: "unknown", action_type: "MOTION_MADE", evidenceType: "motion_mover", review_status: "parsed_motion_metadata", motion_made_by: "Reviewed Official", seconded_by: "Reviewed Seconder" });
  fixture.set("officials-runtime.json", [
    officialAction("approved-named-vote"),
    officialAction("approved-mover", { action_type: "MOTION_MADE" }),
    officialAction("approved-seconder", { action_type: "MOTION_SECONDED", official_id: "official-reviewed-seconder", official_name_raw: "Reviewed Seconder" }),
    officialAction("held-action", { official_id: "official-held", review_status: "needs_review", confidence: 0.99 }),
    officialAction("held-flag-action", { official_id: "official-flagged", needs_review: true }),
    officialAction("wrong-meeting-action", { official_id: "official-wrong-meeting", meeting_id: "unrelated-meeting" }),
    officialAction("wrong-topic-action", { official_id: "official-wrong-topic", topic_item_id: "unrelated-topic" }),
    officialAction("low-confidence-action", { official_id: "official-low-confidence", confidence: 0.5, match_confidence: 0.5 }),
    officialAction("uncited-action", { official_id: "official-uncited", source_url: null }),
  ]);
  fixture.set("public-meeting-votes.json", [
    legitimateVote, legitimateMotion,
    vote("unrelated-topic-same-meeting", { meeting_item_id: "unrelated-topic", official_name: "Unrelated person" }),
    vote("exact-topic-wrong-meeting", { meeting_id: "unrelated-meeting" }),
    vote("held-roll-call", { needs_roll_call_review: true, confidence_score: 0.99 }),
    vote("held-named-vote", { review_status: "needs_review", confidence_score: 0.99 }),
    vote("held-motion", { vote: "unknown", action_type: "MOTION_MADE", review_status: "needs_review" }),
    vote("unmatched-identity", { official_id: null }),
    vote("unapproved-identity", { official_id: "official-without-reviewed-action" }),
    vote("wrong-action-type", { vote: "no", action_type: "VOTE_NO" }),
    vote("vote-action-semantic-mismatch", { vote: "no", action_type: "VOTE_YES" }),
    vote("motion-claims-named-vote", { vote: "yes", action_type: "MOTION_MADE", review_status: "parsed_motion_metadata" }),
    vote("rejected-vote", { review_status: "rejected" }),
    vote("wrong-source-document", { source_url: "https://example.gov/unrelated-minutes.pdf" }),
    ...["held", "flagged", "wrong-meeting", "wrong-topic", "low-confidence", "uncited"].map(suffix => vote(`untrusted-action-${suffix}`, { official_id: `official-${suffix}` })),
  ]);
  const reviewedResult = actionResult("result-exact-topic");
  fixture.set("public-meeting-action-results.json", { records: [
    actionResult("wrong-meeting-result", { meetingId: "unrelated-meeting" }),
    actionResult("wrong-topic-result", { meetingItemId: "unrelated-topic" }),
    actionResult("held-result", { needsReview: true, confidence: 0.99 }), reviewedResult,
  ] });
  const page = await fixture.reader.getDecisionPageData(decision().id);
  assert.ok(page);
  const canonicalVote = { ...legitimateVote, official_name: "Reviewed Official", motion_made_by: null, seconded_by: null };
  assert.deepEqual(structuredClone(page.votes), [canonicalVote, legitimateMotion], "Only exact topic AND meeting votes with corresponding approved official actions are exposed; names come from the approved action");
  assert.deepEqual(structuredClone(page.namedVotes), [canonicalVote], "Another topic's names or an unapproved identity cannot appear under this decision");
  assert.deepEqual(structuredClone(page.motionMetadata), [legitimateMotion], "Held or unrelated movers cannot appear under this decision");
  assert.deepEqual(structuredClone(page.actionResult), reviewedResult, "The first stale/held action result cannot mask the legitimate exact result");
  fixture.set("public-meeting-action-results.json", [actionResult("held-only-result", { needsReview: true }), actionResult("wrong-meeting-only-result", { meetingId: "unrelated-meeting" })]);
  assert.equal((await fixture.reader.getDecisionPageData(decision().id))?.actionResult, null, "No reviewed exact action result means no public outcome attribution");
  fixture.set("public-meeting-action-results.json", [actionResult("unmatched-result-names", { mover: "Unreviewed Mover", seconder: "Unreviewed Seconder" })]);
  const unnamedResult = (await fixture.reader.getDecisionPageData(decision().id))?.actionResult;
  assert.equal(unnamedResult?.outcome, "approved", "A reviewed aggregate outcome survives independently of named attribution");
  assert.equal(unnamedResult?.mover, null);
  assert.equal(unnamedResult?.seconder, null);
  fixture.remove("officials-runtime.json");
  const noApprovedOfficials = await fixture.reader.getDecisionPageData(decision().id);
  assert.ok(noApprovedOfficials);
  assert.equal(noApprovedOfficials.namedVotes.length, 0, "Parsed names alone cannot replace approved official identity evidence");
  assert.equal(noApprovedOfficials.motionMetadata.length, 0);
  fixture.set("voting-cards.json", { records: [decision({ relatedOfficials: [{ id: "unapproved-official", name: "Fabricated Name", actionType: "VOTE_YES", actionText: "Unsupported attribution" }] })] });
  assert.equal((await fixture.reader.getDecisionCards())[0]?.relatedOfficials.length, 0, "Stale decision payloads cannot retain unapproved official attribution");
  fixture.set("officials-runtime.json", [officialAction("approved-related-official")]);
  const relatedOfficials = (await fixture.reader.getDecisionCards())[0]?.relatedOfficials;
  assert.equal(relatedOfficials?.length, 1, "Exact-topic approved official actions supply current related officials");
  assert.equal(relatedOfficials?.[0]?.id, "official-reviewed");
  assert.equal(relatedOfficials?.[0]?.name, "Reviewed Official");
  assert.ok(fixture.reads.includes("public-meeting-votes.json"), "The actual asynchronous detail reader was exercised");
  assert.ok(fixture.reads.every(filename => !["public-meeting-items.json", "public-meeting-voting-cards.json"].includes(filename)), "Eligibility uses compact public evidence without loading worker datasets");
  console.log("Decision page integrity passed: public list/ID evidence gates, held topics/excerpts, forged identities, exact-topic vote joins, reviewed action results, and legitimate decisions. No generated files or database writes.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
