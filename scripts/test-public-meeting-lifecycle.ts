import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { documentRefreshDue, meetingLifecycle, mergeMeetingHistory, recordDocumentAttempt, selectDocumentRefreshBatch } from "@/lib/public-meetings/lifecycle";
import type { PublicMeetingRecord } from "@/lib/public-meetings/types";

const now = new Date("2026-09-06T18:00:00Z");
function fixture(changes: Partial<PublicMeetingRecord> = {}): PublicMeetingRecord {
  return { id: "meeting-1", public_body_id: "body-1", meeting_date: "2026-08-01T17:00:00Z", meeting_type: "Regular", title: "Committee meeting", agenda_url: "https://example.gov/agenda.pdf", minutes_url: null, packet_url: null, video_url: null, transcript_url: null, meeting_summary: null, key_actions: [], vote_results: [], source_document_count: 1, source_urls: ["https://example.gov/agenda.pdf"], ingestion_status: "parsed", document_hashes: [], created_at: "2026-08-01T18:00:00Z", updated_at: "2026-08-01T18:00:00Z", source_method: "automated_archive", ...changes };
}
const old = fixture();
assert.deepEqual(mergeMeetingHistory([old], []), [old], "A failed or truncated discovery must preserve history");
const minutes = fixture({ minutes_url: "https://example.gov/minutes.pdf", source_urls: [...old.source_urls, "https://example.gov/minutes.pdf"] });
const refreshed = mergeMeetingHistory([minutes], [fixture({ created_at: now.toISOString(), updated_at: now.toISOString() })])[0];
assert.equal(refreshed.minutes_url, minutes.minutes_url, "A calendar without minutes cannot erase previously discovered minutes");
assert.equal(refreshed.created_at, old.created_at);
assert.equal(mergeMeetingHistory([old], [fixture({ updated_at: now.toISOString() })])[0].updated_at, old.updated_at, "Reobserving unchanged evidence must not reset evidence freshness");
assert.equal(mergeMeetingHistory([fixture({ source_method: "manual_fixture" })], []).length, 0, "History retention cannot restore civic fixtures");
const known = fixture({ meeting_status: "cancelled", location: "Hall", meeting_summary: "Minutes summary", meeting_time_known: false });
const sparse = mergeMeetingHistory([known], [fixture({ meeting_date: null, meeting_status: undefined, location: undefined, meeting_summary: "" })])[0];
assert.equal(sparse.meeting_date, known.meeting_date);
assert.equal(sparse.meeting_status, "cancelled");
assert.equal(sparse.location, "Hall");
assert.equal(sparse.meeting_summary, "Minutes summary");
assert.equal(meetingLifecycle(fixture({ title: "CANCELLED_-_Planning_Commission.pdf" }), now).minutesStatus, "cancelled");
const oldAlias = fixture({ id: "recording-id", minutes_url: "https://example.gov/approved-minutes.pdf", source_urls: ["https://example.gov/recording"] });
const aliasesMerged = mergeMeetingHistory([old, oldAlias], [fixture({ meeting_alias_ids: ["recording-id"], source_identity_evidence: ["https://example.gov/exact-shared-artifact"] })]);
assert.equal(aliasesMerged.length, 1);
assert.equal(aliasesMerged[0].id, old.id);
assert.equal(aliasesMerged[0].minutes_url, oldAlias.minutes_url);
assert.ok(aliasesMerged[0].meeting_alias_ids?.includes("recording-id"));
assert.ok(aliasesMerged[0].source_urls.includes("https://example.gov/recording"));
assert.equal(meetingLifecycle(old, now).phase, "archived");
assert.equal(meetingLifecycle(old, now).minutesOverdue, true);
assert.equal(meetingLifecycle(fixture({ meeting_date: "2026-09-06" }), now).phase, "upcoming", "Date-only events must stay on the correct local calendar day");
assert.equal(meetingLifecycle(fixture({ meeting_date: "2026-09-06T08:00:00Z" }), now).phase, "upcoming", "Unknown end times keep today's events active");
assert.equal(meetingLifecycle(fixture({ meeting_date: null }), now).phase, "date_unconfirmed");
assert.equal(meetingLifecycle(fixture({ meeting_status: "cancelled", meeting_date: "2026-10-01" }), now).minutesStatus, "cancelled");
assert.equal(meetingLifecycle(fixture({ meeting_category: "parent_organization" }), now).minutesStatus, "not_due", "PTA meetings do not receive government minutes deadlines");
assert.equal(meetingLifecycle(minutes, now).minutesStatus, "published", "A URL is not extracted text");
assert.equal(meetingLifecycle(minutes, now, true).minutesStatus, "extracted");
const failure = recordDocumentAttempt({ documentId: "doc-1", status: "failed", documentType: "minutes", meetingDate: old.meeting_date, now });
assert.equal(failure.consecutiveFailures, 1);
assert.equal(failure.lastSuccessAt, null);
assert.equal(documentRefreshDue({ state: failure, documentType: "minutes", meetingDate: old.meeting_date, now }), false);
assert.equal(documentRefreshDue({ state: failure, documentType: "minutes", meetingDate: old.meeting_date, now, force: true }), true);
const success = recordDocumentAttempt({ documentId: "doc-1", status: "updated_content", documentType: "minutes", meetingDate: old.meeting_date, previous: failure, now });
const subsequentFailure = recordDocumentAttempt({ documentId: "doc-1", status: "unavailable", documentType: "minutes", meetingDate: old.meeting_date, previous: success, now: new Date("2026-09-14T18:00:00Z") });
assert.equal(success.consecutiveFailures, 0);
assert.equal(subsequentFailure.lastSuccessAt, success.lastSuccessAt, "Failure must not invent a successful fetch");
assert.equal(documentRefreshDue({ lastSuccessfulRetrievalAt: "2026-08-01T00:00:00Z", documentType: "minutes", meetingDate: old.meeting_date, now }), true, "Cached minutes must be revisited for approved/corrected versions");
const documents = ["a1", "a2", "a3", "b1"].map((id) => ({ id, organizationId: id[0], sourceHost: "example.gov", documentType: "minutes", meetingId: "meeting-1", priorityBody: true }));
assert.deepEqual(selectDocumentRefreshBatch(documents, new Map(), new Map(), 2).map((row) => row.id), ["a1", "b1"], "One provider cannot monopolize a bounded batch");
const plan = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "scripts/run-dataops-pipeline.ts", "--meetings-only", "--dry-run"], { encoding: "utf8" })) as { stages: Array<{ id: string; commands: string[][] }> };
assert.equal(plan.stages.some((stage) => ["refresh-public-data", "public-records"].includes(stage.id)), false, "Meetings must be independent of unrelated imports");
assert.ok(plan.stages.find((stage) => stage.id === "meeting-lifecycle"));
assert.ok(plan.stages.findIndex((stage) => stage.id === "retrieve-documents") < plan.stages.findIndex((stage) => stage.id === "meeting-lifecycle"));
assert.equal(meetingLifecycle(fixture({ title: "Committee meeting postponed" }), now).minutesStatus, "not_due");
assert.equal(meetingLifecycle(fixture({ title: "Cancelled old date", meeting_status: "rescheduled", meeting_date: "2026-10-01" }), now).phase, "upcoming");
const sourceState = new Map([["a0", { ...failure, documentId: "a0", sourceId: "a" }]]);
assert.equal(selectDocumentRefreshBatch(documents, sourceState, new Map(), 1)[0].id, "b1", "Across runs, an untouched source outranks a source already consuming the retrieval budget");

