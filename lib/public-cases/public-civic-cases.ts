import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCivicJurisdictionContext } from "@/lib/civic/jurisdiction-context";
import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, normalizeWhitespace, slugify, summarizeText } from "@/lib/public-meetings/shared";
import type {
  MeetingVotingCardRecord,
  PublicBodyRecord,
  PublicCivicCaseRecord,
  PublicMeetingItemRecord,
  PublicMeetingRecord,
} from "@/lib/public-meetings/types";
import type { CommunitySummary } from "@/types/domain";

async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const filePath = absolutePublicMeetingPath(relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJsonFile(relativePath: string, value: unknown) {
  const filePath = absolutePublicMeetingPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function redactPrivateInfo(value: string | null | undefined) {
  return normalizeWhitespace(value)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone redacted]")
    .replace(/\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|circle|cir|way|boulevard|blvd)\b/gi, "[address redacted]");
}

function hasCaseSignal(item: PublicMeetingItemRecord) {
  const text = `${item.item_type} ${item.title} ${item.description ?? ""} ${item.one_sentence_summary} ${item.source_text}`.toLowerCase();
  if (item.item_type === "public_comment") return true;
  return /\b(complaint|appeal|dispute|violation|enforcement|permit|zoning|development|public safety|road|traffic|code enforcement|homeless|school|utility|service issue|public comment|hearing|variance|abatement|nuisance|follow[-\s]?up)\b/.test(text);
}

function priorityFor(item: PublicMeetingItemRecord): PublicCivicCaseRecord["priority"] {
  const text = `${item.title} ${item.source_text}`.toLowerCase();
  if (/\burgent|emergency|immediate danger|life safety|evacuation\b/.test(text)) return "urgent";
  if (/\bpublic safety|violation|enforcement|homeless|school safety|water outage|hazard\b/.test(text)) return "high";
  if (/\bappeal|permit|zoning|development|road|traffic|utility\b/.test(text)) return "medium";
  return "low";
}

function sourceTypeFor(item: PublicMeetingItemRecord): PublicCivicCaseRecord["source_type"] {
  if (item.item_type === "public_comment") return "meeting_public_comment";
  return "agenda_item";
}

export function buildPublicCivicCases(input: {
  bodies: PublicBodyRecord[];
  meetings: PublicMeetingRecord[];
  items: PublicMeetingItemRecord[];
  votingCards: MeetingVotingCardRecord[];
}): PublicCivicCaseRecord[] {
  const meetingById = new Map(input.meetings.map((meeting) => [meeting.id, meeting]));
  const bodyById = new Map(input.bodies.map((body) => [body.id, body]));
  const cardByItemId = new Map(input.votingCards.map((card) => [card.topic_item_id, card]));
  const now = new Date().toISOString();

  return input.items
    .filter(hasCaseSignal)
    .map((item) => {
      const meeting = meetingById.get(item.meeting_id) ?? null;
      const body = meeting ? bodyById.get(meeting.public_body_id) ?? null : null;
      const context = getCivicJurisdictionContext({ jurisdiction: body?.jurisdiction, body_name: body?.name });
      const card = cardByItemId.get(item.id) ?? null;
      const sourceSnippet = redactPrivateInfo(item.source_snippet ?? summarizeText(item.source_text, 500));
      const summary = redactPrivateInfo(item.plain_english_explanation || item.one_sentence_summary || item.description || item.title);
      const title = summarizeText(redactPrivateInfo(item.one_sentence_summary || item.title), 140);

      return {
        id: `public-case-${slugify(item.id)}`,
        title,
        plain_language_summary: summarizeText(summary, 420),
        status: "under_review",
        priority: priorityFor(item),
        jurisdiction: context.jurisdictionName,
        civic_layer: context.civicLayer,
        civic_layer_label: context.civicLayerLabel,
        body_or_department: item.department_names?.[0] ?? context.governingBodyName,
        source_type: sourceTypeFor(item),
        source_url: item.source_url ?? meeting?.source_urls[0] ?? null,
        source_snippet: sourceSnippet || null,
        related_meeting_id: meeting?.id ?? null,
        related_agenda_item_id: item.id,
        related_voting_card_id: card?.id ?? null,
        related_official_ids: [],
        related_community_id: null,
        policy_area: item.policy_area,
        created_at: now,
        updated_at: now,
        last_public_update_at: null,
        review_status: "needs_review",
        confidence_score: Math.max(0.2, Math.min(0.82, item.confidence_score - 0.08)),
        badges: ["Source-backed", "Needs review", sourceTypeFor(item) === "meeting_public_comment" ? "Public comment" : "Government-record"],
      } satisfies PublicCivicCaseRecord;
    });
}

