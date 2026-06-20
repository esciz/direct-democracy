import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "vote-attribution-readiness.json");

type AttendanceArtifact = { records?: Array<{ meetingId: string; votingEligibility: string; attendanceStatus: string; matchedOfficialId?: string | null; matchConfidence?: string }> };
type VoteAudit = {
  totals?: Record<string, number>;
  aggregateOnlyOutcomes?: Array<{ meeting_id: string; meeting_item_id: string; structuredOutcome?: { kind?: string } }>;
  attendanceReviewActions?: Array<{ meeting_id: string; meeting_item_id: string; reason: string }>;
  distributionReviewActions?: Array<{ meeting_id: string; meeting_item_id: string; reason: string }>;
};
type VoteRecord = { meeting_id?: string; meeting_item_id: string; evidenceType?: string; vote?: string };
type RosterArtifact = { records?: Array<{ bodyId: string; votingMember: boolean; officialId: string | null }> };

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function hasVoteOutcome(item: PublicMeetingItemRecord) {
  return Boolean(item.vote_outcome) || /\b(?:passed|approved|adopted|carried|failed|denied|vote|voted|ayes?|nays?)\b/i.test(item.source_text);
}

function sourceTypeCounts(meetings: PublicMeetingRecord[]) {
  return meetings.reduce(
    (counts, meeting) => {
      if (meeting.agenda_url) counts.agenda += 1;
      if (meeting.packet_url) counts.packet += 1;
      if (meeting.minutes_url) counts.minutes += 1;
      if (meeting.transcript_url) counts.result_page += 1;
      return counts;
    },
    { agenda: 0, packet: 0, minutes: 0, action_summary: 0, legislative_journal: 0, result_page: 0 },
  );
}

