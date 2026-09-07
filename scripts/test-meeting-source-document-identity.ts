import assert from "node:assert/strict";
import { reconcileSourceDocumentIdentities, type SourceDocumentRecord } from "./discover-public-meeting-source-documents";

const record = (overrides: Partial<SourceDocumentRecord> = {}): SourceDocumentRecord => ({
  id: "meeting-source-document-same-bytes", meetingId: "meeting-a", meetingItemIds: ["item-a"], bodyId: "body-a", organizationId: "provider-a", jurisdiction: "Nevada",
  documentType: "minutes", sourceUrl: null, sourcePath: "data/manual-sources/minutes-a.pdf", sourceHost: null, sourcePlatform: "civic_website",
  cached: true, cachedPath: "data/manual-sources/minutes-a.pdf", contentHash: "same-bytes", sizeBytes: 2000,
  discoveredAt: "2026-09-07T00:00:00Z", retrievalStatus: "local_cached", priorityBody: true,
  provenance: [{ meetingId: "meeting-a", meetingItemId: "item-a", field: "item_source_local_path" }], ...overrides,
});
const first = record();
const second = record({ sourcePath: "data/generated/second-copy.pdf", cachedPath: "data/generated/second-copy.pdf", meetingItemIds: ["item-b", "item-a"], provenance: [{ meetingId: "meeting-a", meetingItemId: "item-b", field: "item_source_local_path" }] });
const unchanged = structuredClone([first, second]);
const merged = reconcileSourceDocumentIdentities([first, second]);
assert.equal(merged.length, 1);
assert.equal(merged[0].id, first.id);
assert.deepEqual(merged[0].meetingItemIds, ["item-a", "item-b"]);
assert.deepEqual(merged[0].sourcePaths, [first.sourcePath, second.sourcePath]);
assert.equal(merged[0].provenance.length, 2);
assert.deepEqual([first, second], unchanged, "Source identity reconciliation must not mutate retained evidence");

const otherOwner = record({ meetingId: "meeting-b", bodyId: "body-b", meetingItemIds: ["item-other"], sourcePath: "data/generated/other-meeting.pdf", cachedPath: "data/generated/other-meeting.pdf", provenance: [{ meetingId: "meeting-b", meetingItemId: "item-other", field: "source_local_paths" }] });
const textOwner = { documentId: first.id, meetingId: otherOwner.meetingId, documentType: "minutes", sourceContentHash: "same-bytes", sourcePath: otherOwner.sourcePath };
const separate = reconcileSourceDocumentIdentities([first, second, otherOwner], [], [textOwner]);
assert.equal(separate.length, 2, "Shared bytes cannot collapse two meeting owners");
assert.equal(new Set(separate.map(row => row.id)).size, 2);
assert.equal(separate.find(row => row.meetingId === "meeting-b")!.id, first.id, "The existing text-ledger owner retains its ID");
const newScoped = separate.find(row => row.meetingId === "meeting-a")!;
assert.notEqual(newScoped.id, first.id);
assert.equal(newScoped.cachedPath, first.cachedPath, "A new scoped ID remains directly cache-readable without a cache-index entry");
assert.equal(newScoped.retrievalStatus, "local_cached");
assert.deepEqual(newScoped.meetingItemIds, ["item-a", "item-b"]);
assert.deepEqual(separate.find(row => row.meetingId === "meeting-b")!.meetingItemIds, ["item-other"]);
assert.deepEqual(reconcileSourceDocumentIdentities([otherOwner, second, first], separate, [textOwner]).map(row => [row.meetingId, row.id]).sort(), separate.map(row => [row.meetingId, row.id]).sort(), "Assigned IDs remain stable across input ordering");
assert.equal(reconcileSourceDocumentIdentities([first], separate)[0].id, newScoped.id, "Removing a colliding sibling cannot repurpose its old shared ID");
assert.deepEqual(reconcileSourceDocumentIdentities(separate, separate, [textOwner]), separate, "Reconciliation is idempotent");
const previouslyAssigned = reconcileSourceDocumentIdentities([otherOwner]);
const newlyColliding = reconcileSourceDocumentIdentities([first, otherOwner], previouslyAssigned);
assert.equal(newlyColliding.find(row => row.meetingId === otherOwner.meetingId)!.id, otherOwner.id, "A newly discovered lexically earlier sibling cannot steal an established ID before text extraction");
assert.notEqual(newlyColliding.find(row => row.meetingId === first.meetingId)!.id, otherOwner.id);

const alternateRole = record({ documentType: "supporting_document" });
const roles = reconcileSourceDocumentIdentities([first, alternateRole], [], [{ ...textOwner, meetingId: first.meetingId, sourcePath: first.sourcePath }]);
assert.equal(roles.length, 2, "A shared file may have distinct document roles without losing its minutes association");
assert.equal(roles.find(row => row.documentType === "minutes")!.id, first.id);
assert.equal(new Set(roles.map(row => row.id)).size, 2);

const truncatedId = "meeting-source-document-path-data-manual-sources-public-meetings-nv-cannabis-public-meet";
const missing = Array.from({ length: 8 }, (_, index) => record({ id: truncatedId, meetingId: `ccb-${index}`, contentHash: null, sizeBytes: null, cached: false, cachedPath: null,
  retrievalStatus: "unreadable_local", sourcePath: `data/manual-sources/public-meetings/nv-cannabis-public-meetings/minutes/2026-${index + 1}-minutes.pdf`,
  meetingItemIds: [`ccb-item-${index}`], provenance: [{ meetingId: `ccb-${index}`, meetingItemId: `ccb-item-${index}`, field: "source_local_paths" }] }));
const retainedMissingOwner = { documentId: truncatedId, meetingId: missing[5].meetingId, documentType: "minutes", sourcePath: missing[5].sourcePath };
const missingResult = reconcileSourceDocumentIdentities(missing, [], [retainedMissingOwner]);
assert.equal(missingResult.length, 8);
assert.equal(new Set(missingResult.map(row => row.id)).size, 8, "Full path/owner identity must distinguish colliding unreadable files");
assert.equal(missingResult.find(row => row.meetingId === missing[5].meetingId)!.id, truncatedId);
assert.deepEqual(missingResult.flatMap(row => row.meetingItemIds).sort(), missing.flatMap(row => row.meetingItemIds).sort());
assert.ok(missingResult.every(row => !row.cached && row.retrievalStatus === "unreadable_local"));
const remote = record({ id: "meeting-source-document-unambiguous-url", sourceUrl: "https://official.gov/minutes.pdf", sourcePath: null, cachedPath: null, cached: false, retrievalStatus: "remote_discovered" });
assert.equal(reconcileSourceDocumentIdentities([remote])[0].id, remote.id, "Unambiguous URL IDs are unchanged");
console.log("Meeting source-document identity: exact duplicate consolidation, distinct owners/roles, legacy text ownership, full-path collisions, cache paths, item/provenance retention and stable IDs passed.");
