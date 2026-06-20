import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeWhitespace, slugify, summarizeText } from "@/lib/public-meetings/shared";
import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord, VoteChoice, VoteRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const VOTES_OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-votes.json");
const AUDIT_OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-vote-extraction-audit.json");

type EvidenceType =
  | "explicit_roll_call_group"
  | "inline_named_vote"
  | "motion_mover"
  | "motion_second"
  | "unanimous_with_attendance_roster"
  | "aggregate_full_roster_match"
  | "aggregate_partial_distribution"
  | "aggregate_only"
  | "ambiguous_vote_language"
  | "attendance_present"
  | "attendance_absent"
  | "attendance_excused"
  | "attendance_recused";

type GeneratedVoteRecord = VoteRecord & {
  action_type: "VOTE_YES" | "VOTE_NO" | "ABSTAIN" | "ABSENT" | "MOTION_MADE" | "MOTION_SECONDED";
  evidenceType: EvidenceType;
  motion_made_by: string | null;
  seconded_by: string | null;
  needs_roll_call_review: boolean;
  review_status: "parsed_named_vote" | "parsed_motion_metadata" | "needs_roll_call_review";
  source_references: Array<{ url: string | null; path: string | null; snippet: string | null }>;
  vote_outcome_snippet: string | null;
  attendance_snippet: string | null;
  meeting_id: string;
  agenda_item_id: string;
  governing_body: string | null;
  inference_rule: string | null;
  created_at: string;
};

type ParsedEvidence = {
  personName: string;
  vote: VoteChoice;
  actionType: GeneratedVoteRecord["action_type"];
  evidenceType: EvidenceType;
  sourceSnippet: string;
  confidence: number;
};

type AggregateEvidence = {
  meeting_item_id: string;
  meeting_id: string;
  title: string;
  source_url: string | null;
  sourceSnippet: string;
  outcome: string;
  evidenceType: EvidenceType;
  structuredOutcome?: StructuredVoteOutcome;
  reason?: string;
};

type RosterMember = {
  fullName: string;
  aliases: string[];
  sourceUrl: string | null;
};

type RosterSeed = {
  providerId: string;
  sourceName: string;
  sourceUrl?: string | null;
  bodyName: string;
  bodyAliases?: string[];
  members?: Array<{
    fullName: string;
    surname?: string | null;
    seatTitle?: string | null;
    status?: string | null;
    sourceUrl?: string | null;
    aliases?: string[];
  }>;
};
type RosterSeedMember = NonNullable<RosterSeed["members"]>[number];

type AttendanceRoster = {
  present: RosterMember[];
  absent: RosterMember[];
  excused: RosterMember[];
  recused: RosterMember[];
  nonVoting: RosterMember[];
  sourceSnippet: string;
  evidenceTypes: EvidenceType[];
};

type AttendanceArtifactRecord = {
  meetingId: string;
  bodyId: string | null;
  personName: string;
  matchedOfficialId: string | null;
  attendanceStatus: "present" | "absent" | "excused" | "recused" | "non_voting_present" | "unknown";
  votingEligibility: "eligible_voting_member" | "non_voting" | "unknown";
  sourceSnippet: string;
  sourceDocument: string | null;
  confidence: number;
  needsReview: boolean;
};

type StructuredVoteOutcome = {
  kind: "unanimous_yes" | "unanimous_no" | "count" | "needs_review";
  yesVotes: number | null;
  noVotes: number | null;
  abstainVotes: number | null;
  absentVotes: number | null;
  sourceSnippet: string;
  raw: string;
};

const TITLE_WORDS =
  /\b(?:mayor|councilmember|council member|councilwoman|councilman|commissioner|trustee|senator|assemblymember|assembly member|chair|vice chair|director|secretary|clerk|member|regent|regents)\b\.?/gi;
const NON_NAME_WORDS =
  /\b(?:none|unanimous|unanimously|all|motion|vote|votes|present|approved|passed|carried|failed|absent|abstain|nays?|ayes?|yeas?|noes?|license|agenda|item|public|staff|department|division|office|state|nevada|upon|roll|call|the|and)\b/i;
