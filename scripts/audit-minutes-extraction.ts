import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeWhitespace, summarizeText } from "@/lib/public-meetings/shared";
import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "minutes-extraction-audit.json");
const MAX_SOURCE_BYTES = 1_500_000;
const MAX_SOURCE_CHARS = 220_000;

type ExtractionQuality = "full_text" | "partial_text" | "metadata_only" | "unreadable" | "blocked";
type DocumentTextArtifact = {
  records?: Array<{
    meetingId: string;
    documentId: string;
    documentType: string;
    extractedTextPath: string | null;
    extractionMethod: string;
    extractionQuality: string;
    sourceSnippet: string | null;
    failureReason: string | null;
  }>;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function readCachedText(localPath: string | null | undefined) {
  if (!localPath) return null;
  try {
    const absolutePath = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), localPath);
    const stats = statSync(absolutePath);
    if (stats.size > MAX_SOURCE_BYTES) return { text: "", quality: "blocked" as ExtractionQuality, reason: "source_file_too_large" };
    const bytes = readFileSync(absolutePath);
    // Downloaded files are evidence containers, not extracted prose. A PDF can
    // contain readable metadata and keywords while its page text is compressed.
    // Only the native/OCR text ledger may establish that those pages were read.
    if (/^\s*%PDF-/.test(bytes.subarray(0, 1024).toString("latin1")) || /\.(?:pdf|docx?|png|jpe?g|gif|webp|zip)$/i.test(absolutePath)) return { text: "", quality: "blocked" as ExtractionQuality, reason: "binary_document_requires_text_extraction" };
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes).slice(0, MAX_SOURCE_CHARS);
    if (sourceLooksBinary(raw)) return { text: "", quality: "blocked" as ExtractionQuality, reason: "binary_document_requires_text_extraction" };
    const text = cleanSourceText(raw);
    return { text, quality: qualityForText(text), reason: null };
  } catch {
    return { text: "", quality: "unreadable" as ExtractionQuality, reason: "source_file_unreadable" };
  }
}

function sourceLooksBinary(value: string) {
  return /%PDF-\d\.\d|\u0000|PK\u0003\u0004/.test(value) || (value.match(/\uFFFD/g)?.length ?? 0) > Math.max(3, value.length * 0.01);
}

function cleanSourceText(value: string) {
  if (sourceLooksBinary(value)) return "";
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\b(?:font-family|font-size|Times New Roman|Helvetica|Arial|serif|sans-serif)\b/gi, " ")
      .replace(/\s+/g, " "),
  );
}

function qualityForText(text: string): ExtractionQuality {
  if (!text || sourceLooksBinary(text)) return "unreadable";
  if (text.length < 300) return "metadata_only";
  if (text.length < 1200) return "partial_text";
  if (/\b(?:motion|second|approved|adopted|vote|roll call|present|absent|minutes)\b/i.test(text)) return "full_text";
  return "partial_text";
}

