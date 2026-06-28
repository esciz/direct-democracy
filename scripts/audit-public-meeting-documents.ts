import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-document-audit.json");

function readJson<T>(fileName: string): T {
  return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
}

const documents = readJson<{ records: Array<{ id?: string; meetingId?: string; sourceUrl?: string | null; sourcePath?: string | null; retrievalStatus?: string; provenance?: unknown[] }> }>("public-meeting-source-documents.json");
const text = readJson<{ records: Array<{ documentId?: string; extractionMethod?: string; extractionQuality?: string; confidence?: number; failureReason?: string | null }> }>("public-meeting-document-text.json");
const completeness = readJson<{ totals: Record<string, number>; meetingRecords: Array<{ meetingId: string; sourceQuality: string; recommendedNextAction: string; missingFields: string[] }> }>("public-meeting-source-completeness.json");
const readiness = readJson<{ officialScorecardsSafe: boolean; blocker: string | null }>("public-meeting-accountability-readiness.json");

const failures: string[] = [];
for (const document of documents.records) {
  if (!document.id) failures.push("Discovered document missing id");
  if (!document.meetingId) failures.push(`Document ${document.id ?? "unknown"} missing meetingId`);
  if (!document.sourceUrl && !document.sourcePath) failures.push(`Document ${document.id ?? "unknown"} missing sourceUrl/sourcePath`);
  if (!document.retrievalStatus) failures.push(`Document ${document.id ?? "unknown"} missing retrievalStatus`);
  if (!document.provenance?.length) failures.push(`Document ${document.id ?? "unknown"} missing provenance`);
}

const textByDoc = new Map(text.records.map((record) => [record.documentId, record]));
for (const document of documents.records) {
  if (!textByDoc.has(document.id)) failures.push(`Document ${document.id ?? "unknown"} missing text extraction row`);
}
for (const record of text.records) {
  if (!record.documentId) failures.push("Document text row missing documentId");
  if (!record.extractionMethod) failures.push(`Document text ${record.documentId ?? "unknown"} missing extractionMethod`);
  if (!record.extractionQuality) failures.push(`Document text ${record.documentId ?? "unknown"} missing extractionQuality`);
  if (typeof record.confidence !== "number") failures.push(`Document text ${record.documentId ?? "unknown"} missing confidence`);
}

const audit = {
  generatedAt: new Date().toISOString(),
  totals: {
    documents: documents.records.length,
    textRows: text.records.length,
    localCached: documents.records.filter((document) => document.retrievalStatus === "local_cached").length,
    remoteDiscovered: documents.records.filter((document) => document.retrievalStatus === "remote_discovered").length,
    textExtracted: text.records.filter((record) => record.extractionMethod !== "failed").length,
    failedExtraction: text.records.filter((record) => record.extractionMethod === "failed").length,
    meetingsScored: completeness.totals.meetingsScored,
    highQualityMeetings: completeness.totals.highQualityMeetings,
    sourceGapMeetings: completeness.totals.meetingsBlockedBySourceGaps,
    parserGapMeetings: completeness.totals.meetingsBlockedByParserGaps,
  },
  officialScorecardsSafe: readiness.officialScorecardsSafe,
  blocker: readiness.blocker,
  topReviewQueues: {
    sourceGaps: completeness.meetingRecords.filter((record) => record.recommendedNextAction === "recover_or_extract_full_source_document").slice(0, 20),
    parserGaps: completeness.meetingRecords.filter((record) => record.recommendedNextAction === "review_action_result_extraction").slice(0, 20),
    missingAttendance: completeness.meetingRecords.filter((record) => record.missingFields.includes("attendance")).slice(0, 20),
  },
  failures,
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

if (failures.length) {
  console.error("Public meeting document audit failed:");
  for (const failure of failures.slice(0, 30)) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public meeting document audit passed.");
console.log(JSON.stringify(audit.totals, null, 2));
