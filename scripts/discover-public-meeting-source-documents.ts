import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

import { slugify } from "@/lib/public-meetings/shared";
import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-source-documents.json");
const PRIORITY_SOURCE_IDS = new Set([
  "carson-city-board-of-supervisors",
  "reno-city-council",
  "sparks-city-council",
  "washoe-county-commission",
  "clark-county-commission",
  "las-vegas-city-council",
  "henderson-city-council",
  "north-las-vegas-city-council",
  "clark-county-school-district",
  "nshe-board-of-regents",
  "nv-legislature",
  "nv-senate",
  "nv-assembly",
]);

type SourceDocumentType = "agenda" | "minutes" | "packet" | "staff_report" | "attachment" | "vote_record" | "result_page" | "supporting_document" | "unknown";

type SourceDocumentRecord = {
  id: string;
  meetingId: string;
  meetingItemIds: string[];
  bodyId: string | null;
  organizationId: string | null;
  jurisdiction: string | null;
  documentType: SourceDocumentType;
  sourceUrl: string | null;
  sourcePath: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  cached: boolean;
  cachedPath: string | null;
  contentHash: string | null;
  sizeBytes: number | null;
  discoveredAt: string;
  retrievalStatus: "local_cached" | "remote_discovered" | "missing" | "unreadable_local";
  priorityBody: boolean;
  provenance: Array<{ meetingId: string; meetingItemId: string | null; field: string }>;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashFile(localPath: string) {
  try {
    const absolutePath = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), localPath);
    return createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
  } catch {
    return null;
  }
}

function fileSize(localPath: string) {
  try {
    const absolutePath = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), localPath);
    return statSync(absolutePath).size;
  } catch {
    return null;
  }
}

function hostFor(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function platformFor(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("legistar")) return "legistar";
  if (lower.includes("primegov") || lower.includes("publicportal")) return "primegov";
  if (lower.includes("boarddocs")) return "boarddocs";
  if (lower.includes("diligent")) return "diligent";
  if (lower.includes("granicus")) return "granicus";
  if (lower.includes("leg.state.nv.us")) return "nevada_legislature";
  return "civic_website";
}

function documentTypeFor(value: string, field: string): SourceDocumentType {
  const lower = `${field} ${value}`.toLowerCase();
  if (lower.includes("agenda-packet") || lower.includes("packet")) return "packet";
  if (lower.includes("minutes") || lower.includes("journal")) return "minutes";
  if (lower.includes("agenda")) return "agenda";
  if (lower.includes("staff") || lower.includes("report")) return "staff_report";
  if (lower.includes("attachment") || lower.includes("support")) return "attachment";
  if (lower.includes("vote") || lower.includes("rollcall") || lower.includes("roll-call")) return "vote_record";
  if (lower.includes("result")) return "result_page";
  if (lower.includes(".pdf") || lower.includes("document")) return "supporting_document";
  return "unknown";
}

function isNonMeetingUtilitySource(sourceUrl: string | null, sourcePath: string | null) {
  const value = `${sourceUrl ?? ""} ${sourcePath ?? ""}`.toLowerCase();
  return (
    value.includes("/api/opendata/getmatomoconfig") ||
    value.includes("/api/v2/publicportal/getarchivedmeetingyears") ||
    value.includes("/shared/getfontsizecookie") ||
    value.includes("/residents/sign-up/voter-registration") ||
    value.includes("/government/departments/city-clerk/elections/voter-information") ||
    value.includes("/government/departments/city-clerk/elections/kids-vote") ||
    value.includes("?splash=") ||
    value.includes("/metadata/undated-api-json-") ||
    value.includes("/mediaplayer.php") ||
    value.includes("gov.nv.gov/boards/") ||
    value.includes("/app/nelis/rel/83rd2025/house/senate") ||
    value.includes("/app/nelis/rel/83rd2025/house/assembly") ||
    value.includes("/government/public-meeting-agendas") ||
    value.includes("/residents/sign-up/agenda-requests") ||
    value.includes("/agenda-requests") ||
    value.includes("/agendas-back-up-minutes-video") ||
    value.includes("board.nsf/bd-getmeetingslistforseo") ||
    value.includes("board.nsf/public") ||
    value.includes("/division/research/content/items/bill-draft-requests-allowed-by-entity") ||
    value.includes("/bills/undated-bdrs-allowed-by-entity-")
  );
}

