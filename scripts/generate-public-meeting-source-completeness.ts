import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const SOURCE_COMPLETENESS_PATH = path.join(GENERATED_DIR, "public-meeting-source-completeness.json");
const ACCOUNTABILITY_READINESS_PATH = path.join(GENERATED_DIR, "public-meeting-accountability-readiness.json");

type SourceDocument = {
  id: string;
  meetingId: string;
  meetingItemIds: string[];
  documentType: string;
  retrievalStatus: string;
  priorityBody: boolean;
};

type RetrievalQueueRecord = {
  documentId: string;
  meetingId: string;
  retrievalState: string;
  ocrRequired: boolean;
  recommendedNextAction: string;
};

type DocumentText = {
  documentId: string;
  meetingId: string;
  meetingItemIds: string[];
  documentType: string;
  extractionMethod: string;
  extractionQuality: "high" | "medium" | "low" | "insufficient";
  textLength: number;
  confidence: number;
  sourceSnippet: string | null;
  failureReason: string | null;
};

type ActionResult = {
  meetingId: string;
  meetingItemId: string;
  agendaItemId: string | null;
  motionText: string | null;
  mover: string | null;
  seconder: string | null;
  outcome: string | null;
  voteCount: unknown | null;
  namedVotes: unknown[];
  unanimous: boolean;
  needsReview: boolean;
};

