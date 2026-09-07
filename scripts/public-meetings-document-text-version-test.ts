import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { NATIVE_PDF_EXTRACTOR_VERSION } from "../lib/public-meetings/pdf-native-text";

const projectRoot = process.cwd();
const testRoot = mkdtempSync(path.join(os.tmpdir(), "meeting-text-version-test-"));
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

function blankPdf(revision: string) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"];
  let pdf = `%PDF-1.4\n% revision ${revision}\n`;
  const offsets = [0];
  for (const [index, body] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function writeJson(root: string, filename: string, value: unknown) {
  writeFileSync(path.join(root, "data", "generated", filename), JSON.stringify(value));
}

function readJson(root: string, filename: string) {
  return JSON.parse(readFileSync(path.join(root, "data", "generated", filename), "utf8"));
}

const currentPdf = blankPdf("new source");
const currentHash = hash(currentPdf);
const oldHash = hash(blankPdf("old source"));
const preservedText = `LAST_GOOD\n${"The motion was approved with the recorded vote.\n".repeat(180)}`;

function scenario(name: string, options: { ocrSourceHash?: string; omitOcrHash?: boolean; existingSourceHash?: string; cacheHash?: string; ocrText?: string; existingText?: string; existingMethod?: string; noOcr?: boolean }) {
  const root = path.join(testRoot, name);
  const generated = path.join(root, "data", "generated");
  mkdirSync(path.join(generated, "public-meeting-document-text-cache"), { recursive: true });
  writeFileSync(path.join(root, "source.pdf"), currentPdf);
  const existingPath = "data/generated/public-meeting-document-text-cache/doc.txt";
  const ocrPath = "data/generated/ocr.txt";
  const existingText = (options.existingText ?? preservedText).trimEnd();
  const ocrText = options.ocrText ?? `STALE_OCR\n${"An obsolete motion was approved.\n".repeat(100)}`;
  writeFileSync(path.join(root, existingPath), `${existingText}\n`);
  writeFileSync(path.join(root, ocrPath), ocrText);
  writeJson(root, "public-meeting-source-documents.json", { records: [{ id: "doc", meetingId: "meeting", meetingItemIds: [], bodyId: "body", organizationId: "source", documentType: "minutes", sourceUrl: "https://example.gov/minutes.pdf", sourcePath: "source.pdf", cachedPath: "source.pdf", retrievalStatus: "local_cached", priorityBody: true, contentHash: options.cacheHash ?? currentHash }] });
  writeJson(root, "public-meeting-document-cache-index.json", { records: [{ documentId: "doc", stableLocalPath: "source.pdf", contentHash: options.cacheHash ?? currentHash, contentType: "application/pdf", fileSize: currentPdf.length, extractionStatus: "extracted" }] });
  writeJson(root, "public-meeting-document-text.json", { records: options.existingSourceHash ? [{ id: "document-text-doc", documentId: "doc", meetingId: "meeting", meetingItemIds: [], documentType: "minutes", sourceUrl: "https://example.gov/minutes.pdf", sourcePath: "source.pdf", extractedTextPath: existingPath, extractionMethod: options.existingMethod ?? "mixed", extractionQuality: "high", textLength: existingText.length, confidence: 0.88, sourceSnippet: "LAST_GOOD", ocrAttempted: true, ocrAvailable: options.existingMethod !== "native_text", failureReason: null, extractedAt: "2026-01-01T00:00:00.000Z", sourceContentHash: options.existingSourceHash, ocrTextHash: "previous-ocr-hash" }] : [] });
  writeJson(root, "public-meeting-ocr-results.json", { records: options.noOcr ? [] : [{ documentId: "doc", extractedTextPath: ocrPath, textLength: ocrText.length, ocrStatus: "succeeded", confidence: 0.9, failureReason: null, processedAt: "2026-09-06T00:00:00.000Z", ...(options.omitOcrHash ? {} : { sourceContentHash: options.ocrSourceHash ?? currentHash }) }] });
  return { root, existingPath, ocrPath };
}

function run(root: string, flags: string[] = [], customPath?: string) {
  const child = spawnSync(process.execPath, ["--import", path.join(projectRoot, "node_modules/tsx/dist/loader.mjs"), path.join(projectRoot, "scripts/extract-public-meeting-document-text.ts"), ...flags], {
    cwd: root, env: { ...process.env, ...(customPath ? { PATH: customPath } : {}), TSX_TSCONFIG_PATH: path.join(projectRoot, "tsconfig.json") }, encoding: "utf8", timeout: 30_000, maxBuffer: 2_000_000,
  });
  assert.equal(child.status, 0, child.stderr || child.stdout || String(child.error));
  return JSON.parse(readFileSync(path.join(root, "data/generated/public-meeting-document-text.json"), "utf8"));
}

try {
  const revised = scenario("revised-source", { ocrSourceHash: oldHash, existingSourceHash: oldHash, cacheHash: oldHash });
  const revisedRecord = run(revised.root).records[0];
  assert.equal(revisedRecord.ocrAvailable, false, "Old-version OCR must not merge into a revised PDF, even if cache metadata is stale");
  assert.equal(revisedRecord.sourceContentHash, currentHash, "Source fingerprint must describe actual current bytes");
  assert.ok(!String(revisedRecord.sourceSnippet).includes("STALE_OCR"));

  const unversioned = scenario("unversioned-legacy", { omitOcrHash: true });
  assert.equal(run(unversioned.root).records[0].ocrAvailable, false, "Unversioned OCR cannot enter a new source extraction");

  const improvedText = `IMPROVED_FULL_OCR\n${"A new motion was approved and every vote was recorded.\n".repeat(250)}`;
  const improved = scenario("improved-unchanged", { existingSourceHash: currentHash, existingMethod: "native_text", ocrText: improvedText });
  const improvedOutput = run(improved.root);
  assert.equal(improvedOutput.audit.totals.documentsProcessed, 1, "High existing text quality must not suppress new matching OCR");
  assert.ok(readFileSync(path.join(improved.root, improvedOutput.records[0].extractedTextPath), "utf8").includes("IMPROVED_FULL_OCR"));
  assert.notEqual(improvedOutput.records[0].extractedTextPath, improved.existingPath);
  assert.equal(readFileSync(path.join(improved.root, improved.existingPath), "utf8"), preservedText, "New text versions must leave the previous ledger's evidence intact");
  assert.ok(improvedOutput.records[0].ocrTextHash);
  assert.equal(run(improved.root).audit.totals.reusedExistingText, 1, "Identical applied OCR should not append itself on each run");

  const partial = scenario("partial-rerun", { existingSourceHash: currentHash, ocrText: `PARTIAL\n${"An approved motion.\n".repeat(180)}` });
  const partialOutput = run(partial.root);
  assert.equal(readFileSync(path.join(partial.root, partial.existingPath), "utf8"), preservedText, "A shorter high-quality partial OCR must preserve last-good same-version text");
  assert.equal(partialOutput.records[0].extractedAt, "2026-01-01T00:00:00.000Z");
  assert.ok(partialOutput.records[0].evaluatedOcrTextHash);
  assert.equal(run(partial.root).audit.totals.reusedExistingText, 1, "Already evaluated partial OCR should not cause repeated failed refreshes");
  writeFileSync(path.join(partial.root, partial.ocrPath), improvedText);
  const laterOutput = run(partial.root);
  assert.equal(laterOutput.audit.totals.documentsProcessed, 1, "Later improved sidecar bytes must be considered again");
  assert.ok(readFileSync(path.join(partial.root, laterOutput.records[0].extractedTextPath), "utf8").includes("IMPROVED_FULL_OCR"));
  assert.equal(readFileSync(path.join(partial.root, partial.existingPath), "utf8"), preservedText);

  const unavailable = scenario("missing-new-ocr", { existingSourceHash: currentHash, noOcr: true });
  run(unavailable.root, ["--all"]);
  assert.equal(readFileSync(path.join(unavailable.root, unavailable.existingPath), "utf8"), preservedText, "Forced re-extraction with unavailable OCR must preserve same-version last-good evidence");

  const scoped = scenario("scoped-preservation", { existingSourceHash: currentHash, ocrText: improvedText });
  const sourceData = readJson(scoped.root, "public-meeting-source-documents.json");
  const cacheData = readJson(scoped.root, "public-meeting-document-cache-index.json");
  const ledgerData = readJson(scoped.root, "public-meeting-document-text.json");
  for (const [id, organizationId] of [["same-source-other-doc", "source"], ["other-source-doc", "other-source"]]) {
    sourceData.records.push({ ...sourceData.records[0], id, organizationId });
    cacheData.records.push({ ...cacheData.records[0], documentId: id, extractionStatus: "pending", sentinel: id });
    ledgerData.records.push({ ...ledgerData.records[0], documentId: id, id: `document-text-${id}`, sentinel: id });
  }
  writeJson(scoped.root, "public-meeting-source-documents.json", sourceData);
  writeJson(scoped.root, "public-meeting-document-cache-index.json", cacheData);
  writeJson(scoped.root, "public-meeting-document-text.json", ledgerData);
  const scopedOutput = run(scoped.root, ["--source=source", "--document-id=doc,other-source-doc", "--all"]);
  assert.equal(scopedOutput.audit.scope.documentsSelected, 1, "Source and exact document filters compose as AND");
  assert.equal(scopedOutput.records.length, 3, "Scoped extraction retains all unrelated ledger rows");
  for (const old of ledgerData.records.slice(1)) assert.deepEqual(scopedOutput.records.find((row: { documentId: string }) => row.documentId === old.documentId), old);
  assert.deepEqual(readJson(scoped.root, "public-meeting-document-cache-index.json").records.slice(1), cacheData.records.slice(1), "Unselected cache metadata is unchanged");
  const idOnlyOutput = run(scoped.root, ["--document-id=doc", "--document-id=same-source-other-doc"]);
  assert.equal(idOnlyOutput.audit.scope.documentsSelected, 2, "Repeated exact document filters work without a source filter");
  assert.equal(idOnlyOutput.records.length, 3);

  sourceData.records[1].documentType = "agenda";
  sourceData.records[2].documentType = "minutes_attachment";
  writeJson(scoped.root, "public-meeting-source-documents.json", sourceData);
  const beforeTypeLedger = readJson(scoped.root, "public-meeting-document-text.json");
  const beforeTypeCache = readJson(scoped.root, "public-meeting-document-cache-index.json");
  const minutesOnly = run(scoped.root, ["--document-type=minutes", "--all"]);
  assert.deepEqual(minutesOnly.audit.scope.documentTypes, ["minutes"]);
  assert.equal(minutesOnly.audit.scope.documentsSelected, 1, "Document type is an exact match, not a prefix");
  assert.equal(minutesOnly.records.length, 3, "Minutes-only refresh retains unrelated text evidence");
  for (const old of beforeTypeLedger.records.slice(1)) assert.deepEqual(minutesOnly.records.find((row: { documentId: string }) => row.documentId === old.documentId), old);
  assert.deepEqual(readJson(scoped.root, "public-meeting-document-cache-index.json").records.slice(1), beforeTypeCache.records.slice(1), "Minutes-only refresh leaves agenda/attachment cache metadata unchanged");
  const allFilters = run(scoped.root, ["--document-type=minutes,agenda", "--source=source", "--document-id=same-source-other-doc,other-source-doc"]);
  assert.equal(allFilters.audit.scope.documentsSelected, 1, "Source, document ID, and exact types compose as AND");

  const tooLarge = scenario("size-limit-recovery", { noOcr: true });
  const tooLargeOutput = run(tooLarge.root, ["--max-pdf-bytes=1"]);
  assert.match(tooLargeOutput.records[0].failureReason, /pdf_native_text_size_limit/);
  assert.equal(tooLargeOutput.records[0].extractionMethod, "failed", "Oversized PDF remains an explicit recoverable failure");
  const limitRecovered = scenario("size-limit-ocr-recovery", { ocrText: improvedText });
  const recoveredOutput = run(limitRecovered.root, ["--max-pdf-bytes=1"]);
  assert.equal(recoveredOutput.records[0].extractionMethod, "ocr_text", "Matching OCR recovers text without parsing oversized PDFs");
  assert.match(recoveredOutput.records[0].nativeTextFailureReason, /pdf_native_text_size_limit/);
  const bin = path.join(testRoot, "poppler"); mkdirSync(bin);
  const page = "The board approved a motion after discussion of transportation, public safety, district staffing, financial statements, building maintenance, classroom resources and community recommendations. ".repeat(6);
  const fullNative = Array.from({ length: 16 }, (_, index) => `Page ${index + 1}\n${page}`).join("\f") + "\f";
  const stub = (name: string, body: string) => { const file = path.join(bin, name); writeFileSync(file, `#!${process.execPath}\n${body}\n`); chmodSync(file, 0o755); };
  stub("pdfinfo", "process.stdout.write('Pages: 16\\n')");
  stub("pdftotext", `process.stdout.write(process.argv.includes('-v')?'fixture Poppler':${JSON.stringify(fullNative)})`);
  const lostPages = scenario("legacy-native-lost-pages", { existingSourceHash: currentHash, existingMethod: "native_text", existingText: "Final page footer only. ".repeat(28), noOcr: true });
  const refreshed = run(lostPages.root, [], bin);
  assert.equal(refreshed.audit.totals.documentsProcessed, 1, "Old PDFParse results must not remain cached merely because source bytes match");
  assert.equal(refreshed.records[0].nativeTextExtractorVersion, NATIVE_PDF_EXTRACTOR_VERSION);
  assert.equal(refreshed.records[0].nativeTextExtractor, "poppler");
  assert.equal(refreshed.records[0].textCompleteness, "complete");
  assert.ok(refreshed.records[0].textLength > 16_000);
  assert.equal(run(lostPages.root, [], bin).audit.totals.reusedExistingText, 1, "Current matching Poppler results remain cached");
  const retainedPartial = scenario("retained-partial-not-upgraded-by-discarded-native", { existingSourceHash: currentHash,
    existingText: "Prior partial OCR evidence: the board approved a motion.\n".repeat(2000), noOcr: true });
  const retainedLedger = readJson(retainedPartial.root, "public-meeting-document-text.json");
  retainedLedger.records[0].textCompleteness = "partial";
  writeJson(retainedPartial.root, "public-meeting-document-text.json", retainedLedger);
  const oldPartialBytes = readFileSync(path.join(retainedPartial.root, retainedPartial.existingPath), "utf8");
  const retainedResult = run(retainedPartial.root, [], bin).records[0];
  assert.equal(retainedResult.extractedTextPath, retainedPartial.existingPath, "A shorter rerun preserves the earlier usable sidecar");
  assert.equal(readFileSync(path.join(retainedPartial.root, retainedResult.extractedTextPath), "utf8"), oldPartialBytes);
  assert.equal(retainedResult.textCompleteness, "partial", "Discarded complete native text must not upgrade the retained partial sidecar");
  assert.equal(run(retainedPartial.root, [], bin).records[0].textCompleteness, "partial", "Cache reuse must retain the saved sidecar's actual completeness");
  const retainedUnknown = scenario("retained-unknown-not-upgraded-by-discarded-native", { existingSourceHash: currentHash,
    existingText: oldPartialBytes.replace(/\n$/, ""), noOcr: true });
  const unknownResult = run(retainedUnknown.root, [], bin).records[0];
  assert.equal(unknownResult.extractedTextPath, retainedUnknown.existingPath);
  assert.notEqual(unknownResult.textCompleteness, "complete", "Legacy evidence without page proof cannot acquire completeness from discarded text");
  const fallbackCache = scenario("fallback-becomes-poppler", { existingSourceHash: currentHash, existingMethod: "native_text", existingText: "Final page footer only. ".repeat(28), noOcr: true });
  const cachedFallback = readJson(fallbackCache.root, "public-meeting-document-text.json");
  Object.assign(cachedFallback.records[0], { nativeTextExtractorVersion: NATIVE_PDF_EXTRACTOR_VERSION, nativeTextExtractor: "pdf-parse" });
  writeJson(fallbackCache.root, "public-meeting-document-text.json", cachedFallback);
  const missingTools = path.join(testRoot, "missing-tools"); mkdirSync(missingTools);
  assert.equal(run(fallbackCache.root, [], missingTools).audit.totals.reusedExistingText, 1);
  assert.equal(run(fallbackCache.root, [], bin).audit.totals.documentsProcessed, 1, "Installing Poppler must invalidate an otherwise current fallback cache");
  const bracketText = `Header with literal < ..\n${fullNative}\n> Final footer`;
  stub("pdftotext", `process.stdout.write(process.argv.includes('-v')?'fixture Poppler':${JSON.stringify(bracketText)})`);
  const brackets = scenario("plain-text-angle-brackets", { noOcr: true });
  const bracketRecord = run(brackets.root, [], bin).records[0];
  const bracketSidecar = readFileSync(path.join(brackets.root, bracketRecord.extractedTextPath), "utf8");
  assert.ok(bracketSidecar.includes("Page 1\n") && bracketSidecar.includes("Page 16\n"));
  assert.ok(bracketSidecar.includes("< ..") && bracketSidecar.includes("> Final footer"), "Plain PDF text must not be interpreted as HTML and lose intervening pages");
  assert.ok(bracketRecord.textLength > 16_000);
  const ocrBrackets = scenario("ocr-angle-brackets", { ocrText: bracketText });
  const ocrBracketRecord = run(ocrBrackets.root, [], missingTools).records[0];
  assert.ok(readFileSync(path.join(ocrBrackets.root, ocrBracketRecord.extractedTextPath), "utf8").includes("Page 1\n"), "OCR sidecars are also plain text");
  const html = scenario("html-source", { noOcr: true });
  writeFileSync(path.join(html.root, "source.html"), `<html><script>SECRET_SCRIPT_TEXT</script><p>${page}</p><p>SECOND_PARAGRAPH &amp; details</p></html>`);
  const htmlSources = readJson(html.root, "public-meeting-source-documents.json");
  htmlSources.records[0].sourcePath = htmlSources.records[0].cachedPath = "source.html";
  writeJson(html.root, "public-meeting-source-documents.json", htmlSources);
  writeJson(html.root, "public-meeting-document-cache-index.json", { records: [] });
  const htmlRecord = run(html.root).records[0];
  const htmlSidecar = readFileSync(path.join(html.root, htmlRecord.extractedTextPath), "utf8");
  assert.ok(!htmlSidecar.includes("SECRET_SCRIPT_TEXT") && !htmlSidecar.includes("<p>"), "Actual HTML sources still remove markup and scripts");
  assert.ok(htmlSidecar.includes("\nSECOND_PARAGRAPH & details"));
  stub("pdftotext", `process.stdout.write(process.argv.includes('-v')?'fixture Poppler':${JSON.stringify("\f".repeat(15) + page + "\f")})`);
  const partialNative = scenario("partial-native-pages", { noOcr: true });
  const partialNativeRecord = run(partialNative.root, [], bin).records[0];
  assert.equal(partialNativeRecord.textCompleteness, "partial");
  assert.equal(partialNativeRecord.extractionQuality, "low");
  assert.equal(partialNativeRecord.failureReason, "native_text_incomplete_pages");
  assert.equal(partialNativeRecord.nativePagesDetected, 16);
  assert.equal(partialNativeRecord.nativePagesWithText, 1);
  console.log("Document text passed: parser/backend cache upgrades, complete versus partial native pages, source/OCR version isolation, last-good reuse, immutable evidence, scope, and size-limit recovery.");
} finally {
  rmSync(testRoot, { recursive: true, force: true });
}