function addDocument(
  map: Map<string, SourceDocumentRecord>,
  input: {
    meeting: PublicMeetingRecord;
    body: PublicBodyRecord | undefined;
    meetingItemId: string | null;
    field: string;
    sourceUrl?: string | null;
    sourcePath?: string | null;
    discoveredAt: string;
  },
) {
  const sourceUrl = input.sourceUrl ?? null;
  const sourcePath = input.sourcePath ?? null;
  if (!sourceUrl && !sourcePath) return;
  if (isNonMeetingUtilitySource(sourceUrl, sourcePath)) return;
  const key = sourceUrl ? `url:${sourceUrl}` : `path:${sourcePath}`;
  const sizeBytes = sourcePath ? fileSize(sourcePath) : null;
  const contentHash = sourcePath ? hashFile(sourcePath) : sourceUrl ? hashText(sourceUrl) : null;
  const cached = Boolean(sourcePath && sizeBytes !== null);
  const valueForType = `${sourceUrl ?? ""} ${sourcePath ?? ""}`;
  const existing = map.get(key);
  if (existing) {
    if (input.meetingItemId && !existing.meetingItemIds.includes(input.meetingItemId)) existing.meetingItemIds.push(input.meetingItemId);
    existing.provenance.push({ meetingId: input.meeting.id, meetingItemId: input.meetingItemId, field: input.field });
    return;
  }
  map.set(key, {
    id: `meeting-source-document-${slugify(contentHash ?? key).slice(0, 64)}`,
    meetingId: input.meeting.id,
    meetingItemIds: input.meetingItemId ? [input.meetingItemId] : [],
    bodyId: input.meeting.public_body_id,
    organizationId: input.body?.seed_source_id ?? null,
    jurisdiction: input.body?.jurisdiction ?? null,
    documentType: documentTypeFor(valueForType, input.field),
    sourceUrl,
    sourcePath,
    sourceHost: hostFor(sourceUrl),
    sourcePlatform: platformFor(valueForType),
    cached,
    cachedPath: cached ? sourcePath : null,
    contentHash,
    sizeBytes,
    discoveredAt: input.discoveredAt,
    retrievalStatus: cached ? "local_cached" : sourceUrl ? "remote_discovered" : sourcePath ? "unreadable_local" : "missing",
    priorityBody: input.body ? PRIORITY_SOURCE_IDS.has(input.body.seed_source_id) : false,
    provenance: [{ meetingId: input.meeting.id, meetingItemId: input.meetingItemId, field: input.field }],
  });
}

function discoverDocuments() {
  const discoveredAt = new Date().toISOString();
  const meetings = readJson<PublicMeetingRecord[]>("public-meetings.json", []);
  const items = readJson<PublicMeetingItemRecord[]>("public-meeting-items.json", []);
  const bodies = readJson<PublicBodyRecord[]>("public-meeting-bodies.json", []);
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const records = new Map<string, SourceDocumentRecord>();

  for (const meeting of meetings) {
    const body = bodyById.get(meeting.public_body_id);
    addDocument(records, { meeting, body, meetingItemId: null, field: "agenda_url", sourceUrl: meeting.agenda_url, discoveredAt });
    addDocument(records, { meeting, body, meetingItemId: null, field: "minutes_url", sourceUrl: meeting.minutes_url, discoveredAt });
    addDocument(records, { meeting, body, meetingItemId: null, field: "packet_url", sourceUrl: meeting.packet_url, discoveredAt });
    addDocument(records, { meeting, body, meetingItemId: null, field: "transcript_url", sourceUrl: meeting.transcript_url, discoveredAt });
    for (const sourceUrl of meeting.source_urls ?? []) addDocument(records, { meeting, body, meetingItemId: null, field: "source_urls", sourceUrl, discoveredAt });
    for (const sourcePath of meeting.source_local_paths ?? []) addDocument(records, { meeting, body, meetingItemId: null, field: "source_local_paths", sourcePath, discoveredAt });
  }

  for (const item of items) {
    const meeting = meetingById.get(item.meeting_id);
    if (!meeting) continue;
    const body = bodyById.get(meeting.public_body_id);
    addDocument(records, { meeting, body, meetingItemId: item.id, field: "item_source_url", sourceUrl: item.source_url, discoveredAt });
    addDocument(records, { meeting, body, meetingItemId: item.id, field: "item_source_local_path", sourcePath: item.source_local_path, discoveredAt });
    addDocument(records, { meeting, body, meetingItemId: item.id, field: "item_cached_text_path", sourcePath: item.cached_text_path, discoveredAt });
  }

  const documents = [...records.values()].sort((left, right) => Number(right.priorityBody) - Number(left.priorityBody) || left.documentType.localeCompare(right.documentType));
  const audit = {
    generatedAt: discoveredAt,
    totals: {
      meetingsScanned: meetings.length,
      documentsDiscovered: documents.length,
      priorityDocuments: documents.filter((document) => document.priorityBody).length,
      localCached: documents.filter((document) => document.retrievalStatus === "local_cached").length,
      remoteDiscovered: documents.filter((document) => document.retrievalStatus === "remote_discovered").length,
      unreadableLocal: documents.filter((document) => document.retrievalStatus === "unreadable_local").length,
      pdfDocuments: documents.filter((document) => /\.(pdf)(?:$|\?)/i.test(`${document.sourcePath ?? ""} ${document.sourceUrl ?? ""}`)).length,
    },
    documentTypeCounts: documents.reduce<Record<string, number>>((counts, document) => {
      counts[document.documentType] = (counts[document.documentType] ?? 0) + 1;
      return counts;
    }, {}),
    platformCounts: documents.reduce<Record<string, number>>((counts, document) => {
      counts[document.sourcePlatform] = (counts[document.sourcePlatform] ?? 0) + 1;
      return counts;
    }, {}),
  };
  return { generatedAt: discoveredAt, records: documents, audit };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const artifact = discoverDocuments();
writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`Discovered ${artifact.records.length} public meeting source documents at ${OUTPUT_PATH}`);
console.log(JSON.stringify(artifact.audit.totals, null, 2));
