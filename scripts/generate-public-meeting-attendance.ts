import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeWhitespace, slugify, summarizeText } from "@/lib/public-meetings/shared";
import type { PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const ATTENDANCE_OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-attendance.json");
const AUDIT_OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-attendance-audit.json");
const MAX_SOURCE_BYTES = 1_500_000;
const MAX_SOURCE_CHARS = 180_000;

type AttendanceStatus = "present" | "remote_present" | "absent" | "excused" | "recused" | "non_voting_present" | "unknown";
type VotingEligibility = "eligible_voting_member" | "non_voting" | "unknown";
type MatchConfidence = "exact_name_match" | "normalized_name_match" | "title_plus_name_match" | "ambiguous_name" | "unmatched_name";

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
  title?: string;
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

type ActionResultArtifact = {
  records?: Array<{
    meetingId: string;
    sourceSnippet?: string | null;
    sourceUrl?: string | null;
    sourcePath?: string | null;
  }>;
};

type DocumentTextArtifact = {
  records?: Array<{
    meetingId: string;
    documentId: string;
    extractedTextPath: string | null;
    sourceSnippet: string | null;
    extractionQuality: string;
  }>;
};

const VOTING_LABELS: Array<{ pattern: string; status: AttendanceStatus }> = [
  { pattern: "roll\\s+call", status: "present" },
  { pattern: "call\\s+to\\s+order\\s+and\\s+roll\\s+call", status: "present" },
  { pattern: "present\\s+were", status: "present" },
  { pattern: "(?:members|commissioners|councilmembers|council\\s+members|trustees|board\\s+members|senators|assemblymembers|regents)\\s+present", status: "present" },
  { pattern: "(?:members|commissioners|councilmembers|council\\s+members|trustees|board\\s+members|senators|assemblymembers|regents)\\s+absent", status: "absent" },
  { pattern: "absent", status: "absent" },
  { pattern: "excused", status: "excused" },
  { pattern: "recused", status: "recused" },
  { pattern: "(?:attended|participating)\\s+(?:remotely|via\\s+zoom)", status: "remote_present" },
];

const NON_VOTING_LABELS = ["also\\s+present", "staff\\s+present", "others\\s+present"];
const ALL_LABELS = [...VOTING_LABELS.map((entry) => entry.pattern), ...NON_VOTING_LABELS].join("|");
const STOP_WORDS =
  "\\b(?:important\\s+information|public\\s+comment|agenda|approval\\s+of\\s+agenda|minutes|item\\s+\\d+|pledge|invocation|result|mover|seconder|ayes?|nays?|abstentions?|chair\\s+called|call\\s+to\\s+order|faculty\\s+senate|student\\s+body|nshe\\s+classified|discussion|action)\\b";
const TITLE_WORDS =
  "\\b(?:mr|mrs|ms|dr|mayor|councilmember|council\\s+member|commissioner|trustee|senator|assemblymember|assembly\\s+member|chair|vice\\s+chair|president|vice\\s+president|clerk|member|regent)\\.?";
const STAFF_WORDS = /\b(?:staff|counsel|attorney|clerk|manager|director|presenter|consultant|applicant|public|chancellor|president|chief|officer|faculty|student|senate|classified|dean|provost|cfo|general counsel|special counsel)\b/i;
const NON_PERSON_NAME_WORDS =
  /\b(?:none|determination|quorum|entertainment\s+board|times|new roman|helvetica|arial|serif|font|family|style|span|table|motion|moved|seconded|approved|passed|carried|voted?|votes?|ayes?|nays?|yes|no|public\s+comments?|comments?|agenda|meeting|minutes|approval|call\s+to\s+order|roll|called|invocation|church|chapel|pastor|street|reno|nevada|county|district|attorney|manager|case|code|policy|parks|recreation|planning\s+commission|community\s+development|chief\s+financial|recorder|ordinance)\b/i;

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
      .replace(/\bwas\s+(?:present|absent|excused|recused)\b.*$/i, "")
      .replace(/\bwas$/i, "")
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
  const officials = buildOfficialIndex();
  for (const body of bodies) {
    const existing = rosterByBodyId.get(body.id) ?? [];
    const bodyName = normalizeWhitespace(body.name).toLowerCase();
    const bodyJurisdiction = normalizeWhitespace(body.jurisdiction).toLowerCase();
    const additions = officials.filter((official) => {
      const officialBody = normalizeWhitespace(official.body_name ?? "").toLowerCase();
      const officialJurisdiction = normalizeWhitespace(official.jurisdiction ?? "").toLowerCase();
      if (officialBody && (officialBody === bodyName || bodyName.includes(officialBody) || officialBody.includes(bodyName))) return true;
      if (!officialJurisdiction.includes(bodyJurisdiction) && !bodyJurisdiction.includes(officialJurisdiction)) return false;
      return /\b(?:mayor|supervisor|commissioner|council|trustee|senator|assembly|regent|clerk|sheriff|assessor|treasurer|recorder)\b/i.test(`${official.title ?? ""} ${official.body_name ?? ""}`);
    });
    for (const official of additions) {
      if (!official.name) continue;
      if (existing.some((member) => normalizeName(member.fullName) === normalizeName(official.name ?? ""))) continue;
      existing.push({
        fullName: official.name,
        externalId: official.id ?? null,
        aliases: [official.name, ...(official.aliases ?? []), official.title ? `${official.title} ${official.name.split(/\s+/).at(-1) ?? official.name}` : official.name].map(normalizeWhitespace),
        sourceUrl: null,
      });
    }
    if (existing.length) rosterByBodyId.set(body.id, existing);
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
    .map((name) => name.replace(/\s+(?:on video conference|by phone|non-voting)\b.*$/i, "").trim())
    .filter((name) => /^[A-Z][A-Za-z'. -]{2,90}$/.test(name))
    .filter((name) => !/^(?:[IVX]+\.?|[A-Z]\.?|None)$/i.test(name))
    .filter((name) => !NON_PERSON_NAME_WORDS.test(name))
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
  const lastName = normalized.split(/\s+/).filter(Boolean).at(-1);
  if (lastName && normalized === lastName && lastName.length >= 3) {
    const matches = roster.filter((member) => normalizeName(member.fullName).split(/\s+/).at(-1) === lastName || member.aliases.some((alias) => normalizeName(alias) === lastName));
    if (matches.length === 1) return { member: matches[0], matchConfidence: "normalized_name_match" as MatchConfidence, confidence: 0.78 };
    if (matches.length > 1) return { member: null, matchConfidence: "ambiguous_name" as MatchConfidence, confidence: 0.42 };
  }
  if (lastName && titlePlus) {
    const matches = roster.filter((member) => normalizeName(member.fullName).split(/\s+/).at(-1) === lastName);
    if (matches.length === 1) return { member: matches[0], matchConfidence: "title_plus_name_match" as MatchConfidence, confidence: 0.82 };
    if (matches.length > 1) return { member: null, matchConfidence: "ambiguous_name" as MatchConfidence, confidence: 0.42 };
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

function readCachedSource(localPath: string) {
  try {
    const absolutePath = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), localPath);
    const stats = statSync(absolutePath);
    if (stats.size > MAX_SOURCE_BYTES) return null;
    const text = readFileSync(absolutePath, "utf8").slice(0, MAX_SOURCE_CHARS);
    if (!/\b(?:roll\s+call|present|absent|excused|recused)\b/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

function sourcesForMeeting(meeting: PublicMeetingRecord, items: PublicMeetingItemRecord[]) {
  const sources: Array<{ text: string; document: string | null }> = [];
  if (meeting.meeting_summary) sources.push({ text: meeting.meeting_summary, document: meeting.source_local_paths?.[0] ?? meeting.minutes_url ?? meeting.agenda_url ?? null });
  const seenDocuments = new Set<string>();
  for (const localPath of meeting.source_local_paths ?? []) {
    if (seenDocuments.has(localPath)) continue;
    seenDocuments.add(localPath);
    const text = readCachedSource(localPath);
    if (text) sources.push({ text, document: localPath });
  }
  for (const item of items) {
    if (item.source_text) sources.push({ text: item.source_text, document: item.source_local_path ?? item.cached_text_path ?? item.source_url ?? null });
    for (const localPath of [item.source_local_path, item.cached_text_path].filter(Boolean) as string[]) {
      if (seenDocuments.has(localPath)) continue;
      seenDocuments.add(localPath);
      const text = readCachedSource(localPath);
      if (text) sources.push({ text, document: localPath });
    }
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

function addRosterAttendanceRecord({
  records,
  seen,
  meeting,
  body,
  officials,
  member,
  status,
  snippet,
  document,
  reason,
}: {
  records: AttendanceRecord[];
  seen: Set<string>;
  meeting: PublicMeetingRecord;
  body: PublicBodyRecord | undefined;
  officials: OfficialRecord[];
  member: RosterMember;
  status: Extract<AttendanceStatus, "present" | "absent" | "excused" | "recused" | "remote_present">;
  snippet: string;
  document: string | null;
  reason: string;
}) {
  const key = `${meeting.id}:${member.fullName.toLowerCase()}:${status}:eligible_voting_member`;
  if (seen.has(key)) return;
  seen.add(key);
  records.push({
    id: `attendance-${slugify(meeting.id)}-${slugify(member.fullName)}-${slugify(status)}`,
    meetingId: meeting.id,
    organizationId: body?.seed_source_id ?? null,
    bodyId: body?.id ?? null,
    personName: member.fullName,
    matchedOfficialId: member.externalId ?? officialIdFor(member.fullName, body, officials),
    attendanceStatus: status,
    votingEligibility: "eligible_voting_member",
    sourceSnippet: snippet,
    sourceDocument: document,
    confidence: status === "present" || status === "remote_present" ? 0.84 : 0.86,
    matchConfidence: "title_plus_name_match",
    needsReview: false,
    reason,
  });
}

function generateAttendance() {
  const generatedAt = new Date().toISOString();
  const meetings = readJson<PublicMeetingRecord[]>("data/generated/public-meetings.json", []);
  const items = readJson<PublicMeetingItemRecord[]>("data/generated/public-meeting-items.json", []);
  const bodies = readJson<PublicBodyRecord[]>("data/generated/public-meeting-bodies.json", []);
  const actionResults = readJson<ActionResultArtifact>("data/generated/public-meeting-action-results.json", { records: [] });
  const documentText = readJson<DocumentTextArtifact>("data/generated/public-meeting-document-text.json", { records: [] });
  const officials = buildOfficialIndex();
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const rosterByBodyId = buildRosterByBodyId(bodies);
  const itemsByMeetingId = new Map<string, PublicMeetingItemRecord[]>();
  for (const item of items) itemsByMeetingId.set(item.meeting_id, [...(itemsByMeetingId.get(item.meeting_id) ?? []), item]);
  const actionResultsByMeetingId = new Map<string, NonNullable<ActionResultArtifact["records"]>>();
  for (const result of actionResults.records ?? []) actionResultsByMeetingId.set(result.meetingId, [...(actionResultsByMeetingId.get(result.meetingId) ?? []), result]);
  const documentTextByMeetingId = new Map<string, NonNullable<DocumentTextArtifact["records"]>>();
  for (const text of documentText.records ?? []) documentTextByMeetingId.set(text.meetingId, [...(documentTextByMeetingId.get(text.meetingId) ?? []), text]);

  const records: AttendanceRecord[] = [];
  const seen = new Set<string>();
  const meetingsNeedingReview = new Set<string>();

  for (const meeting of meetings) {
    const body = bodyById.get(meeting.public_body_id);
    const roster = body ? rosterByBodyId.get(body.id) ?? [] : [];
    const sources = [
      ...sourcesForMeeting(meeting, itemsByMeetingId.get(meeting.id) ?? []),
      ...(actionResultsByMeetingId.get(meeting.id) ?? []).map((result) => ({ text: result.sourceSnippet ?? "", document: result.sourcePath ?? result.sourceUrl ?? null })),
      ...(documentTextByMeetingId.get(meeting.id) ?? []).map((record) => {
        let text = record.sourceSnippet ?? "";
        if (record.extractedTextPath) {
          try {
            text = readFileSync(path.join(process.cwd(), record.extractedTextPath), "utf8");
          } catch {
            text = record.sourceSnippet ?? "";
          }
        }
        return { text, document: record.documentId };
      }),
    ];
    for (const source of sources) {
      for (const section of extractSections(source.text, source.document)) {
        for (const rawName of splitCandidateNames(section.sourceSnippet)) {
          const rosterMatch = matchRosterMember(rawName, roster);
          const matchedName = rosterMatch?.member?.fullName ?? displayName(rawName);
          const votingEligibility: VotingEligibility = section.status === "non_voting_present"
            ? "non_voting"
            : rosterMatch?.member && section.votingSection
              ? "eligible_voting_member"
            : section.votingSection
              ? "eligible_voting_member"
              : "non_voting";
          const matchConfidence = rosterMatch?.matchConfidence ?? ("unmatched_name" as MatchConfidence);
          const confidence = votingEligibility === "eligible_voting_member" ? rosterMatch?.confidence ?? 0.8 : votingEligibility === "non_voting" ? 0.78 : 0.52;
          const needsReview = matchConfidence === "ambiguous_name";
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
            matchedOfficialId: rosterMatch?.member?.externalId ?? officialIdFor(matchedName, body, officials),
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
      if (/\ball\s+(?:members|commissioners|trustees|councilmembers|council\s+members|regents|senators|assemblymembers|supervisors)\s+(?:were\s+)?present\b/i.test(source.text) && roster.length) {
        const snippet = summarizeText(normalizeWhitespace(source.text).match(/\ball\s+(?:members|commissioners|trustees|councilmembers|council\s+members|regents|senators|assemblymembers|supervisors)\s+(?:were\s+)?present\b[^.]*\.?/i)?.[0] ?? source.text, 360);
        for (const member of roster) {
          addRosterAttendanceRecord({ records, seen, meeting, body, officials, member, status: "present", snippet, document: source.document, reason: "All members present statement applied to known governing body roster." });
        }
      }
      const allExceptMatch = normalizeWhitespace(source.text).match(
        /\ball\s+(?:members|commissioners|trustees|councilmembers|council\s+members|regents|senators|assemblymembers|supervisors)\s+(?:were\s+)?present\s+except\s+([^.;\n]{2,220})/i,
      );
      if (allExceptMatch && roster.length) {
        const snippet = summarizeText(allExceptMatch[0], 360);
        const unavailableNames = new Set(splitCandidateNames(allExceptMatch[1]).map(normalizeName));
        for (const member of roster) {
          const isUnavailable = unavailableNames.has(normalizeName(member.fullName)) || member.aliases.some((alias) => unavailableNames.has(normalizeName(alias)));
          addRosterAttendanceRecord({
            records,
            seen,
            meeting,
            body,
            officials,
            member,
            status: isUnavailable ? "absent" : "present",
            snippet,
            document: source.document,
            reason: isUnavailable
              ? "All present except statement identified this roster member as unavailable."
              : "All present except statement applied present status to remaining known voting roster members.",
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
