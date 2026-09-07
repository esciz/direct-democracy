import assert from "node:assert/strict";
import { reconcileCrossProviderMeetingIdentities, remapMeetingReferences } from "../lib/public-meetings/cross-provider-identity";
import { mergeMeetingHistory } from "../lib/public-meetings/lifecycle";
import { meetingsRepresentSameEvent } from "../lib/public-meetings/manual-sources";
import type { PublicMeetingRecord } from "../lib/public-meetings/types";

const fixture = (fields: Partial<PublicMeetingRecord>): PublicMeetingRecord => ({
  id: "meeting", public_body_id: "body", title: "Meeting", meeting_date: "2026-09-09T16:00:00.000Z", meeting_type: "Legislative meeting",
  agenda_url: null, minutes_url: null, packet_url: null, video_url: null, transcript_url: null, meeting_summary: null,
  key_actions: [], vote_results: [], source_urls: [], source_document_count: 1, ingestion_status: "parsed", document_hashes: [],
  created_at: "2026-09-06T20:00:00.000Z", updated_at: "2026-09-06T21:00:00.000Z", ...fields,
});
const legislature = fixture({ id: "legislature", public_body_id: "body-manual-nv-legislature-nevada-legislature", title: "Economic Forum - Wednesday, September 9, 2026 9:00 AM", agenda_url: "https://www.leg.state.nv.us/App/InterimCommittee/REL/Interim2025/Meeting/35182" });
const senate = { ...legislature, id: "senate", public_body_id: "body-manual-nv-senate-nevada-senate", meeting_alias_ids: ["old-senate"], source_local_paths: ["retained-senate.html"], minutes_url: "https://www.leg.state.nv.us/minutes.pdf", key_actions: ["Retain evidence"] };
const assembly = { ...legislature, id: "assembly", public_body_id: "body-manual-nv-assembly-nevada-assembly", document_hashes: ["retained-hash"], source_urls: [legislature.agenda_url!] };
const economic = reconcileCrossProviderMeetingIdentities([senate, assembly, legislature]);
assert.equal(economic.length, 1); assert.equal(economic[0].id, legislature.id);
assert.deepEqual(economic[0].meeting_alias_ids, ["assembly", "old-senate", "senate"]);
assert.equal(economic[0].minutes_url, senate.minutes_url); assert.deepEqual(economic[0].document_hashes, ["retained-hash"]);
assert.deepEqual(economic[0].source_local_paths, ["retained-senate.html"]); assert.deepEqual(economic[0].key_actions, ["Retain evidence"]);
assert.deepEqual(reconcileCrossProviderMeetingIdentities(economic), economic, "Reconciliation is idempotent");
const refreshed = reconcileCrossProviderMeetingIdentities(mergeMeetingHistory(economic, [senate, assembly]));
assert.deepEqual(refreshed[0].meeting_alias_ids, economic[0].meeting_alias_ids, "Scoped source refresh cannot recreate aliases");
assert.equal(meetingsRepresentSameEvent(economic[0], senate), true, "Manual refresh resolves an established alias");
assert.equal(meetingsRepresentSameEvent(legislature, senate), false, "Manual pre-merge leaves new cross-provider identity to the evidence reconciler");
assert.equal(meetingsRepresentSameEvent({ ...senate, title: "Finance Committee", agenda_url: "https://www.leg.state.nv.us/calendar" }, { ...assembly, title: "Finance Committee", agenda_url: "https://www.leg.state.nv.us/calendar" }), false, "A shared calendar and generic title cannot merge separate chambers");
const manualRefreshed = mergeMeetingHistory([economic[0]], [{ ...senate, id: economic[0].id, public_body_id: economic[0].public_body_id, meeting_alias_ids: [senate.id, ...(senate.meeting_alias_ids ?? [])] }]);
assert.deepEqual([...manualRefreshed[0].meeting_alias_ids!].sort(), [...economic[0].meeting_alias_ids!].sort(), "Manual evidence updates retain previous aliases");
const aliasMap = new Map(economic.flatMap((meeting) => meeting.meeting_alias_ids!.map((id) => [id, meeting.id])));
assert.deepEqual(["assembly", "senate", "old-senate"].map((meeting_id) => aliasMap.get(meeting_id) ?? meeting_id), ["legislature", "legislature", "legislature"], "Importer can preserve item/action references");
const ledger = { records: [{ id: "senate", documentId: "document-senate", meetingId: "senate", provenance: [{ meetingId: "assembly", meetingItemId: "senate" }], proposedItem: { meeting_id: "old-senate" }, meetingIds: ["senate", "assembly", "unrelated"], meeting_alias_ids: ["senate"] }] };
const migrated = remapMeetingReferences(ledger, economic);
assert.equal(migrated.records[0].meetingId, "legislature"); assert.equal(migrated.records[0].provenance[0].meetingId, "legislature");
assert.equal(migrated.records[0].proposedItem.meeting_id, "legislature"); assert.deepEqual(migrated.records[0].meetingIds, ["legislature", "unrelated"]);
assert.equal(migrated.records[0].id, "senate"); assert.equal(migrated.records[0].documentId, "document-senate"); assert.equal(migrated.records[0].provenance[0].meetingItemId, "senate");
assert.deepEqual(migrated.records[0].meeting_alias_ids, ["senate"]); assert.equal(ledger.records[0].meetingId, "senate", "Migration does not mutate its input");
for (const changed of [
  { agenda_url: "https://www.leg.state.nv.us/App/InterimCommittee/REL/Interim2025/Meeting/35183" },
  { agenda_url: "https://example.com/App/InterimCommittee/REL/Interim2025/Meeting/35182" },
  { meeting_date: "2026-09-09T17:00:00.000Z" }, { meeting_date: "2026-09-09" }, { meeting_time_known: false },
  { title: "Senate Committee on Finance - Wednesday, September 9, 2026 9:00 AM" },
  { public_body_id: "body-nv-unrelated" }, { meeting_status: "cancelled" as const },
]) assert.equal(reconcileCrossProviderMeetingIdentities([legislature, { ...senate, ...changed }]).length, 2);
assert.equal(reconcileCrossProviderMeetingIdentities([{ ...legislature, title: "Senate Finance" }, { ...senate, title: "Assembly Finance" }]).length, 2, "Separate chambers remain separate");
assert.equal(reconcileCrossProviderMeetingIdentities([legislature, senate, { ...senate, id: "other-senate" }]).length, 3, "Ambiguous source identity remains separate");

