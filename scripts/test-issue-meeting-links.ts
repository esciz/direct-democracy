import assert from "node:assert/strict";
import { getIssueLinkedMeetings } from "../lib/issues/meeting-links";

const meeting = (id: string, startsAt: string, extra = {}) => ({
  id, startsAt, aliasIds: [] as string[], meetingRecordId: id, isOfficialMeeting: true,
  relatedIssueLabels: [], title: "Board of Trustees Regular Meeting", description: "Official meeting record.", ...extra,
});
const june = meeting("june", "2026-06-09");
const august = meeting("august", "2026-08-11", { aliasIds: ["old-august"] });
const titleMatch = meeting("unlinked-title-match", "2026-09-01", { title: "Teacher salary increases" });
const community = meeting("community", "2026-09-02", { isOfficialMeeting: false });
const events = [june, august, titleMatch, community];
const evidence = { publicRelationshipEvidenceVersion: 1, relatedMeetingIds: ["june", "old-august", "community", "missing", "june"] };
assert.deepEqual(getIssueLinkedMeetings(events, "Teacher Pay", evidence).map(event => event.id), ["august", "june"], "Generic meeting titles must show validated minutes links, canonical aliases resolve, and unlinked title matches/community events stay out");
assert.deepEqual(getIssueLinkedMeetings(events, "Teacher Pay", { ...evidence, relatedMeetingIds: [] }), [], "A validated empty relationship set cannot be bypassed by title matching");
assert.deepEqual(getIssueLinkedMeetings(events, "Teacher Pay", null).map(event => event.id), ["unlinked-title-match"], "Curated issues without a generated record retain strong topic matching");
assert.deepEqual(getIssueLinkedMeetings(events, "Teacher Pay", { relatedMeetingIds: ["june"] }).map(event => event.id), ["unlinked-title-match"], "Legacy unvalidated ID lists cannot establish new minutes relationships");
assert.deepEqual(getIssueLinkedMeetings([meeting("event-wrapper", "2026-08-11", { meetingRecordId: "august" })], "Teacher Pay", { ...evidence, relatedMeetingIds: ["august"] }).map(event => event.id), ["event-wrapper"], "Event wrappers retain their canonical meeting link");
assert.deepEqual(events.map(event => event.id), ["june", "august", "unlinked-title-match", "community"], "Display sorting must not reorder the shared event collection");
console.log("Issue meeting links passed: validated minutes relationships, generic titles, aliases, strict exclusions, and curated fallback.");
