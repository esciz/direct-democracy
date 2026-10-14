import assert from "node:assert/strict";
import { resolveReviewedMeetingDocumentAssociations, type ReviewedNativeDocumentEvidence } from "../lib/public-meetings/reviewed-document-associations";
import { applyReviewedDocumentItemAssociation } from "../lib/public-meetings/reviewed-document-association-store";
import { cachedTopicNeedsEvidenceReview } from "../lib/public-meetings/evidence-review";
import { extractOfficialActionsForItem } from "../lib/public-meetings/official-actions";
import type { PublicMeetingItemRecord } from "../lib/public-meetings/types";

const sourceUrl = "https://carsoncity.granicus.com/MinutesViewer.php?view_id=2&clip_id=2908&doc_id=8076bd7d-855a-11f1-bb61-005056a89546";
const sourceHash = "df2d876eb90fbc031c4bb82b70cc9beb7bdff77cf2f22d17b3f0b4f193b8b962";
const displacedUrl = "https://carsoncity.granicus.com/MinutesViewer.php?view_id=2&clip_id=2869&doc_id=dd7929f4-45a8-11f1-bb28-005056a89546";
const bodyId = "body-carson-city-board-of-supervisors-9-1-1-surcharge-advisory-committee";
const april = { id: "meeting-april-21", public_body_id: bodyId, meeting_date: "2026-04-21T15:30:00.000Z", minutes_url: null };
const july = { id: "meeting-july-21", public_body_id: bodyId, meeting_date: "2026-07-21T15:30:00.000Z", minutes_url: sourceUrl };
const nativeText = `Minutes
of the Meeting of the
Carson City
9-1-1 SURCHARGE ADVISORY COMMITTEE
April 21, 2026
The Carson City 9-1-1 Surcharge Advisory Committee held a public meeting on April 21, 2026,
beginning at 8:30 a.m. in the meeting room of Fire Station 51, 777 S. Stewart Street, Carson City.
1. Call to Order
Chair Ryan McIntosh called the meeting to order at 8:42 am.
7. For Discussion Only: Next Meeting Date – July 21, 2026`;
const evidence: ReviewedNativeDocumentEvidence = {
  documentId: "document-exact-minutes",
  meetingId: july.id,
  documentType: "minutes",
  sourceUrl,
  sourceContentHash: sourceHash,
  extractionMethod: "native_text",
  extractionQuality: "medium",
  text: nativeText,
};
const input = { meetings: [july, april], nativeEvidence: [evidence] };
const before = structuredClone(input);
const resolved = resolveReviewedMeetingDocumentAssociations(input);
assert.deepEqual(resolved.meetingIdBySourceUrl, { [sourceUrl]: april.id });
assert.deepEqual(resolved.associations, [{ sourceUrl, sourceHash, documentId: evidence.documentId, fromMeetingId: july.id, targetMeetingId: april.id }]);
assert.deepEqual(resolved.pendingReview, []);
assert.deepEqual(input, before, "The pure correction must leave July's date and both original calendar records intact");
assert.deepEqual(resolveReviewedMeetingDocumentAssociations(input), resolved, "Ownership resolution is repeatable");
assert.deepEqual(resolveReviewedMeetingDocumentAssociations({ meetings: input.meetings, nativeEvidence: [{ ...evidence, meetingId: april.id }] }).meetingIdBySourceUrl, { [sourceUrl]: april.id }, "Reprocessing an already reassociated document keeps its reviewed owner");

function held(next: Parameters<typeof resolveReviewedMeetingDocumentAssociations>[0], reason: string) {
  const result = resolveReviewedMeetingDocumentAssociations(next);
  assert.deepEqual(result.meetingIdBySourceUrl, {}, reason);
  assert.deepEqual(result.associations, [], reason);
  assert.equal(result.pendingReview[0]?.reason, reason);
}
held({ ...input, meetings: [july] }, "target_meeting_missing");
held({ ...input, meetings: [...input.meetings, { ...april, id: "second-april-meeting" }] }, "target_meeting_ambiguous");
held({ ...input, meetings: [july, { ...april, public_body_id: "another-body" }] }, "target_meeting_missing");
held({ ...input, meetings: [{ ...july, public_body_id: "another-body" }, april] }, "source_body_conflict");
held({ ...input, nativeEvidence: [{ ...evidence, meetingId: "unknown-calendar-record" }] }, "source_meeting_unconfirmed");
held({ ...input, nativeEvidence: [{ ...evidence, sourceContentHash: "a".repeat(64) }] }, "source_hash_changed");
held({ ...input, nativeEvidence: [{ ...evidence, sourceContentHash: null }] }, "source_hash_changed");
held({ ...input, nativeEvidence: [evidence, { ...evidence, documentId: "changed-version", sourceContentHash: "a".repeat(64) }] }, "source_hash_changed");
held({ ...input, nativeEvidence: [{ ...evidence, text: nativeText.replaceAll("April 21, 2026", "July 21, 2026") }] }, "reviewed_header_mismatch");
held({ ...input, nativeEvidence: [{ ...evidence, text: `July 21 agenda approving prior minutes:\n${nativeText}` }] }, "reviewed_header_mismatch");
held({ ...input, nativeEvidence: [{ ...evidence, text: nativeText.replace("9-1-1 SURCHARGE ADVISORY COMMITTEE", "BOARD OF SUPERVISORS") }] }, "reviewed_header_mismatch");
for (const change of [{ extractionMethod: "ocr_text" }, { extractionQuality: "low" }, { documentType: "agenda" }]) {
  held({ ...input, nativeEvidence: [{ ...evidence, ...change }] }, "native_minutes_evidence_required");
}
held({ ...input, meetings: [july, { ...april, meeting_date: "2026-04-21T15:30:00" }] }, "target_meeting_missing");
assert.deepEqual(resolveReviewedMeetingDocumentAssociations({ ...input, meetings: [july, { ...april, meeting_date: "2026-04-22T01:00:00Z" }] }).meetingIdBySourceUrl, { [sourceUrl]: april.id }, "Target date is the Nevada local day, not the UTC calendar day");
assert.deepEqual(resolveReviewedMeetingDocumentAssociations({ ...input, meetings: [july, { ...april, meeting_date: "2026-04-21" }] }).meetingIdBySourceUrl, { [sourceUrl]: april.id });

