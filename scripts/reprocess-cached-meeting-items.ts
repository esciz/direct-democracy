import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CACHED_MEETING_TOPIC_PARSER_VERSION, parseCachedPublicMeetingDocument, resolveCachedMeetingDocumentUrl } from "@/lib/public-meetings/importer";
import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const root = path.join(process.cwd(), "data/generated");
function read<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path.join(root, file), "utf8")) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
}
function write(file: string, value: unknown) {
  const target = path.join(root, file);
  writeFileSync(`${target}.${process.pid}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(`${target}.${process.pid}.tmp`, target);
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const now = new Date().toISOString();
const selectedSources = process.argv.filter((arg) => arg.startsWith("--source=")).flatMap((arg) => arg.slice(9).split(","));
const selectedDocumentType = process.argv.find((arg) => arg.startsWith("--document-type="))?.slice("--document-type=".length) ?? null;
if (selectedDocumentType && !["agenda", "minutes", "packet"].includes(selectedDocumentType)) throw new Error("--document-type must be agenda, minutes, or packet");
const limit = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? "100");
if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a positive integer");
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const meetings = new Map(read<PublicMeetingRecord[]>("public-meetings.json", []).map((meeting) => [meeting.id, meeting]));
const bodies = new Map(read<PublicBodyRecord[]>("public-meeting-bodies.json", []).map((body) => [body.id, body]));
const reviewCandidates = new Map(read<{ records: Array<{ id: string; [key: string]: unknown }> }>("public-meeting-item-review-candidates.json", { records: [] }).records.map((row) => [row.id, row]));
const items = new Map(read<PublicMeetingItemRecord[]>("public-meeting-items.json", []).map((item) => [item.id, item]));
const approved = new Set([
  ...read<Array<{ topic_item_id: string; review_status: string }>>("public-meeting-voting-cards.json", []).filter((row) => row.review_status === "approved").map((row) => row.topic_item_id),
  ...read<Array<{ topic_item_id: string; review_status: string }>>("public-meeting-official-actions.json", []).filter((row) => row.review_status === "approved").map((row) => row.topic_item_id),
]);
type TextRecord = { documentId: string; meetingId: string; documentType: string; extractedTextPath: string | null; sourceUrl: string | null; sourcePath: string | null; extractionQuality: string; extractionMethod: string; sourceContentHash?: string | null; extractedAt: string };
type ParseState = { documentId: string; meetingId: string; sourceHash: string; textHash: string; parserVersion: number; itemIds: string[]; parsedAt: string };
const cache = new Map(read<{ records: Array<{ documentId: string; contentHash: string; stableLocalPath: string }> }>("public-meeting-document-cache-index.json", { records: [] }).records.map((row) => [row.documentId, row]));
const state = new Map(read<{ records: ParseState[] }>("public-meeting-item-processing-state.json", { records: [] }).records.map((row) => [row.documentId, row]));
const sourceDocuments = read<{ records: Array<{ id: string; meetingId: string; documentType: string; sourceUrl: string | null; provenance?: Array<{ meetingId: string }> }> }>("public-meeting-source-documents.json", { records: [] }).records;
const documents = read<{ records: TextRecord[] }>("public-meeting-document-text.json", { records: [] }).records;
const minutesUrls = new Set(documents.filter((row) => row.documentType === "minutes").map((row) => row.sourceUrl).filter(Boolean));
const key = (item: PublicMeetingItemRecord) => item.item_number ? `${item.meeting_id}:${item.item_number.toLowerCase()}:${item.title.toLowerCase().replace(/^(?:item\s+)?[\da-z]+[.)]\s*/i, "").replace(/[^a-z0-9]+/g, " ").trim()}` : item.id;
const identities = new Map([...items.values()].map((item) => [key(item), item.id]));
const report: Array<{ documentId: string; meetingId: string; status: string; itemCount: number; reason?: string }> = [];
let processed = 0;
for (const document of [...documents].sort((left, right) => right.extractedAt.localeCompare(left.extractedAt))) {
  const meeting = meetings.get(document.meetingId);
  const body = meeting ? bodies.get(meeting.public_body_id) : undefined;
  if (!meeting || meeting.source_method === "manual_fixture" || !["agenda", "minutes", "packet"].includes(document.documentType) || !document.extractedTextPath) continue;
  if (selectedDocumentType && document.documentType !== selectedDocumentType) continue;
  if (selectedSources.length && (!body || !selectedSources.includes(body.seed_source_id))) continue;
  if (!["high", "medium"].includes(document.extractionQuality)) continue;
  let text: string;
  try { text = readFileSync(path.resolve(process.cwd(), document.extractedTextPath), "utf8"); }
  catch { report.push({ documentId: document.documentId, meetingId: meeting.id, status: "blocked", itemCount: 0, reason: "extracted_text_missing" }); continue; }
  const cached = cache.get(document.documentId);
  if (document.sourceContentHash && cached && document.sourceContentHash !== cached.contentHash) {
    report.push({ documentId: document.documentId, meetingId: meeting.id, status: "blocked", itemCount: 0, reason: "text_does_not_match_current_document_version" }); continue;
  }
  const textHash = hash(text);
  const sourceHash = document.sourceContentHash ?? cached?.contentHash ?? textHash;
  const previous = state.get(document.documentId);
  if (!force && previous?.textHash === textHash && previous.sourceHash === sourceHash && previous.parserVersion === CACHED_MEETING_TOPIC_PARSER_VERSION && previous.itemIds.every((id) => items.has(id))) continue;
  if (processed >= limit) continue;
  processed += 1;
  const drafts = parseCachedPublicMeetingDocument({ meeting, body: body ?? null, documentId: document.documentId,
    documentType: document.documentType === "packet" ? "board_packet" : document.documentType as "agenda" | "minutes",
    text, sourceUrl: resolveCachedMeetingDocumentUrl({ meeting, documentId: document.documentId, documentType: document.documentType, sourceHash, sourceUrl: document.sourceUrl, documents: sourceDocuments, cache: [...cache.values()] }), sourceHash, textPath: document.extractedTextPath,
    sourcePath: cached?.stableLocalPath ?? document.sourcePath, ocr: document.extractionMethod !== "native_text" });
  const newIds: string[] = [];
  for (const draft of drafts) {
    const existingId = identities.get(key(draft));
    const old = existingId ? items.get(existingId) : undefined;
    const next = { ...draft, id: old?.id ?? draft.id };
    const keepExisting = old && (approved.has(old.id) || (document.documentType !== "minutes" && old.source_url && minutesUrls.has(old.source_url)));
    if (old && approved.has(old.id) && old.source_document_hash !== sourceHash && old.source_text !== next.source_text) {
      const candidateId = `${document.documentId}:${old.id}:${sourceHash}`;
      reviewCandidates.set(candidateId, { id: candidateId, status: "needs_review", reason: "reviewed_item_has_new_source_evidence", documentId: document.documentId, existingItemId: old.id, meetingId: meeting.id, sourceHash, detectedAt: now, proposedItem: next });
    }
    if (!keepExisting) items.set(next.id, next);
    identities.set(key(next), next.id);
    newIds.push(next.id);
  }
  // Prior versions are retained if reviewed or still referenced by another document.
  for (const oldId of previous?.itemIds ?? []) {
    if (!newIds.includes(oldId) && !approved.has(oldId) && ![...state.values()].some((row) => row.documentId !== document.documentId && row.itemIds.includes(oldId))) items.delete(oldId);
  }
  state.set(document.documentId, { documentId: document.documentId, meetingId: meeting.id, sourceHash, textHash, parserVersion: CACHED_MEETING_TOPIC_PARSER_VERSION, itemIds: newIds, parsedAt: now });
  report.push({ documentId: document.documentId, meetingId: meeting.id, status: drafts.some((draft) => !draft.item_number) ? "needs_document_review" : "topics_extracted_for_review", itemCount: newIds.length });
}
const artifact = { generatedAt: now, dryRun, limit, sources: selectedSources, documentType: selectedDocumentType, totals: { documentsProcessed: processed, itemRecords: items.size, reviewedItemChangesPending: reviewCandidates.size, documentsBlocked: report.filter((row) => row.status === "blocked").length, documentsNeedingReview: report.filter((row) => row.status === "needs_document_review").length }, records: report };
if (!dryRun) {
  mkdirSync(root, { recursive: true });
  write("public-meeting-items.json", [...items.values()]);
  write("public-meeting-item-processing-state.json", { generatedAt: now, records: [...state.values()] });
  write("public-meeting-item-processing-report.json", artifact);
  write("public-meeting-item-review-candidates.json", { generatedAt: now, records: [...reviewCandidates.values()] });
}
console.log(JSON.stringify(artifact, null, 2));
