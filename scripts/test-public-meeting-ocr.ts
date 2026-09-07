import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const project = process.cwd();
const fixture = mkdtempSync(path.join(os.tmpdir(), "meeting-ocr-selection-"));
const generated = path.join(fixture, "data/generated");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const save = (file: string, value: unknown) => writeFileSync(path.join(generated, file), JSON.stringify(value));
const load = () => JSON.parse(readFileSync(path.join(generated, "public-meeting-ocr-results.json"), "utf8"));
try {
  mkdirSync(generated, { recursive: true });
  mkdirSync(path.join(fixture, "bin"));
  symlinkSync(path.join(project, "node_modules"), path.join(fixture, "node_modules"), "dir");
  const stub = (name: string, code: string) => { const target = path.join(fixture, "bin", name); writeFileSync(target, `#!/usr/bin/env node\n${code}\n`); chmodSync(target, 0o755); };
  stub("pdfinfo", "process.stdout.write('Pages: 12\\n')");
  stub("pdftotext", "process.stdout.write('')");
  stub("pdftoppm", "const fs=require('node:fs');const prefix=process.argv.at(-1);fs.writeFileSync(process.argv.includes('-singlefile')?prefix+'.png':prefix+'-01.png','fixture-image');");
  stub("tesseract", "const fs=require('node:fs');if(!fs.existsSync(process.argv[2]))process.exit(9);process.stdout.write('MINUTES OF SCHOOL BOARD\\n1. Consider school transportation\\nThe motion passed with a recorded roll call.\\n');");
  const docs = [
    { id: "other-minutes", organizationId: "other-source", documentType: "minutes" },
    { id: "school-agenda", organizationId: "school-source", documentType: "agenda" },
    { id: "school-minutes-1", organizationId: "school-source", documentType: "minutes" },
    { id: "school-minutes-2", organizationId: "school-source", documentType: "minutes" },
  ].map((row) => ({ ...row, meetingId: `meeting-${row.id}`, jurisdiction: "NV", sourceUrl: `https://example.gov/${row.id}.pdf`, sourcePath: null, cachedPath: `data/generated/${row.id}.pdf` }));
  for (const doc of docs) writeFileSync(path.join(fixture, doc.cachedPath), `%PDF fixture ${doc.id}`);
  save("public-meeting-source-documents.json", { records: docs });
  save("public-meeting-content-verification.json", { records: docs.map((doc) => ({ ...doc, documentId: doc.id, localPath: doc.cachedPath, fileSize: 50, classification: "ocr_candidate", ocrNeeded: true })) });
  save("public-meeting-document-cache-index.json", { records: docs.map((doc) => ({ documentId: doc.id, stableLocalPath: doc.cachedPath, contentType: "application/pdf", contentHash: hash(`%PDF fixture ${doc.id}`) })) });
  save("public-meeting-document-text.json", { records: docs.map((doc) => ({ documentId: doc.id, extractionMethod: "failed", extractionQuality: "insufficient", textLength: 0, failureReason: "native_text_too_thin_ocr_unavailable" })) });
  save("dataops-ocr-capabilities.json", { capabilities: { canRunPageOcr: true, canExtractNativePdfText: true }, limits: { maxPagesPerDocument: 10, subprocessTimeoutMs: 10000 }, tools: [] });
  const prior = { documentId: "other-preserved", ocrStatus: "succeeded", sourceContentHash: "old-source-hash", textLength: 1000, extractedTextPath: "data/generated/old-ocr.txt", pagesDetected: 1, pagesSucceeded: 1, pagesAttempted: 1, pagesFailed: 0 };
  writeFileSync(path.join(generated, "old-ocr.txt"), "preserved evidence");
  save("public-meeting-ocr-results.json", { records: [prior] });
  const run = (args: string[] = []) => execFileSync(process.execPath, ["--import", "tsx", path.join(project, "scripts/run-public-meeting-ocr.ts"), "--source=school-source", "--document-type=minutes", "--limit=1", "--max-pages=20", ...args], { cwd: fixture, env: { ...process.env, PATH: `${path.join(fixture, "bin")}${path.delimiter}${process.env.PATH}` }, stdio: "pipe" });
  run();
  const first = load();
  assert.equal(first.audit.totals.candidates, 1);
  assert.equal(first.records.length, 2);
  assert.deepEqual(first.records.find((row: { documentId: string }) => row.documentId === prior.documentId), prior, "Scoped OCR must preserve unrelated ledger evidence");
  const record = first.records.find((row: { documentId: string }) => row.documentId === "school-minutes-1");
  assert.equal(record.pagesSucceeded, 12, "Single-page renderer output must work for double-digit page counts");
  assert.equal(record.pagesTruncated, false);
  assert.equal(record.sourceContentHash, hash("%PDF fixture school-minutes-1"));
  assert.ok(readFileSync(path.join(fixture, record.extractedTextPath), "utf8").includes("\n1."), "OCR preserves heading boundaries for topic parsing");
  run();
  const second = load();
  assert.equal(second.records.length, 3, "Previously succeeded scoped OCR is retained while the next document uses the budget");
  assert.equal(second.audit.totals.reusedSuccessful, 1);
  run();
  const third = load();
  assert.equal(third.audit.totals.candidates, 0);
  assert.deepEqual(third.records, second.records, "Unchanged source hashes must make OCR idempotent");
  writeFileSync(path.join(generated, "school-minutes-1.pdf"), "%PDF fixture school-minutes-1 revised");
  run();
  const changed = load();
  assert.equal(changed.audit.totals.candidates, 1, "Changed source bytes must invalidate OCR reuse");
  assert.equal(changed.records.find((row: { documentId: string }) => row.documentId === "school-minutes-1").sourceContentHash, hash("%PDF fixture school-minutes-1 revised"));
  assert.ok(!changed.records.some((row: { documentId: string }) => ["other-minutes", "school-agenda"].includes(row.documentId)), "Source and document-type scope must exclude unrelated candidates");
  const dryRun = JSON.parse(run(["--force", "--document-id=school-minutes-2,school-agenda", "--document-id=other-minutes", "--dry-run"]).toString());
  assert.deepEqual(dryRun.candidates.map((row: { documentId: string }) => row.documentId), ["school-minutes-2"], "Repeated and comma-separated exact document IDs must intersect source/type scope");
  assert.deepEqual(load().records, changed.records, "A scoped dry run must not change existing OCR results");
  run(["--force", "--document-id=school-minutes-2"]);
  const recovered = load();
  assert.equal(recovered.audit.totals.candidates, 1);
  assert.deepEqual(recovered.filters.documentIds, ["school-minutes-2"]);
  assert.deepEqual(recovered.records.filter((row: { documentId: string }) => row.documentId !== "school-minutes-2"), changed.records.filter((row: { documentId: string }) => row.documentId !== "school-minutes-2"), "Exact recovery must preserve every unselected OCR result");
  console.log("Scoped OCR source/type/document-ID filters, 12-page rendering, ledger preservation, hash invalidation, and idempotence checks passed.");
} finally { rmSync(fixture, { recursive: true, force: true }); }
