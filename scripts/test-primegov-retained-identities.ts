import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePrimeGovMeetings, reconcilePriorityMeetingIdentities, reconcilePriorityRetainedMetadataPaths, type PriorityMeeting, type RetainedPrimeGovEvidence } from "../lib/public-meetings/nevada-priority-sources";
import type { PublicMeetingRecord, PublicMeetingSourceSeed } from "../lib/public-meetings/types";

const seeds = JSON.parse(readFileSync("data/seed/public-meeting-sources.json", "utf8")) as PublicMeetingSourceSeed[];
const providers = [
  ["las-vegas-city-council", "lasvegas.primegov.com"],
  ["boulder-city-council", "bcnv.primegov.com"],
  ["north-las-vegas-city-council", "cityofnorthlasvegas.primegov.com"],
] as const;

function fixture(provider: typeof providers[number] = providers[0]) {
  const [source, host] = provider;
  const seed = seeds.find(s => s.id === source)!;
  const payload = { id: 2976, committeeId: 48, title: "Planning Commission Meeting", date: "Sep 02, 2026", time: "04:00 PM", documentList: [
    { id: 24018, meetingId: 2976, templateId: 16271, templateName: "Agenda", publishStatus: 1, compileOutputType: 1 },
  ] };
  const incoming = parsePrimeGovMeetings([payload], seed, `https://${host}/public/portal`, new Map([[48, "Planning Commission"]]))[0];
  const sourcePath = `data/manual-sources/public-meetings/${source}/metadata/arbitrary-filename.json`;
  const old: PublicMeetingRecord = {
    id: `meeting-manual-${source}-planning-commission-2026-09-02-legacy`,
    public_body_id: `body-manual-${source}-planning-commission`, meeting_date: incoming.meetingDate,
    meeting_type: "Public meeting", title: "Planning Commission Meeting", agenda_url: null, minutes_url: null, packet_url: null, video_url: null, transcript_url: null,
    meeting_summary: null, key_actions: [], vote_results: [], source_document_count: 1,
    source_urls: [`https://${host}/api/v2/PublicPortal/ListArchivedMeetings?year=2026`],
    source_method: "manual_cache", source_local_paths: [sourcePath], ingestion_status: "parsed",
    document_hashes: ["retained-normalized-text-hash"], created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z",
  };
  const evidence: RetainedPrimeGovEvidence = { meetingId: old.id, sourcePath, payload };
  return { source, host, seed, payload, incoming, old, evidence };
}

for (const provider of providers) {
  const { incoming, old, evidence, payload } = fixture(provider);
  const oldSnapshot = structuredClone(old);
  reconcilePriorityMeetingIdentities([incoming], [old], [evidence]);
  assert.deepEqual(incoming.aliasMeetingIds, [old.id], "An attached validated public API row preserves the old public ID");
  assert.ok(incoming.sourceIdentityEvidence?.some(text => text.includes(`meeting ${payload.id}, committee ${payload.committeeId}`)));
  assert.equal(incoming.publicBodyName, "Planning Commission", "A committee is never relabeled as a city council during reconciliation");
  assert.deepEqual(old, oldSnapshot, "Historical records and source evidence remain unmodified");
  reconcilePriorityMeetingIdentities([incoming], [old], [evidence]);
  assert.equal(incoming.aliasMeetingIds?.length, 1, "Repeated refreshes do not duplicate aliases");
}

const sameLocalDay = fixture();
sameLocalDay.old.meeting_date = "2026-09-03T00:00:00.000Z";
reconcilePriorityMeetingIdentities([sameLocalDay.incoming], [sameLocalDay.old], [sameLocalDay.evidence]);
assert.deepEqual(sameLocalDay.incoming.aliasMeetingIds, [sameLocalDay.old.id], "A retained UTC-offset error can be corrected when native evidence and the Pacific meeting day agree");

