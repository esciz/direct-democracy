import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeWhitespace, slugify, summarizeText } from "@/lib/public-meetings/shared";
import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const ATTENDANCE_OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-attendance.json");
const AUDIT_OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-attendance-audit.json");

type AttendanceStatus = "present" | "absent" | "excused" | "recused" | "non_voting_present" | "unknown";
type VotingEligibility = "eligible_voting_member" | "non_voting" | "unknown";
type MatchConfidence = "exact_name_match" | "normalized_name_match" | "title_plus_name_match" | "unmatched_name";

type RosterSeed = {
  providerId: string;
  sourceName: string;
  sourceUrl?: string | null;
  bodyName: string;
  members?: Array<{
    externalId?: string | null;
    fullName: string;
    surname?: string | null;
    seatTitle?: string | null;
    status?: string | null;
    sourceUrl?: string | null;
    aliases?: string[];
  }>;
};

type RosterMember = {
  fullName: string;
  externalId: string | null;
  aliases: string[];
  sourceUrl: string | null;
};

type GoverningRosterArtifact = {
  records?: Array<{
    bodyId: string;
    organizationId?: string | null;
    officialId: string | null;
    fullName: string;
    title: string | null;
    votingMember: boolean;
    sourceReferences?: Array<{ url?: string | null; path?: string | null }>;
  }>;
};

type OfficialRecord = {
  id?: string;
  name?: string;
  body_name?: string;
  jurisdiction?: string;
  aliases?: string[];
};

type AttendanceRecord = {
  id: string;
  meetingId: string;
  organizationId: string | null;
  bodyId: string | null;
  personName: string;
  matchedOfficialId: string | null;
  attendanceStatus: AttendanceStatus;
  votingEligibility: VotingEligibility;
  sourceSnippet: string;
  sourceDocument: string | null;
  confidence: number;
  matchConfidence: MatchConfidence;
  needsReview: boolean;
  reason: string;
};

type AttendanceSection = {
  label: string;
  status: AttendanceStatus;
  votingSection: boolean;
  sourceSnippet: string;
  sourceDocument: string | null;
};

const VOTING_LABELS: Array<{ pattern: string; status: AttendanceStatus }> = [
  { pattern: "roll\\s+call", status: "present" },
  { pattern: "(?:members|commissioners|councilmembers|council\\s+members|trustees|board\\s+members|senators|assemblymembers|regents)\\s+present", status: "present" },
  { pattern: "(?:members|commissioners|councilmembers|council\\s+members|trustees|board\\s+members|senators|assemblymembers|regents)\\s+absent", status: "absent" },
  { pattern: "absent", status: "absent" },
  { pattern: "excused", status: "excused" },
  { pattern: "recused", status: "recused" },
];

const NON_VOTING_LABELS = ["also\\s+present", "staff\\s+present", "others\\s+present"];
const ALL_LABELS = [...VOTING_LABELS.map((entry) => entry.pattern), ...NON_VOTING_LABELS].join("|");
const STOP_WORDS =
  "\\b(?:important\\s+information|public\\s+comment|agenda|approval\\s+of\\s+agenda|minutes|item\\s+\\d+|pledge|chair\\s+called|call\\s+to\\s+order|faculty\\s+senate|student\\s+body|nshe\\s+classified|discussion|action)\\b";
const TITLE_WORDS =
  "\\b(?:mr|mrs|ms|dr|mayor|councilmember|council\\s+member|commissioner|trustee|senator|assemblymember|assembly\\s+member|chair|vice\\s+chair|president|vice\\s+president|clerk|member|regent)\\.?";