export async function writePublicCivicCaseArtifacts(input?: {
  bodies?: PublicBodyRecord[];
  meetings?: PublicMeetingRecord[];
  items?: PublicMeetingItemRecord[];
  votingCards?: MeetingVotingCardRecord[];
}) {
  const [bodies, meetings, items, votingCards] = await Promise.all([
    input?.bodies ? Promise.resolve(input.bodies) : readJsonFile<PublicBodyRecord[]>(PUBLIC_MEETING_PATHS.bodies, []),
    input?.meetings ? Promise.resolve(input.meetings) : readJsonFile<PublicMeetingRecord[]>(PUBLIC_MEETING_PATHS.meetings, []),
    input?.items ? Promise.resolve(input.items) : readJsonFile<PublicMeetingItemRecord[]>(PUBLIC_MEETING_PATHS.meetingItems, []),
    input?.votingCards ? Promise.resolve(input.votingCards) : readJsonFile<MeetingVotingCardRecord[]>(PUBLIC_MEETING_PATHS.meetingVotingCards, []),
  ]);
  const cases = buildPublicCivicCases({ bodies, meetings, items, votingCards });
  const runtimeCases = cases.map((entry) => ({
    id: entry.id,
    title: entry.title,
    plain_language_summary: entry.plain_language_summary,
    status: entry.status,
    priority: entry.priority,
    jurisdiction: entry.jurisdiction,
    civic_layer: entry.civic_layer,
    civic_layer_label: entry.civic_layer_label,
    body_or_department: entry.body_or_department,
    source_type: entry.source_type,
    source_url: entry.source_url,
    related_meeting_id: entry.related_meeting_id,
    related_agenda_item_id: entry.related_agenda_item_id,
    related_voting_card_id: entry.related_voting_card_id,
    policy_area: entry.policy_area,
    review_status: entry.review_status,
    confidence_score: entry.confidence_score,
    badges: entry.badges,
    updated_at: entry.updated_at,
  }));

  await Promise.all([
    writeJsonFile(PUBLIC_MEETING_PATHS.publicCases, cases),
    writeJsonFile(PUBLIC_MEETING_PATHS.publicCasesRuntime, runtimeCases),
  ]);

  return { cases: cases.length, runtimeCases: runtimeCases.length };
}

function communityMatchesCase(community: CommunitySummary, entry: Pick<PublicCivicCaseRecord, "jurisdiction">) {
  const haystack = entry.jurisdiction.toLowerCase();
  return [community.name, community.primaryJurisdictionName, ...community.jurisdictionMatches]
    .map((value) => value.toLowerCase())
    .some((value) => haystack.includes(value) || value.includes(haystack));
}

export async function getPublicCivicCasesForCommunity(community: CommunitySummary, limit = 6) {
  const cases = await readJsonFile<PublicCivicCaseRecord[]>(PUBLIC_MEETING_PATHS.publicCasesRuntime, []);
  const uniqueCases: PublicCivicCaseRecord[] = [];
  const seenTitles = new Set<string>();

  for (const entry of cases
    .filter((entry) => communityMatchesCase(community, entry))
    .sort((left, right) => (Date.parse(right.updated_at) || 0) - (Date.parse(left.updated_at) || 0))) {
    const titleKey = normalizeWhitespace(entry.title).toLowerCase();
    if (seenTitles.has(titleKey)) continue;
    seenTitles.add(titleKey);
    uniqueCases.push(entry);
    if (uniqueCases.length >= limit) break;
  }

  return uniqueCases;
}

export async function getPublicCivicCaseAdminQueue() {
  const cases = await readJsonFile<PublicCivicCaseRecord[]>(PUBLIC_MEETING_PATHS.publicCases, []);
  return cases.sort((left, right) => {
    const priorityRank = { urgent: 4, high: 3, medium: 2, low: 1 };
    return priorityRank[right.priority] - priorityRank[left.priority] || right.confidence_score - left.confidence_score;
  });
}