const district = fixture({ id: "district", public_body_id: "body-carson-city-school-district-carson-city-school-district-board-of-trustees", title: "Carson City School District Board of Trustees — 2026-09-08", meeting_date: "2026-09-09T01:00:00.000Z", meeting_time_known: true, meeting_type: "School board meeting", agenda_url: "https://drive.google.com/uc?export=download&id=1hkjq-IqCTfDzJvBV7m-uysy6ZK9h8oEw", source_urls: ["https://www.carsoncityschools.com/our-district/school-board"] });
const city = fixture({ id: "city", public_body_id: "body-carson-city-board-of-supervisors-carson-city-school-board", title: "Carson City School Board - Regular meeting", meeting_date: "2026-09-09T01:00:00.000Z", agenda_url: "https://carsoncity.granicus.com/AgendaViewer.php?view_id=2&event_id=2715", source_urls: ["https://carsoncity.granicus.com/ViewPublisher.php?view_id=2"], video_url: "https://carsoncity.granicus.com/player/clip/2715" });
const schools = reconcileCrossProviderMeetingIdentities([city, district]);
assert.equal(schools.length, 1); assert.equal(schools[0].id, district.id); assert.deepEqual(schools[0].meeting_alias_ids, [city.id]);
assert.equal(schools[0].video_url, city.video_url); assert.ok(schools[0].source_urls.includes(city.source_urls[0]));
for (const changed of [{ meeting_date: "2026-09-09T02:00:00.000Z" }, { title: "Carson City School Board - Workshop" }, { public_body_id: "body-carson-city-board-of-supervisors" }, { agenda_url: "https://example.com/AgendaViewer.php?event_id=2715" }, { agenda_url: "https://carsoncity.granicus.com/ViewPublisher.php?view_id=2" }]) {
  assert.equal(reconcileCrossProviderMeetingIdentities([district, { ...city, ...changed }]).length, 2);
}
assert.equal(reconcileCrossProviderMeetingIdentities([city, { ...district, source_urls: [] }]).length, 2, "District authority required");
assert.equal(reconcileCrossProviderMeetingIdentities([city, district, { ...city, id: "city-other-event", agenda_url: "https://carsoncity.granicus.com/AgendaViewer.php?event_id=2716" }]).length, 3, "Multiple events require explicit identity resolution");

