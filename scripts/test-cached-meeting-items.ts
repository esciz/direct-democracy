import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseCachedPublicMeetingDocument } from "@/lib/public-meetings/importer";
import type { PublicBodyRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const meeting: PublicMeetingRecord = { id: "meeting-real", public_body_id: "body-real", title: "School PTO meeting", meeting_date: "2026-09-09", meeting_type: "PTO", meeting_category: "parent_organization", meeting_status: "rescheduled", meeting_time_known: false, location: "School library", agenda_url: "https://example.gov/agenda.pdf", minutes_url: null, packet_url: null, video_url: null, transcript_url: null, meeting_summary: null, key_actions: [], vote_results: [], source_document_count: 1, source_urls: ["https://example.gov/agenda.pdf"], document_hashes: [], ingestion_status: "parsed", created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z" };
const body: PublicBodyRecord = { id: "body-real", name: "School PTO", jurisdiction: "Carson City", level: "school", website: "https://example.gov", source_url: "https://example.gov", meeting_index_url: "https://example.gov", scraper_type: "html", active: true, seed_source_id: "school-source", notes: null, created_at: meeting.created_at, updated_at: meeting.updated_at };
const text = "Committee agenda\n1. Consider cannabis tax regulations\nDiscussion of a proposal previously approved by another body. No vote occurred at this meeting.\n2. Review school transportation budget\nFiscal impact: $5000 for buses. Public comment follows.";
const parse = parseCachedPublicMeetingDocument({ meeting, body, documentId: "doc-real", documentType: "agenda", text, sourceUrl: meeting.agenda_url, sourceHash: "pdf-hash", textPath: "text.txt", sourcePath: "source.pdf", ocr: false });
assert.equal(parse.length, 2);
assert.equal(parse[0].meeting_id, meeting.id);
assert.equal(parse[0].source_document_hash, "pdf-hash");
assert.equal(parse[0].source_url, meeting.agenda_url);
assert.ok(parse.every((item) => item.vote_outcome === null && item.related_official_names.length === 0 && item.parser_status === "needs_review"), "Agenda language must not generate decisions or attributed official actions");
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
  };
  saveText(text);
  run("reprocess-cached-meeting-items.ts");
  const first = load("public-meeting-items.json");
  assert.equal(first.length, 2);
  run("reprocess-cached-meeting-items.ts");
  assert.equal(load("public-meeting-item-processing-report.json").totals.documentsProcessed, 0, "Unchanged documents must not recreate topic records");
  assert.deepEqual(load("public-meeting-items.json"), first);
  save("public-meeting-voting-cards.json", [{ topic_item_id: first[0].id, review_status: "approved" }]);
  saveText(text.replace("No vote occurred", "Updated source: No vote occurred"));
  run("reprocess-cached-meeting-items.ts");
  assert.equal(load("public-meeting-items.json").find((item: { id: string }) => item.id === first[0].id).source_text, first[0].source_text, "Reviewed evidence must never be silently overwritten");
  assert.equal(load("public-meeting-item-review-candidates.json").records.length, 1, "Changed reviewed evidence must enter a review queue");
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
