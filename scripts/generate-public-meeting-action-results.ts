import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeWhitespace, slugify, summarizeText } from "@/lib/public-meetings/shared";
import { cachedTopicNeedsEvidenceReview } from "@/lib/public-meetings/evidence-review";
import { resolveCachedMeetingDocumentUrl } from "@/lib/public-meetings/importer";
import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-action-results.json");
const AUDIT_PATH = path.join(GENERATED_DIR, "public-meeting-action-results-audit.json");
const MAX_MEETING_CONTEXT_CHARS = 80_000;

type ActionResultRecord = {
  id: string;
  meetingId: string;
  meetingItemId: string;
  bodyId: string | null;
  organizationId: string | null;
  actionTitle: string;
  agendaItemId: string | null;
  motionText: string | null;
  mover: string | null;
  seconder: string | null;
  outcome: string | null;
  voteCount: { yes: number; no: number; abstain: number | null } | null;
  namedVotes: Array<{ personName: string; vote: "yes" | "no" | "abstain" | "absent"; sourceSnippet: string }>;
  unanimous: boolean;
  sourceSnippet: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
};

type DocumentTextRecord = {
  documentId: string;
  meetingId: string;
  documentType: string;
  extractedTextPath: string | null;
  extractionMethod: "native_text" | "ocr_text" | "mixed" | "failed";
  extractionQuality: "high" | "medium" | "low" | "insufficient";
  textLength: number;
  sourceUrl?: string | null;
  sourceContentHash?: string | null;
};

type MeetingContext = { text: string; sourceUrl: string; sourcePath: string };

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function cleanName(value: string) {
  return normalizeWhitespace(
    value
      .replace(/^.*\bmeeting\.\s*/i, "")
      .replace(/\b(?:mayor|councilmember|council member|commissioner|trustee|senator|assemblymember|chair|vice chair|regent|member)\b\.?/gi, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/^[^A-Za-z]+|[^A-Za-z'. -]+$/g, ""),
  );
}

function isPersonLikeName(value: string) {
  return /^[A-Z][A-Za-z'. -]{2,90}$/.test(value) && !/\b(?:agenda|minutes|meeting|motion|public|comment|download|reader|windows|privacy|policy|department|services|employment)\b/i.test(value);
}

function parseVoteCount(text: string) {
  if (isAdministrativeAvailabilityNotice(text)) return null;
  const match = text.match(
    /\b(?:result\s*:\s*)?(?:approved|adopted|passed|carried|failed|denied|rejected|vote(?:\s+of)?|ayes?|nays?)[^.;\n]{0,80}?\b(\d{1,2})\s*[-–]\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\b/i,
  );
  if (!match) return null;
  return { yes: Number(match[1]), no: Number(match[2]), abstain: match[3] ? Number(match[3]) : 0 };
}

function namedVotes(text: string): ActionResultRecord["namedVotes"] {
  const votes: ActionResultRecord["namedVotes"] = [];
  const groupPattern =
    /\b(ayes?|yeas?|nays?|noes?|abstain(?:ed|ing)?|absent|excused)\s*(?:vote|votes)?\s*[:\-]\s*([^.;\n]{2,360}?)(?=\b(?:ayes?|yeas?|nays?|noes?|abstain(?:ed|ing)?|abstentions?|absent|excused)\b\s*(?:vote|votes)?\s*[:\-]?|[.;\n]|$)/gi;
  for (const match of text.matchAll(groupPattern)) {
    const rawVote = match[1].toLowerCase();
    const vote = /nay|noe/.test(rawVote) ? "no" : /abstain/.test(rawVote) ? "abstain" : /absent|excused/.test(rawVote) ? "absent" : "yes";
    if (/^\s*(?:none|n\/a|not applicable)\b/i.test(match[2])) continue;
    for (const rawName of match[2].split(/,|;|\band\b/i)) {
      const personName = cleanName(rawName);
      if (!/^[A-Z][A-Za-z'. -]{2,80}$/.test(personName)) continue;
      votes.push({ personName, vote, sourceSnippet: normalizeWhitespace(match[0]) });
    }
  }
  const inlinePattern = /\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3})\s*[:,]\s*(yes|aye|yea|no|nay|abstain|abstained|absent|excused)\b/gi;
  for (const match of text.matchAll(inlinePattern)) {
    const personName = cleanName(match[1]);
    const rawVote = match[2].toLowerCase();
    const vote = /no|nay/.test(rawVote) ? "no" : /abstain/.test(rawVote) ? "abstain" : /absent|excused/.test(rawVote) ? "absent" : "yes";
    if (/^[A-Z][A-Za-z'. -]{2,80}$/.test(personName)) votes.push({ personName, vote, sourceSnippet: normalizeWhitespace(match[0]) });
  }
  return [...new Map(votes.map((vote) => [`${vote.personName}:${vote.vote}:${vote.sourceSnippet}`, vote])).values()];
}

function extractMotion(text: string) {
  const motion =
    text.match(/\b((?:motion\s+(?:made\s+)?by|moved\s+by|upon\s+motion\s+by)\s+[^.;\n]{2,180})/i)?.[1] ??
    text.match(/\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3}\s+made\s+a\s+motion\s+to\s+[^.;\n]{2,180})/i)?.[1] ??
    null;
  return motion ? summarizeText(motion, 220) : null;
}

function extractMover(text: string) {
  const match =
    text.match(/\b(?:motion\s+(?:made\s+)?by|moved\s+by|upon\s+motion\s+by)\s+([^.;,\n]{2,120})/i) ??
    text.match(/\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3})\s+made\s+a\s+motion\s+to\b/i);
  if (!match) return null;
  const name = cleanName(match[1]);
  return isPersonLikeName(name) ? name : null;
}

function extractSeconder(text: string) {
  const match =
    text.match(/\bsecond(?:ed)?\s+by\s+([^.;,\n]{2,120})/i) ??
    text.match(/\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3})\s+second(?:ed)?\b/i);
  if (!match) return null;
  const name = cleanName(match[1]);
  return isPersonLikeName(name) ? name : null;
}