function generateReadiness() {
  const generatedAt = new Date().toISOString();
  const meetings = readJson<PublicMeetingRecord[]>("public-meetings.json", []);
  const bodies = readJson<PublicBodyRecord[]>("public-meeting-bodies.json", []);
  const items = readJson<PublicMeetingItemRecord[]>("public-meeting-items.json", []);
  const attendance = readJson<AttendanceArtifact>("public-meeting-attendance.json", { records: [] });
  const votes = readJson<VoteRecord[]>("public-meeting-votes.json", []);
  const voteAudit = readJson<VoteAudit>("public-meeting-vote-extraction-audit.json", {});
  const rosters = readJson<RosterArtifact>("governing-body-rosters.json", { records: [] });
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const itemsByMeeting = new Map<string, PublicMeetingItemRecord[]>();
  for (const item of items) itemsByMeeting.set(item.meeting_id, [...(itemsByMeeting.get(item.meeting_id) ?? []), item]);
  const attendanceByMeeting = new Map<string, NonNullable<AttendanceArtifact["records"]>>();
  for (const record of attendance.records ?? []) attendanceByMeeting.set(record.meetingId, [...(attendanceByMeeting.get(record.meetingId) ?? []), record]);
  const votesByMeeting = new Map<string, VoteRecord[]>();
  for (const vote of votes) {
    const meetingId = vote.meeting_id ?? items.find((item) => item.id === vote.meeting_item_id)?.meeting_id;
    if (!meetingId) continue;
    votesByMeeting.set(meetingId, [...(votesByMeeting.get(meetingId) ?? []), vote]);
  }
  const rosterByBody = new Map<string, NonNullable<RosterArtifact["records"]>>();
  for (const record of rosters.records ?? []) rosterByBody.set(record.bodyId, [...(rosterByBody.get(record.bodyId) ?? []), record]);
  const attendanceBlocked = new Set((voteAudit.attendanceReviewActions ?? []).map((action) => action.meeting_id));
  const distributionBlocked = new Set((voteAudit.distributionReviewActions ?? []).map((action) => action.meeting_id));

  const records = meetings.map((meeting) => {
    const meetingItems = itemsByMeeting.get(meeting.id) ?? [];
    const body = bodyById.get(meeting.public_body_id);
    const attendanceRecords = attendanceByMeeting.get(meeting.id) ?? [];
    const voteRecords = votesByMeeting.get(meeting.id) ?? [];
    const rosterRecords = rosterByBody.get(meeting.public_body_id) ?? [];
    const hasAttendance = attendanceRecords.some((record) => record.votingEligibility === "eligible_voting_member" && record.attendanceStatus === "present");
    const hasVoteOutcomeFlag = meetingItems.some(hasVoteOutcome);
    const hasNamedVotes = voteRecords.some((vote) => vote.evidenceType === "explicit_roll_call_group" || vote.evidenceType === "inline_named_vote");
    const hasRosterMatch = attendanceRecords.some((record) => record.matchConfidence && record.matchConfidence !== "unmatched_name") || rosterRecords.length > 0;
    const eligibleForUnanimousAttribution = hasAttendance && meetingItems.some((item) => /\bunanim/i.test(`${item.vote_outcome ?? ""} ${item.source_text}`));
    const eligibleForAggregateAttribution = hasAttendance && meetingItems.some((item) => /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(`${item.vote_outcome ?? ""} ${item.source_text}`));
    const blockedReason = [
      !meeting.minutes_url ? "missing_minutes" : null,
      !hasAttendance ? "missing_attendance" : null,
      rosterRecords.length === 0 ? "missing_roster" : null,
      rosterRecords.length > 0 && !hasRosterMatch ? "incomplete_membership" : null,
      distributionBlocked.has(meeting.id) ? "unresolved_distribution" : null,
      !hasVoteOutcomeFlag ? "insufficient_source_evidence" : null,
      attendanceBlocked.has(meeting.id) ? "missing_attendance" : null,
    ].filter(Boolean);
    return {
      meetingId: meeting.id,
      bodyId: meeting.public_body_id,
      organizationId: body?.seed_source_id ?? null,
      bodyName: body?.name ?? "Unknown body",
      jurisdiction: body?.jurisdiction ?? null,
      meetingDate: meeting.meeting_date,
      hasAgenda: Boolean(meeting.agenda_url),
      hasPacket: Boolean(meeting.packet_url),
      hasMinutes: Boolean(meeting.minutes_url),
      hasAttendance,
      hasVoteOutcome: hasVoteOutcomeFlag,
      hasNamedVotes,
      hasRosterMatch,
      eligibleForAggregateAttribution,
      eligibleForUnanimousAttribution,
      blockedReason: [...new Set(blockedReason)],
      readinessScore: [meeting.agenda_url, meeting.packet_url, meeting.minutes_url, hasAttendance, hasVoteOutcomeFlag, hasNamedVotes, hasRosterMatch].filter(Boolean).length,
    };
  });

  const organizationReports = Array.from(
    records.reduce((map, record) => {
      const key = record.organizationId ?? record.bodyId;
      const current = map.get(key) ?? {
        organizationId: key,
        bodyName: record.bodyName,
        jurisdiction: record.jurisdiction,
        meetingsImported: 0,
        agendas: 0,
        packets: 0,
        minutes: 0,
        attendanceCoverage: 0,
        voteCoverage: 0,
        namedVoteCoverage: 0,
        aggregateVoteCoverage: 0,
        readinessScore: 0,
      };
      current.meetingsImported += 1;
      if (record.hasAgenda) current.agendas += 1;
      if (record.hasPacket) current.packets += 1;
      if (record.hasMinutes) current.minutes += 1;
      if (record.hasAttendance) current.attendanceCoverage += 1;
      if (record.hasVoteOutcome) current.voteCoverage += 1;
      if (record.hasNamedVotes) current.namedVoteCoverage += 1;
      if (record.eligibleForAggregateAttribution) current.aggregateVoteCoverage += 1;
      current.readinessScore += record.readinessScore;
      map.set(key, current);
      return map;
    }, new Map<string, any>()).values(),
  )
    .map((report) => ({ ...report, readinessScore: Number((report.readinessScore / Math.max(1, report.meetingsImported) / 7).toFixed(2)) }))
    .sort((left, right) => left.readinessScore - right.readinessScore || right.meetingsImported - left.meetingsImported);

  const audit = {
    generatedAt,
    sourceTypeCounts: sourceTypeCounts(meetings),
    totals: {
      meetings: records.length,
      meetingsWithMinutes: records.filter((record) => record.hasMinutes).length,
      meetingsWithAttendance: records.filter((record) => record.hasAttendance).length,
      meetingsWithVoteOutcomes: records.filter((record) => record.hasVoteOutcome).length,
      meetingsWithNamedVotes: records.filter((record) => record.hasNamedVotes).length,
      meetingsWithRosterMatch: records.filter((record) => record.hasRosterMatch).length,
      eligibleForAggregateAttribution: records.filter((record) => record.eligibleForAggregateAttribution).length,
      eligibleForUnanimousAttribution: records.filter((record) => record.eligibleForUnanimousAttribution).length,
    },
    highestRemainingGaps: organizationReports.slice(0, 12),
  };

  return { generatedAt, records, organizationReports, audit };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const { generatedAt, records, organizationReports, audit } = generateReadiness();
writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, records, organizationReports, audit }, null, 2)}\n`);
console.log(`Generated vote attribution readiness for ${records.length} meetings at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