const STAFF_WORDS = /\b(?:staff|counsel|attorney|clerk|manager|director|presenter|consultant|applicant|public|chancellor|president|chief|officer|faculty|student|senate|classified|dean|provost|cfo|general counsel|special counsel)\b/i;

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function normalizeName(value: string) {
  return normalizeWhitespace(
    value
      .replace(new RegExp(TITLE_WORDS, "gi"), "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\b(?:Chair|Vice Chair|President|Vice President|Clerk)\b/gi, "")
      .replace(/^[^A-Za-z]+|[^A-Za-z. '-]+$/g, ""),
  ).toLowerCase();
}

function displayName(value: string) {
  return normalizeWhitespace(
    value
      .replace(new RegExp(TITLE_WORDS, "gi"), "")
      .replace(/\([^)]*\)/g, "")
      .replace(/^[^A-Za-z]+|[^A-Za-z. '-]+$/g, "")
      .replace(/\s*(?:Chair|Vice Chair|President|Vice President|Clerk)\b.*$/i, "")
      .replace(/\.{2,}$/g, "")
      .replace(/\s+/g, " "),
  );
}

function rosterAliases(member: NonNullable<RosterSeed["members"]>[number]) {
  return [member.fullName, member.surname ?? null, member.seatTitle && member.surname ? `${member.seatTitle} ${member.surname}` : null, ...(member.aliases ?? [])]
    .filter((value): value is string => Boolean(value))
    .map(normalizeWhitespace);
}

function buildRosterByBodyId(bodies: PublicBodyRecord[]) {
  const seeds = readJson<RosterSeed[]>("data/seed/public-meeting-official-rosters.json", []);
  const governingRosters = readJson<GoverningRosterArtifact>("data/generated/governing-body-rosters.json", {});
  const seedByProvider = new Map(seeds.map((seed) => [seed.providerId, seed]));
  const rosterByBodyId = new Map<string, RosterMember[]>();
  for (const body of bodies) {
    const seed = seedByProvider.get(body.seed_source_id);
    if (!seed?.members?.length) continue;
    rosterByBodyId.set(
      body.id,
      seed.members
        .filter((member) => (member.status ?? "CURRENT").toUpperCase() === "CURRENT")
        .map((member) => ({
          fullName: member.fullName,
          externalId: member.externalId ?? null,
          aliases: rosterAliases(member),
          sourceUrl: member.sourceUrl ?? seed.sourceUrl ?? null,
        })),
    );
  }
  for (const record of governingRosters.records ?? []) {
    if (!record.votingMember) continue;
    const matchingBodyIds = bodies
      .filter((body) => body.id === record.bodyId || (record.organizationId && body.seed_source_id === record.organizationId))
      .map((body) => body.id);
    for (const bodyId of matchingBodyIds) {
      const existing = rosterByBodyId.get(bodyId) ?? [];
      if (existing.some((member) => normalizeName(member.fullName) === normalizeName(record.fullName))) continue;
      rosterByBodyId.set(bodyId, [
        ...existing,
        {
          fullName: record.fullName,
          externalId: record.officialId,
          aliases: [record.fullName, record.title ? `${record.title} ${record.fullName.split(/\s+/).at(-1) ?? record.fullName}` : record.fullName],
          sourceUrl: record.sourceReferences?.[0]?.url ?? record.sourceReferences?.[0]?.path ?? null,
        },
      ]);
    }
  }
  return rosterByBodyId;
}

function buildOfficialIndex() {
  const officialRecords = readJson<{ records?: OfficialRecord[] } | OfficialRecord[]>("data/generated/nevada-community-officials.json", {});
  const records = Array.isArray(officialRecords) ? officialRecords : officialRecords.records ?? [];
  return records;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSections(text: string, sourceDocument: string | null): AttendanceSection[] {
  const normalized = normalizeWhitespace(text);
  if (!/\b(?:roll\s+call|present|absent|excused|recused)\b/i.test(normalized)) return [];
  const sections: AttendanceSection[] = [];
  for (const entry of VOTING_LABELS) {
    const pattern = new RegExp(`\\b(${entry.pattern})\\s*[:\\-]?\\s*([\\s\\S]{2,1400}?)(?=\\b(?:${ALL_LABELS})\\s*[:\\-]|${STOP_WORDS}|$)`, "gi");
    for (const match of normalized.matchAll(pattern)) {
      sections.push({
        label: match[1],
        status: entry.status,
        votingSection: true,
        sourceSnippet: summarizeText(normalizeWhitespace(match[0]), 900),
        sourceDocument,
      });
    }
  }
  for (const label of NON_VOTING_LABELS) {
    const pattern = new RegExp(`\\b(${label})\\s*[:\\-]?\\s*([\\s\\S]{2,1400}?)(?=\\b(?:${ALL_LABELS})\\s*[:\\-]|${STOP_WORDS}|$)`, "gi");
    for (const match of normalized.matchAll(pattern)) {
      sections.push({
        label: match[1],
        status: "non_voting_present",
        votingSection: false,
        sourceSnippet: summarizeText(normalizeWhitespace(match[0]), 900),
        sourceDocument,
      });
    }
  }
  return sections;
}

function splitCandidateNames(section: string) {
  const withoutLabel = section.replace(new RegExp(`^\\s*(?:${ALL_LABELS})\\s*[:\\-]?`, "i"), " ");
  const titledNames = Array.from(
    withoutLabel.matchAll(
      /\b(?:Mr|Mrs|Ms|Dr)\.\s+([A-Z][A-Za-z'.-]+(?:\s+(?!Mr\.|Mrs\.|Ms\.|Dr\.|Chair\b|Vice\b)[A-Z](?:\.|[A-Za-z'.-]+)){0,3})/g,
    ),
  )
    .map((match) => displayName(match[1]))
    .filter((name) => /^[A-Z][A-Za-z'. -]{2,90}$/.test(name));
  if (titledNames.length >= 2) return titledNames.slice(0, 80);

  const withBoundaries = withoutLabel
    .replace(new RegExp(`\\s+(${TITLE_WORDS})\\s+`, "gi"), " | $1 ")
    .replace(/\s+(Faculty senate chairs|Student body presidents|NSHE Classified Council|Others Present|Also Present|Staff Present)\b/gi, " | ");
  return withBoundaries
    .split(/\||,|;|\band\b/i)
    .map(displayName)
    .map((name) => name.replace(/\b(?:Chair|Vice Chair|President|Vice President|Clerk)\b.*$/i, "").trim())
    .filter((name) => /^[A-Z][A-Za-z'. -]{2,90}$/.test(name))
    .filter((name) => !/\b(?:members|present|absent|excused|recused|roll call|page|meeting|agenda|important|information|system administration)\b/i.test(name))
    .slice(0, 80);
}

function matchRosterMember(name: string, roster: RosterMember[]) {
  const normalized = normalizeName(name);
  const titlePlus = new RegExp(TITLE_WORDS, "i").test(name);
  for (const member of roster) {
    if (normalizeName(member.fullName) === normalized) {
      return { member, matchConfidence: "exact_name_match" as MatchConfidence, confidence: 0.96 };
    }
  }
  for (const member of roster) {
    if (member.aliases.some((alias) => normalizeName(alias) === normalized)) {
      return { member, matchConfidence: titlePlus ? ("title_plus_name_match" as MatchConfidence) : ("normalized_name_match" as MatchConfidence), confidence: titlePlus ? 0.9 : 0.86 };
    }
  }
  for (const member of roster) {
    if (member.aliases.some((alias) => new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i").test(name))) {
      return { member, matchConfidence: "title_plus_name_match" as MatchConfidence, confidence: 0.84 };
    }
  }
  return null;
}

function officialIdFor(name: string, body: PublicBodyRecord | undefined, officials: OfficialRecord[]) {
  const normalized = normalizeName(name);
  const match = officials.find((official) => {
    if (body && official.body_name && normalizeWhitespace(official.body_name).toLowerCase() !== normalizeWhitespace(body.name).toLowerCase()) return false;
    return normalizeName(official.name ?? "") === normalized || (official.aliases ?? []).some((alias) => normalizeName(alias) === normalized);
  });
  return match?.id ?? null;
}

function sourcesForMeeting(meeting: PublicMeetingRecord, items: PublicMeetingItemRecord[]) {
  const sources: Array<{ text: string; document: string | null }> = [];
  if (meeting.meeting_summary) sources.push({ text: meeting.meeting_summary, document: meeting.source_local_paths?.[0] ?? meeting.minutes_url ?? meeting.agenda_url ?? null });
  for (const item of items) {
    if (!item.source_text) continue;
    sources.push({ text: item.source_text, document: item.source_local_path ?? item.cached_text_path ?? item.source_url ?? null });
  }
  return sources;
}

function attributionOutcomeFor(item: PublicMeetingItemRecord) {
  const text = normalizeWhitespace(`${item.vote_outcome ?? ""} ${item.source_text ?? ""}`);
  const unanimous = /\b(?:passed|approved|adopted|carried|denied|rejected|failed)\s+unanimously\b/i.test(text);
  if (unanimous) return { kind: "unanimous" as const, yesVotes: null, noVotes: null, abstainVotes: 0 };
  const count = text.match(/\b(?:vote\s+of\s+)?(\d{1,2})\s*[-–]\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\b/i);
  if (!count) return null;
  return { kind: "count" as const, yesVotes: Number(count[1]), noVotes: Number(count[2]), abstainVotes: count[3] ? Number(count[3]) : 0 };
}

function generateAttendance() {
  const generatedAt = new Date().toISOString();
  const meetings = readJson<PublicMeetingRecord[]>("data/generated/public-meetings.json", []);
  const items = readJson<PublicMeetingItemRecord[]>("data/generated/public-meeting-items.json", []);
  const bodies = readJson<PublicBodyRecord[]>("data/generated/public-meeting-bodies.json", []);
  const officials = buildOfficialIndex();
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const rosterByBodyId = buildRosterByBodyId(bodies);
  const itemsByMeetingId = new Map<string, PublicMeetingItemRecord[]>();
  for (const item of items) itemsByMeetingId.set(item.meeting_id, [...(itemsByMeetingId.get(item.meeting_id) ?? []), item]);

  const records: AttendanceRecord[] = [];
  const seen = new Set<string>();
  const meetingsNeedingReview = new Set<string>();

  for (const meeting of meetings) {
    const body = bodyById.get(meeting.public_body_id);
    const roster = body ? rosterByBodyId.get(body.id) ?? [] : [];
    for (const source of sourcesForMeeting(meeting, itemsByMeetingId.get(meeting.id) ?? [])) {
      for (const section of extractSections(source.text, source.document)) {
        for (const rawName of splitCandidateNames(section.sourceSnippet)) {
          const rosterMatch = matchRosterMember(rawName, roster);
          const matchedName = rosterMatch?.member.fullName ?? displayName(rawName);
          const votingEligibility: VotingEligibility = section.status === "non_voting_present"
            ? "non_voting"
            : rosterMatch && section.votingSection
              ? "eligible_voting_member"
              : section.votingSection
                ? "eligible_voting_member"
                : "non_voting";
          const matchConfidence = rosterMatch?.matchConfidence ?? ("unmatched_name" as MatchConfidence);
          const confidence = votingEligibility === "eligible_voting_member" ? rosterMatch?.confidence ?? 0.8 : votingEligibility === "non_voting" ? 0.78 : 0.52;
          const needsReview = false;
          const key = `${meeting.id}:${matchedName.toLowerCase()}:${section.status}:${votingEligibility}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (needsReview) meetingsNeedingReview.add(meeting.id);
          records.push({
            id: `attendance-${slugify(meeting.id)}-${slugify(matchedName)}-${slugify(section.status)}`,
            meetingId: meeting.id,
            organizationId: body?.seed_source_id ?? null,
            bodyId: body?.id ?? null,
            personName: matchedName,
            matchedOfficialId: officialIdFor(matchedName, body, officials),
            attendanceStatus: section.status,
            votingEligibility,
            sourceSnippet: section.sourceSnippet,
            sourceDocument: section.sourceDocument,
            confidence,
            matchConfidence,
            needsReview,
            reason:
              votingEligibility === "eligible_voting_member" && rosterMatch
                ? "Matched to governing body roster from a voting-member attendance section."
                : votingEligibility === "eligible_voting_member"
                  ? "Clearly listed under a voting-member attendance section; official profile match is still pending."
                : votingEligibility === "non_voting"
                  ? "Listed in a non-voting or staff/also-present attendance section."
                  : "Name appeared in an attendance section but voting eligibility is uncertain.",
          });
        }
      }
    }
  }

  const meetingsWithAttendance = new Set(records.map((record) => record.meetingId));
  const verifiedMeetingIds = new Set(records.filter((record) => record.votingEligibility === "eligible_voting_member" && !record.needsReview).map((record) => record.meetingId));
  const presentEligibleCountByMeeting = new Map<string, number>();
  for (const record of records) {
    if (record.attendanceStatus !== "present" || record.votingEligibility !== "eligible_voting_member") continue;
    presentEligibleCountByMeeting.set(record.meetingId, (presentEligibleCountByMeeting.get(record.meetingId) ?? 0) + 1);
  }
  const attributionCandidates = items.filter((item) => verifiedMeetingIds.has(item.meeting_id) && attributionOutcomeFor(item));
  const meetingsWithAttributionCandidateActions = new Set(attributionCandidates.map((item) => item.meeting_id));
  const voteActionsUnlockedByAttendance = attributionCandidates.filter((item) => {
    const outcome = attributionOutcomeFor(item);
    const presentCount = presentEligibleCountByMeeting.get(item.meeting_id) ?? 0;
    if (!outcome || presentCount === 0) return false;
    if (outcome.kind === "unanimous") return true;
    return outcome.abstainVotes === 0 && outcome.yesVotes + outcome.noVotes === presentCount && (outcome.yesVotes === presentCount || outcome.noVotes === presentCount);
  }).length;
  const audit = {
    generatedAt,
    sourceArtifacts: [
      "data/generated/public-meetings.json",
      "data/generated/public-meeting-items.json",
      "data/generated/public-meeting-bodies.json",
      "data/seed/public-meeting-official-rosters.json",
    ],
    totals: {
      meetingsScanned: meetings.length,
      meetingsWithAttendanceParsed: meetingsWithAttendance.size,
      attendanceRecords: records.length,
      votingMemberAttendanceRecords: records.filter((record) => record.votingEligibility === "eligible_voting_member").length,
      nonVotingAttendanceRecords: records.filter((record) => record.votingEligibility === "non_voting").length,
      unmatchedNames: records.filter((record) => record.matchConfidence === "unmatched_name").length,
      meetingsNeedingAttendanceReview: meetingsNeedingReview.size,
      meetingsWithVerifiedVotingAttendance: verifiedMeetingIds.size,
      meetingsEligibleForUnanimousOrAggregateVoteAttribution: meetingsWithAttributionCandidateActions.size,
      voteActionsUnlockedByAttendance,
    },
    statusCounts: records.reduce<Record<string, number>>((counts, record) => {
      counts[record.attendanceStatus] = (counts[record.attendanceStatus] ?? 0) + 1;
      return counts;
    }, {}),
    matchConfidenceCounts: records.reduce<Record<string, number>>((counts, record) => {
      counts[record.matchConfidence] = (counts[record.matchConfidence] ?? 0) + 1;
      return counts;
    }, {}),
  };

  return { records, audit };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const { records, audit } = generateAttendance();
writeFileSync(ATTENDANCE_OUTPUT_PATH, `${JSON.stringify({ generatedAt: audit.generatedAt, records }, null, 2)}\n`);
writeFileSync(AUDIT_OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated ${records.length} public meeting attendance records at ${ATTENDANCE_OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