function extractOutcome(text: string) {
  if (/\b(?:staff report|project description|fiscal impact|public comment|information only|for discussion only)\b/i.test(text) && !/\b(?:motion\s+(?:carried|passes|passed|failed)|approved unanimously|adopted unanimously|by\s+(?:a\s+)?vote\s+of\s+\d{1,2}\s*[-–]\s*\d{1,2})\b/i.test(text)) {
    return null;
  }
  const match = text.match(
    /\b(?:with\s+all\s+ayes\s+in\s+favor[^.;\n]*|all\s+ayes\s+(?:are\s+)?in\s+favor[^.;\n]*|no\s+opposition[^.;\n]*|motion\s+(?:carried|passes|passed|failed)|approved|adopted|accepted|authorized|awarded|denied|rejected|continued)(?:\s+unanimously|\s+by\s+(?:a\s+)?vote\s+of\s+\d{1,2}\s*[-–]\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?)?[^.;\n]*/i,
  );
  if (!match) return null;
  const outcome = normalizeWhitespace(match[0]);
  if (isAdministrativeAvailabilityNotice(outcome)) return null;
  if (/\bapproved\s+(?:amount|site development plan|civil improvement plans|by\s+(?:the\s+)?(?:city|county|nshe)\s+(?:chief\s+)?(?:general\s+)?counsel|by\s+staff)\b/i.test(outcome)) return null;
  return summarizeText(outcome, 260);
}