type Fixture = ReturnType<typeof fixture>;
const rejected: Array<[string, (value: Fixture) => void]> = [
  ["raw meeting ID mismatch", f => { f.payload.id = 9999; }],
  ["raw committee mismatch", f => { f.payload.committeeId = 1; }],
  ["raw native time mismatch", f => { f.payload.time = "05:00 PM"; }],
  ["raw native date mismatch", f => { f.payload.date = "Sep 03, 2026"; }],
  ["native start unknown", f => { f.payload.time = "TBD"; }],
  ["retained local date differs", f => { f.old.meeting_date = "2026-09-04T00:00:00.000Z"; }],
  ["retained date missing", f => { f.old.meeting_date = null; }],
  ["document unpublished", f => { f.payload.documentList[0].publishStatus = 0; }],
  ["document belongs to another meeting", f => { f.payload.documentList[0].meetingId = 9999; }],
  ["document is HTML only", f => { f.payload.documentList[0].compileOutputType = 3; }],
  ["no shared published template", f => { f.payload.documentList[0].templateId = 9999; }],
  ["incoming committee missing", f => { delete f.incoming.sourceCommitteeId; }],
  ["incoming provider ID missing", f => { delete f.incoming.sourceMeetingId; }],
  ["incoming start not known", f => { f.incoming.meetingTimeKnown = false; }],
  ["raw file not attached to old meeting", f => { f.old.source_local_paths = []; }],
  ["path traversal", f => { f.evidence.sourcePath = `data/manual-sources/public-meetings/${f.source}/metadata/../wrong.json`; f.old.source_local_paths = [f.evidence.sourcePath]; }],
  ["other provider metadata path", f => { f.evidence.sourcePath = "data/manual-sources/public-meetings/reno-city-council/metadata/meeting.json"; f.old.source_local_paths = [f.evidence.sourcePath]; }],
  ["generic portal is not public API provenance", f => { f.old.source_urls = [`https://${f.host}/public/portal`]; }],
  ["different source host", f => { f.old.source_urls = ["https://reno.primegov.com/api/v2/PublicPortal/ListArchivedMeetings?year=2026"]; }],
  ["different source body", f => { f.old.public_body_id = "body-manual-reno-city-council-planning-commission"; }],
  ["unparsed JSON wrapper", f => { f.evidence.payload = { records: [f.payload] }; }],
];
for (const [label, mutate] of rejected) {
  const f = fixture(); mutate(f);
  reconcilePriorityMeetingIdentities([f.incoming], [f.old], [f.evidence]);
  assert.equal(f.incoming.aliasMeetingIds?.length ?? 0, 0, label);
}
const noRaw = fixture();
reconcilePriorityMeetingIdentities([noRaw.incoming], [noRaw.old]);
assert.equal(noRaw.incoming.aliasMeetingIds?.length ?? 0, 0, "Same title/date and shared archive URLs alone never establish identity");

const ambiguous = fixture();
const secondPayload = { ...ambiguous.payload, id: 2977, documentList: [{ ...ambiguous.payload.documentList[0], meetingId: 2977, templateId: 16272 }] };
const secondIncoming = parsePrimeGovMeetings([secondPayload], ambiguous.seed, `https://${ambiguous.host}/public/portal`, new Map([[48, "Planning Commission"]]))[0];
const secondPath = ambiguous.evidence.sourcePath.replace("arbitrary-filename", "second-attached-meeting");
ambiguous.old.source_local_paths!.push(secondPath);
reconcilePriorityMeetingIdentities([ambiguous.incoming, secondIncoming], [ambiguous.old], [ambiguous.evidence, { meetingId: ambiguous.old.id, sourcePath: secondPath, payload: secondPayload }]);
assert.equal(ambiguous.incoming.aliasMeetingIds?.length ?? 0, 0);
assert.equal(secondIncoming.aliasMeetingIds?.length ?? 0, 0, "Conflicting attached meeting IDs hold both potential aliases");