const ATTENDANCE_LABELS = "(?:members\\s+present|present|members\\s+absent|absent|excused|recused|non[-\\s]?voting|members\\s+not\\s+present)";

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function normalizeVoteValue(value: string): VoteChoice | null {
  const normalized = value.trim().toLowerCase();
  if (/^(?:yes|aye|ayes|yea|yeas)$/.test(normalized)) return "yes";
  if (/^(?:no|nay|nays|noes)$/.test(normalized)) return "no";
  if (/^(?:abstain|abstained|abstention)$/.test(normalized)) return "abstain";
  if (/^(?:absent|excused)$/.test(normalized)) return "absent";
  return null;
}

function actionTypeForVote(vote: VoteChoice): GeneratedVoteRecord["action_type"] {
  if (vote === "yes") return "VOTE_YES";
  if (vote === "no") return "VOTE_NO";
  if (vote === "abstain") return "ABSTAIN";
  if (vote === "absent") return "ABSENT";
  return "VOTE_YES";
}

function hasVoteLikeLanguage(item: PublicMeetingItemRecord) {
  return /\b(ayes?|yeas?|nays?|noes?|abstain(?:ed|ing)?|absent|motion|second(?:ed)?|vote|voted|approved|adopted|passed|carried|failed|denied)\b/i.test(
    `${item.vote_outcome ?? ""} ${item.source_text ?? ""}`,
  );
}

function sourceUrlFor(item: PublicMeetingItemRecord, meeting: PublicMeetingRecord | undefined) {
  return item.source_url ?? meeting?.minutes_url ?? meeting?.agenda_url ?? meeting?.source_urls?.[0] ?? null;
}

function voteId(item: PublicMeetingItemRecord, evidence: ParsedEvidence, index: number) {
  return `vote-${slugify(item.id)}-${slugify(evidence.actionType)}-${slugify(evidence.personName)}-${index}`;
}

function cleanName(value: string) {
  return normalizeWhitespace(
    value
      .replace(TITLE_WORDS, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\b(?:Dr|Mr|Mrs|Ms)\.\s+/g, "")
      .replace(/\s+/g, " "),
  );
}