function isActionable(text: string, item: PublicMeetingItemRecord) {
  if (isAdministrativeAvailabilityNotice(text)) return false;
  if (["public_comment", "closed_session", "presentation"].includes(item.item_type)) return false;
  const strongActionEvidence = Boolean(item.vote_outcome) || /\b(?:motion\s+(?:carried|passes|passed|failed)|motion\s+(?:made\s+)?by|moved\s+by|second(?:ed)?\s+by|approved unanimously|adopted unanimously|with\s+all\s+ayes|vote\s+of\s+\d{1,2}\s*[-–]\s*\d{1,2})\b/i.test(text);
  if (/\b(?:information only|for discussion only|informational report|presentation|public comment|staff report|project description|background)\b/i.test(text) && !strongActionEvidence) {
    return false;
  }
  if (/\b(?:for possible action|public comment interest card|free viewers are required|download acrobat reader|polling:\s+supports)\b/i.test(text) && !/\b(?:motion\s+(?:carried|passed|failed)|moved\s+by|second(?:ed)?\s+by|with\s+all\s+ayes|vote\s+of\s+\d|approved unanimously|unanimously approved)\b/i.test(text)) {
    return false;
  }
  return Boolean(item.vote_outcome) || /\b(?:all\s+ayes|no\s+opposition|motion\s+(?:carried|passes|passed|failed)|motion\s+(?:made\s+)?by|moved\s+by|second(?:ed)?\s+by|seconded\b|approved|adopted|accepted|authorized|awarded|denied|rejected|continued|unanimously|vote\s+of\s+\d)/i.test(text);
}

function isAdministrativeAvailabilityNotice(text: string) {
  return (
    /\bapproved\s+minutes\s+(?:of\s+the\s+)?(?:board|commission|committee|council|meeting)[^.;\n]{0,140}\b(?:available|posted)\s+(?:on|at)\s+https?:\/\//i.test(text) ||
    /\bapproved\s+minutes\s+(?:are\s+)?(?:available|posted)\s+(?:on|at)\s+https?:\/\//i.test(text) ||
    /\bapproved\s+(?:on\s+)?this\s+\d{1,2}[^.;\n]{0,40}\s+day\s+of\b/i.test(text) ||
    /\bapproved\s+by\s+this\s+(?:board|commission|committee|council)\s+in\s+\d{4}\b/i.test(text) ||
    /\bapproved\s+[—-]\s+unanimously\s+(?:mr|mrs|ms|dr)\b/i.test(text) ||
    /\bpolling:\s+supports\b/i.test(text) ||
    /\btotal\s+yes\s+\d+%\b/i.test(text) ||
    /\bplease\s+fill\s+out\s+a\s+public\s+comment\s+interest\s+card\b/i.test(text) ||
    /\bwelcome\s+to\s+[^.]{0,80}\bagenda\s+online\b/i.test(text) ||
    /\bfree\s+viewers\s+are\s+required\b/i.test(text) ||
    /\/kids-vote\b/i.test(text) ||
    /board\.nsf\/bd-getmeetingslistforseo/i.test(text) ||
    /board\.nsf\/public/i.test(text) ||
    /onbaseagendaonline/i.test(text)
  );
}

