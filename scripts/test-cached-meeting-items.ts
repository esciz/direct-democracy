import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CACHED_MEETING_TOPIC_PARSER_VERSION, isSpecificMeetingDocumentUrl, parseCachedPublicMeetingDocument, resolveCachedMeetingDocumentUrl } from "@/lib/public-meetings/importer";
import { cachedTopicNeedsEvidenceReview } from "@/lib/public-meetings/evidence-review";
import { extractOfficialActionsForItem } from "@/lib/public-meetings/official-actions";
import { buildMeetingVotingCards, getPublicMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import { getPublicMeetingItems } from "@/lib/public-meetings/public-record-eligibility";
import type { PublicBodyRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const meeting: PublicMeetingRecord = { id: "meeting-real", public_body_id: "body-real", title: "School PTO meeting", meeting_date: "2026-09-09", meeting_type: "PTO", meeting_category: "parent_organization", meeting_status: "rescheduled", meeting_time_known: false, location: "School library", agenda_url: "https://example.gov/agenda.pdf", minutes_url: null, packet_url: null, video_url: null, transcript_url: null, meeting_summary: null, key_actions: [], vote_results: [], source_document_count: 1, source_urls: ["https://example.gov/agenda.pdf"], document_hashes: [], ingestion_status: "parsed", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" };
const body: PublicBodyRecord = { id: "body-real", name: "School PTO", jurisdiction: "Carson City", level: "school", website: "https://example.gov", source_url: "https://example.gov", meeting_index_url: "https://example.gov", scraper_type: "html", active: true, seed_source_id: "school-source", notes: null, created_at: meeting.created_at, updated_at: meeting.updated_at };
const text = "Committee agenda\n1. Consider cannabis tax regulations\nDiscussion of a proposal previously approved by another body. No vote occurred at this meeting.\n2. Review school transportation budget\nFiscal impact: $5000 for buses. Public comment follows.";
const proofHash = "f".repeat(64);
const parseInput = { meeting, body, documentId: "doc-real", documentType: "agenda" as const, text, sourceUrl: meeting.agenda_url, sourceHash: proofHash, textPath: "text.txt", sourcePath: "source.pdf", ocr: false };
const parse = parseCachedPublicMeetingDocument(parseInput);
assert.equal(parse.length, 2);
assert.equal(parse[0].meeting_id, meeting.id);
assert.equal(parse[0].source_document_hash, proofHash);
assert.equal(parse[0].source_url, meeting.agenda_url);
assert.ok(parse.every((item) => item.vote_outcome === null && item.related_official_names.length === 0 && item.parser_status === "source_excerpt"), "Cited numbered topics publish only as source excerpts, without inferred decisions or attributed officials");
assert.equal(getPublicMeetingItems(parse).length, 2, "Validated native excerpts pass the existing public topic threshold");
assert.ok(parse.every((item) => item.financial_impact === null && item.staff_recommendation === null && item.source_document_type === "agenda"));
const longBody = "The committee discussed the original research and limitations.\n".repeat(40) + "Final source sentence remains intact.";
const romanText = `Members Present:\nL. Kristopher Rath\nI. Public Comment\na. No public comment.\nII.\nConsideration of Approval of the Previous Meeting\nMinutes (for possible action)\na. A member moved to approve the minutes.\nIII. Research and Data Update (for discussion only)\na. Cannabis data\ni. Nested research notes\n1. A nested observation should remain in this section.\n${longBody}\nIV. Questions for Cannabis Industry\na. Discussion continues.\nV. Adjournment\na. Meeting adjourned.`;
const roman = parseCachedPublicMeetingDocument({ ...parseInput, documentType: "minutes", sourceUrl: "https://ccb.nv.gov/wp-content/uploads/2026/08/minutes.pdf", text: romanText });
assert.deepEqual(roman.map((item) => item.item_number), ["I", "II", "III", "IV", "V"]);
assert.match(roman[1].title, /Previous Meeting Minutes \(for possible action\)/, "Wrapped headings retain their full subject");
assert.ok(roman.every((item) => item.parser_status === "source_excerpt" && item.source_document_type === "minutes"));
assert.ok(roman[2].source_text.length > 1800 && roman[2].source_text.includes("Final source sentence remains intact."), "Worker evidence is not silently truncated or replaced with ellipses");
assert.ok(roman[2].source_text.includes("1. A nested observation"), "Lower-level discussion bullets remain under their Roman topic");
assert.ok(!roman.some((item) => item.title.includes("Kristopher")), "A person's initial must never become an item");
// The August 6 CCB minutes use specific action-topic stems, outside generic
// "discussion/review" headings. Their native source text is still an excerpt.
const ccbAugustMinutesUrl = "https://ccb.nv.gov/wp-content/uploads/2026/08/APPROVED-08.06.2026-Minutes.pdf";
const ccbAugustText = `Members Present:\nL. Kristopher Rath\nIII. Transfers of Interest\na. Vireo Growth Inc requesting approval to acquire The Hawthorne Gardening Company LLC.\nChair Berry moved to approve Agenda Item III with the requested waiver subject to the condition that the waiver expires on the next agenda date.\nMember Rath seconded the motion.\nIV. Hearing on the Summary Suspension in the matter of CCB v. NLV Mayflower Holdings\nLLC(C145)\nThe parties have agreed to continue the suspension while they work to resolve the underlying matter.\nV. Public Comment\nThere was no additional comment.`;
const ccbAugust = parseCachedPublicMeetingDocument({ ...parseInput, documentType: "minutes", sourceUrl: ccbAugustMinutesUrl, text: ccbAugustText });
assert.deepEqual(ccbAugust.map((item) => item.item_number), ["III", "IV", "V"]);
assert.ok(ccbAugust.every((item) => item.parser_status === "source_excerpt"));
assert.equal(getPublicMeetingItems(ccbAugust).length, 3, "Native cited CCB transfers and suspension hearings are public topics");
assert.ok(ccbAugust.every((item) => item.source_url === ccbAugustMinutesUrl && item.source_document_hash === proofHash && item.vote_outcome === null && item.related_official_names.length === 0));
assert.ok(ccbAugust[1].source_text.includes("LLC(C145)"), "Wrapped source details remain intact");
assert.ok(ccbAugust.every((item) => extractOfficialActionsForItem(item, { meeting, body }).length === 0), "A recognized CCB heading still grants no reviewed outcome or official attribution");
const repeatedCcb = parseCachedPublicMeetingDocument({ ...parseInput, documentType: "minutes", sourceUrl: ccbAugustMinutesUrl, text: `${ccbAugustText}\nIII. Transfers of Interest\nAnother embedded set of minutes.\nL. Kristopher Rath` });
assert.equal(repeatedCcb.filter((item) => item.item_number === "III").length, 2);
assert.ok(repeatedCcb.filter((item) => item.item_number === "III").every((item) => item.parser_status === "needs_review"), "Even recognized CCB stems cannot override repeated Roman-number ambiguity");
assert.ok(!repeatedCcb.some((item) => item.title.includes("Kristopher")));
for (const heading of ["Transfers of Interest", "Hearing on Summary Suspension", "Hearing on the Summary Suspension", "Status Check", "Three-Month Status Update", "3-Month Status Update", "Three–Month Status Update", "License Agreement"]) {
  const topic = parseCachedPublicMeetingDocument({ ...parseInput, text: `I. Public Comment\nNo comments.\nII. ${heading}\nThe board discussed this item.` })[1];
  assert.equal(topic.parser_status, "source_excerpt", heading);
  assert.equal(topic.vote_outcome, null);
}
for (const heading of ["Thirty-Month Status Update", "13-Month Status Update", "Three-Year Status Update", "Status Checker Notes", "Licensing Agent", "Hearing on a Personal Request"]) {
  const topic = parseCachedPublicMeetingDocument({ ...parseInput, text: `I. Public Comment\nNo comments.\nII. ${heading}\nThis heading requires review.` })[1];
  assert.equal(topic.parser_status, "needs_review", "The added stems are constrained civic phrases, not broad numeric or name matches");
}
for (const change of [{ ocr: true }, { sourceUrl: null }, { sourceUrl: "https://ccb.nv.gov/public-meetings/" }, { sourceHash: "unverified" }, { textPath: "" }]) {
  const held = parseCachedPublicMeetingDocument({ ...parseInput, ...change });
  assert.ok(held.every((item) => item.parser_status === "needs_review")); assert.equal(getPublicMeetingItems(held).length, 0);
}
assert.equal(parseCachedPublicMeetingDocument({ ...parseInput, sourceUrl: null })[0].source_url, null, "Missing document URL cannot fall back to an unrelated meeting URL");
assert.ok(parseCachedPublicMeetingDocument({ ...parseInput, text: "Unstructured source notes. ".repeat(10) }).every((item) => item.parser_status === "needs_review"));
const ambiguous = parseCachedPublicMeetingDocument({ ...parseInput, text: "I. Public Comment\nOne section.\nII. Discussion of Budget\nDiscussion.\nI. Public Comment\nA second embedded meeting." });
assert.ok(ambiguous.filter((item) => item.item_number === "I").every((item) => item.parser_status === "needs_review"), "Duplicate headings require document review");
const claims = { ...parse[0], title: "Approve the budget", item_type: "action" as const, confidence_score: 0.99, vote_outcome: "Approved unanimously", source_text: "Motion by Jane Smith. Seconded by John Jones. Ayes: Jane Smith, John Jones. Motion carried." };
assert.deepEqual(extractOfficialActionsForItem(claims, { meeting, body }), [], "An excerpt cannot create attributed official actions");
assert.ok(buildMeetingVotingCards({ meetings: [meeting], bodies: [body], items: [claims], officialActions: [] }).every((card) => card.review_status === "needs_review"), "Excerpt confidence cannot approve a voting card");
const claimText = "1. Approve the school transportation budget\nMotion by Jane Smith. Seconded by John Jones. Ayes: Jane Smith, John Jones. Motion carried unanimously 2-0.\n2. Approve school facilities funding\nMotion carried.";
const heldClaimChanges = [
  { label: "ocr", ocr: true, text: claimText },
  { label: "missing-citation", sourceUrl: null, text: claimText },
  { label: "ambiguous", text: `${claimText}\n1. Approve another school contract\nMotion carried.` },
  { label: "unstructured", text: "Approve school transportation budget. Motion by Jane Smith. Seconded by John Jones. Ayes: Jane Smith, John Jones. Motion carried unanimously 2-0." },
];
const heldClaims = heldClaimChanges.map(({ label, ...change }) => {
  const held = parseCachedPublicMeetingDocument({ ...parseInput, documentType: "minutes", ...change })[0];
  assert.equal(held.parser_status, "needs_review", label);
  return { ...held, id: `held-${label}`, title: "Approve school transportation budget", confidence_score: 0.99 };
});
const checkedClaim = { ...heldClaims[0], id: "reviewed-cached", parser_status: "parsed" as const };
const legacyClaim = { ...heldClaims[0], id: "legacy-manual", source_method: "manual_cache" as const, source_document_type: undefined };
const downstreamControls = [checkedClaim, legacyClaim];
const staleClaimResult = (item: { id: string }) => ({ meetingItemId: item.id, outcome: "Approved unanimously 2-0", voteCount: { yes: 2, no: 0, abstain: 0 }, unanimous: true, sourceSnippet: claimText, sourceUrl: meeting.agenda_url, sourcePath: null, confidence: 0.99, needsReview: false });
for (const held of heldClaims) {
  assert.equal(cachedTopicNeedsEvidenceReview(held), true);
  assert.deepEqual(extractOfficialActionsForItem(held, { meeting, body }), [], "Held OCR, ambiguous and uncited topics cannot create attributed actions");
  const cards = buildMeetingVotingCards({ meetings: [meeting], bodies: [body], items: [held], officialActions: [], actionResults: [staleClaimResult(held)] });
  assert.equal(cards.length, 1);
  assert.equal(cards[0].review_status, "needs_review", "Stale high-confidence action results cannot promote held topics");
}
for (const reviewed of downstreamControls) {
  assert.equal(cachedTopicNeedsEvidenceReview(reviewed), false, "Explicitly parsed cached items and legacy manual evidence keep existing behavior");
  assert.ok(extractOfficialActionsForItem(reviewed, { meeting, body }).length > 0);
  assert.equal(buildMeetingVotingCards({ meetings: [meeting], bodies: [body], items: [reviewed], officialActions: [], actionResults: [staleClaimResult(reviewed)] })[0].review_status, "approved");
}
const specificCard = buildMeetingVotingCards({ meetings: [meeting], bodies: [body], items: [checkedClaim], officialActions: [], actionResults: [staleClaimResult(checkedClaim)] })[0];
const genericCards = ["Should the state approve Motion carried?", "Should the county approve motion carried 3-0?", "Should the state continue continued work on this matter?"].map((question, index) => ({ ...specificCard, id: `generic-${index}`, public_question: question, question_text: question }));
assert.deepEqual(getPublicMeetingVotingCards([specificCard, ...genericCards]).map(card => card.id), [specificCard.id], "A prior approval cannot publish an outcome-only question without the actual proposal");
assert.ok(genericCards.every(card => card.review_status === "approved"), "Publication filtering preserves the original reviewed records for correction");
const minutesUrl = "https://ccb.nv.gov/wp-content/uploads/2026/08/APPROVED-08.06.2026-Minutes.pdf";
const sourceProof = { meeting: { ...meeting, meeting_alias_ids: ["old-meeting"], minutes_url: minutesUrl }, documentId: "doc-generic", documentType: "minutes", sourceHash: proofHash, sourceUrl: "https://ccb.nv.gov/public-meetings/", documents: [{ id: "doc-pdf", meetingId: "old-meeting", documentType: "minutes", sourceUrl: minutesUrl }], cache: [{ documentId: "doc-pdf", contentHash: proofHash }] };
assert.equal(resolveCachedMeetingDocumentUrl(sourceProof), minutesUrl, "Exact downloaded bytes restore the real PDF citation across a meeting alias");
assert.equal(resolveCachedMeetingDocumentUrl({ ...sourceProof, cache: [{ documentId: "doc-pdf", contentHash: "a".repeat(64) }] }), null);
assert.equal(resolveCachedMeetingDocumentUrl({ ...sourceProof, documents: [{ ...sourceProof.documents[0], meetingId: "unrelated-meeting" }] }), null);
assert.equal(resolveCachedMeetingDocumentUrl({ ...sourceProof, documents: [{ ...sourceProof.documents[0], documentType: "agenda" }] }), null);
assert.equal(resolveCachedMeetingDocumentUrl({ ...sourceProof, documents: [] }), null, "A primary minutes URL without matching hash evidence proves nothing");
const granicusMinutes = "https://elkocounty.granicus.com/MinutesViewer.php?view_id=5&clip_id=3134&doc_id=736a2dd7-5c92-44b6-b706-25a224280838";
assert.equal(isSpecificMeetingDocumentUrl(granicusMinutes), true);
assert.equal(isSpecificMeetingDocumentUrl("https://elkocounty.granicus.com/MinutesViewer.php?view_id=5"), false);
assert.equal(isSpecificMeetingDocumentUrl(granicusMinutes.replace("clip_id=3134", "clip_id=unknown")), false);
assert.equal(resolveCachedMeetingDocumentUrl({ ...sourceProof, meeting: { ...sourceProof.meeting, minutes_url: granicusMinutes }, documents: [{ ...sourceProof.documents[0], sourceUrl: granicusMinutes }] }), granicusMinutes, "Specific public minutes viewers retain their exact hash-backed citation");
const scratch = mkdtempSync(path.join(tmpdir(), "cached-meeting-items-"));
const project = process.cwd();
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const save = (name: string, value: unknown) => writeFileSync(path.join(scratch, "data/generated", name), JSON.stringify(value));
const load = (name: string) => JSON.parse(readFileSync(path.join(scratch, "data/generated", name), "utf8"));
const run = (script: string, args: string[] = []) => execFileSync(process.execPath, ["--import", "tsx", path.join(project, "scripts", script), ...args], { cwd: scratch, stdio: "pipe" });
try {
  mkdirSync(path.join(scratch, "data/generated"), { recursive: true });
  symlinkSync(path.join(project, "node_modules"), path.join(scratch, "node_modules"), "dir");
  writeFileSync(path.join(scratch, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: project, paths: { "@/*": ["./*"] } } }));
  save("public-meetings.json", [meeting]); save("public-meeting-bodies.json", [body]);
  save("public-meeting-items.json", []); save("public-meeting-voting-cards.json", []); save("public-meeting-official-actions.json", []);
  const saveText = (content: string) => {
    writeFileSync(path.join(scratch, "data/generated/text.txt"), content);
    writeFileSync(path.join(scratch, "data/generated/source.pdf"), `%PDF-1.4\n${content}`);
    const contentHash = sha(`%PDF-1.4\n${content}`);
    save("public-meeting-document-text.json", { records: [{ documentId: "doc-real", meetingId: meeting.id, documentType: "agenda", extractedTextPath: "data/generated/text.txt", sourceUrl: meeting.agenda_url, sourcePath: "data/generated/source.pdf", extractionQuality: "medium", extractionMethod: "native_text", sourceContentHash: contentHash, extractedAt: new Date().toISOString() }] });
    save("public-meeting-document-cache-index.json", { records: [{ documentId: "doc-real", contentHash, stableLocalPath: "data/generated/source.pdf" }] });
    save("public-meeting-source-documents.json", { records: [{ id: "doc-real", meetingId: meeting.id, documentType: "agenda", sourceUrl: meeting.agenda_url }] });
  };
  saveText(text);
  run("reprocess-cached-meeting-items.ts");
  const first = load("public-meeting-items.json");
  assert.equal(first.length, 2);
  const priorParserState = load("public-meeting-item-processing-state.json");
  save("public-meeting-item-processing-state.json", { ...priorParserState, records: priorParserState.records.map((row: { parserVersion: number }) => ({ ...row, parserVersion: CACHED_MEETING_TOPIC_PARSER_VERSION - 1 })) });
  run("reprocess-cached-meeting-items.ts");
  assert.equal(load("public-meeting-item-processing-report.json").totals.documentsProcessed, 1, "A parser upgrade must revisit held documents even when source bytes have not changed");
  assert.equal(load("public-meeting-item-processing-state.json").records[0].parserVersion, CACHED_MEETING_TOPIC_PARSER_VERSION);
  assert.deepEqual(load("public-meeting-items.json").map((row: { id: string }) => row.id), first.map((row: { id: string }) => row.id));
  save("public-meeting-items.json", [{ ...claims, id: first[0].id }]);
  run("generate-public-meeting-action-results.ts"); run("generate-public-meeting-votes.ts");
  assert.equal(load("public-meeting-action-results.json").records.length, 0, "Source excerpts do not generate reviewed outcomes");
  assert.equal(load("public-meeting-votes.json").length, 0, "Source excerpts do not generate named votes");
  save("public-meeting-items.json", first);
  run("reprocess-cached-meeting-items.ts");
  assert.equal(load("public-meeting-item-processing-report.json").totals.documentsProcessed, 0, "Unchanged documents must not recreate topic records");
  assert.deepEqual(load("public-meeting-items.json"), first);
  save("public-meeting-voting-cards.json", [{ topic_item_id: first[0].id, review_status: "approved" }]);
  saveText(text.replace("No vote occurred", "Updated source: No vote occurred"));
  run("reprocess-cached-meeting-items.ts");
  assert.equal(load("public-meeting-items.json").find((item: { id: string }) => item.id === first[0].id).source_text, first[0].source_text, "Reviewed evidence must never be silently overwritten");
  assert.equal(load("public-meeting-item-review-candidates.json").records.length, 1, "Changed reviewed evidence must enter a review queue");
  const agendaState = load("public-meeting-item-processing-state.json").records.find((row: { documentId: string }) => row.documentId === "doc-real");
  const documentRows = load("public-meeting-document-text.json").records;
  save("public-meeting-document-text.json", { records: [...documentRows, { ...documentRows[0], documentId: "doc-minutes", documentType: "minutes", sourceUrl: "https://example.gov/minutes.pdf" }] });
  const cacheRows = load("public-meeting-document-cache-index.json").records;
  save("public-meeting-document-cache-index.json", { records: [...cacheRows, { ...cacheRows[0], documentId: "doc-minutes" }] });
  save("public-meeting-source-documents.json", { records: [...load("public-meeting-source-documents.json").records, { id: "doc-minutes", meetingId: meeting.id, documentType: "minutes", sourceUrl: "https://example.gov/minutes.pdf" }] });
  run("reprocess-cached-meeting-items.ts", ["--document-type=minutes", "--force"]);
  const minutesReport = load("public-meeting-item-processing-report.json");
  assert.equal(minutesReport.documentType, "minutes");
  assert.deepEqual(minutesReport.records.map((row: { documentId: string }) => row.documentId), ["doc-minutes"], "A bounded minutes recovery must leave agendas and packets outside its scope");
  assert.deepEqual(load("public-meeting-item-processing-state.json").records.find((row: { documentId: string }) => row.documentId === "doc-real"), agendaState);
  assert.throws(() => run("reprocess-cached-meeting-items.ts", ["--document-type=invalid"]));
  save("public-meeting-items.json", [...heldClaims, ...downstreamControls]);
  save("public-meeting-document-text.json", { records: [] });
  run("generate-public-meeting-action-results.ts");
  const extractedResults = load("public-meeting-action-results.json").records;
  assert.deepEqual(new Set(extractedResults.map((row: { meetingItemId: string }) => row.meetingItemId)), new Set(downstreamControls.map(row => row.id)), "Action-result CLI must skip every held cached topic while preserving manual/reviewed controls");
  save("public-meeting-action-results.json", { records: [...extractedResults, ...heldClaims.map(staleClaimResult)] });
  run("generate-public-meeting-votes.ts");
  const extractedVotes = load("public-meeting-votes.json");
  assert.ok(extractedVotes.length > 0, "The control documents still produce explicit named votes");
  assert.ok(extractedVotes.every((row: { meeting_item_id: string }) => downstreamControls.some(item => item.id === row.meeting_item_id)), "Stale action results cannot produce named votes for held cached topics");

  const neighbor = { ...legacyClaim, id: "legacy-neighbor", title: "School transportation funding review", source_text: "Committee discussed school transportation funding review.", source_snippet: "", description: null, vote_outcome: null };
  save("public-meeting-items.json", [neighbor, legacyClaim]);
  const contextText = "School transportation funding review. Motion by Jane Smith. Seconded by John Jones. Ayes: Jane Smith, John Jones. Motion carried unanimously 2-0. " + "Supporting minutes background details and committee discussion. ".repeat(30);
  const contextPath = "data/generated/native-context.txt";
  const contextUrl = "https://example.gov/verified-minutes.pdf";
  writeFileSync(path.join(scratch, contextPath), `${contextText}\n`);
  const contextRecord = { documentId: "context-doc", meetingId: meeting.id, documentType: "minutes", extractedTextPath: contextPath, extractionMethod: "native_text", extractionQuality: "high", textLength: contextText.length, sourceUrl: contextUrl, sourceContentHash: proofHash };
  const contextSources = [{ id: "context-doc", meetingId: meeting.id, documentType: "minutes", sourceUrl: contextUrl }];
  const contextCache = [{ documentId: "context-doc", contentHash: proofHash, stableLocalPath: "data/generated/source.pdf" }];
  for (const scenario of [
    { label: "OCR", record: { ...contextRecord, extractionMethod: "ocr_text" }, sources: contextSources, cache: contextCache },
    { label: "mixed OCR", record: { ...contextRecord, extractionMethod: "mixed" }, sources: contextSources, cache: contextCache },
    { label: "insufficient", record: { ...contextRecord, extractionQuality: "insufficient" }, sources: contextSources, cache: contextCache },
    { label: "low quality", record: { ...contextRecord, extractionQuality: "low" }, sources: contextSources, cache: contextCache },
    { label: "unknown document", record: { ...contextRecord, documentType: "unknown" }, sources: contextSources, cache: contextCache },
    { label: "uncited", record: { ...contextRecord, sourceUrl: null }, sources: [], cache: contextCache },
    { label: "changed PDF", record: contextRecord, sources: contextSources, cache: [{ ...contextCache[0], contentHash: "a".repeat(64) }] },
    { label: "unverified text bytes", record: { ...contextRecord, textLength: contextText.length + 100 }, sources: contextSources, cache: contextCache },
  ]) {
    save("public-meeting-document-text.json", { records: [scenario.record] });
    save("public-meeting-source-documents.json", { records: scenario.sources });
    save("public-meeting-document-cache-index.json", { records: scenario.cache });
    run("generate-public-meeting-action-results.ts");
    const contextResults = load("public-meeting-action-results.json").records;
    assert.deepEqual(contextResults.map((row: { meetingItemId: string }) => row.meetingItemId), [legacyClaim.id], `${scenario.label} context cannot upgrade a neighboring legacy item; own manual evidence remains available`);
    assert.equal(load("public-meeting-document-text.json").records.length, 1, "Rejected context remains in its extraction ledger for review");
  }
  save("public-meeting-document-text.json", { records: [contextRecord] });
  save("public-meeting-source-documents.json", { records: contextSources });
  save("public-meeting-document-cache-index.json", { records: contextCache });
  run("generate-public-meeting-action-results.ts");
  const supportedNeighbor = load("public-meeting-action-results.json").records.find((row: { meetingItemId: string }) => row.meetingItemId === neighbor.id);
  assert.ok(supportedNeighbor, "Native high-quality hash-backed minutes remain usable as context");
  assert.equal(supportedNeighbor.sourceUrl, contextUrl, "A context-derived claim must cite the exact minutes that supplied it");

  save("public-meeting-voting-cards.json", []);
  run("publish-public-meeting-runtime.ts");
  const runtime = load("events-runtime.json")[0];
  assert.equal(runtime.meeting_category, "parent_organization");
  assert.equal(runtime.meeting_status, "rescheduled");
  assert.equal(runtime.meeting_time_known, false);
  assert.equal(runtime.location, "School library");
  assert.equal(runtime.meeting_date, "2026-09-09");
  const htmlAgenda = "https://agendas.cityofsparks.us/OnBaseAgendaOnline/Documents/ViewAgenda?meetingId=12&type=HTML&doctype=1";
  save("public-meetings.json", [{ ...meeting, agenda_url: htmlAgenda, source_urls: [htmlAgenda,
    "https://agendas.cityofsparks.us/OnBaseAgendaOnline/#meeting-12-row",
    "https://agendas.cityofsparks.us/OnBaseAgendaOnline/Meetings/ViewMeeting?id=12&doctype=1",
    "https://washoeschools.community.diligentoneplatform.com/Portal/MeetingInformation.aspx?Id=1493",
  ] }]);
  save("public-meeting-items.json", []);
  run("discover-public-meeting-source-documents.ts");
  const discovered = load("public-meeting-source-documents.json").records;
  assert.equal(discovered.length, 1, "Calendar and portal navigation must not become agenda/minutes documents");
  assert.equal(discovered[0].sourceUrl, htmlAgenda);
  assert.equal(discovered[0].documentType, "agenda");
} finally { rmSync(scratch, { recursive: true, force: true }); }
console.log("Cached meeting topic extraction, identity, provenance, idempotency, review preservation, and runtime metadata checks passed.");