for (const addendum of [false, true]) {
  const composite = fixture();
  const otherPayload = { ...composite.payload, id: 2977, title: addendum ? `${composite.payload.title} Addendum` : "Redevelopment Agency Meeting", committeeId: addendum ? 48 : 49,
    documentList: [{ ...composite.payload.documentList[0], meetingId: 2977, templateId: 16272 }] };
  const other = parsePrimeGovMeetings([otherPayload], composite.seed, `https://${composite.host}/public/portal`, new Map([[48, "Planning Commission"], [49, "Redevelopment Agency"]]))[0];
  const otherPath = composite.evidence.sourcePath.replace("arbitrary-filename", "other-native-meeting");
  composite.old.source_local_paths!.push(otherPath, "unverified-history.txt");
  const otherEvidence = { meetingId: composite.old.id, sourcePath: otherPath, payload: otherPayload, primaryTopicSource: true };
  composite.evidence.primaryTopicSource = true;
  reconcilePriorityMeetingIdentities([composite.incoming, other], [composite.old], [composite.evidence, otherEvidence]);
  assert.deepEqual(composite.incoming.aliasMeetingIds, [composite.old.id], "Exact title plus the retained topic source identifies the one primary legacy identity");
  assert.equal(other.aliasMeetingIds?.length ?? 0, 0, "An addendum or different corporation retains its own native meeting ID");
  assert.deepEqual(composite.incoming.retainedMetadataPaths, [composite.evidence.sourcePath]);
  assert.deepEqual(other.retainedMetadataPaths, [otherPath], "Nonprimary attached metadata still has a verified native owner");
  const merged: PublicMeetingRecord[] = [
    { ...composite.old, id: composite.incoming.id, meeting_alias_ids: [composite.old.id] },
    { ...composite.old, id: other.id, title: other.title, public_body_id: "body-distinct", source_local_paths: [], meeting_alias_ids: [] },
  ];
  const before = structuredClone(merged);
  const moved = reconcilePriorityRetainedMetadataPaths(merged, [composite.incoming, other]);
  assert.deepEqual(moved[0].source_local_paths, [composite.evidence.sourcePath, "unverified-history.txt"]);
  assert.deepEqual(moved[1].source_local_paths, [otherPath]);
  assert.deepEqual(merged, before, "The path repair does not mutate its input records");
  const withoutPaths = (rows: PublicMeetingRecord[]) => rows.map(({ source_local_paths: _paths, ...row }) => row);
  assert.deepEqual(withoutPaths(moved), withoutPaths(before), "IDs, aliases, dates, bodies, titles and all nonpath evidence are preserved");
  assert.deepEqual(reconcilePriorityRetainedMetadataPaths(moved, [composite.incoming, other]), moved, "Repeated metadata repair is idempotent");
  assert.deepEqual(reconcilePriorityRetainedMetadataPaths(merged, [{ id: "missing-owner", retainedMetadataPaths: [otherPath] }]), merged, "A missing canonical owner leaves evidence attached");
  assert.deepEqual(reconcilePriorityRetainedMetadataPaths(merged, [{ id: merged[0].id, retainedMetadataPaths: [otherPath] }, { id: merged[1].id, retainedMetadataPaths: [otherPath] }]), merged, "Conflicting canonical owners do not move evidence");
  assert.deepEqual(reconcilePriorityRetainedMetadataPaths(merged, [{ id: "missing-owner", retainedMetadataPaths: [otherPath] }, { id: merged[1].id, retainedMetadataPaths: [otherPath] }]), merged, "An unresolved competing claim cannot be discarded to force ownership");
  const aliasOwner = { ...merged[1], meeting_alias_ids: ["retained-native-alias"] };
  const viaAlias = reconcilePriorityRetainedMetadataPaths([merged[0], aliasOwner], [{ id: "retained-native-alias", retainedMetadataPaths: [otherPath] }]);
  assert.deepEqual(viaAlias[1].source_local_paths, [otherPath], "A uniquely retained alias resolves to the existing canonical owner");
}
const tiedPrimary = fixture();
tiedPrimary.evidence.primaryTopicSource = true;
const tiedPath = tiedPrimary.evidence.sourcePath.replace("arbitrary-filename", "another-primary");
tiedPrimary.old.source_local_paths!.push(tiedPath);
const tiedPayload = { ...tiedPrimary.payload, id: 2977, documentList: [{ ...tiedPrimary.payload.documentList[0], meetingId: 2977, templateId: 16272 }] };
const tiedIncoming = parsePrimeGovMeetings([tiedPayload], tiedPrimary.seed, `https://${tiedPrimary.host}/public/portal`, new Map([[48, "Planning Commission"]]))[0];
reconcilePriorityMeetingIdentities([tiedPrimary.incoming, tiedIncoming], [tiedPrimary.old], [tiedPrimary.evidence, { meetingId: tiedPrimary.old.id, sourcePath: tiedPath, payload: tiedPayload, primaryTopicSource: true }]);
assert.equal(tiedPrimary.incoming.aliasMeetingIds?.length ?? 0, 0);
assert.equal(tiedIncoming.aliasMeetingIds?.length ?? 0, 0, "Two exact-title primary item sources remain ambiguous");

const chamber = fixture();
const distinctBody: PriorityMeeting = { ...structuredClone(chamber.incoming), id: `meeting-${chamber.source}-primegov-3000`, sourceMeetingId: 3000, sourceCommitteeId: 49, publicBodyName: "Redevelopment Agency" };
reconcilePriorityMeetingIdentities([chamber.incoming, distinctBody], [chamber.old], [chamber.evidence]);
assert.deepEqual(chamber.incoming.aliasMeetingIds, [chamber.old.id]);
assert.equal(distinctBody.aliasMeetingIds?.length ?? 0, 0, "A same-time distinct governing body cannot claim the old ID");

const templateOnly = fixture();
templateOnly.old.source_urls = [templateOnly.incoming.agendaUrl!];
reconcilePriorityMeetingIdentities([templateOnly.incoming], [templateOnly.old]);
assert.deepEqual(templateOnly.incoming.aliasMeetingIds, [templateOnly.old.id], "Existing exact public template URL compatibility remains intact");
console.log("PrimeGov retained identities passed: provider/meeting/committee/native-start/published-document proof, old-ID preservation, offset correction, and conflicting or unsupported aliases held. No network or generated writes.");