function meetingContextByMeetingId(meetings: PublicMeetingRecord[]) {
  const records = readJson<{ records?: DocumentTextRecord[] }>("public-meeting-document-text.json", { records: [] }).records ?? [];
  const documents = readJson<{ records: Array<{ id: string; meetingId: string; documentType: string; sourceUrl: string | null; provenance?: Array<{ meetingId: string }> }> }>("public-meeting-source-documents.json", { records: [] }).records;
  const cache = readJson<{ records: Array<{ documentId: string; contentHash: string; stableLocalPath: string }> }>("public-meeting-document-cache-index.json", { records: [] }).records;
  const cacheById = new Map(cache.map(record => [record.documentId, record]));
  const meetingById = new Map(meetings.flatMap(meeting => [meeting.id, ...(meeting.meeting_alias_ids ?? [])].map(id => [id, meeting] as const)));
  const byMeeting = new Map<string, MeetingContext[]>();
  for (const record of records) {
    // Shared context can upgrade a neighboring legacy item. Require native,
    // substantial minutes with an exact hash-backed citation before sharing it.
    // OCR and held text remain in the extraction ledger for explicit review.
    if (!record.extractedTextPath || record.extractionMethod !== "native_text" || !["high", "medium"].includes(record.extractionQuality)) continue;
    if (record.documentType !== "minutes" || !record.sourceContentHash) continue;
    const meeting = meetingById.get(record.meetingId);
    const cached = cacheById.get(record.documentId);
    if (!meeting || cached && cached.contentHash !== record.sourceContentHash) continue;
    const sourceUrl = resolveCachedMeetingDocumentUrl({ meeting, documentId: record.documentId, documentType: record.documentType,
      sourceHash: record.sourceContentHash, sourceUrl: record.sourceUrl ?? null, documents, cache });
    if (!sourceUrl) continue;
    let text = "";
    try {
      text = readFileSync(path.join(process.cwd(), record.extractedTextPath), "utf8");
    } catch {
      continue;
    }
    if (text.replace(/\n$/, "").length !== record.textLength || /%PDF-\d\.\d|\u0000/.test(text)) continue;
    text = cleanTextForContext(text);
    if (text.length < 1200) continue;
    const current = byMeeting.get(meeting.id) ?? [];
    current.push({ text, sourceUrl, sourcePath: cached?.stableLocalPath ?? record.extractedTextPath });
    byMeeting.set(meeting.id, current);
  }
  return byMeeting;
}

function cleanTextForContext(value: string) {
  return normalizeWhitespace(value).slice(0, MAX_MEETING_CONTEXT_CHARS);
}

function itemContextWindow(item: PublicMeetingItemRecord, meetingContext: string) {
  if (!meetingContext || item.vote_outcome) return "";
  const candidates = [
    item.source_text,
    item.source_snippet ?? "",
    item.title,
    item.description ?? "",
    item.item_number ? `${item.item_number}.` : "",
    item.item_number ? `Agenda Item ${item.item_number}` : "",
  ]
    .map((value) => normalizeWhitespace(value).slice(0, 140))
    .filter((value) => value.length >= 20 || /^\d+[A-Za-z.-]*$/.test(value));

  for (const candidate of candidates) {
    const index = meetingContext.toLowerCase().indexOf(candidate.toLowerCase());
    if (index < 0) continue;
    const start = Math.max(0, index - 700);
    const end = Math.min(meetingContext.length, index + Math.max(2600, candidate.length + 1800));
    const window = normalizeWhitespace(meetingContext.slice(start, end));
    if (/\b(?:motion|second|vote|approved|adopted|passed|denied|continued|unanimous|ayes?|nays?)\b/i.test(window)) return window;
  }
  return "";
}

function shouldUseMeetingContext(item: PublicMeetingItemRecord, baseText: string) {
  if (/\bmeeting materials\b/i.test(item.title) && baseText.length < 240) return true;
  return false;
}