function sourceTextsForMeeting(meeting: PublicMeetingRecord, items: PublicMeetingItemRecord[], documentTexts: NonNullable<DocumentTextArtifact["records"]>) {
  const sources: Array<{ text: string; document: string | null; quality: ExtractionQuality; reason: string | null }> = [];
  const seen = new Set<string>();
  // A calendar description or agenda is not evidence that the minutes were read.
  // Keep only text traceable to the minutes themselves; snippets are metadata.
  const isMinutesPath = (value: string | null | undefined) => Boolean(value && /(?:^|[\/_ .-])minutes?(?:[\/_ .-]|$)/i.test(value));
  const minutesPaths = new Set(documentTexts.filter((document) => document.documentType === "minutes").map((document) => document.extractedTextPath).filter(Boolean));
  for (const localPath of meeting.source_local_paths ?? []) {
    if (!isMinutesPath(localPath) && !minutesPaths.has(localPath)) continue;
    if (seen.has(localPath)) continue;
    seen.add(localPath);
    const read = readCachedText(localPath);
    if (read) sources.push({ text: read.text, document: localPath, quality: read.quality, reason: read.reason });
  }
  for (const item of items) {
    const fromMinutes = Boolean(meeting.minutes_url && item.source_url === meeting.minutes_url)
      || isMinutesPath(item.source_local_path) || minutesPaths.has(item.source_local_path ?? null)
      || minutesPaths.has(item.cached_text_path);
    if (!fromMinutes) continue;
    if (item.source_text) {
      const text = cleanSourceText(item.source_text);
      sources.push({ text, document: item.source_local_path ?? item.cached_text_path ?? item.source_url, quality: qualityForText(text), reason: text ? null : "source_text_unusable" });
    }
    for (const localPath of [item.source_local_path, item.cached_text_path].filter(Boolean) as string[]) {
      if (seen.has(localPath)) continue;
      seen.add(localPath);
      const read = readCachedText(localPath);
      if (read) sources.push({ text: read.text, document: localPath, quality: read.quality, reason: read.reason });
    }
  }
  for (const documentText of documentTexts) {
    if (documentText.documentType !== "minutes") continue;
    if (documentText.extractedTextPath && seen.has(documentText.extractedTextPath)) continue;
    let text = cleanSourceText(documentText.sourceSnippet ?? "");
    let quality: ExtractionQuality = text ? "metadata_only" : "unreadable";
    let reason = documentText.failureReason;
    if (documentText.extractedTextPath) {
      const read = readCachedText(documentText.extractedTextPath);
      if (read?.text) { text = read.text; quality = read.quality; }
      else { reason = read?.reason ?? reason; quality = read?.quality ?? quality; }
      seen.add(documentText.extractedTextPath);
    }
    sources.push({
      text,
      document: documentText.documentId,
      quality,
      reason,
    });
  }
  return sources;
}

function flagsFor(text: string) {
  const normalized = normalizeWhitespace(text);
  return {
    hasAttendanceSection: /\b(?:members|commissioners|councilmembers|trustees|regents|senators|assemblymembers|supervisors)\s+(?:present|absent)|\bpresent\s+were\b|\babsent\s+were\b|\ball\s+(?:members|commissioners|trustees|regents|supervisors)\s+(?:were\s+)?present\b/i.test(normalized),
    hasRollCall: /\broll\s+call\b/i.test(normalized),
    hasActionResult: /\b(?:motion\s+(?:carried|passed|failed)|approved|adopted|denied|rejected|continued|accepted|authorized|awarded)\b/i.test(normalized),
    hasMotion: /\b(?:motion\s+(?:made\s+)?by|moved\s+by|upon\s+motion\s+by)\b/i.test(normalized),
    hasSecond: /\bsecond(?:ed)?\s+by\b/i.test(normalized),
    hasVoteCount: /\b(?:vote\s+of\s+)?\d{1,2}\s*[-–]\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?\b/i.test(normalized),
    hasNamedVotes: /\b(?:ayes?|yeas?|nays?|noes?)\s*[:\-]\s*[A-Z]|\b[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,2}\s*[:,]\s*(?:yes|aye|no|nay|abstain)\b/i.test(normalized),
    hasUnanimousLanguage: /\bunanim(?:ous|ously)\b/i.test(normalized),
    isAdjournmentOnly: /\badjourn(?:ed|ment)\b/i.test(normalized) && !/\b(?:motion|approved|adopted|vote|public hearing|contract|ordinance|resolution)\b/i.test(normalized),
  };
}

