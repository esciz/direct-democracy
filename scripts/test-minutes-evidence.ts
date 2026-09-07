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