const fixtureDirectory = mkdtempSync(path.join(tmpdir(), "meeting-pipeline-test-"));
const projectDirectory = process.cwd();
try {
  mkdirSync(path.join(fixtureDirectory, "scripts"));
  mkdirSync(path.join(fixtureDirectory, "data/generated"), { recursive: true });
  symlinkSync(path.join(projectDirectory, "node_modules"), path.join(fixtureDirectory, "node_modules"), "dir");
  writeFileSync(path.join(fixtureDirectory, "tsconfig.json"), JSON.stringify({ compilerOptions: { baseUrl: projectDirectory, paths: { "@/*": ["./*"] } } }));
  const monitors = plan.stages.find((stage) => stage.id === "monitor-sources")!.commands;
  for (const [index, command] of monitors.entries()) {
    writeFileSync(path.join(fixtureDirectory, command[3]), index === 0 ? "process.exit(7);" : `require("node:fs").writeFileSync(${JSON.stringify(path.join(fixtureDirectory, `continued-${index}`))}, "ran");`);
  }
  let failed = false;
  try { execFileSync(process.execPath, ["--import", "tsx", path.join(projectDirectory, "scripts/run-dataops-pipeline.ts"), "--meetings-only", "--from=monitor-sources", "--to=monitor-sources", "--offline"], { cwd: fixtureDirectory, stdio: "pipe" }); }
  catch { failed = true; }
  assert.equal(failed, true, "Failed commands must still fail the final pipeline result");
  assert.ok(existsSync(path.join(fixtureDirectory, `continued-${monitors.length - 1}`)), "A failed audit cannot prevent later recovery commands from running");
  const run = JSON.parse(readFileSync(path.join(fixtureDirectory, "data/generated/meetings-pipeline-targeted-run.json"), "utf8"));
  assert.ok(run.completedAt, "Failures must retain a complete, inspectable run ledger");
  assert.equal(run.stages[0].commands[0].status, "failed");
  assert.equal(run.stages[0].commands.at(-1).status, "succeeded");
  assert.equal(existsSync(path.join(fixtureDirectory, "data/generated/.dataops-pipeline.lock")), false);

  const cachedPath = "data/generated/prior.html";
  const payload = "<html><body>Previously cached official minutes</body></html>";
  writeFileSync(path.join(fixtureDirectory, cachedPath), payload);
  const document = { id: "doc-cache", meetingId: "meeting-1", organizationId: "source-a", jurisdiction: "NV", documentType: "minutes", sourceUrl: "http://localhost/blocked", sourceHost: "localhost", sourcePath: cachedPath, cachedPath, priorityBody: true, sourcePlatform: "html" };
  writeFileSync(path.join(fixtureDirectory, "data/generated/public-meeting-source-documents.json"), JSON.stringify({ records: [document] }));
  writeFileSync(path.join(fixtureDirectory, "data/generated/public-meeting-document-cache-index.json"), JSON.stringify({ records: [{ documentId: document.id, stableLocalPath: cachedPath, contentHash: createHash("sha256").update(payload).digest("hex"), lastSuccessfulRetrievalAt: now.toISOString() }] }));
  execFileSync(process.execPath, ["--import", "tsx", path.join(projectDirectory, "scripts/retrieve-public-meeting-documents.ts"), "--force-refresh", "--limit=1"], { cwd: fixtureDirectory, stdio: "pipe" });
  const retrieval = JSON.parse(readFileSync(path.join(fixtureDirectory, "data/generated/dataops-retrieval-run.json"), "utf8"));
  assert.equal(retrieval.attempts.length, 1, "Force refresh must select previously cached documents");
  assert.equal(retrieval.attempts[0].status, "security_rejected", "Refresh still enforces the public URL boundary before making a request");
  assert.equal(readFileSync(path.join(fixtureDirectory, cachedPath), "utf8"), payload, "A failed refresh preserves prior evidence");
  execFileSync(process.execPath, ["--import", "tsx", path.join(projectDirectory, "scripts/retrieve-public-meeting-documents.ts"), "--limit=1"], { cwd: fixtureDirectory, stdio: "pipe" });
  const deferred = JSON.parse(readFileSync(path.join(fixtureDirectory, "data/generated/dataops-retrieval-run.json"), "utf8"));
  assert.equal(deferred.attempts.length, 0, "Retry backoff must persist across separate process runs");
  writeFileSync(path.join(fixtureDirectory, "data/generated/public-meeting-document-refresh-state.json"), JSON.stringify({ records: [{ documentId: document.id, lastAttemptAt: now.toISOString(), lastSuccessAt: now.toISOString(), nextAttemptAt: "2099-01-01T00:00:00Z", consecutiveFailures: 0, status: "unchanged" }] }));
  rmSync(path.join(fixtureDirectory, cachedPath));
  execFileSync(process.execPath, ["--import", "tsx", path.join(projectDirectory, "scripts/retrieve-public-meeting-documents.ts"), "--retry-only", "--limit=1"], { cwd: fixtureDirectory, stdio: "pipe" });
  const cacheRecovery = JSON.parse(readFileSync(path.join(fixtureDirectory, "data/generated/dataops-retrieval-run.json"), "utf8"));
  assert.equal(cacheRecovery.attempts.length, 1, "An indexed but missing cached file must be recovered immediately even with --retry-only");
  assert.equal(cacheRecovery.attempts[0].status, "security_rejected");

} finally { rmSync(fixtureDirectory, { recursive: true, force: true }); }
console.log("Public meeting lifecycle, archive retention, refresh/backoff, fairness, and isolated pipeline checks passed.");