const unrelated = { ...evidence, documentId: "index-page", sourceUrl: "https://carsoncity.granicus.com/ViewPublisher.php?view_id=2", documentType: "supporting_document" };
assert.deepEqual(resolveReviewedMeetingDocumentAssociations({ ...input, nativeEvidence: [unrelated] }), { meetingIdBySourceUrl: {}, associations: [], pendingReview: [] }, "Unreviewed URLs and calendar pages are unaffected");
assert.deepEqual(resolveReviewedMeetingDocumentAssociations({ ...input, nativeEvidence: [...input.nativeEvidence, unrelated] }), resolved);
assert.deepEqual(resolveReviewedMeetingDocumentAssociations({ ...input, nativeEvidence: [evidence, evidence] }), resolved, "Duplicate ledger rows do not duplicate corrections");

const displaced = { ...evidence, documentId: "displaced-january-minutes", meetingId: april.id, sourceUrl: displacedUrl, sourceContentHash: "6d103d8c87916043c1f2f990c600493aae22d119cc1395265dbf03cebc9b9194", text: nativeText.replaceAll("April 21, 2026", "January 27, 2026") };
const replacement = resolveReviewedMeetingDocumentAssociations({ meetings: [july, { ...april, minutes_url: displacedUrl }], nativeEvidence: [evidence, displaced] });
assert.deepEqual(replacement.meetingIdBySourceUrl, { [sourceUrl]: april.id });
assert.deepEqual(replacement.pendingReview, [{ sourceUrl: displacedUrl, reason: "reviewed_association_displaced_unverified_minutes", documentIds: [displaced.documentId], meetingIds: [april.id] }], "Replacing a mismatched primary link must flag its old evidence for quarantine, not silently call it April minutes");
assert.equal(Object.hasOwn(replacement.meetingIdBySourceUrl, displacedUrl), false, "No January meeting is guessed for the displaced document");
assert.equal(resolveReviewedMeetingDocumentAssociations({ meetings: [july, { ...april, minutes_url: sourceUrl }], nativeEvidence: [evidence] }).pendingReview.length, 0);
const legacyItem = { id: "legacy-topic", meeting_id: april.id, source_url: displacedUrl, source_text: "Motion by Member Test approved unanimously 7-0.", source_document_hash: displaced.sourceContentHash,
  source_method: "manual_cache", parser_status: "partially_parsed", confidence_score: 0.99, vote_outcome: "approved unanimously", related_official_names: ["Member Test"] } as PublicMeetingItemRecord;
const heldItem = applyReviewedDocumentItemAssociation(legacyItem, undefined, true);
assert.equal(heldItem.id, legacyItem.id);
assert.equal(heldItem.meeting_id, legacyItem.meeting_id);
assert.equal(heldItem.source_url, legacyItem.source_url);
assert.equal(heldItem.source_text, legacyItem.source_text);
assert.equal(heldItem.source_document_hash, legacyItem.source_document_hash);
assert.equal(heldItem.vote_outcome, null);
assert.deepEqual(heldItem.related_official_names, []);
assert.equal(heldItem.confidence_score, 0.64);
const staleHighConfidenceItem = { ...heldItem, confidence_score: 0.99, vote_outcome: "approved unanimously" };
assert.equal(cachedTopicNeedsEvidenceReview(staleHighConfidenceItem), true, "The exact guard used by vote and action-result generators must hold even stale high-confidence outcomes");
assert.deepEqual(extractOfficialActionsForItem(staleHighConfidenceItem, undefined as never), [], "Official attribution must stop at the held-evidence guard before reading stale outcome/context");
console.log("Reviewed minutes associations passed: exact URL/hash/native header/body, unique existing owner, immutable calendar dates, ambiguity and changed-byte holds, and displaced-evidence review. No database or generated-data writes.");