function generateActionResults() {
  const generatedAt = new Date().toISOString();
  const items = readJson<PublicMeetingItemRecord[]>("public-meeting-items.json", []);
  const meetings = readJson<PublicMeetingRecord[]>("public-meetings.json", []);
  const bodies = readJson<PublicBodyRecord[]>("public-meeting-bodies.json", []);
  const meetingContext = meetingContextByMeetingId(meetings);
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const records: ActionResultRecord[] = [];

  for (const item of items) {
    if (cachedTopicNeedsEvidenceReview(item)) continue;
    const meeting = meetingById.get(item.meeting_id);
    const body = meeting ? bodyById.get(meeting.public_body_id) ?? null : null;
    const baseText = normalizeWhitespace(`${item.vote_outcome ?? ""}. ${item.source_text ?? ""}`);
    const context = (meetingContext.get(item.meeting_id) ?? []).map(source => ({ ...source,
      text: itemContextWindow(item, source.text) || (shouldUseMeetingContext(item, baseText) ? source.text : ""),
    })).find(source => source.text);
    const contextText = context?.text ?? "";
    const text = normalizeWhitespace(`${baseText}. ${contextText}`);
    if (!isActionable(text, item)) continue;
    const voteCount = parseVoteCount(text);
    const parsedNamedVotes = namedVotes(text);
    const motionText = extractMotion(text);
    const mover = extractMover(text);
    const seconder = extractSeconder(text);
    const outcome = item.vote_outcome ?? extractOutcome(text);
    const unanimous = /\bunanim(?:ous|ously)\b/i.test(text);
    const confidence = Number(
      Math.min(
        0.94,
        0.55 +
          (outcome ? 0.14 : 0) +
          (item.vote_outcome ? 0.1 : 0) +
          (motionText ? 0.1 : 0) +
          (voteCount ? 0.08 : 0) +
          (parsedNamedVotes.length ? 0.1 : 0) +
          (unanimous ? 0.07 : 0) +
          (item.source_url || item.source_local_path ? 0.04 : 0),
      ).toFixed(2),
    );
    const needsReview = confidence < 0.78 || (!outcome && !parsedNamedVotes.length);
    records.push({
      id: `action-result-${slugify(item.id)}`,
      meetingId: item.meeting_id,
      meetingItemId: item.id,
      bodyId: meeting?.public_body_id ?? null,
      organizationId: body?.seed_source_id ?? null,
      actionTitle: item.title,
      agendaItemId: item.item_number,
      motionText,
      mover,
      seconder,
      outcome,
      voteCount,
      namedVotes: parsedNamedVotes,
      unanimous,
      sourceSnippet: summarizeText(text, 700),
      sourceUrl: context?.sourceUrl ?? item.source_url ?? meeting?.minutes_url ?? meeting?.agenda_url ?? null,
      sourcePath: context?.sourcePath ?? item.source_local_path ?? item.cached_text_path ?? null,
      confidence,
      needsReview,
      reviewReason: needsReview ? "action_result_requires_review_or_more_source_detail" : null,
    });
  }

  const audit = {
    generatedAt,
    totals: {
      meetingItemsScanned: items.length,
      actionResultsExtracted: records.length,
      withMotion: records.filter((record) => record.motionText).length,
      withMover: records.filter((record) => record.mover).length,
      withSeconder: records.filter((record) => record.seconder).length,
      withOutcome: records.filter((record) => record.outcome).length,
      withVoteCount: records.filter((record) => record.voteCount).length,
      withNamedVotes: records.filter((record) => record.namedVotes.length).length,
      unanimousActions: records.filter((record) => record.unanimous).length,
      needsReview: records.filter((record) => record.needsReview).length,
      unlinkedToAgendaItem: records.filter((record) => !record.agendaItemId).length,
    },
    organizationReports: Array.from(
      records.reduce((map, record) => {
        const key = record.organizationId ?? record.bodyId ?? "unknown";
        const current = map.get(key) ?? { organizationId: key, actionResults: 0, withOutcome: 0, withVoteCount: 0, withNamedVotes: 0, needsReview: 0, unlinkedToAgendaItem: 0 };
        current.actionResults += 1;
        if (record.outcome) current.withOutcome += 1;
        if (record.voteCount) current.withVoteCount += 1;
        if (record.namedVotes.length) current.withNamedVotes += 1;
        if (record.needsReview) current.needsReview += 1;
        if (!record.agendaItemId) current.unlinkedToAgendaItem += 1;
        map.set(key, current);
        return map;
      }, new Map<string, any>()).values(),
    ).sort((left, right) => right.actionResults - left.actionResults),
  };
  return { generatedAt, records, audit };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const { generatedAt, records, audit } = generateActionResults();
writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, records }, null, 2)}\n`);
writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated ${records.length} public meeting action results at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
