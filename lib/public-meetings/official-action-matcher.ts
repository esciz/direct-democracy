import { prisma } from "@/lib/prisma";
import { namesMatch, normalizeWhitespace } from "@/lib/public-meetings/shared";
import type {
  OfficialActionMatchReviewStatus,
  OfficialMeetingActionRecord,
  PublicBodyRecord,
  PublicMeetingRecord,
} from "@/lib/public-meetings/types";

export type OfficialActionMatchCandidate = {
  id: string;
  name: string;
  jurisdictionName: string | null;
  officeTitle: string | null;
  districtName?: string | null;
};

export type OfficialActionMatchResult = {
  official_id: string | null;
  official_name: string | null;
  match_confidence: number | null;
  match_reason: string;
  review_status: OfficialActionMatchReviewStatus;
};

const STOPWORDS = new Set(["city", "county", "state", "nevada", "board", "of", "the", "and", "district", "public"]);

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function searchableTokens(value: string | null | undefined) {
  return normalizeWhitespace(value ?? "")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function normalizedText(value: string | null | undefined) {
  return normalizeWhitespace(value ?? "").toLowerCase();
}

export function surnameOf(value: string) {
  const parts = normalizeWhitespace(value)
    .replace(/[,()[\]]/g, " ")
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z'-]/g, ""))
    .filter(Boolean);
  return parts.at(-1)?.toLowerCase() ?? "";
}

function isSurnameOnly(value: string) {
  return normalizeWhitespace(value).split(/\s+/).filter(Boolean).length === 1;
}

function bodyOfficeTokens(body: PublicBodyRecord | null) {
  const text = normalizedText(`${body?.name ?? ""} ${body?.jurisdiction ?? ""}`);
  const tokens = new Set<string>();
  if (/\bcouncil\b/.test(text)) tokens.add("council");
  if (/\bcommission(?:ers?)?\b/.test(text)) tokens.add("commission");
  if (/\bschool\b/.test(text)) tokens.add("school");
  if (/\bsenate\b/.test(text)) tokens.add("senate");
  if (/\bassembly\b/.test(text)) tokens.add("assembly");
  if (/\bregents?\b/.test(text)) tokens.add("regent");
  if (/\bplanning\b/.test(text)) tokens.add("planning");
  return tokens;
}

function officeMatchesBody(candidate: OfficialActionMatchCandidate, body: PublicBodyRecord | null) {
  const office = normalizedText(candidate.officeTitle);
  for (const token of bodyOfficeTokens(body)) {
    if (office.includes(token)) return true;
    if (token === "commission" && office.includes("commissioner")) return true;
    if (token === "regent" && office.includes("regent")) return true;
  }
  return false;
}

function jurisdictionScore(candidate: OfficialActionMatchCandidate, body: PublicBodyRecord | null) {
  const officialJurisdiction = normalizedText(candidate.jurisdictionName);
  const bodyJurisdiction = normalizedText(body?.jurisdiction);
  const bodyName = normalizedText(body?.name);
  if (!officialJurisdiction || (!bodyJurisdiction && !bodyName)) return 0;
  if (bodyJurisdiction && (officialJurisdiction.includes(bodyJurisdiction) || bodyJurisdiction.includes(officialJurisdiction))) return 0.35;
  const officialTokens = new Set(searchableTokens(officialJurisdiction));
  const bodyTokens = new Set([...searchableTokens(bodyJurisdiction), ...searchableTokens(bodyName)]);
  const overlap = [...officialTokens].filter((token) => bodyTokens.has(token)).length;
  return overlap > 0 ? Math.min(0.35, overlap * 0.24) : 0;
}

function candidateScore(candidate: OfficialActionMatchCandidate, body: PublicBodyRecord | null) {
  return jurisdictionScore(candidate, body) + (officeMatchesBody(candidate, body) ? 0.35 : 0);
}

export async function loadOfficialActionMatchCandidates(): Promise<OfficialActionMatchCandidate[]> {
  try {
    const officials = await prisma.official.findMany({
      include: {
        office: { select: { title: true } },
        jurisdiction: { select: { name: true } },
        district: { select: { name: true } },
      },
      orderBy: [{ jurisdiction: { name: "asc" } }, { fullName: "asc" }],
      take: 1000,
    });
    return officials.map((official) => ({
      id: official.id,
      name: official.fullName,
      jurisdictionName: official.jurisdiction.name,
      officeTitle: official.office.title,
      districtName: official.district?.name ?? null,
    }));
  } catch (error) {
    console.warn("[official-action-matcher] Unable to load official roster for matching.", error);
    return [];
  }
}

export function resolveOfficialActionMatch(
  action: OfficialMeetingActionRecord,
  context: { meeting: PublicMeetingRecord | null; body: PublicBodyRecord | null; candidates: OfficialActionMatchCandidate[] },
): OfficialActionMatchResult {
  const rawName = normalizeWhitespace(action.official_name_raw);
  const rawSurname = surnameOf(rawName);
  if (!rawSurname) {
    return {
      official_id: null,
      official_name: null,
      match_confidence: null,
      match_reason: "No usable actor surname was extracted from the source text.",
      review_status: "unmatched",
    };
  }

  const exactMatches = context.candidates.filter((candidate) => namesMatch(candidate.name, rawName));
  if (!isSurnameOnly(rawName) && exactMatches.length === 1) {
    return {
      official_id: exactMatches[0].id,
      official_name: exactMatches[0].name,
      match_confidence: 0.96,
      match_reason: `Exact official-name match: ${exactMatches[0].name}.`,
      review_status: "approved",
    };
  }

  const surnameMatches = context.candidates
    .filter((candidate) => surnameOf(candidate.name) === rawSurname)
    .map((candidate) => ({ candidate, score: candidateScore(candidate, context.body) }))
    .sort((left, right) => right.score - left.score);

  if (!surnameMatches.length) {
    return {
      official_id: null,
      official_name: null,
      match_confidence: null,
      match_reason: `No known official with surname "${rawName}" matched the current roster.`,
      review_status: "unmatched",
    };
  }

  const clearBodyMatches = surnameMatches.filter((entry) => entry.score >= 0.55);
  if (clearBodyMatches.length === 1) {
    return {
      official_id: clearBodyMatches[0].candidate.id,
      official_name: clearBodyMatches[0].candidate.name,
      match_confidence: 0.9,
      match_reason: `Unique surname match in narrowed body/jurisdiction: ${clearBodyMatches[0].candidate.name}.`,
      review_status: "approved",
    };
  }

  const [top, second] = surnameMatches;
  if (top && top.score >= 0.28 && (!second || top.score - second.score >= 0.2)) {
    return {
      official_id: top.candidate.id,
      official_name: top.candidate.name,
      match_confidence: 0.78,
      match_reason: `Suggested surname match; body/jurisdiction context is helpful but not uniquely clear: ${top.candidate.name}.`,
      review_status: "suggested_match",
    };
  }

  return {
    official_id: null,
    official_name: null,
    match_confidence: 0.42,
    match_reason: `Multiple or weak surname matches for "${rawName}" require manual review.`,
    review_status: "unmatched",
  };
}

export function applyOfficialActionMatches(
  actions: OfficialMeetingActionRecord[],
  context: {
    meetings: PublicMeetingRecord[];
    bodies: PublicBodyRecord[];
    candidates: OfficialActionMatchCandidate[];
  },
) {
  const meetingById = new Map(context.meetings.map((meeting) => [meeting.id, meeting]));
  const bodyById = new Map(context.bodies.map((body) => [body.id, body]));

  return actions.map((action) => {
    const meeting = meetingById.get(action.meeting_id) ?? null;
    const body = meeting ? bodyById.get(meeting.public_body_id) ?? null : null;
    const match = resolveOfficialActionMatch(action, { meeting, body, candidates: context.candidates });
    const reviewStatus = match.review_status;
    return {
      ...action,
      official_id: match.official_id,
      match_confidence: match.match_confidence,
      match_reason: match.match_reason,
      review_status: reviewStatus,
      needs_review: reviewStatus !== "approved" || (action.confidence < 0.82 && (match.match_confidence ?? 0) < 0.88),
    };
  });
}

export function hasSurnameOnlyActor(action: Pick<OfficialMeetingActionRecord, "official_name_raw">) {
  return isSurnameOnly(action.official_name_raw);
}
