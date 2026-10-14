import type { PublicMeetingRecord } from "@/lib/public-meetings/types";

type AssociationMeeting = Pick<PublicMeetingRecord, "id" | "public_body_id" | "meeting_date" | "meeting_alias_ids" | "minutes_url">;

export type ReviewedNativeDocumentEvidence = {
  documentId: string;
  meetingId: string;
  documentType: string;
  sourceUrl: string | null;
  sourceContentHash?: string | null;
  extractionMethod: string;
  extractionQuality: string;
  text: string;
};

export type ReviewedDocumentAssociation = {
  sourceUrl: string;
  sourceHash: string;
  documentId: string;
  fromMeetingId: string;
  targetMeetingId: string;
};

export type DocumentAssociationReviewReason =
  | "source_hash_changed"
  | "native_minutes_evidence_required"
  | "reviewed_header_mismatch"
  | "source_meeting_unconfirmed"
  | "source_body_conflict"
  | "target_meeting_missing"
  | "target_meeting_ambiguous"
  | "reviewed_association_displaced_unverified_minutes";

export type DocumentAssociationReviewNote = {
  sourceUrl: string;
  reason: DocumentAssociationReviewReason;
  documentIds: string[];
  meetingIds: string[];
};

// Reviewed September 7, 2026: the live MinutesViewer response and cached PDF
// have this exact hash. Both the opening heading and meeting narrative date the
// minutes April 21; item 7 names July 21 as the NEXT meeting. The calendar's
// July 21 event remains a separate event where these prior minutes were linked.
const REVIEWED_CARSON_MINUTES = {
  sourceUrl: "https://carsoncity.granicus.com/MinutesViewer.php?view_id=2&clip_id=2908&doc_id=8076bd7d-855a-11f1-bb61-005056a89546",
  sourceHash: "df2d876eb90fbc031c4bb82b70cc9beb7bdff77cf2f22d17b3f0b4f193b8b962",
  bodyId: "body-carson-city-board-of-supervisors-9-1-1-surcharge-advisory-committee",
  meetingDate: "2026-04-21",
  nativeHeader: /^Minutes of the Meeting of the Carson City 9-1-1 SURCHARGE ADVISORY COMMITTEE April 21, 2026 The Carson City 9-1-1 Surcharge Advisory Committee held a public meeting on April 21, 2026\b/i,
} as const;

export const REVIEWED_MEETING_DOCUMENT_ASSOCIATIONS = [REVIEWED_CARSON_MINUTES] as const;

function localMeetingDate(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // A timezone-free timestamp cannot establish the reviewed local meeting day.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Returns evidence-only corrections; never changes a calendar date or invents a meeting. */
export function resolveReviewedMeetingDocumentAssociations(input: {
  meetings: ReadonlyArray<AssociationMeeting>;
  nativeEvidence: ReadonlyArray<ReviewedNativeDocumentEvidence>;
}): {
  meetingIdBySourceUrl: Record<string, string>;
  associations: ReviewedDocumentAssociation[];
  pendingReview: DocumentAssociationReviewNote[];
} {
  const meetingIdBySourceUrl: Record<string, string> = {};
  const associations: ReviewedDocumentAssociation[] = [];
  const pendingReview: DocumentAssociationReviewNote[] = [];
  const rule = REVIEWED_CARSON_MINUTES;
  const evidence = input.nativeEvidence.filter((row) => row.sourceUrl === rule.sourceUrl);
  if (!evidence.length) return { meetingIdBySourceUrl, associations, pendingReview };
  const note = (reason: DocumentAssociationReviewReason, meetingIds = evidence.map((row) => row.meetingId)) => {
    pendingReview.push({ sourceUrl: rule.sourceUrl, reason, documentIds: [...new Set(evidence.map((row) => row.documentId))], meetingIds: [...new Set(meetingIds)] });
    return { meetingIdBySourceUrl, associations, pendingReview };
  };
  // A conflicting version must not be concealed by another row with old bytes.
  if (evidence.some((row) => row.sourceContentHash !== rule.sourceHash)) return note("source_hash_changed");
  if (evidence.some((row) => row.documentType !== "minutes" || row.extractionMethod !== "native_text" || !["high", "medium"].includes(row.extractionQuality))) {
    return note("native_minutes_evidence_required");
  }
  if (evidence.some((row) => !rule.nativeHeader.test(row.text.replace(/\s+/g, " ").trim()))) return note("reviewed_header_mismatch");
  for (const row of evidence) {
    const owners = input.meetings.filter((meeting) => meeting.id === row.meetingId || meeting.meeting_alias_ids?.includes(row.meetingId));
    if (owners.length !== 1) return note("source_meeting_unconfirmed");
    if (owners[0].public_body_id !== rule.bodyId) return note("source_body_conflict");
  }
  const targets = input.meetings.filter((meeting) => meeting.public_body_id === rule.bodyId && localMeetingDate(meeting.meeting_date) === rule.meetingDate);
  if (!targets.length) return note("target_meeting_missing");
  if (targets.length !== 1) return note("target_meeting_ambiguous", targets.map((meeting) => meeting.id));
  const target = targets[0];
  meetingIdBySourceUrl[rule.sourceUrl] = target.id;
  const seenDocuments = new Set<string>();
  for (const row of evidence) {
    const key = `${row.documentId}\u0000${row.meetingId}`;
    if (seenDocuments.has(key)) continue;
    seenDocuments.add(key);
    associations.push({ sourceUrl: rule.sourceUrl, sourceHash: rule.sourceHash, documentId: row.documentId, fromMeetingId: row.meetingId, targetMeetingId: target.id });
  }
  if (target.minutes_url && target.minutes_url !== rule.sourceUrl) {
    const displaced = input.nativeEvidence.filter((row) => row.sourceUrl === target.minutes_url);
    pendingReview.push({
      sourceUrl: target.minutes_url,
      reason: "reviewed_association_displaced_unverified_minutes",
      documentIds: [...new Set(displaced.map((row) => row.documentId))],
      meetingIds: [target.id],
    });
  }
  return { meetingIdBySourceUrl, associations, pendingReview };
}