function generateAudit() {
  const generatedAt = new Date().toISOString();
  const meetings = readJson<PublicMeetingRecord[]>("public-meetings.json", []);
  const items = readJson<PublicMeetingItemRecord[]>("public-meeting-items.json", []);
  const bodies = readJson<PublicBodyRecord[]>("public-meeting-bodies.json", []);
  const documentText = readJson<DocumentTextArtifact>("public-meeting-document-text.json", { records: [] });
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const itemsByMeeting = new Map<string, PublicMeetingItemRecord[]>();
  for (const item of items) itemsByMeeting.set(item.meeting_id, [...(itemsByMeeting.get(item.meeting_id) ?? []), item]);
  const documentTextByMeeting = new Map<string, NonNullable<DocumentTextArtifact["records"]>>();
  for (const record of documentText.records ?? []) documentTextByMeeting.set(record.meetingId, [...(documentTextByMeeting.get(record.meetingId) ?? []), record]);

  const records = meetings
    .filter((meeting) => Boolean(meeting.minutes_url) || (meeting.source_local_paths ?? []).some((sourcePath) => /(?:^|[\/_ .-])minutes?(?:[\/_ .-]|$)/i.test(sourcePath)) || (documentTextByMeeting.get(meeting.id) ?? []).some((document) => document.documentType === "minutes"))
    .map((meeting) => {
      const body = bodyById.get(meeting.public_body_id);
      const sources = sourceTextsForMeeting(meeting, itemsByMeeting.get(meeting.id) ?? [], documentTextByMeeting.get(meeting.id) ?? []);
      const combinedText = [...new Set(sources.map((source) => source.text).filter(Boolean))].join(" ");
      const sourceDocuments = [...new Set(sources.map((source) => source.document).filter(Boolean))];
      const flags = flagsFor(sources.filter((source) => source.quality === "full_text" || source.quality === "partial_text").map((source) => source.text).join(" "));
      const bestQuality = sources.some((source) => source.quality === "full_text")
        ? "full_text"
        : sources.some((source) => source.quality === "partial_text")
          ? "partial_text"
          : sources.some((source) => source.quality === "metadata_only")
            ? "metadata_only"
            : sources.some((source) => source.quality === "blocked")
              ? "blocked"
              : "unreadable";
      return {
        meetingId: meeting.id,
        bodyId: meeting.public_body_id,
        organizationId: body?.seed_source_id ?? null,
        bodyName: body?.name ?? "Unknown body",
        jurisdiction: body?.jurisdiction ?? null,
        meetingDate: meeting.meeting_date,
        minutesUrl: meeting.minutes_url,
        extractionQuality: bestQuality as ExtractionQuality,
        sourceDocuments,
        sourceDocumentCount: sourceDocuments.length,
        cachedTextLength: combinedText.length,
        ...flags,
        minutesInNameOnly: bestQuality === "metadata_only" || bestQuality === "unreadable" || bestQuality === "blocked",
        cachedSourceTooThin: combinedText.length < 500,
        sourceSnippet: summarizeText(combinedText, 520),
      };
    });

  const organizationReports = Array.from(
    records.reduce((map, record) => {
      const key = record.organizationId ?? record.bodyId;
      const current = map.get(key) ?? {
        organizationId: key,
        bodyName: record.bodyName,
        jurisdiction: record.jurisdiction,
        meetingsWithMinutes: 0,
        usableAttendanceText: 0,
        actionResultText: 0,
        voteResultText: 0,
        minutesInNameOnly: 0,
        cachedSourceTooThin: 0,
      };
      current.meetingsWithMinutes += 1;
      if (record.hasAttendanceSection || record.hasRollCall) current.usableAttendanceText += 1;
      if (record.hasActionResult || record.hasMotion || record.hasSecond) current.actionResultText += 1;
      if (record.hasVoteCount || record.hasNamedVotes || record.hasUnanimousLanguage) current.voteResultText += 1;
      if (record.minutesInNameOnly) current.minutesInNameOnly += 1;
      if (record.cachedSourceTooThin) current.cachedSourceTooThin += 1;
      map.set(key, current);
      return map;
    }, new Map<string, any>()).values(),
  ).sort((left, right) => right.meetingsWithMinutes - left.meetingsWithMinutes);

  const totals = {
    minutesScanned: records.length,
    minutesWithUsableText: records.filter((record) => record.extractionQuality === "full_text" || record.extractionQuality === "partial_text").length,
    meetingsWithUsableAttendanceText: records.filter((record) => record.hasAttendanceSection || record.hasRollCall).length,
    meetingsWithActionResultText: records.filter((record) => record.hasActionResult || record.hasMotion || record.hasSecond).length,
    meetingsWithVoteResultText: records.filter((record) => record.hasVoteCount || record.hasNamedVotes || record.hasUnanimousLanguage).length,
    minutesInNameOnly: records.filter((record) => record.minutesInNameOnly).length,
    cachedSourceTooThin: records.filter((record) => record.cachedSourceTooThin).length,
    adjournmentOnlyOrNoAction: records.filter((record) => record.isAdjournmentOnly).length,
  };

  return { generatedAt, totals, qualityCounts: records.reduce<Record<string, number>>((counts, record) => ({ ...counts, [record.extractionQuality]: (counts[record.extractionQuality] ?? 0) + 1 }), {}), organizationReports, records };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const audit = generateAudit();
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated minutes extraction audit at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