const finalsite = "meeting-clark-county-school-district-finalsite-23908695-2026-09-02";
const schoolOriginal = fixture({ id: "meeting-clark-county-school-district-diligent-1696", public_body_id: "body-clark-county-school-district-clark-county-school-district-board-of-trustees", title: "Clark County School District Board of Trustees — Board Work Session", meeting_type: "Board Work Session", meeting_date: "2026-09-02T23:00:00.000Z", meeting_time_known: true, location: "Edward A. Greer Education Center, Board Room", agenda_url: "https://ccsd.community.diligentoneplatform.com/document/68772", source_urls: ["https://ccsd.community.diligentoneplatform.com/Portal/MeetingInformation.aspx?Id=1696"], meeting_alias_ids: [finalsite], source_local_paths: ["original-agenda.html"], document_hashes: ["original-hash"] });
const schoolAmended = { ...schoolOriginal, id: "meeting-clark-county-school-district-diligent-1706", title: "Clark County School District Board of Trustees — AMENDED Board Work Session", meeting_type: "AMENDED Board Work Session", agenda_url: "https://ccsd.community.diligentoneplatform.com/document/69186", minutes_url: "https://ccsd.community.diligentoneplatform.com/document/69814", source_urls: ["https://ccsd.community.diligentoneplatform.com/Portal/MeetingInformation.aspx?Id=1706"], source_local_paths: ["amended-agenda.html"], document_hashes: ["amended-hash"] };
const amended = reconcileCrossProviderMeetingIdentities([schoolOriginal, schoolAmended]);
assert.equal(amended.length, 1); assert.equal(amended[0].id, schoolAmended.id); assert.equal(amended[0].agenda_url, schoolAmended.agenda_url); assert.equal(amended[0].minutes_url, schoolAmended.minutes_url);
assert.deepEqual(amended[0].meeting_alias_ids, [schoolOriginal.id, finalsite].sort());
assert.ok(amended[0].source_urls.includes(schoolOriginal.agenda_url!)); assert.ok(amended[0].source_urls.includes(schoolAmended.agenda_url));
assert.deepEqual(amended[0].source_local_paths, ["original-agenda.html", "amended-agenda.html"]); assert.deepEqual(amended[0].document_hashes, ["original-hash", "amended-hash"]);
const allAliases = amended.flatMap((meeting) => meeting.meeting_alias_ids ?? []);
assert.equal(new Set(allAliases).size, allAliases.length, "An original and its amendment cannot both own the Finalsite alias");
assert.equal(remapMeetingReferences({ meetingId: schoolOriginal.id }, amended).meetingId, schoolAmended.id);
assert.equal(reconcileCrossProviderMeetingIdentities([schoolOriginal, { ...schoolAmended, meeting_alias_ids: [] }]).length, 1, "Unique official amendment identity remains valid after assigning the calendar alias only once");
assert.equal(reconcileCrossProviderMeetingIdentities(mergeMeetingHistory(amended, [{ ...schoolOriginal, meeting_alias_ids: [] }])).length, 1, "Original source refresh cannot revive a superseded posting");
assert.deepEqual(reconcileCrossProviderMeetingIdentities(amended), amended);
for (const changed of [{ title: "Clark County School District Board of Trustees — AMENDED Special Meeting" }, { meeting_type: "AMENDED Special Meeting" }, { meeting_date: "2026-09-03T00:00:00.000Z" }, { meeting_time_known: false }, { location: "A different room" }, { public_body_id: "body-clark-county-school-district-another-committee" }, { agenda_url: "https://unrelated.example/document/69186" }, { source_urls: [] }]) {
  assert.equal(reconcileCrossProviderMeetingIdentities([schoolOriginal, { ...schoolAmended, ...changed }]).length, 2);
}
assert.equal(reconcileCrossProviderMeetingIdentities([schoolOriginal, schoolAmended, { ...schoolAmended, id: "meeting-clark-county-school-district-diligent-1707", source_urls: ["https://ccsd.community.diligentoneplatform.com/Portal/MeetingInformation.aspx?Id=1707"] }]).length, 3, "Multiple amendments require explicit publisher version ordering");
console.log("Cross-provider meeting identity: exact Economic Forum resources, Carson school authority/time, stable aliases, evidence and distinct-body guards passed.");
