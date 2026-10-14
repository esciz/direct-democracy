import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const project = process.cwd();
const fixture = mkdtempSync(path.join(os.tmpdir(), "native-minutes-batches-"));
const generated = path.join(fixture, "data/generated");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const save = (file: string, value: unknown) => writeFileSync(path.join(generated, file), JSON.stringify(value));
const load = () => JSON.parse(readFileSync(path.join(generated, "public-meeting-document-text.json"), "utf8"));
const sourceText = "1. School staffing\n" + "The board approved classroom support after public discussion. ".repeat(25);

try {
  mkdirSync(generated, { recursive: true });
  symlinkSync(path.join(project, "node_modules"), path.join(fixture, "node_modules"), "dir");
  const documents = [
    ["a-new-failure", "minutes", "school", ""],
    ["b-new-minutes", "minutes", "school", sourceText],
    ["c-old-failure", "minutes", "school", ""],
    ["d-agenda", "agenda", "school", sourceText],
    ["stable-minutes", "minutes", "school", sourceText],
    ["unrelated", "minutes", "other", sourceText],
  ].map(([id, documentType, organizationId, contents]) => {
    const cachedPath = `data/generated/${id}.txt`;
    writeFileSync(path.join(fixture, cachedPath), contents);
    return { id, documentType, organizationId, cachedPath, sourcePath: null, sourceUrl: `https://example.gov/${id}`, meetingId: `meeting-${id}`, meetingItemIds: [], bodyId: "school-board", priorityBody: true, retrievalStatus: "local_cached", contentHash: hash(contents), contents };
  });
  const priorRecord = (id: string, failed = false) => {
    const document = documents.find(row => row.id === id)!;
    return { id: `document-text-${id}`, documentId: id, meetingId: document.meetingId, meetingItemIds: [], documentType: document.documentType, sourceUrl: document.sourceUrl, sourcePath: null, sourceContentHash: document.contentHash, extractedTextPath: failed ? null : document.cachedPath, extractionMethod: failed ? "failed" : "native_text", extractionQuality: failed ? "insufficient" : "medium", textLength: failed ? 0 : sourceText.length, confidence: failed ? 0 : 0.84, sourceSnippet: failed ? null : sourceText.slice(0, 200), ocrAttempted: false, ocrAvailable: false, failureReason: failed ? "native_text_too_thin_ocr_unavailable" : null, extractedAt: "2020-01-01T00:00:00.000Z" };
  };
  const oldFailure = priorRecord("c-old-failure", true);
  const unrelated = priorRecord("unrelated");
  save("public-meeting-source-documents.json", { records: documents });
  save("public-meeting-document-cache-index.json", { records: documents.map(row => ({ documentId: row.id, stableLocalPath: row.cachedPath, contentHash: row.contentHash, contentType: "text/plain", fileSize: row.contents.length, extractionStatus: "pending" })) });
  save("public-meeting-document-text.json", { records: [oldFailure, priorRecord("stable-minutes"), unrelated] });
  const run = (args: string[] = []) => execFileSync(process.execPath, ["--import", "tsx", path.join(project, "scripts/extract-public-meeting-document-text.ts"), "--source=school", "--max-documents=1", ...args], { cwd: fixture, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(project, "tsconfig.json") }, stdio: "pipe", timeout: 20000 });

  run();
  const first = load();
  assert.equal(first.audit.totals.documentsProcessed, 1);
  assert.equal(first.audit.totals.documentsDeferred, 3);
  assert.equal(first.audit.totals.reusedExistingText, 1, "Reused evidence must not consume the extraction quota");
  assert.deepEqual(first.records.find((row: any) => row.documentId === "c-old-failure"), oldFailure, "A deferred prior record must survive unchanged");
  assert.deepEqual(first.records.find((row: any) => row.documentId === "unrelated"), unrelated, "Scoped extraction must retain unrelated evidence");
  assert.ok(first.records.find((row: any) => row.documentId === "a-new-failure").lastAttemptAt);
  const cache = JSON.parse(readFileSync(path.join(generated, "public-meeting-document-cache-index.json"), "utf8"));
  assert.equal(cache.records.find((row: any) => row.documentId === "b-new-minutes").extractionStatus, "pending", "Deferred documents must remain pending in the cache");
  const deferred = first.records.find((row: any) => row.documentId === "b-new-minutes");
  assert.equal(deferred.failureReason, "extraction_budget_deferred", "A new unattempted document must have explicit budget queue state");
  assert.equal(deferred.extractedAt, null);
  assert.equal(deferred.lastAttemptAt, undefined, "Deferral must not fabricate an extraction attempt timestamp");
  assert.equal(deferred.extractedTextPath, null);
  assert.equal(deferred.textLength, 0);
  execFileSync(process.execPath, ["--import", "tsx", path.join(project, "scripts/reprocess-cached-meeting-items.ts"), "--document-type=minutes"], { cwd: fixture, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(project, "tsconfig.json") }, stdio: "pipe", timeout: 20000 });
  assert.equal(load().records.find((row: any) => row.documentId === "b-new-minutes").extractedAt, null, "The topic parser must accept unattempted text records without fabricating evidence");

  run();
  const second = load();
  const recovered = second.records.find((row: any) => row.documentId === "b-new-minutes");
  assert.equal(recovered.extractionMethod, "native_text", "A prior failure must rotate behind the next unattempted minutes document");
  assert.equal(recovered.sourceContentHash, hash(sourceText));
  assert.equal(readFileSync(path.join(fixture, recovered.extractedTextPath), "utf8"), sourceText.trim() + "\n");
  assert.equal(second.audit.totals.documentsProcessed, 1);
  assert.equal(second.records.find((row: any) => row.documentId === "d-agenda").failureReason, "extraction_budget_deferred", "Available minutes have priority over deferred agendas");

  run();
  const third = load();
  assert.equal(third.records.find((row: any) => row.documentId === "d-agenda").extractionMethod, "native_text", "Failed minutes must not starve an unattempted agenda");
  run();
  const fourth = load();
  assert.notEqual(fourth.records.find((row: any) => row.documentId === "c-old-failure").extractedAt, oldFailure.extractedAt, "Older failed attempts must rotate back into the queue");
  run(["--max-duration-ms=0.000001"]);
  const budgeted = load();
  assert.equal(budgeted.audit.scope.budgetReached, true);
  assert.equal(budgeted.audit.totals.documentsProcessed, 0);
  assert.deepEqual(budgeted.records, fourth.records, "Ending at the time budget must durably preserve every previous text record");
  console.log("Native extraction quotas, minutes priority, failed-attempt rotation, cache deferral, time budget and evidence preservation passed.");
} finally { rmSync(fixture, { recursive: true, force: true }); }
