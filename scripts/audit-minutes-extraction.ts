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
    const raw = readFileSync(absolutePath, "utf8").slice(0, MAX_SOURCE_CHARS);
    const text = cleanSourceText(raw);
    return { text, quality: qualityForText(text), reason: null };
  } catch {
    return { text: "", quality: "unreadable" as ExtractionQuality, reason: "source_file_unreadable" };
  }
}

function cleanSourceText(value: string) {
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
  if (!text) return "unreadable";
  if (text.length < 300) return "metadata_only";
  if (text.length < 1200) return "partial_text";
  if (/\b(?:motion|second|approved|adopted|vote|roll call|present|absent|minutes)\b/i.test(text)) return "full_text";
  return "partial_text";
}

function sourceTextsForMeeting(meeting: PublicMeetingRecord, items: PublicMeetingItemRecord[], documentTexts: NonNullable<DocumentTextArtifact["records"]>) {
  const sources: Array<{ text: string; document: string | null; quality: ExtractionQuality; reason: string | null }> = [];
  const seen = new Set<string>();
  if (meeting.meeting_summary) sources.push({ text: cleanSourceText(meeting.meeting_summary), document: meeting.minutes_url ?? meeting.agenda_url ?? null, quality: qualityForText(meeting.meeting_summary), reason: null });
  for (const localPath of meeting.source_local_paths ?? []) {
    if (seen.has(localPath)) continue;
    seen.add(localPath);
    const read = readCachedText(localPath);
    if (read) sources.push({ text: read.text, document: localPath, quality: read.quality, reason: read.reason });
  }
  for (const item of items) {
    if (item.source_text) sources.push({ text: cleanSourceText(item.source_text), document: item.source_local_path ?? item.cached_text_path ?? item.source_url, quality: qualityForText(item.source_text), reason: null });
    for (const localPath of [item.source_local_path, item.cached_text_path].filter(Boolean) as string[]) {
      if (seen.has(localPath)) continue;
      seen.add(localPath);
      const read = readCachedText(localPath);
      if (read) sources.push({ text: read.text, document: localPath, quality: read.quality, reason: read.reason });
    }
  }
  for (const documentText of documentTexts) {
    let text = documentText.sourceSnippet ?? "";
    if (documentText.extractedTextPath) {
      const read = readCachedText(documentText.extractedTextPath);
      if (read?.text) text = read.text;
    }
    sources.push({
      text,
      document: documentText.documentId,
      quality: documentText.extractionQuality === "high" || documentText.extractionQuality === "medium" ? "full_text" : documentText.extractionQuality === "low" ? "partial_text" : "metadata_only",
      reason: documentText.failureReason,
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
    .filter((meeting) => Boolean(meeting.minutes_url) || (meeting.source_local_paths ?? []).some((sourcePath) => /minutes?|result|journal/i.test(sourcePath)))
    .map((meeting) => {
      const body = bodyById.get(meeting.public_body_id);
      const sources = sourceTextsForMeeting(meeting, itemsByMeeting.get(meeting.id) ?? [], documentTextByMeeting.get(meeting.id) ?? []);
      const combinedText = sources.map((source) => source.text).join(" ");
      const flags = flagsFor(combinedText);
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
        sourceDocuments: sources.map((source) => source.document).filter(Boolean),
        sourceDocumentCount: sources.length,
        cachedTextLength: combinedText.length,
        ...flags,
        minutesInNameOnly: bestQuality === "metadata_only" || bestQuality === "unreadable",
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
