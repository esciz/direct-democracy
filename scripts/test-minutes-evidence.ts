import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const require = createRequire(import.meta.url);
const fixture = mkdtempSync(path.join(os.tmpdir(), "dd-minutes-evidence-"));
const generated = path.join(fixture, "data/generated");
mkdirSync(generated, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(path.join(generated, name), JSON.stringify(data));
const minutes = "Members present were Ada Example and Ben Example. Motion by Ada Example, seconded by Ben Example. Motion carried 2-0. ".repeat(20);
try {
  const makeMeeting = (id: string) => ({ id, public_body_id: "test-body", meeting_date: "2026-08-01", minutes_url: `https://example.gov/${id}.pdf`, source_local_paths: [], meeting_summary: minutes });
  const binaryPdf = `%PDF-1.7\n${minutes}\n1 0 obj\nstream\n\u0000\u0001\u0002\nendstream\n%%EOF`;
  write("public-meetings.json", [makeMeeting("agenda-only"), makeMeeting("snippet-only"), makeMeeting("real-minutes"), makeMeeting("broken-cache"),
    { ...makeMeeting("pdf-only"), source_local_paths: ["data/generated/minutes.pdf"] },
    { ...makeMeeting("pdf-and-text"), source_local_paths: ["data/generated/minutes.pdf"] },
    { ...makeMeeting("binary-item"), source_local_paths: ["data/generated/disguised-minutes.txt"] },
  ]);
  write("public-meeting-bodies.json", []);
  write("public-meeting-items.json", [
    { id: "agenda-item", meeting_id: "agenda-only", source_text: minutes, source_url: "https://example.gov/agenda.pdf" },
    { id: "binary-item", meeting_id: "binary-item", source_text: binaryPdf, source_url: "https://example.gov/binary-item.pdf" },
  ]);
  writeFileSync(path.join(generated, "agenda.txt"), minutes);
  writeFileSync(path.join(generated, "minutes.txt"), minutes);
  writeFileSync(path.join(generated, "minutes.pdf"), binaryPdf);
  writeFileSync(path.join(generated, "disguised-minutes.txt"), binaryPdf);
  write("public-meeting-document-text.json", { records: [
    { meetingId: "agenda-only", documentId: "agenda", documentType: "agenda", extractedTextPath: "data/generated/agenda.txt", extractionQuality: "high", extractionMethod: "native_text", sourceSnippet: minutes },
    { meetingId: "snippet-only", documentId: "snippet", documentType: "minutes", extractedTextPath: null, extractionQuality: "high", extractionMethod: "native_text", sourceSnippet: minutes },
    { meetingId: "real-minutes", documentId: "minutes", documentType: "minutes", extractedTextPath: "data/generated/minutes.txt", extractionQuality: "high", extractionMethod: "native_text", sourceSnippet: "Minutes" },
    { meetingId: "broken-cache", documentId: "broken", documentType: "minutes", extractedTextPath: "data/generated/missing.txt", extractionQuality: "high", extractionMethod: "native_text", sourceSnippet: minutes },
    { meetingId: "pdf-and-text", documentId: "extracted-pdf", documentType: "minutes", extractedTextPath: "data/generated/minutes.txt", extractionQuality: "high", extractionMethod: "native_text", sourceSnippet: "Minutes" },
  ] });
  execFileSync(process.execPath, ["--import", require.resolve("tsx"), path.join(root, "scripts/audit-minutes-extraction.ts")], { cwd: fixture, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json") }, stdio: "pipe" });
  const audit = JSON.parse(readFileSync(path.join(generated, "minutes-extraction-audit.json"), "utf8"));
  const rows = new Map<string, any>(audit.records.map((row: any) => [row.meetingId, row]));
  assert.equal(audit.totals.minutesWithUsableText, 2);
  assert.equal(rows.get("agenda-only").hasActionResult, false);
  assert.equal(rows.get("agenda-only").cachedTextLength, 0);
  assert.equal(rows.get("snippet-only").extractionQuality, "metadata_only");
  assert.equal(rows.get("snippet-only").hasNamedVotes, false);
  assert.equal(rows.get("broken-cache").minutesInNameOnly, true);
  assert.equal(rows.get("broken-cache").hasActionResult, false);
  assert.equal(rows.get("real-minutes").extractionQuality, "full_text");
  assert.equal(rows.get("real-minutes").hasActionResult, true);
  for (const id of ["pdf-only", "binary-item"]) {
    assert.equal(rows.get(id).minutesInNameOnly, true, "Raw PDF bytes must not count as extracted minutes");
    assert.equal(rows.get(id).hasActionResult, false);
    assert.equal(rows.get(id).cachedTextLength, 0);
  }
  assert.equal(rows.get("pdf-and-text").hasActionResult, true);
  assert(!rows.get("pdf-and-text").sourceSnippet.includes("%PDF"));
  assert.equal(rows.get("pdf-and-text").cachedTextLength, minutes.trim().length);
  const coverageIds = ["native-partial", "ocr-partial", "complete-native", "stale-ocr", "missing-partial"];
  write("public-meetings.json", coverageIds.map(id => ({ ...makeMeeting(id), source_local_paths: ["data/generated/minutes.txt"] })));
  write("public-meeting-items.json", [{ id: "long-excerpt", meeting_id: "native-partial", source_text: minutes, source_url: "https://example.gov/native-partial.pdf" }]);
  write("public-meeting-document-text.json", { records: coverageIds.map(id => ({
    meetingId: id, documentId: id, documentType: "minutes", extractedTextPath: id === "missing-partial" ? "data/generated/missing.txt" : "data/generated/minutes.txt",
    extractionQuality: "high", extractionMethod: id === "native-partial" ? "native_text" : "mixed", sourceContentHash: id,
    textCompleteness: id === "native-partial" || id === "missing-partial" ? "partial" : id === "complete-native" ? "complete" : "unknown",
  })) });
  write("public-meeting-ocr-results.json", { records: coverageIds.slice(1).map(id => ({
    documentId: id, sourceContentHash: id === "stale-ocr" ? "superseded-source" : id,
    ocrStatus: "succeeded", pagesDetected: 12, pagesSucceeded: 11, pagesFailed: 1, pagesTruncated: false,
  })) });
  execFileSync(process.execPath, ["--import", require.resolve("tsx"), path.join(root, "scripts/audit-minutes-extraction.ts")], { cwd: fixture, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json") }, stdio: "pipe" });
  const coverageAudit = JSON.parse(readFileSync(path.join(generated, "minutes-extraction-audit.json"), "utf8"));
  const coverageRows = new Map<string, any>(coverageAudit.records.map((row: any) => [row.meetingId, row]));
  for (const id of ["native-partial", "ocr-partial", "missing-partial"]) {
    assert.equal(coverageRows.get(id).extractionQuality, "partial_text", "Known missing pages must remain partial despite long excerpts and reused source paths");
    assert.equal(coverageRows.get(id).knownPartialPages, true);
  }
  for (const id of ["complete-native", "stale-ocr"]) assert.equal(coverageRows.get(id).extractionQuality, "full_text", "Complete native coverage and superseded OCR must not be downgraded");
  writeFileSync(path.join(generated, "bracket-minutes.txt"), `Header < ..\n${minutes}\n> Footer`);
  writeFileSync(path.join(generated, "html-minutes.html"), `<script>UNTRUSTED_SCRIPT</script><p>${minutes}</p>`);
  write("public-meetings.json", [makeMeeting("bracket-minutes"), makeMeeting("html-minutes")]);
  write("public-meeting-items.json", []);
  write("public-meeting-document-text.json", { records: ["bracket-minutes", "html-minutes"].map(id => ({
    meetingId: id, documentId: id, documentType: "minutes", extractionQuality: "high", extractionMethod: "native_text", textCompleteness: "complete",
    extractedTextPath: `data/generated/${id}.${id === "html-minutes" ? "html" : "txt"}`,
  })) });
  execFileSync(process.execPath, ["--import", require.resolve("tsx"), path.join(root, "scripts/audit-minutes-extraction.ts")], { cwd: fixture, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json") }, stdio: "pipe" });
  const bracketAudit = JSON.parse(readFileSync(path.join(generated, "minutes-extraction-audit.json"), "utf8"));
  for (const row of bracketAudit.records) {
    assert.equal(row.extractionQuality, "full_text");
    assert.equal(row.hasActionResult, true, "Literal angle brackets must not hide actions between PDF pages");
    assert.ok(row.cachedTextLength >= minutes.trim().length);
    assert.ok(!row.sourceSnippet.includes("UNTRUSTED_SCRIPT"), "Actual HTML still excludes script contents");
  }
  write("public-meetings.json", [
    { ...makeMeeting("later-approval"), minutes_url: null, source_urls: ["https://example.gov/prior-minutes.pdf"] },
    { ...makeMeeting("prior-meeting"), minutes_url: "https://example.gov/prior-minutes.pdf", source_urls: [] },
  ]);
  execFileSync(process.execPath, ["--import", require.resolve("tsx"), path.join(root, "scripts/discover-public-meeting-source-documents.ts")], { cwd: fixture, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json") }, stdio: "pipe" });
  const discovered = JSON.parse(readFileSync(path.join(generated, "public-meeting-source-documents.json"), "utf8"));
  const priorDocument = discovered.records.find((row: any) => row.sourceUrl === "https://example.gov/prior-minutes.pdf");
  assert.equal(priorDocument.meetingId, "prior-meeting", "An approval agenda must not steal ownership of the earlier meeting's minutes");
  assert.equal(priorDocument.documentType, "minutes");
  console.log("Minutes evidence checks passed: agenda, summary, snippets and missing cache do not count as extracted minutes.");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
