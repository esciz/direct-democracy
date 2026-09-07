import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
  const run = (args: string[] = [], nodeArgs: string[] = []) => execFileSync(process.execPath, [...nodeArgs, "--import", "tsx", path.join(project, "scripts/run-public-meeting-ocr.ts"), "--source=school-source", "--document-type=minutes", ...(!args.some(arg => arg.startsWith("--limit=")) ? ["--limit=1"] : []), "--max-pages=20", ...args], { cwd: fixture, env: { ...process.env, PATH: `${path.join(fixture, "bin")}${path.delimiter}${process.env.PATH}` }, stdio: "pipe", timeout: 30_000 });
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
  save("public-meeting-ocr-results.json", { records: [prior,
    { ...record, ocrStatus: "failed", processedAt: "2026-09-07T17:00:00Z", lastAttemptAt: "2026-09-07T17:00:00Z" },
    { ...record, documentId: "school-minutes-2", ocrStatus: "failed", processedAt: "2026-09-07T16:00:00Z", lastAttemptAt: "2026-09-07T16:00:00Z" },
  ] });
  run();
  assert.equal(load().records.find((row: { documentId: string }) => row.documentId === "school-minutes-2").ocrStatus, "succeeded", "An older failed document must get the budget ahead of the most recent failure");
  const readablePage = "The board reviewed transportation routes serving students throughout the district. Members discussed attendance records, classroom staffing, teacher recruitment, construction projects, maintenance schedules, financial statements, contract terms, public comments, budget allocations, and emergency preparation. After considering the superintendent report and questions from residents, trustees approved the proposed recommendations with a recorded motion and individual votes. Staff will publish supporting documents and provide updates at the next regular meeting.";
  const nativePages = Array.from({ length: 12 }, (_, index) => `Page ${index + 1}. ${readablePage}`).join("\f") + "\f";
  const nativeSidecar = nativePages.replace(/\f/g, "\n").trim();
  writeFileSync(path.join(generated, "readable-native.txt"), `${nativeSidecar}\n`);
  stub("pdftotext", `process.stdout.write(${JSON.stringify(nativePages)})`);
  const nativeAlias = { documentId: "other-id-same-file", extractionMethod: "native_text", extractionQuality: "high", textLength: nativeSidecar.length,
    extractedTextPath: "data/generated/readable-native.txt", sourceContentHash: hash("%PDF fixture school-minutes-1 revised") };
  save("public-meeting-document-text.json", { records: [nativeAlias] });
  const nativeReuse = JSON.parse(run(["--dry-run"]).toString());
  assert.equal(nativeReuse.reusedNativeText, 1, "A substantive native sidecar plus readable text on every page avoids duplicate OCR across document aliases");
  assert.equal(nativeReuse.candidates.length, 0);
  writeFileSync(path.join(generated, "readable-native.txt"), " ".repeat(nativeSidecar.length));
  assert.equal(JSON.parse(run(["--dry-run"]).toString()).reusedNativeText, 0, "A high label cannot make whitespace substantive native text");
  writeFileSync(path.join(generated, "readable-native.txt"), `%PDF-${"native-body".repeat(1000)}`);
  assert.equal(JSON.parse(run(["--dry-run"]).toString()).reusedNativeText, 0, "A binary or length-mismatched sidecar cannot suppress OCR");
  writeFileSync(path.join(generated, "readable-native.txt"), `${nativeSidecar}\n`);
  stub("pdftotext", `process.stdout.write(${JSON.stringify(readablePage + "\f".repeat(12))})`);
  assert.equal(JSON.parse(run(["--dry-run"]).toString()).reusedNativeText, 0, "Readable first-page text does not prove the remaining scan pages are readable");
  stub("pdftotext", `process.stdout.write(${JSON.stringify(Array.from({ length: 12 }, () => "SCANNED ARCHIVE HEADER PAGE NUMBER ".repeat(20)).join("\f") + "\f")})`);
  assert.equal(JSON.parse(run(["--dry-run"]).toString()).reusedNativeText, 0, "Repeated native markers on every page do not constitute substantive content");
  stub("pdftotext", `process.stdout.write(${JSON.stringify(nativePages)})`);
  save("public-meeting-document-text.json", { records: [{ ...nativeAlias, textLength: nativeAlias.textLength - 1 }] });
  assert.equal(JSON.parse(run(["--dry-run"]).toString()).reusedNativeText, 0, "Native sidecar character length must agree with its evidence ledger");
  save("public-meeting-document-text.json", { records: [nativeAlias] });
  writeFileSync(path.join(generated, "school-minutes-1.pdf"), "%PDF genuinely changed scan");
  const changedNative = JSON.parse(run(["--dry-run"]).toString());
  assert.equal(changedNative.candidates[0].documentId, "school-minutes-1", "Old native text cannot suppress OCR for changed source bytes");

  // Keep partial OCR evidence when native extraction yields only markers or
  // when an attempted recovery produces fewer successful pages.
  const partialPages = [1, 2].map(page => ({ page, text: `Useful original OCR evidence from scanned page ${page}.` }));
  const partialText = partialPages.map(page => page.text).join("\n\n");
  const partialPath = "data/generated/partial-ocr.txt";
  writeFileSync(path.join(fixture, partialPath), `${partialText}\n`);
  const partial = { ...record, sourceContentHash: hash("%PDF genuinely changed scan"), extractedTextPath: partialPath,
    pagesDetected: 12, pagesAttempted: 2, pagesSucceeded: 2, pagesFailed: 0, pagesTruncated: true,
    textLength: partialText.length, pageResults: partialPages };
  save("public-meeting-ocr-results.json", { records: [prior, partial] });
  save("public-meeting-document-text.json", { records: [] });
  stub("pdftotext", "process.stdout.write('SCANNED ARCHIVE HEADER PAGE NUMBER '.repeat(20))");
  stub("tesseract", "process.stdout.write('')");
  run(["--document-id=school-minutes-1"]);
  const retained = load();
  const retainedPartial = retained.records.find((row: { documentId: string }) => row.documentId === "school-minutes-1");
  assert.equal(retainedPartial.ocrStatus, "succeeded", "Sparse native markers and a failed retry must retain prior partial OCR");
  assert.equal(retainedPartial.extractedTextPath, partialPath);
  assert.equal(retainedPartial.pagesSucceeded, 2);
  assert.equal(retainedPartial.pagesTruncated, true);
  assert.equal(readFileSync(path.join(fixture, partialPath), "utf8"), `${partialText}\n`);
  assert.equal(retained.audit.totals.pagesAttempted, 12, "Sparse native markers must not prevent the scan recovery attempt");
  assert.equal(retained.audit.totals.pagesSucceeded, 0, "Retained earlier pages must not inflate current OCR success counts");
  assert.equal(retained.audit.totals.ocrSucceeded, 0);
  assert.equal(retained.audit.totals.preservedAfterWeakerRetry, 1);
  assert.ok(retainedPartial.lastAttemptAt, "A retained failed retry must rotate behind older work");

  // Full native recovery may now avoid OCR, while the separate historical OCR
  // evidence retains its actual partial coverage rather than being erased.
  stub("pdftotext", `process.stdout.write(${JSON.stringify(nativePages)})`);
  run(["--document-id=school-minutes-1"]);
  const nativeWithPartial = load();
  const preservedPartial = nativeWithPartial.records.find((row: { documentId: string }) => row.documentId === "school-minutes-1");
  assert.equal(preservedPartial.pagesTruncated, true);
  assert.equal(preservedPartial.pagesSucceeded, 2);
  assert.equal(preservedPartial.extractedTextPath, partialPath);
  assert.equal(nativeWithPartial.audit.totals.pagesAttempted, 0);
  assert.equal(nativeWithPartial.audit.totals.ocrSucceeded, 0);
  assert.equal(nativeWithPartial.audit.totals.preservedPriorOcr, 1);

  // Aggregate successes can conceal a failed page within the requested range.
  const noncontiguous = { ...partial, pagesAttempted: 12, pagesSucceeded: 10, pagesFailed: 2, pagesTruncated: false,
    pageResults: Array.from({ length: 12 }, (_, index) => ({ page: index + 1, text: index < 2 ? "" : partialText })) };
  save("public-meeting-ocr-results.json", { records: [prior, noncontiguous] });
  const rangeCheck = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", path.join(project, "scripts/run-public-meeting-ocr.ts"), "--document-id=school-minutes-1", "--max-pages=10", "--dry-run"], { cwd: fixture, env: { ...process.env, PATH: `${path.join(fixture, "bin")}${path.delimiter}${process.env.PATH}` }, stdio: "pipe" }).toString());
  assert.equal(rangeCheck.reusedSuccessful, 0, "Ten successes on pages 3–12 cannot hide failed pages 1–2 within a ten-page request");
  assert.equal(rangeCheck.candidates.length, 1);
  save("public-meeting-ocr-results.json", { records: [prior, partial] });
  stub("pdftotext", "process.stdout.write('SCANNED ARCHIVE HEADER PAGE NUMBER '.repeat(20))");
  stub("pdftoppm", "const fs=require('node:fs');fs.writeFileSync(process.argv.at(-1)+'.png',process.argv[process.argv.indexOf('-f')+1]);");
  stub("tesseract", `const fs=require('node:fs');const page=Number(fs.readFileSync(process.argv[2],'utf8'));process.stdout.write(page<=2?'':'Recovered page '+page+'. '+${JSON.stringify(readablePage)});`);
  run(["--document-id=school-minutes-1"]);
  const combined = load();
  const complete = combined.records.find((row: { documentId: string }) => row.documentId === "school-minutes-1");
  assert.equal(complete.pagesSucceeded, 12, "New pages combine with verified earlier pages even when those earlier pages fail on retry");
  assert.equal(complete.coverageStatus, "complete");
  assert.equal(combined.audit.totals.pagesSucceeded, 10, "Two retained pages are coverage, not newly recovered work");
  assert.ok(readFileSync(path.join(fixture, complete.extractedTextPath), "utf8").includes(partialText));
  assert.equal(readFileSync(path.join(fixture, partialPath), "utf8"), `${partialText}\n`);

  // A deadline before work, or during PDF inspection, defers the document
  // without inventing a failed page or an attempt on its earlier OCR record.
  const beforeBudget = load();
  const completeBytes = readFileSync(path.join(fixture, complete.extractedTextPath), "utf8");
  run(["--force", "--document-id=school-minutes-1", "--max-duration-ms=1"]);
  const noWork = load();
  assert.deepEqual(noWork.records, beforeBudget.records);
  assert.equal(noWork.audit.budgetReached, true);
  assert.equal(noWork.audit.totals.documentsProcessed, 0);
  assert.equal(noWork.audit.totals.documentsDeferred, 1);
  assert.equal(noWork.audit.totals.pagesAttempted, 0);
  stub("pdfinfo", "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3000);process.stdout.write('Pages: 4\\n')");
  run(["--force", "--document-id=school-minutes-1", "--max-duration-ms=500"]);
  const inspectedOnly = load();
  assert.deepEqual(inspectedOnly.records, beforeBudget.records, "Budget expiration during page inspection must not overwrite prior evidence with page-count failure");
  assert.equal(inspectedOnly.audit.totals.pagesAttempted, 0);
  assert.equal(inspectedOnly.audit.totals.documentsProcessed, 0);
  assert.equal(readFileSync(path.join(fixture, complete.extractedTextPath), "utf8"), completeBytes);

  // Per-page remaining time stops a slow second page while preserving useful
  // first-page text. The next document remains byte-for-byte unchanged.
  const deferred = { ...partial, documentId: "school-minutes-2", sourceContentHash: hash("%PDF fixture school-minutes-2"), sentinel: "deferred" };
  save("public-meeting-ocr-results.json", { records: [prior, deferred] });
  stub("pdfinfo", "process.stdout.write('Pages: 4\\n')");
  stub("pdftotext", "process.stdout.write('')");
  stub("tesseract", `const fs=require('node:fs');const page=Number(fs.readFileSync(process.argv[2],'utf8'));if(page>1)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,3000);process.stdout.write('New OCR page '+page+'. '+${JSON.stringify(readablePage)});`);
  const budgetStart = Date.now();
  run(["--force", "--limit=2", "--max-duration-ms=1200"]);
  assert.ok(Date.now() - budgetStart < 3500, "Remaining batch time must cap the subprocess's longer timeout");
  const partialBudget = load();
  const prefix = partialBudget.records.find((row: { documentId: string }) => row.documentId === "school-minutes-1");
  assert.equal(prefix.pagesSucceeded, 1);
  assert.equal(prefix.pagesAttempted, 2, "Only started pages count as attempted");
  assert.equal(prefix.pagesFailed, 1, "Unstarted pages must not become failures");
  assert.equal(prefix.pagesTruncated, true);
  assert.equal(prefix.coverageStatus, "partial");
  assert.equal(prefix.lastAttemptStatus, "ocr_budget_exhausted");
  assert.equal(partialBudget.audit.totals.documentsDeferred, 1);
  assert.deepEqual(partialBudget.records.find((row: { documentId: string }) => row.documentId === deferred.documentId), deferred);
  const prefixBytes = readFileSync(path.join(fixture, prefix.extractedTextPath), "utf8");
  assert.equal(path.basename(prefix.extractedTextPath), `${hash(prefixBytes)}.txt`, "Immutable sidecar identity must hash OCR text bytes, not just the unchanged PDF");
  stub("tesseract", `const fs=require('node:fs');const page=Number(fs.readFileSync(process.argv[2],'utf8'));process.stdout.write(page===1?'':'Resumed OCR page '+page+'. '+${JSON.stringify(readablePage)});`);
  run(["--document-id=school-minutes-1"]);
  const resumed = load().records.find((row: { documentId: string }) => row.documentId === "school-minutes-1");
  assert.equal(resumed.pagesSucceeded, 4);
  assert.equal(resumed.coverageStatus, "complete");
  assert.notEqual(resumed.extractedTextPath, prefix.extractedTextPath, "Improved OCR for the same PDF needs a new sidecar revision");
  assert.equal(readFileSync(path.join(fixture, prefix.extractedTextPath), "utf8"), prefixBytes, "The previous ledger's text stays unchanged after resume");
  assert.ok(readFileSync(path.join(fixture, resumed.extractedTextPath), "utf8").includes(prefixBytes.trim()));

  // Kill the runner from the second document's renderer: document1 must have
  // been atomically committed before the whole selected batch completes.
  save("public-meeting-ocr-results.json", { records: [prior, deferred] });
  stub("pdfinfo", "process.stdout.write('Pages: 1\\n')");
  stub("tesseract", `process.stdout.write('Checkpoint OCR. '+${JSON.stringify(readablePage)})`);
  stub("pdftoppm", "const fs=require('node:fs');if(process.argv.at(-2).includes('school-minutes-2.pdf')){fs.rmSync(require('node:path').dirname(process.argv.at(-1)),{recursive:true,force:true});process.kill(process.ppid,'SIGKILL');process.exit(0);}fs.writeFileSync(process.argv.at(-1)+'.png','1');");
  assert.throws(() => run(["--force", "--limit=2"]));
  const interrupted = load();
  assert.equal(interrupted.audit.completed, false);
  const committed = interrupted.records.find((row: { documentId: string }) => row.documentId === "school-minutes-1");
  assert.equal(committed.pagesSucceeded, 1, "Completed document must survive interruption during the next document");
  assert.ok(existsSync(path.join(fixture, committed.extractedTextPath)));
  assert.deepEqual(interrupted.records.find((row: { documentId: string }) => row.documentId === deferred.documentId), deferred);

  // Interrupt precisely after a new sidecar is written but before its ledger
  // rename. The last committed ledger and all referenced old text remain valid.
  stub("pdftoppm", "const fs=require('node:fs');fs.writeFileSync(process.argv.at(-1)+'.png','1');");
  stub("tesseract", `process.stdout.write('Uncommitted improved OCR. '+${JSON.stringify(readablePage.repeat(2))})`);
  const beforeInterruptedLedger = readFileSync(path.join(generated, "public-meeting-ocr-results.json"), "utf8");
  const oldCommittedBytes = readFileSync(path.join(fixture, committed.extractedTextPath), "utf8");
  const sidecarDirectory = path.join(generated, "public-meeting-ocr-text-cache");
  const beforeSidecars = readdirSync(sidecarDirectory).filter(file => file.endsWith(".txt"));
  const preload = path.join(fixture, "interrupt-ledger.cjs");
  writeFileSync(preload, "const fs=require('node:fs');const rename=fs.renameSync;fs.renameSync=function(from,to){if(to.endsWith('public-meeting-ocr-results.json'))process.kill(process.pid,'SIGKILL');return rename(from,to);};require('node:module').syncBuiltinESMExports();");
  assert.throws(() => run(["--force", "--document-id=school-minutes-1"], ["--require", preload]));
  assert.equal(readFileSync(path.join(generated, "public-meeting-ocr-results.json"), "utf8"), beforeInterruptedLedger);
  assert.equal(readFileSync(path.join(fixture, committed.extractedTextPath), "utf8"), oldCommittedBytes);
  assert.equal(readdirSync(sidecarDirectory).filter(file => file.endsWith(".txt")).length, beforeSidecars.length + 1, "An uncommitted immutable sidecar is harmless and does not change the old reference");
  console.log("Scoped OCR, native/partial evidence guards, deadlines, per-document checkpoints, immutable sidecars, interruption/resume, honest attempt totals and failure rotation passed.");
} finally { rmSync(fixture, { recursive: true, force: true }); }
