import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REVIEWED_MEETING_DOCUMENT_ASSOCIATIONS, resolveReviewedMeetingDocumentAssociations, type DocumentAssociationReviewNote, type ReviewedNativeDocumentEvidence } from "@/lib/public-meetings/reviewed-document-associations";
import type { PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

type DocumentRow = {
  id?: string; documentId?: string; meetingId: string; sourceUrl: string | null; documentType: string;
  contentHash?: string | null; sourceContentHash?: string | null; sourcePath?: string | null;
  extractedTextPath?: string | null; extractionMethod?: string; extractionQuality?: string;
  provenance?: Array<{ meetingId: string; meetingItemId: string | null; field: string }>;
  [key: string]: unknown;
};
type CacheRow = { documentId: string; contentHash: string; stableLocalPath: string };

export function applyReviewedDocumentItemAssociation(item: PublicMeetingItemRecord, targetMeetingId: string | undefined, held: boolean): PublicMeetingItemRecord {
  return { ...item, meeting_id: targetMeetingId ?? item.meeting_id, source_method: "automated_archive",
    source_document_type: "minutes", parser_status: held || item.parser_status !== "source_excerpt" ? "needs_review" : item.parser_status,
    confidence_score: Math.min(item.confidence_score, held ? 0.64 : 0.72), vote_outcome: null,
    related_official_names: [], related_organization_names: [], roll_call_status: "needs_roll_call_review" };
}

/** Reapplies a reviewed source correction after collection and after text extraction. */
export function repairReviewedMeetingDocumentAssociations(options: { root?: string; dryRun?: boolean } = {}) {
  const root = options.root ?? process.cwd();
  const generated = path.join(root, "data/generated");
  const read = <T>(name: string, fallback: T): T => {
    try { return JSON.parse(readFileSync(path.join(generated, `${name}.json`), "utf8")) as T; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
  };
  const changedFiles: string[] = [];
  const write = (name: string, before: unknown, after: unknown) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    changedFiles.push(name);
    if (options.dryRun) return;
    const target = path.join(generated, `${name}.json`);
    writeFileSync(`${target}.${process.pid}.tmp`, `${JSON.stringify(after, null, 2)}\n`);
    renameSync(`${target}.${process.pid}.tmp`, target);
  };
  const meetings = read<PublicMeetingRecord[]>("public-meetings", []);
  const items = read<PublicMeetingItemRecord[]>("public-meeting-items", []);
  const sourceArtifact = read<{ records: DocumentRow[] }>("public-meeting-source-documents", { records: [] });
  const textArtifact = read<{ records: DocumentRow[] }>("public-meeting-document-text", { records: [] });
  const cache = new Map(read<{ records: CacheRow[] }>("public-meeting-document-cache-index", { records: [] }).records.map(row => [row.documentId, row]));
  const prior = read<{ pendingReview: DocumentAssociationReviewNote[]; heldDerivedRecords?: Array<{ file: string; record: Record<string, unknown> }> }>("public-meeting-document-association-review-candidates", { pendingReview: [] });
  const reviewedUrls = new Set<string>(REVIEWED_MEETING_DOCUMENT_ASSOCIATIONS.map(rule => rule.sourceUrl));
  const nativeEvidence: ReviewedNativeDocumentEvidence[] = [];
  for (const document of sourceArtifact.records.filter(row => row.sourceUrl && reviewedUrls.has(row.sourceUrl))) {
    const documentId = document.id!;
    const cached = cache.get(documentId);
    let actualHash: string | null = null;
    try { if (cached) actualHash = createHash("sha256").update(readFileSync(path.resolve(root, cached.stableLocalPath))).digest("hex"); } catch { /* Missing exact bytes cannot establish ownership. */ }
    const texts = textArtifact.records.filter(row => row.documentId === documentId);
    for (const text of texts.length ? texts : [document]) {
      let content = "";
      try { if (text.extractedTextPath) content = readFileSync(path.resolve(root, text.extractedTextPath), "utf8"); } catch { /* Missing native text remains held. */ }
      nativeEvidence.push({ documentId, meetingId: text.meetingId, documentType: text.documentType,
        sourceUrl: document.sourceUrl, sourceContentHash: actualHash && actualHash === cached?.contentHash && actualHash === text.sourceContentHash ? actualHash : null,
        extractionMethod: text.extractionMethod ?? "failed", extractionQuality: text.extractionQuality ?? "insufficient", text: content });
    }
  }
  const resolved = resolveReviewedMeetingDocumentAssociations({ meetings, nativeEvidence });
  const owners = resolved.meetingIdBySourceUrl;
  const pendingReview = [...new Map([...(prior.pendingReview ?? []), ...resolved.pendingReview]
    .filter(note => !owners[note.sourceUrl]).map(note => [`${note.sourceUrl}:${note.reason}`, note])).values()];
  const heldUrls = new Set(pendingReview.map(note => note.sourceUrl));
  const relevantUrls = new Set([...Object.keys(owners), ...heldUrls]);
  const urlByHash = new Map<string, string>();
  for (const document of sourceArtifact.records) if (document.sourceUrl && relevantUrls.has(document.sourceUrl)) {
    const hash = cache.get(document.id!)?.contentHash ?? document.contentHash;
    if (hash) urlByHash.set(hash, document.sourceUrl);
  }
  const recordUrl = (row: DocumentRow) => row.sourceUrl && relevantUrls.has(row.sourceUrl) ? row.sourceUrl
    : urlByHash.get(row.sourceContentHash ?? row.contentHash ?? cache.get(row.documentId ?? row.id!)?.contentHash ?? "");
  const nextMeetings = meetings.map(meeting => {
    const correctUrl = Object.keys(owners).find(url => owners[url] === meeting.id);
    const wrongPrimary = meeting.minutes_url && (heldUrls.has(meeting.minutes_url) || owners[meeting.minutes_url] && owners[meeting.minutes_url] !== meeting.id);
    if (!correctUrl && !wrongPrimary) return meeting;
    return { ...meeting, minutes_url: correctUrl ?? null,
      source_urls: [...new Set([...meeting.source_urls, meeting.minutes_url, correctUrl].filter((url): url is string => Boolean(url)))],
      source_identity_evidence: [...new Set([...(meeting.source_identity_evidence ?? []), ...(wrongPrimary && meeting.minutes_url ? [meeting.minutes_url] : [])])],
    };
  });
  const affectedItemIds = new Set<string>();
  const nextItems = items.map(item => {
    const url = item.source_url && relevantUrls.has(item.source_url) ? item.source_url : urlByHash.get(item.source_document_hash ?? "");
    if (!url) return item;
    affectedItemIds.add(item.id);
    return applyReviewedDocumentItemAssociation(item, owners[url], heldUrls.has(url));
  });
  const fixDocument = (document: DocumentRow): DocumentRow => {
    const url = recordUrl(document);
    if (!url) return document;
    const target = owners[url];
    const provenance = target ? document.provenance?.map(entry => ({ ...entry, meetingId: target })) : document.provenance;
    return { ...document, ...(target ? { meetingId: target } : {}),
      documentType: heldUrls.has(url) ? "supporting_document" : "minutes", provenance,
      sourceAssociationReview: heldUrls.has(url) ? "needs_review" : "reviewed_exact_document",
    };
  };
  write("public-meetings", meetings, nextMeetings);
  write("public-meeting-items", items, nextItems);
  write("public-meeting-source-documents", sourceArtifact, { ...sourceArtifact, records: sourceArtifact.records.map(fixDocument) });
  write("public-meeting-document-text", textArtifact, { ...textArtifact, records: textArtifact.records.map(fixDocument) });
  const heldDerivedRecords = new Map((prior.heldDerivedRecords ?? []).map(row => [`${row.file}:${row.record.id}`, row]));
  for (const [file, itemField] of [["public-meeting-official-actions", "topic_item_id"], ["public-meeting-votes", "meeting_item_id"], ["citizen-vote-questions", "meeting_item_id"]] as const) {
    const records = read<Array<Record<string, unknown>>>(file, []);
    const retained = records.filter(record => !affectedItemIds.has(String(record[itemField])));
    for (const record of records) if (affectedItemIds.has(String(record[itemField]))) heldDerivedRecords.set(`${file}:${record.id}`, { file, record });
    write(file, records, retained);
  }
  const report = { associations: resolved.associations, pendingReview, heldDerivedRecords: [...heldDerivedRecords.values()],
    totals: { reviewedSourceUrls: Object.keys(owners).length, pendingSourceUrls: heldUrls.size,
      movedItems: nextItems.filter((item, index) => item.meeting_id !== items[index].meeting_id).length,
      heldItems: nextItems.filter(item => item.source_url && heldUrls.has(item.source_url)).length },
  };
  write("public-meeting-document-association-review-candidates", prior, report);
  return { ...report, changedFiles, dryRun: options.dryRun ?? false };
}