type AttendanceRecord = {
  meetingId: string;
  attendanceStatus: string;
  votingEligibility: string;
  matchConfidence: string;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function score(parts: boolean[]) {
  return Number((parts.filter(Boolean).length / Math.max(1, parts.length)).toFixed(2));
}

function quality(scoreValue: number): "high" | "medium" | "low" | "insufficient" {
  if (scoreValue >= 0.75) return "high";
  if (scoreValue >= 0.5) return "medium";
  if (scoreValue >= 0.25) return "low";
  return "insufficient";
}

function generateCompleteness() {
  const generatedAt = new Date().toISOString();
  const meetings = readJson<PublicMeetingRecord[]>("public-meetings.json", []);
  const items = readJson<PublicMeetingItemRecord[]>("public-meeting-items.json", []);
  const bodies = readJson<PublicBodyRecord[]>("public-meeting-bodies.json", []);
  const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
  const retrievalQueue = readJson<{ records?: RetrievalQueueRecord[] }>("public-meeting-retrieval-queue.json", { records: [] }).records ?? [];
  const documentText = readJson<{ records?: DocumentText[] }>("public-meeting-document-text.json", { records: [] }).records ?? [];
  const actionResults = readJson<{ records?: ActionResult[] }>("public-meeting-action-results.json", { records: [] }).records ?? [];
  const attendance = readJson<{ records?: AttendanceRecord[] }>("public-meeting-attendance.json", { records: [] }).records ?? [];
  const voteAudit = readJson<{ totals?: Record<string, number>; attendanceReviewActions?: Array<{ meeting_id: string }>; distributionReviewActions?: Array<{ meeting_id: string }> }>("public-meeting-vote-extraction-audit.json", {});
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const itemsByMeeting = new Map<string, PublicMeetingItemRecord[]>();
  for (const item of items) itemsByMeeting.set(item.meeting_id, [...(itemsByMeeting.get(item.meeting_id) ?? []), item]);
  const docsByMeeting = new Map<string, SourceDocument[]>();
  for (const document of documents) docsByMeeting.set(document.meetingId, [...(docsByMeeting.get(document.meetingId) ?? []), document]);
  const retrievalByMeeting = new Map<string, RetrievalQueueRecord[]>();
  for (const record of retrievalQueue) retrievalByMeeting.set(record.meetingId, [...(retrievalByMeeting.get(record.meetingId) ?? []), record]);
  const textByMeeting = new Map<string, DocumentText[]>();
  for (const text of documentText) textByMeeting.set(text.meetingId, [...(textByMeeting.get(text.meetingId) ?? []), text]);
  const actionByMeeting = new Map<string, ActionResult[]>();
  for (const action of actionResults) actionByMeeting.set(action.meetingId, [...(actionByMeeting.get(action.meetingId) ?? []), action]);
  const attendanceByMeeting = new Map<string, AttendanceRecord[]>();
  for (const record of attendance) attendanceByMeeting.set(record.meetingId, [...(attendanceByMeeting.get(record.meetingId) ?? []), record]);
  const attendanceBlocked = new Set((voteAudit.attendanceReviewActions ?? []).map((action) => action.meeting_id));
  const distributionBlocked = new Set((voteAudit.distributionReviewActions ?? []).map((action) => action.meeting_id));

  const meetingRecords = meetings.map((meeting) => {
    const body = bodyById.get(meeting.public_body_id);
    const meetingDocs = docsByMeeting.get(meeting.id) ?? [];
    const retrievalRecords = retrievalByMeeting.get(meeting.id) ?? [];
    const meetingTexts = textByMeeting.get(meeting.id) ?? [];
    const meetingActions = actionByMeeting.get(meeting.id) ?? [];
    const meetingAttendance = attendanceByMeeting.get(meeting.id) ?? [];
    const meetingItems = itemsByMeeting.get(meeting.id) ?? [];
    const hasAgenda = meetingDocs.some((document) => document.documentType === "agenda") || Boolean(meeting.agenda_url);
    const hasPacket = meetingDocs.some((document) => document.documentType === "packet") || Boolean(meeting.packet_url);
    const hasMinutes = meetingDocs.some((document) => document.documentType === "minutes") || Boolean(meeting.minutes_url);
    const hasCachedFullText = meetingTexts.some((text) => text.extractionQuality === "high" || text.extractionQuality === "medium");
    const hasAttendance = meetingAttendance.some((record) => record.votingEligibility === "eligible_voting_member");
    const hasMotionSecond = meetingActions.some((action) => action.mover || action.seconder || action.motionText);
    const hasVoteOutcome = meetingActions.some((action) => action.outcome || action.voteCount || action.unanimous) || meetingItems.some((item) => Boolean(item.vote_outcome));
    const hasFiscal = meetingItems.some((item) => Boolean(item.financial_impact || item.fiscal_impact_summary));
    const linkedActions = meetingActions.filter((action) => action.agendaItemId).length;
    const documentCoverageScore = score([hasAgenda, hasMinutes, hasPacket, meetingDocs.some((document) => document.retrievalStatus === "local_cached"), hasCachedFullText]);
    const attendanceCoverage = hasAttendance ? 1 : meetingTexts.some((text) => /\b(?:present|absent|roll call)\b/i.test(text.sourceSnippet ?? "")) ? 0.5 : 0;
    const motionSecondCoverage = hasMotionSecond ? 1 : meetingActions.length ? 0.35 : 0;
    const voteAttributionCoverage = hasVoteOutcome && !attendanceBlocked.has(meeting.id) && !distributionBlocked.has(meeting.id) ? (hasAttendance ? 0.75 : 0.35) : hasVoteOutcome ? 0.2 : 0;
    const fiscalDetailCoverage = hasFiscal ? 1 : 0;
    const agendaItemLinkageConfidence = meetingActions.length ? Number((linkedActions / meetingActions.length).toFixed(2)) : 0;
    const combinedScore = Number(((documentCoverageScore + attendanceCoverage + motionSecondCoverage + voteAttributionCoverage + fiscalDetailCoverage + agendaItemLinkageConfidence) / 6).toFixed(2));
    const missingFields = [
      !hasMinutes ? "minutes_document" : null,
      !hasCachedFullText ? "full_document_text" : null,
      !hasAttendance ? "attendance" : null,
      !hasMotionSecond ? "motion_second" : null,
      !hasVoteOutcome ? "vote_outcome" : null,
      !hasFiscal ? "fiscal_detail" : null,
      meetingActions.some((action) => !action.agendaItemId) ? "agenda_item_linkage" : null,
    ].filter(Boolean);
    const recommendedNextAction = !hasCachedFullText
      ? retrievalRecords.some((record) => record.ocrRequired)
        ? "run_ocr_or_manual_review"
        : "recover_or_extract_full_source_document"
      : !hasAttendance
        ? "review_minutes_for_attendance_or_confirm_not_published"
        : meetingActions.some((action) => action.needsReview)
          ? "review_action_result_extraction"
          : "ready_for_accountability_review";
    return {
      meetingId: meeting.id,
      bodyId: meeting.public_body_id,
      organizationId: body?.seed_source_id ?? null,
      bodyName: body?.name ?? "Unknown body",
      jurisdiction: body?.jurisdiction ?? null,
      meetingDate: meeting.meeting_date,
      documentCoverageScore,
      attendanceCoverage,
      motionSecondCoverage,
      voteAttributionCoverage,
      fiscalDetailCoverage,
      agendaItemLinkageConfidence,
      sourceQuality: quality(combinedScore),
      accountabilityReadinessScore: combinedScore,
      documentsDiscovered: meetingDocs.length,
      localDocuments: meetingDocs.filter((document) => document.retrievalStatus === "local_cached").length + retrievalRecords.filter((record) => Boolean((record as { cachePath?: string | null }).cachePath)).length,
      extractedDocuments: meetingTexts.filter((text) => text.extractionMethod !== "failed").length,
      queuedDocuments: retrievalRecords.filter((record) => record.retrievalState === "queued" || record.retrievalState === "blocked_by_network").length,
      ocrRequiredDocuments: retrievalRecords.filter((record) => record.ocrRequired).length,
      actionResults: meetingActions.length,
      missingFields,
      recommendedNextAction,
    };
  });

  const itemRecords = items.map((item) => {
    const actions = actionResults.filter((action) => action.meetingItemId === item.id);
    const texts = documentText.filter((text) => text.meetingItemIds.includes(item.id));
    const hasOutcome = actions.some((action) => action.outcome || action.voteCount || action.unanimous) || Boolean(item.vote_outcome);
    const scoreValue = score([Boolean(texts.length), Boolean(item.item_number), hasOutcome, actions.some((action) => action.mover || action.seconder), Boolean(item.financial_impact || item.fiscal_impact_summary)]);
    return {
      meetingItemId: item.id,
      meetingId: item.meeting_id,
      agendaItemLinkageConfidence: item.item_number ? 0.9 : 0.2,
      sourceQuality: quality(scoreValue),
      sourceCompletenessScore: scoreValue,
      missingFields: [!texts.length ? "source_document_text" : null, !item.item_number ? "agenda_item_number" : null, !hasOutcome ? "action_result" : null].filter(Boolean),
    };
  });

  const totals = {
    meetingsScored: meetingRecords.length,
    highQualityMeetings: meetingRecords.filter((record) => record.sourceQuality === "high").length,
    mediumQualityMeetings: meetingRecords.filter((record) => record.sourceQuality === "medium").length,
    lowQualityMeetings: meetingRecords.filter((record) => record.sourceQuality === "low").length,
    insufficientMeetings: meetingRecords.filter((record) => record.sourceQuality === "insufficient").length,
    meetingsReadyForAccountability: meetingRecords.filter((record) => record.accountabilityReadinessScore >= 0.75).length,
    meetingsBlockedBySourceGaps: meetingRecords.filter((record) => record.recommendedNextAction === "recover_or_extract_full_source_document").length,
    meetingsBlockedByOcr: meetingRecords.filter((record) => record.recommendedNextAction === "run_ocr_or_manual_review").length,
    meetingsBlockedByParserGaps: meetingRecords.filter((record) => record.recommendedNextAction === "review_action_result_extraction").length,
  };
  const artifact = { generatedAt, totals, meetingRecords, itemRecords };
  const readiness = {
    generatedAt,
    totals,
    officialScorecardsSafe: totals.meetingsReadyForAccountability >= Math.ceil(meetingRecords.length * 0.5),
    blocker: totals.meetingsReadyForAccountability >= Math.ceil(meetingRecords.length * 0.5) ? null : "accountability_readiness_below_defensible_threshold",
    highestValueNextActions: meetingRecords
      .filter((record) => record.sourceQuality !== "high")
      .sort((left, right) => Number(right.organizationId === "carson-city-board-of-supervisors") - Number(left.organizationId === "carson-city-board-of-supervisors") || left.accountabilityReadinessScore - right.accountabilityReadinessScore)
      .slice(0, 40),
  };
  return { artifact, readiness };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const { artifact, readiness } = generateCompleteness();
writeFileSync(SOURCE_COMPLETENESS_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
writeFileSync(ACCOUNTABILITY_READINESS_PATH, `${JSON.stringify(readiness, null, 2)}\n`);
console.log(`Generated source completeness for ${artifact.totals.meetingsScored} meetings at ${SOURCE_COMPLETENESS_PATH}`);
console.log(JSON.stringify(artifact.totals, null, 2));