function splitNames(value: string) {
  return value
    .split(/,|;|\band\b/i)
    .map(cleanName)
    .map((name) => name.replace(/^\W+|\W+$/g, ""))
    .filter((name) => /^[A-Z][A-Za-z'. -]{1,80}$/.test(name))
    .filter((name) => !NON_NAME_WORDS.test(name))
    .slice(0, 40);
}

function addUniqueEvidence(records: ParsedEvidence[], record: ParsedEvidence) {
  const key = `${record.evidenceType}:${record.personName.toLowerCase()}:${record.vote}:${record.sourceSnippet}`;
  if (records.some((existing) => `${existing.evidenceType}:${existing.personName.toLowerCase()}:${existing.vote}:${existing.sourceSnippet}` === key)) return;
  records.push(record);
}

function rosterMemberAliases(member: RosterSeedMember) {
  return [
    member.fullName,
    member.surname ?? null,
    member.seatTitle && member.surname ? `${member.seatTitle} ${member.surname}` : null,
    ...(member.aliases ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeWhitespace);
}

function buildRosterIndex(bodies: PublicBodyRecord[]) {
  const rosterSeeds = readJson<RosterSeed[]>("../seed/public-meeting-official-rosters.json", []);
  const byProviderId = new Map(rosterSeeds.map((roster) => [roster.providerId, roster]));
  const byBodyId = new Map<string, RosterMember[]>();
  for (const body of bodies) {
    const seed = byProviderId.get(body.seed_source_id);
    if (!seed?.members?.length) continue;
    byBodyId.set(
      body.id,
      seed.members
        .filter((member) => (member.status ?? "CURRENT").toUpperCase() === "CURRENT")
        .map((member) => ({
          fullName: member.fullName,
          aliases: rosterMemberAliases(member),
          sourceUrl: member.sourceUrl ?? seed.sourceUrl ?? null,
        })),
    );
  }
  return byBodyId;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function segmentMentionsMember(segment: string, member: RosterMember) {
  return member.aliases.some((alias) => alias.length >= 2 && new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(segment));
}

function membersMentioned(segment: string, roster: RosterMember[]) {
  return roster.filter((member) => segmentMentionsMember(segment, member));
}

function attendanceSegment(text: string, labelPattern: string) {
  const pattern = new RegExp(`\\b${labelPattern}\\s*[:\\-]?\\s*([\\s\\S]{0,900}?)(?=\\b${ATTENDANCE_LABELS}\\s*[:\\-]|\\b(?:public\\s+comment|agenda|approval|minutes|item\\s+\\d+|roll\\s+call|pledge)\\b|$)`, "i");
  const match = text.match(pattern);
  if (!match) return null;
  return normalizeWhitespace(match[0]);
}

function parseAttendanceRoster(meeting: PublicMeetingRecord | undefined, item: PublicMeetingItemRecord, roster: RosterMember[] | undefined): AttendanceRoster | null {
  if (!meeting || !roster?.length) return null;
  const text = normalizeWhitespace(`${meeting.meeting_summary ?? ""} ${item.source_text ?? ""}`);
  if (!text) return null;
  const presentSegment = attendanceSegment(text, "(?:members\\s+present|present)");
  const absentSegment = attendanceSegment(text, "(?:members\\s+absent|members\\s+not\\s+present|absent)");
  const excusedSegment = attendanceSegment(text, "excused");
  const recusedSegment = attendanceSegment(text, "recused");
  const nonVotingSegment = attendanceSegment(text, "non[-\\s]?voting");

  let present = presentSegment ? membersMentioned(presentSegment, roster) : [];
  const absent = absentSegment ? membersMentioned(absentSegment, roster) : [];
  const excused = excusedSegment ? membersMentioned(excusedSegment, roster) : [];
  const recused = recusedSegment ? membersMentioned(recusedSegment, roster) : [];
  const nonVoting = nonVotingSegment ? membersMentioned(nonVotingSegment, roster) : [];

  const allPresent = /\b(?:all\s+(?:members|commissioners|trustees|councilmembers|regents)\s+(?:were\s+)?present|all\s+present)\b/i.test(text);
  if (!present.length && allPresent) present = roster;

  if (!present.length && !absent.length && !excused.length && !recused.length) return null;
  const unavailable = new Set([...absent, ...excused, ...recused, ...nonVoting].map((member) => member.fullName));
  present = present.filter((member) => !unavailable.has(member.fullName));

  return {
    present,
    absent,
    excused,
    recused,
    nonVoting,
    sourceSnippet: summarizeText([presentSegment, absentSegment, excusedSegment, recusedSegment, nonVotingSegment].filter(Boolean).join(" "), 900),
    evidenceTypes: [
      present.length ? "attendance_present" : null,
      absent.length ? "attendance_absent" : null,
      excused.length ? "attendance_excused" : null,
      recused.length ? "attendance_recused" : null,
    ].filter(Boolean) as EvidenceType[],
  };
}

function attendanceRosterFromArtifact(meetingId: string, records: AttendanceArtifactRecord[]): AttendanceRoster | null {
  const meetingRecords = records.filter((record) => record.meetingId === meetingId);
  if (!meetingRecords.length) return null;
  const eligibleRecords = meetingRecords.filter((record) => record.votingEligibility === "eligible_voting_member" && !record.needsReview);
  const toMember = (record: AttendanceArtifactRecord): RosterMember => ({
    fullName: record.personName,
    aliases: [record.personName],
    sourceUrl: record.sourceDocument,
  });
  const present = eligibleRecords.filter((record) => record.attendanceStatus === "present").map(toMember);
  const absent = eligibleRecords.filter((record) => record.attendanceStatus === "absent").map(toMember);
  const excused = eligibleRecords.filter((record) => record.attendanceStatus === "excused").map(toMember);
  const recused = eligibleRecords.filter((record) => record.attendanceStatus === "recused").map(toMember);
  const nonVoting = meetingRecords.filter((record) => record.votingEligibility === "non_voting").map(toMember);
  if (!present.length && !absent.length && !excused.length && !recused.length) return null;
  return {
    present,
    absent,
    excused,
    recused,
    nonVoting,
    sourceSnippet: summarizeText(
      meetingRecords
        .map((record) => record.sourceSnippet)
        .filter(Boolean)
        .join(" "),
      900,
    ),
    evidenceTypes: [
      present.length ? "attendance_present" : null,
      absent.length ? "attendance_absent" : null,
      excused.length ? "attendance_excused" : null,
      recused.length ? "attendance_recused" : null,
    ].filter(Boolean) as EvidenceType[],
  };
}

function extractRollCallGroups(text: string) {
  const records: ParsedEvidence[] = [];
  const groupPattern =
    /\b(ayes?|yeas?|yes\s+votes?|nays?|noes?|no\s+votes?|abstain(?:ed|ing)?|abstentions?|absent|excused)\s*(?:vote|votes)?\s*[:\-]\s*([^.;\n]{2,520})(?=[.;\n]|$)/gi;
  for (const match of text.matchAll(groupPattern)) {
    const vote = normalizeVoteValue(match[1].replace(/\s+votes?$/i, ""));
    if (!vote) continue;
    const sourceSnippet = normalizeWhitespace(match[0]);
    for (const personName of splitNames(match[2])) {
      addUniqueEvidence(records, {
        personName,
        vote,
        actionType: actionTypeForVote(vote),
        evidenceType: "explicit_roll_call_group",
        sourceSnippet,
        confidence: 0.94,
      });
    }
  }
  return records;
}

function extractInlineNameVotePairs(text: string) {
  const records: ParsedEvidence[] = [];
  const labelPattern = /\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,3})\s*[:,]\s*(yes|aye|ayes|yea|yeas|no|nay|nays|noes|abstain|abstained|absent|excused)\b/gi;
  for (const match of text.matchAll(labelPattern)) {
    const vote = normalizeVoteValue(match[2]);
    const [personName] = splitNames(match[1]);
    if (!vote || !personName) continue;
    addUniqueEvidence(records, {
      personName,
      vote,
      actionType: actionTypeForVote(vote),
      evidenceType: "inline_named_vote",
      sourceSnippet: normalizeWhitespace(match[0]),
      confidence: 0.9,
    });
  }

  const sentences = text
    .split(/(?<=[.;\n])\s+/)
    .map(normalizeWhitespace)
    .filter(Boolean);
  const votedPattern = /(.{2,420}?)\s+voted\s+(yes|aye|yea|no|nay|abstain|abstained|absent|excused)\b/gi;
  for (const sentence of sentences) {
    for (const match of sentence.matchAll(votedPattern)) {
      const vote = normalizeVoteValue(match[2]);
      if (!vote) continue;
      const sourceSnippet = normalizeWhitespace(match[0]);
      for (const personName of splitNames(match[1])) {
        addUniqueEvidence(records, {
          personName,
          vote,
          actionType: actionTypeForVote(vote),
          evidenceType: "inline_named_vote",
          sourceSnippet,
          confidence: 0.9,
        });
      }
    }
  }
  return records;
}

function extractMotionMetadata(text: string) {
  const records: ParsedEvidence[] = [];
  const motionPatterns: Array<{ pattern: RegExp; actionType: GeneratedVoteRecord["action_type"]; evidenceType: EvidenceType }> = [
    { pattern: /\b(?:motion\s+(?:made\s+)?by|moved\s+by|upon\s+motion\s+by)\s+([^.;\n]{2,140})/gi, actionType: "MOTION_MADE", evidenceType: "motion_mover" },
    { pattern: /\b(?:second(?:ed)?\s+by)\s+([^.;\n]{2,140})/gi, actionType: "MOTION_SECONDED", evidenceType: "motion_second" },
  ];
  for (const { pattern, actionType, evidenceType } of motionPatterns) {
    for (const match of text.matchAll(pattern)) {
      const [personName] = splitNames(match[1]);
      if (!personName) continue;
      addUniqueEvidence(records, {
        personName,
        vote: "unknown",
        actionType,
        evidenceType,
        sourceSnippet: normalizeWhitespace(match[0]),
        confidence: 0.82,
      });
    }
  }
  return records;
}

function structuredOutcomeFor(item: PublicMeetingItemRecord): StructuredVoteOutcome | null {
  const text = normalizeWhitespace(`${item.vote_outcome ?? ""} ${item.source_text ?? ""}`);
  const unanimous = text.match(
    /\b(?:(passed|approved|adopted|carried|denied|rejected|failed)\s+unanimously|unanimous\s+(approval|vote|denial|rejection)|unanimously\s+(approved|adopted|carried|denied|rejected|failed)|voted\s+unanimously\s+to\s+(approve|adopt|carry|deny|reject|fail))\b[^.;\n]*/i,
  );
  if (unanimous) {
    const snippet = normalizeWhitespace(unanimous[0]);
    if (/\b(?:denied|rejected|failed|denial|rejection|deny|reject|fail)\b/i.test(snippet)) {
      return { kind: "unanimous_no", yesVotes: 0, noVotes: null, abstainVotes: 0, absentVotes: null, sourceSnippet: snippet, raw: snippet };
    }
    if (/\b(?:passed|approved|adopted|carried|approval|approve|adopt|carry|vote)\b/i.test(snippet)) {
      return { kind: "unanimous_yes", yesVotes: null, noVotes: 0, abstainVotes: 0, absentVotes: null, sourceSnippet: snippet, raw: snippet };
    }
    return { kind: "needs_review", yesVotes: null, noVotes: null, abstainVotes: null, absentVotes: null, sourceSnippet: snippet, raw: snippet };
  }

  const count = text.match(/\b(?:(approved|adopted|passed|carried|failed|denied|rejected|motion\s+passed|motion\s+failed|resolution\s+failed|resolution\s+passed)\s+)?(?:by\s+)?(?:a\s+)?(?:vote\s+of\s+)?(\d{1,2})\s*[-–]\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\b/i);
  if (count) {
    return {
      kind: "count",
      yesVotes: Number(count[2]),
      noVotes: Number(count[3]),
      abstainVotes: count[4] ? Number(count[4]) : 0,
      absentVotes: null,
      sourceSnippet: normalizeWhitespace(count[0]),
      raw: normalizeWhitespace(count[0]),
    };
  }
  return null;
}

function aggregateEvidenceFor(item: PublicMeetingItemRecord, meeting: PublicMeetingRecord | undefined): AggregateEvidence | null {
  const structuredOutcome = structuredOutcomeFor(item);
  const text = normalizeWhitespace(`${item.vote_outcome ?? ""} ${item.source_text ?? ""}`);
  const match = text.match(
    /\b(?:approved unanimously|unanimously approved|motion\s+(?:carried|passed|failed)|(?:approved|adopted|passed|carried|failed|denied)(?:\s+by)?(?:\s+a)?(?:\s+vote)?(?:\s+of)?\s+\d+\s*[-–]\s*\d+|approved|adopted|passed|carried|failed|denied)\b[^.;\n]*/i,
  );
  if (!match && !structuredOutcome) return null;
  const sourceSnippet = structuredOutcome?.sourceSnippet ?? normalizeWhitespace(match?.[0] ?? "");
  return {
    meeting_item_id: item.id,
    meeting_id: item.meeting_id,
    title: item.title,
    source_url: sourceUrlFor(item, meeting),
    sourceSnippet: summarizeText(sourceSnippet, 360),
    outcome: item.vote_outcome ?? summarizeText(sourceSnippet, 220),
    evidenceType: "aggregate_only",
    structuredOutcome: structuredOutcome ?? undefined,
  };
}

function ambiguousEvidenceFor(item: PublicMeetingItemRecord, meeting: PublicMeetingRecord | undefined) {
  const text = normalizeWhitespace(item.source_text);
  if (!/\b(?:roll\s+call|vote|voted|ayes?|nays?|abstain|absent|motion)\b/i.test(text)) return null;
  return {
    meeting_item_id: item.id,
    meeting_id: item.meeting_id,
    title: item.title,
    source_url: sourceUrlFor(item, meeting),
    reason: "Vote-related language exists, but no supported explicit name-to-vote evidence was found.",
    sourceSnippet: summarizeText(text, 360),
    evidenceType: "ambiguous_vote_language" as EvidenceType,
  };
}

function fullyAccountedVotes({
  item,
  meeting,
  body,
  roster,
  attendance,
  outcome,
}: {
  item: PublicMeetingItemRecord;
  meeting: PublicMeetingRecord | undefined;
  body: PublicBodyRecord | null;
  roster: RosterMember[] | undefined;
  attendance: AttendanceRoster | null;
  outcome: StructuredVoteOutcome | null;
}) {
  const records: ParsedEvidence[] = [];
  const blockers: string[] = [];
  if (!outcome || outcome.kind === "needs_review") return { records, blockers: outcome ? ["outcome_needs_review"] : ["outcome_not_structured"], rule: null as string | null };
  if (!attendance || !attendance.present.length) return { records, blockers: ["attendance_not_verified"], rule: null as string | null };

  const unavailableCount = attendance.absent.length + attendance.excused.length + attendance.recused.length;
  if (roster?.length && attendance.present.length + unavailableCount > roster.length) blockers.push("attendance_exceeds_known_membership");
  const voteChoice = outcome.kind === "unanimous_yes" ? "yes" : outcome.kind === "unanimous_no" ? "no" : null;
  const rule = outcome.kind === "count" ? "aggregate_full_roster_match" : "unanimous_with_attendance_roster";

  if (outcome.kind === "count") {
    const yesVotes = outcome.yesVotes ?? 0;
    const noVotes = outcome.noVotes ?? 0;
    const abstainVotes = outcome.abstainVotes ?? 0;
    if (abstainVotes > 0) blockers.push("unidentified_abstentions");
    if (yesVotes + noVotes + abstainVotes !== attendance.present.length) blockers.push("vote_count_does_not_match_present_members");
    if (yesVotes > 0 && noVotes > 0) blockers.push("needs_vote_distribution_review");
    if (!blockers.length) {
      const inferredVote: VoteChoice = yesVotes === attendance.present.length ? "yes" : "no";
      for (const member of attendance.present) {
        records.push({
          personName: member.fullName,
          vote: inferredVote,
          actionType: actionTypeForVote(inferredVote),
          evidenceType: "aggregate_full_roster_match",
          sourceSnippet: outcome.sourceSnippet,
          confidence: 0.86,
        });
      }
    }
  } else if (voteChoice) {
    for (const member of attendance.present) {
      records.push({
        personName: member.fullName,
        vote: voteChoice,
        actionType: actionTypeForVote(voteChoice),
        evidenceType: "unanimous_with_attendance_roster",
        sourceSnippet: outcome.sourceSnippet,
        confidence: 0.88,
      });
    }
  }

  return { records: blockers.length ? [] : records, blockers, rule };
}

function generateVotes() {
  const generatedAt = new Date().toISOString();
  const items = readJson<PublicMeetingItemRecord[]>("public-meeting-items.json", []);
  const meetings = readJson<PublicMeetingRecord[]>("public-meetings.json", []);
  const bodies = readJson<PublicBodyRecord[]>("public-meeting-bodies.json", []);
  const attendanceArtifact = readJson<{ records?: AttendanceArtifactRecord[] }>("public-meeting-attendance.json", { records: [] });
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const rosterByBodyId = buildRosterIndex(bodies);
  const attendanceRecords = attendanceArtifact.records ?? [];
  const votes: GeneratedVoteRecord[] = [];
  const aggregateOnlyOutcomes: AggregateEvidence[] = [];
  const ambiguousVoteActions: Array<{ meeting_item_id: string; meeting_id: string; title: string; source_url: string | null; reason: string; sourceSnippet: string; evidenceType: EvidenceType }> = [];
  const attendanceReviewActions: Array<{ meeting_item_id: string; meeting_id: string; title: string; source_url: string | null; reason: string; outcome: StructuredVoteOutcome | null }> = [];
  const distributionReviewActions: Array<{ meeting_item_id: string; meeting_id: string; title: string; source_url: string | null; reason: string; outcome: StructuredVoteOutcome | null }> = [];
  const attendanceRosters = new Map<string, AttendanceRoster>();
  let totalVoteLikeActions = 0;
  let skippedDueToInsufficientEvidence = 0;

  for (const item of items) {
    const meeting = meetingById.get(item.meeting_id);
    const body = meeting ? bodyById.get(meeting.public_body_id) ?? null : null;
    const roster = body ? rosterByBodyId.get(body.id) : undefined;
    const attendance = attendanceRosterFromArtifact(item.meeting_id, attendanceRecords) ?? parseAttendanceRoster(meeting, item, roster);
    if (attendance && !attendanceRosters.has(item.meeting_id)) attendanceRosters.set(item.meeting_id, attendance);
    const voteLike = hasVoteLikeLanguage(item);
    if (!voteLike) {
      skippedDueToInsufficientEvidence += 1;
      continue;
    }
    totalVoteLikeActions += 1;

    const text = normalizeWhitespace(item.source_text);
    const parsedEvidence = [
      ...extractRollCallGroups(text),
      ...extractInlineNameVotePairs(text),
      ...extractMotionMetadata(text),
    ];
    const structuredOutcome = structuredOutcomeFor(item);
    const motion = parsedEvidence.find((evidence) => evidence.evidenceType === "motion_mover")?.personName ?? null;
    const second = parsedEvidence.find((evidence) => evidence.evidenceType === "motion_second")?.personName ?? null;
    const hasNamedVote = parsedEvidence.some((evidence) => evidence.evidenceType === "explicit_roll_call_group" || evidence.evidenceType === "inline_named_vote");
    const inferred = hasNamedVote
      ? { records: [] as ParsedEvidence[], blockers: [] as string[], rule: null as string | null }
      : fullyAccountedVotes({ item, meeting, body, roster, attendance, outcome: structuredOutcome });
    if (!hasNamedVote && structuredOutcome && !inferred.records.length) {
      if (inferred.blockers.includes("needs_vote_distribution_review") || inferred.blockers.includes("unidentified_abstentions") || inferred.blockers.includes("vote_count_does_not_match_present_members")) {
        distributionReviewActions.push({
          meeting_item_id: item.id,
          meeting_id: item.meeting_id,
          title: item.title,
          source_url: sourceUrlFor(item, meeting),
          reason: inferred.blockers.join(", "),
          outcome: structuredOutcome,
        });
      } else if (inferred.blockers.length) {
        attendanceReviewActions.push({
          meeting_item_id: item.id,
          meeting_id: item.meeting_id,
          title: item.title,
          source_url: sourceUrlFor(item, meeting),
          reason: inferred.blockers.join(", "),
          outcome: structuredOutcome,
        });
      }
    }
    parsedEvidence.push(...inferred.records);

    parsedEvidence.forEach((evidence, index) => {
      votes.push({
        id: voteId(item, evidence, index),
        meeting_item_id: item.id,
        meeting_id: item.meeting_id,
        official_id: null,
        official_name: evidence.personName,
        motion,
        vote: evidence.vote,
        result: item.vote_outcome ?? null,
        vote_text: summarizeText(evidence.sourceSnippet || item.vote_outcome || item.source_text, 520),
        source_snippet: summarizeText(evidence.sourceSnippet, 900),
        confidence_score: evidence.confidence,
        source_url: sourceUrlFor(item, meeting),
        source_page: item.source_page,
        action_type: evidence.actionType,
        evidenceType: evidence.evidenceType,
        motion_made_by: motion,
        seconded_by: second,
        needs_roll_call_review: false,
        review_status: evidence.evidenceType === "motion_mover" || evidence.evidenceType === "motion_second" ? "parsed_motion_metadata" : "parsed_named_vote",
        source_references: [
          {
            url: sourceUrlFor(item, meeting),
            path: item.source_local_path ?? item.cached_text_path ?? null,
            snippet: summarizeText(evidence.sourceSnippet, 520),
          },
        ],
        vote_outcome_snippet: evidence.evidenceType === "attendance_absent" || evidence.evidenceType === "attendance_excused" ? structuredOutcome?.sourceSnippet ?? null : evidence.sourceSnippet,
        attendance_snippet: attendance?.sourceSnippet ?? null,
        agenda_item_id: item.id,
        governing_body: body ? `${body.name} · ${body.jurisdiction}` : null,
        inference_rule:
          evidence.evidenceType === "unanimous_with_attendance_roster"
            ? "unanimous outcome plus source-backed attendance roster and known governing body membership"
            : evidence.evidenceType === "aggregate_full_roster_match"
              ? "aggregate count fully reconciled against source-backed attendance roster and known governing body membership"
              : evidence.evidenceType === "attendance_absent" || evidence.evidenceType === "attendance_excused"
                ? "attendance status explicitly listed in source-backed roster section"
                : null,
        created_at: generatedAt,
      });
    });

    const aggregate = aggregateEvidenceFor(item, meeting);
    if (aggregate) aggregateOnlyOutcomes.push(aggregate);

    if (!hasNamedVote) {
      const ambiguous = ambiguousEvidenceFor(item, meeting);
      if (ambiguous && !aggregate) ambiguousVoteActions.push(ambiguous);
      else if (!aggregate && !parsedEvidence.length) skippedDueToInsufficientEvidence += 1;
    }
  }

  const namedVoteRows = votes.filter((vote) => vote.review_status === "parsed_named_vote");
  const explicitNamedVoteRows = votes.filter((vote) => vote.evidenceType === "explicit_roll_call_group" || vote.evidenceType === "inline_named_vote");
  const unanimousInferredRows = votes.filter((vote) => vote.evidenceType === "unanimous_with_attendance_roster");
  const aggregateInferredRows = votes.filter((vote) => vote.evidenceType === "aggregate_full_roster_match");
  const namedVoteActionIds = new Set(namedVoteRows.map((vote) => vote.meeting_item_id));
  const motionRows = votes.filter((vote) => vote.review_status === "parsed_motion_metadata");
  const aggregateOnlyRetained = aggregateOnlyOutcomes.filter((outcome) => !namedVoteActionIds.has(outcome.meeting_item_id));
  const audit = {
    generatedAt,
    sourceArtifacts: ["data/generated/public-meeting-items.json", "data/generated/public-meetings.json", "data/generated/public-meeting-bodies.json"],
    totals: {
      meetingItems: items.length,
      totalVoteLikeActions,
      unanimousActionsFound: aggregateOnlyOutcomes.filter((outcome) => outcome.structuredOutcome?.kind === "unanimous_yes" || outcome.structuredOutcome?.kind === "unanimous_no").length,
      aggregateVoteCountActionsFound: aggregateOnlyOutcomes.filter((outcome) => outcome.structuredOutcome?.kind === "count").length,
      attendanceRostersParsed: attendanceRosters.size,
      fullRosterMatches: new Set([...unanimousInferredRows, ...aggregateInferredRows].map((vote) => vote.meeting_item_id)).size,
      parsedNamedVotes: namedVoteRows.length,
      explicitNamedVotesParsed: explicitNamedVoteRows.length,
      parsedNamedVoteActions: namedVoteActionIds.size,
      individualVotesInferredFromUnanimousOutcomes: unanimousInferredRows.length,
      individualVotesInferredFromAggregateCounts: aggregateInferredRows.length,
      aggregateOnlyOutcomes: aggregateOnlyRetained.length,
      motionSecondParsed: motionRows.length,
      ambiguousVoteActionsNeedingReview: ambiguousVoteActions.length,
      actionsNeedingAttendanceReview: attendanceReviewActions.length,
      actionsNeedingDistributionReview: distributionReviewActions.length,
      unnamedVoteActions: aggregateOnlyRetained.length + ambiguousVoteActions.length,
      needsReview: ambiguousVoteActions.length + attendanceReviewActions.length + distributionReviewActions.length,
      remainingUnresolvedVoteActions: ambiguousVoteActions.length + attendanceReviewActions.length + distributionReviewActions.length,
      skippedDueToInsufficientEvidence,
    },
    aggregateOnlyOutcomes: aggregateOnlyRetained,
    ambiguousVoteActions,
    attendanceReviewActions,
    distributionReviewActions,
    voteChoiceCounts: votes.reduce<Record<string, number>>((counts, vote) => {
      counts[vote.vote] = (counts[vote.vote] ?? 0) + 1;
      return counts;
    }, {}),
    evidenceTypeCounts: votes.reduce<Record<string, number>>((counts, vote) => {
      counts[vote.evidenceType] = (counts[vote.evidenceType] ?? 0) + 1;
      return counts;
    }, {}),
    parserPolicy: {
      namedVotesOnly: true,
      noInference: true,
      aggregateOutcomesRemainSeparate: true,
      explicitNameToVoteEvidenceRequired: true,
    },
  };

  return { votes, audit };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const { votes, audit } = generateVotes();
writeFileSync(VOTES_OUTPUT_PATH, `${JSON.stringify(votes, null, 2)}\n`);
writeFileSync(AUDIT_OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated ${audit.totals.parsedNamedVotes} named public meeting votes at ${VOTES_OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
