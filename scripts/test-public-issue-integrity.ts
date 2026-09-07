import assert from "node:assert/strict";
import { buildPublicIssueHubRecords } from "./generate-issue-hubs";
import { getCanonicalIssueTextOrNull, hasTeacherPaySubjectEvidence, valuesMatchIssueText, valuesStronglyMatchIssueText } from "../lib/issues/utils";

const cannabisText = "Rachel Lee explained her continuing education in the cannabis market and challenges getting funding as a social equity applicant. Chandler Cooks identified issues with securing funding from the right investors.";
assert.equal(hasTeacherPaySubjectEvidence(cannabisText), false);
assert.notEqual(getCanonicalIssueTextOrNull(cannabisText), "Teacher Pay");
assert.equal(valuesMatchIssueText("Teacher Pay", cannabisText), false);
assert.equal(valuesStronglyMatchIssueText("Teacher Pay", cannabisText), false);
for (const text of ["Education funding for a college building", "Classroom space will support enrollment growth", "Teachers completed license renewal training", "Teachers provided public comment. Cannabis businesses requested salary assistance."]) {
  assert.equal(hasTeacherPaySubjectEvidence(text), false, text);
}
for (const text of ["Raise teachers' salaries by 5 percent", "Teacher retention and recruitment plan", "Increase educator compensation", "Faculty wage negotiations", "Funding to retain teachers", "School staffing shortages", "Teacher\npay agreement"]) {
  assert.equal(hasTeacherPaySubjectEvidence(text), true, text);
  assert.equal(getCanonicalIssueTextOrNull(text), "Teacher Pay", text);
}

const meeting = { id: "meeting-one" };
const teacherText = "Approve a 5 percent increase in teachers' salaries to improve teacher retention.";
const item = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, meeting_id: meeting.id, title: "Teacher salary agreement", source_text: teacherText,
  plain_english_explanation: teacherText, policy_area: "Other", source_url: "https://example.gov/teacher-agreement.pdf",
  source_method: "automated_archive", source_document_type: "minutes", parser_status: "partially_parsed", confidence_score: 0.9,
  ...overrides,
});
const card = (id: string, topicId = "teacher-one", overrides: Record<string, unknown> = {}) => ({
  id, meeting_id: meeting.id, topic_item_id: topicId, public_title: "Teacher salary agreement", public_question: "Should the district approve a 5 percent salary increase for teachers?",
  source_title: "Teacher salary agreement", source_snippets: [teacherText], plain_language_summary: teacherText,
  policy_area: "Other", source_url: "https://example.gov/teacher-agreement.pdf", review_status: "approved", confidence_score: 0.9, outcome_status: "approved",
  ...overrides,
});
const teacherIssue = (records: ReturnType<typeof buildPublicIssueHubRecords>) => records.find(record => record.issueSlug === "teacher-pay");
const publicItem = item("teacher-one");
const visibleExcerpt = item("teacher-excerpt", { parser_status: "source_excerpt", confidence_score: 0.72 });
const blocked = buildPublicIssueHubRecords({ meetings: [meeting], meetingItems: [
  item("cannabis", { title: "I. Public Comment", source_text: cannabisText, plain_english_explanation: cannabisText, parser_status: "source_excerpt", confidence_score: 0.72 }),
  item("held", { parser_status: "needs_review", confidence_score: 0.99 }),
  item("low-confidence", { confidence_score: 0.5 }), item("no-source", { source_url: null }),
  item("fixture", { source_method: "manual_fixture" }), item("orphan", { meeting_id: "unknown-meeting" }),
  item("", {}),
], votingCards: [card("held-card", "held"), card("review-card", "cannabis", { review_status: "needs_review" })] });
assert.equal(teacherIssue(blocked), undefined, "Public Teacher Pay must not be created by the CCB false match or hidden/unresolved source records");

const excerptOnly = teacherIssue(buildPublicIssueHubRecords({ meetings: [meeting], meetingItems: [visibleExcerpt], votingCards: [card("stale-approved-excerpt-card", visibleExcerpt.id)] }))!;
assert.equal(excerptOnly.relationshipCounts.meetings, 1);
assert.equal(excerptOnly.relationshipCounts.agendaItems, 1);
assert.equal(excerptOnly.relationshipCounts.votingCards, 0, "A public source excerpt is context, not approval of an outcome/question");
assert.equal(excerptOnly.relationshipCounts.votes, 0);

const counted = teacherIssue(buildPublicIssueHubRecords({ meetings: [meeting], meetingItems: [publicItem, publicItem, item("teacher-two")], votingCards: [
  card("card-one"), card("card-one"), card("card-two"),
  card("held-card", "teacher-two", { review_status: "needs_review", confidence_score: 0.99 }),
  card("generic-card", "teacher-two", { public_question: "Should the board approve motion carried?" }),
] }))!;
assert.equal(counted.publicRelationshipEvidenceVersion, 1);
assert.deepEqual({ meetings: counted.relationshipCounts.meetings, agendaItems: counted.relationshipCounts.agendaItems, votingCards: counted.relationshipCounts.votingCards, votes: counted.relationshipCounts.votes, documents: counted.relationshipCounts.sourceDocuments },
  { meetings: 1, agendaItems: 2, votingCards: 2, votes: 1, documents: 1 }, "Cards and items must share unique source/entity counts, never count the same topic twice");
assert.deepEqual(new Set(counted.relatedAgendaItemIds), new Set(["teacher-one", "teacher-two"]));
assert.deepEqual(counted.relatedVotingCardIds, ["card-one", "card-two"]);

const fabricated = buildPublicIssueHubRecords({ meetings: [meeting], meetingItems: [item("cannabis", { title: "Public Comment", source_text: cannabisText, plain_english_explanation: "Teacher salary agreement", policy_area: "Teacher Pay" })],
  votingCards: [card("fabricated-question", "cannabis", { source_title: "Public Comment", source_snippets: [cannabisText], policy_area: "Teacher Pay" })] });
assert.equal(teacherIssue(fabricated), undefined, "Generated Teacher Pay copy and labels cannot substitute for source-level evidence");

const many = Array.from({ length: 45 }, (_, index) => item(`topic-${index}`, { meeting_id: `meeting-${index}`, source_url: `https://example.gov/minutes-${index}.pdf` }));
const largeIssue = teacherIssue(buildPublicIssueHubRecords({ meetings: many.map(row => ({ id: row.meeting_id })), meetingItems: many, votingCards: [] }))!;
assert.equal(largeIssue.relatedMeetingIds.length, 40);
assert.equal(largeIssue.relatedAgendaItemIds.length, 40);
assert.equal(largeIssue.relationshipCounts.meetings, 45);
assert.equal(largeIssue.relationshipCounts.agendaItems, 45);
assert.equal(largeIssue.relationshipCounts.sourceDocuments, 45, "Counts use complete unique sets before the display link cap");
console.log("Public issue integrity passed: teacher subject evidence, source-based semantics, public eligibility, held outcomes, unique counts, and link limits. No generated files written.");
