import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { nevadaCountyCommunityIds, nevadaLocalCommunityIds, seededCommunities } from "@/lib/community/communities";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-community-relationships.json");
const OFFICIALS_OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-community-officials.json");
const PROJECTS_OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-community-projects.json");
const EVENTS_OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-community-events.json");
const RSS_OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-rss-source-capabilities.json");

type JsonRecord = Record<string, unknown>;
type RelationshipDomain =
  | "meetings"
  | "agendaItems"
  | "votingCards"
  | "issues"
  | "courtCases"
  | "spendingRecords"
  | "projects"
  | "elections"
  | "officialActionRecords";
type LinkType = "direct" | "inferred" | "statewide_overlay" | "federal_overlay";
type RelationshipScope = "direct_local" | "inferred_local" | "county" | "school_special_district" | "statewide_overlay" | "federal_overlay";

type PublicBodyRecord = {
  id: string;
  name?: string | null;
  jurisdiction?: string | null;
};

type PublicMeetingRecord = {
  id: string;
  public_body_id?: string | null;
  title?: string | null;
  meeting_date?: string | null;
  agenda_url?: string | null;
  packet_url?: string | null;
};

type PublicMeetingItemRecord = {
  id: string;
  meeting_id?: string | null;
  title?: string | null;
};

type PublicMeetingSourceSeedRecord = {
  id: string;
  name: string;
  jurisdiction: string;
  level?: string | null;
  website?: string | null;
  sourceUrl?: string | null;
  meetingIndexUrl?: string | null;
  agendaArchiveUrl?: string | null;
  minutesArchiveUrl?: string | null;
  packetArchiveUrl?: string | null;
  videoArchiveUrl?: string | null;
  notes?: string | null;
};

type LinkResult = {
  localCommunityIds: string[];
  canonicalCommunityIds: string[];
  stateOnly: boolean;
  federalOnly: boolean;
  linkBasis: "direct_community_id" | "meeting_body" | "runtime_text" | "issue_communities" | "none";
};

type RelationshipRecord = {
  id: string;
  title: string;
  storyType: "vote" | "meeting" | "case" | "spending" | "project" | "issue" | "election" | "official" | "source";
  storyHeadline: string;
  storySummary: string;
  storyWhyItMatters: string;
  storyJurisdiction: string | null;
  storySourceLabel: string;
  storySourceDetail: string | null;
  sourcePath: string;
  linkType: LinkType;
  relationshipScope: RelationshipScope;
  linkBasis: LinkResult["linkBasis"];
  reviewStatus: string;
  confidence: number | null;
  date: string | null;
  sourceCount: number;
  sourceUpdatedAt: string | null;
  sourceUrl: string | null;
  href: string | null;
  needsReview: boolean;
  statewideOverlay: boolean;
  federalOverlay: boolean;
};

type SourceDocumentRecord = {
  id: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  relatedRecordId: string;
  relatedRecordType: RelationshipDomain;
  linkType: LinkType;
  reviewStatus: string;
  needsReview: boolean;
};

type CommunityRelationshipBucket = {
  communityId: string;
  name: string;
  counts: Record<RelationshipDomain | "sourceDocuments", number>;
  localCounts: Record<RelationshipDomain, number>;
  statewideOverlayCounts: Record<RelationshipDomain, number>;
  linkCounts: {
    direct: number;
    inferred: number;
    statewideOverlay: number;
    federalOverlay: number;
  };
  reviewCounts: {
    approved: number;
    ready: number;
    needsReview: number;
    unknown: number;
  };
  confidenceCounts: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  recordIds: Record<RelationshipDomain | "sourceDocuments", string[]>;
  records: Record<RelationshipDomain, RelationshipRecord[]> & {
    sourceDocuments: SourceDocumentRecord[];
  };
};

function emptyDomainCounts() {
  return {
    meetings: 0,
    agendaItems: 0,
    votingCards: 0,
    issues: 0,
    courtCases: 0,
    spendingRecords: 0,
    projects: 0,
    elections: 0,
    officialActionRecords: 0,
  };
}

function emptyRelationshipRecords() {
  return {
    meetings: [],
    agendaItems: [],
    votingCards: [],
    issues: [],
    courtCases: [],
    spendingRecords: [],
    projects: [],
    elections: [],
    officialActionRecords: [],
    sourceDocuments: [],
  };
}

function emptyRelationshipRecordIds() {
  return {
    meetings: [],
    agendaItems: [],
    votingCards: [],
    issues: [],
    courtCases: [],
    spendingRecords: [],
    projects: [],
    elections: [],
    officialActionRecords: [],
    sourceDocuments: [],
  };
}

function readJson<T>(relativePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function asRecords(relativePath: string) {
  const value = readJson<unknown>(relativePath, []);

  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value)) {
    for (const key of ["records", "cards", "items", "events", "cases"]) {
      const nested = value[key];
      if (Array.isArray(nested)) {
        return nested.filter(isRecord);
      }
    }
  }

  return [];
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bnv\b/g, "nevada")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateValue(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function getRecordId(record: JsonRecord, fallbackPrefix: string, index: number) {
  return text(record.id) || text(record.source_id) || text(record.generation_key) || `${fallbackPrefix}-${index}`;
}

function hashId(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);
}

const canonicalCommunities = seededCommunities;
const localCommunityIdSet = new Set(nevadaLocalCommunityIds);
const countyCommunityIdSet = new Set(nevadaCountyCommunityIds);
const localCommunities = canonicalCommunities.filter((community) => localCommunityIdSet.has(community.id));
const communityById = new Map(canonicalCommunities.map((community) => [community.id, community]));

function getCountyIdForCommunity(communityId: string) {
  if (countyCommunityIdSet.has(communityId)) return communityId;
  const community = communityById.get(communityId);
  if (!community?.locationLabel) return null;
  return nevadaCountyCommunityIds.find((countyId) => communityById.get(countyId)?.name === community.locationLabel) ?? null;
}

const aliasesByCommunity = new Map(
  canonicalCommunities.map((community) => {
    const aliases =
      community.id === "united-states"
        ? new Set([community.id, community.name, community.shortName, community.primaryJurisdictionName, "Federal", "National"])
        : community.id === "nevada"
          ? new Set([community.id, community.name, community.shortName, community.primaryJurisdictionName, "Statewide Nevada"])
          : new Set([
              community.id,
              community.name,
              community.shortName,
              community.primaryJurisdictionName,
              ...community.jurisdictionMatches,
            ]);

    return [
      community.id,
      [...aliases]
        .map((alias) => normalize(alias))
        .filter((alias) => alias.length >= 3)
        .sort((left, right) => right.length - left.length),
    ] as const;
  }),
);

function matchCommunitiesFromText(value: string, includeStatewide: boolean) {
  const haystack = normalize(value);
  if (!haystack) {
    return [];
  }

  const matches: string[] = [];

  for (const community of canonicalCommunities) {
    if (!includeStatewide && !localCommunityIdSet.has(community.id)) {
      continue;
    }

    const aliases = aliasesByCommunity.get(community.id) ?? [];
    if (aliases.some((alias) => haystack.includes(alias))) {
      matches.push(community.id);
    }
  }

  return [...new Set(matches)];
}

function makeLinkResult(evidenceText: string, linkBasis: LinkResult["linkBasis"]): LinkResult {
  const localCommunityIds = matchCommunitiesFromText(evidenceText, false);
  const canonicalCommunityIds = matchCommunitiesFromText(evidenceText, true);

  return {
    localCommunityIds,
    canonicalCommunityIds,
    stateOnly: canonicalCommunityIds.includes("nevada") && localCommunityIds.length === 0,
    federalOnly: canonicalCommunityIds.includes("united-states") && localCommunityIds.length === 0,
    linkBasis: localCommunityIds.length || canonicalCommunityIds.length ? linkBasis : "none",
  };
}

function linkedViaDirectCommunityId(record: JsonRecord) {
  const direct = text(record.communityId) || text(record.community_id) || text(record.related_community_id) || text(record.jurisdictionId);
  if (!direct) return null;
  const community = canonicalCommunities.find((entry) => entry.id === direct);
  if (!community) return null;
  return makeLinkResult(`${community.id} ${community.name} ${community.primaryJurisdictionName}`, "direct_community_id");
}

const bodies = readJson<PublicBodyRecord[]>("data/generated/public-meeting-bodies.json", []);
const meetings = readJson<PublicMeetingRecord[]>("data/generated/public-meetings.json", []);
const meetingItems = readJson<PublicMeetingItemRecord[]>("data/generated/public-meeting-items.json", []);
const bodyById = new Map(bodies.map((body) => [body.id, body]));
const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
const itemById = new Map(meetingItems.map((item) => [item.id, item]));
const canonicalVotingCardIdBySourceId = new Map(
  asRecords("data/generated/voting-cards.json").flatMap((card) => {
    const id = text(card.id);
    const sourceVotingCardId = text(card.sourceVotingCardId);
    const agendaItemId = text(card.agendaItemId);
    return [
      id ? [id, id] : null,
      sourceVotingCardId ? [sourceVotingCardId, id] : null,
      agendaItemId ? [agendaItemId, id] : null,
    ].filter((entry): entry is [string, string] => Boolean(entry?.[0] && entry[1]));
  }),
);

function sourcePathExists(value: string) {
  return Boolean(value) && !value.startsWith("http") && fs.existsSync(path.join(process.cwd(), value));
}

function generateOfficialRecords() {
  const currentOfficials = asRecords("data/generated/current-officials-runtime.json");
  if (currentOfficials.length) return currentOfficials;

  const rosterSeeds = readJson<Array<JsonRecord & { members?: JsonRecord[] }>>("data/seed/public-meeting-official-rosters.json", []);
  const records: JsonRecord[] = [];
  for (const roster of rosterSeeds) {
    for (const member of Array.isArray(roster.members) ? roster.members : []) {
      const fullName = text(member.fullName);
      if (!fullName) continue;
      records.push({
        id: `official-${hashId(`${text(roster.providerId)}:${fullName}:${text(member.seatTitle)}`)}`,
        name: fullName,
        title: text(member.seatTitle) || text(roster.officeTitle) || "Official",
        office: text(roster.officeTitle) || text(member.seatTitle) || "Official",
        jurisdiction: text(roster.jurisdictionName),
        communityName: text(roster.jurisdictionName),
        level: text(roster.officeLevel).toLowerCase() || text(roster.jurisdictionType).toLowerCase() || null,
        body_name: text(roster.bodyName),
        district: text(member.seatTitle) || null,
        source_url: text(member.sourceUrl).startsWith("http") ? text(member.sourceUrl) : text(roster.sourceUrl) || null,
        source_path: sourcePathExists(text(member.sourceUrl)) ? text(member.sourceUrl) : null,
        source_label: text(roster.sourceName) || "Official roster seed",
        confidence: text(member.status) === "CURRENT" ? 0.88 : 0.7,
        review_status: "source_backed_roster",
        needsReview: false,
        last_verified_at: new Date().toISOString(),
        profile_url: text(roster.sourceUrl) || null,
        aliases: Array.isArray(member.aliases) ? member.aliases.map(text).filter(Boolean) : [],
      });
    }
  }
  return records;
}

function projectKeywordText(record: JsonRecord) {
  return [
    text(record.title),
    text(record.description),
    text(record.one_sentence_summary),
    text(record.plain_english_explanation),
    text(record.why_it_matters),
    text(record.fiscal_impact_summary),
    text(record.source_text),
  ].join(" ");
}

function isProjectLike(record: JsonRecord) {
  return /\b(project|capital improvement|cip|construction|road|street|sidewalk|bridge|facility|facilities|park|parks|water|sewer|wastewater|public works|infrastructure|renovation|repair|improvement|school construction|transportation plan)\b/i.test(
    projectKeywordText(record),
  );
}

function extractCost(value: string) {
  return value.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|m|k))?/i)?.[0] ?? null;
}

function generateProjectRecords() {
  const items = asRecords("data/generated/public-meeting-items.json").filter(isProjectLike);
  return items.slice(0, 1200).map((item, index) => {
    const meeting = meetingById.get(text(item.meeting_id));
    const body = meeting ? bodyById.get(text(meeting.public_body_id)) : null;
    const sourceText = projectKeywordText(item);
    const title = cleanCitizenText(text(item.one_sentence_summary) || text(item.title), "Public project or capital program", 140);
    return {
      id: `project-${hashId(`${text(item.id)}:${title}`)}`,
      title,
      project_title: title,
      summary: cleanCitizenText(text(item.plain_english_explanation) || text(item.description) || title, "This appears to be a public project, capital improvement, or infrastructure-related program.", 320),
      jurisdiction: body?.jurisdiction ?? text(item.jurisdiction) ?? "",
      communityName: body?.jurisdiction ?? text(item.jurisdiction) ?? "",
      agency: body?.name ?? text(item.body_name) ?? null,
      status: text(item.vote_outcome) || "needs_review",
      cost: extractCost(sourceText),
      timeline: text(meeting?.meeting_date) || null,
      location: null,
      relatedMeetingIds: meeting?.id ? [meeting.id] : [],
      relatedAgendaItemIds: text(item.id) ? [text(item.id)] : [],
      source_url: text(item.source_url) || text(meeting?.agenda_url) || text(meeting?.packet_url) || null,
      source_label: text(item.item_number) ? `Agenda Item ${text(item.item_number)}` : "Agenda-derived project lead",
      confidence: text(item.fiscal_impact_summary) || text(item.financial_impact) ? 0.72 : 0.48,
      review_status: "needs_review",
      needsReview: true,
      updated_at: text(item.updated_at) || text(meeting?.meeting_date) || null,
      sourcePath: "data/generated/public-meeting-items.json",
      index,
    };
  });
}

function getMeetingStatus(meeting: PublicMeetingRecord) {
  const time = Date.parse(meeting.meeting_date ?? "");
  if (!Number.isFinite(time)) return "unknown";
  return time >= Date.now() ? "upcoming" : "completed";
}

function generateEventRecords() {
  const itemsByMeeting = new Map<string, JsonRecord[]>();
  for (const item of asRecords("data/generated/public-meeting-items.json")) {
    const meetingId = text(item.meeting_id);
    if (!meetingId) continue;
    const items = itemsByMeeting.get(meetingId) ?? [];
    items.push(item);
    itemsByMeeting.set(meetingId, items);
  }

  return meetings.map((meeting) => {
    const body = bodyById.get(text(meeting.public_body_id));
    const relatedItems = itemsByMeeting.get(meeting.id) ?? [];
    const topics = relatedItems
      .map((item) => cleanCitizenText(text(item.one_sentence_summary) || text(item.title), "", 120))
      .filter(Boolean)
      .slice(0, 5);
    return {
      id: `event-${meeting.id}`,
      meeting_id: meeting.id,
      title: meeting.title ?? body?.name ?? "Public meeting",
      community: body?.jurisdiction ?? "",
      jurisdiction: body?.jurisdiction ?? "",
      body_name: body?.name ?? null,
      agency: body?.name ?? null,
      start_at: meeting.meeting_date ?? null,
      status: getMeetingStatus(meeting),
      agenda_url: text((meeting as JsonRecord).agenda_url),
      minutes_url: text((meeting as JsonRecord).minutes_url),
      video_url: text((meeting as JsonRecord).video_url),
      public_comment_info: text((meeting as JsonRecord).agenda_url) ? "Review the agenda source for public-comment instructions and meeting access details." : null,
      summary: cleanCitizenText(text((meeting as JsonRecord).meeting_summary) || `${meeting.title} public meeting.`, "Public meeting record.", 320),
      related_votes_count: relatedItems.filter((item) => text(item.vote_outcome)).length,
      related_topics: topics,
      source_url: text((meeting as JsonRecord).agenda_url) || text((meeting as JsonRecord).minutes_url) || text((meeting as JsonRecord).packet_url) || null,
      source_label: "Public meeting event",
      confidence: 0.86,
      review_status: text((meeting as JsonRecord).ingestion_status) || "source_backed",
      needsReview: text((meeting as JsonRecord).ingestion_status).includes("needs"),
      updated_at: text((meeting as JsonRecord).updated_at) || meeting.meeting_date,
    };
  });
}

function generateRssCapabilities() {
  const seeds = readJson<PublicMeetingSourceSeedRecord[]>("data/seed/public-meeting-sources.json", []);
  const examples = [
    {
      id: "carson-city-news-rss",
      sourceName: "Carson City official news RSS",
      jurisdiction: "Carson City, NV",
      sourceType: "rss",
      rssUrl: "https://www.carsoncity.gov/Home/Components/News/News?format=rss",
      purpose: "official body news and public notices",
      supplementalOnly: true,
      needsReview: true,
    },
  ];
  return {
    generatedAt: new Date().toISOString(),
    sourceType: "rss",
    policy: "RSS is supplemental. It can flag news, notices, meeting updates, project updates, and monitoring leads, but it does not replace agenda, minutes, packet, court, election, or budget ingestion.",
    rssCapableSources: seeds
      .filter((seed) => /news|notice|rss|feed|updates/i.test(`${seed.notes ?? ""} ${seed.website ?? ""} ${seed.sourceUrl ?? ""}`))
      .map((seed) => ({
        id: `${seed.id}-rss-capability`,
        sourceName: seed.name,
        jurisdiction: seed.jurisdiction,
        sourceType: "rss_capable",
        sourceUrl: seed.website ?? seed.sourceUrl ?? seed.meetingIndexUrl ?? null,
        needsReview: true,
      })),
    seedExamples: examples,
  };
}

function linkMeeting(meeting: JsonRecord) {
  const direct = linkedViaDirectCommunityId(meeting);
  if (direct) return direct;
  const body = bodyById.get(text(meeting.public_body_id));
  return makeLinkResult(`${body?.name ?? ""} ${body?.jurisdiction ?? ""} ${text(meeting.title)}`, "meeting_body");
}

function linkMeetingItem(item: JsonRecord) {
  const direct = linkedViaDirectCommunityId(item);
  if (direct) return direct;
  const meeting = meetingById.get(text(item.meeting_id));
  const body = meeting ? bodyById.get(text(meeting.public_body_id)) : null;
  return makeLinkResult(`${body?.name ?? ""} ${body?.jurisdiction ?? ""} ${text(item.title)} ${text(item.description)}`, "meeting_body");
}

function linkVotingCard(card: JsonRecord) {
  const direct = linkedViaDirectCommunityId(card);
  if (direct) return direct;
  const item = itemById.get(text(card.topic_item_id));
  const meeting = meetingById.get(text(card.meeting_id)) ?? (item ? meetingById.get(text(item.meeting_id)) : undefined);
  const body = meeting ? bodyById.get(text(meeting.public_body_id)) : null;
  return makeLinkResult(
    [
      text(card.jurisdiction),
      text(card.jurisdiction_display_name),
      text(card.body_name),
      text(card.governing_body_display_name),
      body?.name ?? "",
      body?.jurisdiction ?? "",
    ].join(" "),
    "runtime_text",
  );
}

function linkIssue(issue: JsonRecord) {
  const direct = linkedViaDirectCommunityId(issue);
  if (direct) return direct;
  const communities = Array.isArray(issue.communities) ? issue.communities.map(text).join(" ") : "";
  return makeLinkResult(`${communities} ${text(issue.jurisdictionName)} ${text(issue.scope)}`, communities ? "issue_communities" : "runtime_text");
}

function linkRuntimeText(record: JsonRecord, fields: string[]) {
  const direct = linkedViaDirectCommunityId(record);
  if (direct) return direct;
  return makeLinkResult(fields.map((field) => text(record[field])).join(" "), "runtime_text");
}

function linkOfficialRecord(record: JsonRecord) {
  const direct = linkedViaDirectCommunityId(record);
  if (direct) return direct;
  return makeLinkResult(
    [
      text(record.jurisdiction),
      text(record.communityName),
      text(record.body_name),
      text(record.office),
      text(record.title),
      text(record.name),
    ].join(" "),
    "runtime_text",
  );
}

function getReviewStatus(record: JsonRecord) {
  return text(record.review_status) || text(record.reviewStatus) || text(record.status) || "unknown";
}

function getConfidence(record: JsonRecord) {
  return numberValue(record.parse_confidence) ?? numberValue(record.confidence_score) ?? numberValue(record.confidence) ?? null;
}

function isNeedsReview(record: JsonRecord) {
  const reviewStatus = getReviewStatus(record).toLowerCase();
  const confidence = getConfidence(record);
  return reviewStatus.includes("needs") || reviewStatus.includes("under_review") || record.unmatched === true || (confidence !== null && confidence < 0.5);
}

function getRecordTitle(record: JsonRecord, domain: RelationshipDomain) {
  return (
    text(record.public_question) ||
    text(record.question_text) ||
    text(record.project_title) ||
    text(record.name) ||
    text(record.issueText) ||
    text(record.title) ||
    text(record.office) ||
    text(record.jurisdiction_body) ||
    text(record.candidate_name) ||
    text(record.source_id) ||
    domain
  );
}

function stripTechnicalPrefixes(value: string) {
  return value
    .replace(/\b(?:resolution|ordinance|agenda item|item|bill|case no\.?|case number)\s*[A-Z0-9.\-:]+/gi, "")
    .replace(/^\s*\d+(?:\.[A-Z0-9]+)*\s*[.)]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(value: string) {
  const textValue = value.trim();
  if (!textValue) return textValue;
  return `${textValue[0]?.toUpperCase() ?? ""}${textValue.slice(1)}`;
}

function cleanCitizenText(value: string, fallback: string, max = 180) {
  const cleaned = stripTechnicalPrefixes(value)
    .replace(/\b(?:recommendation|appearance|discussion|possible action|for possible action|presentation)\b[:\s-]*/gi, "")
    .replace(/\b(?:acknowledge receipt of|approve acknowledge|accept approve|approve approve)\b/gi, "review")
    .replace(/\s+/g, " ")
    .trim();
  const candidate = cleaned || fallback;
  return sentenceCase(candidate.length > max ? `${candidate.slice(0, max - 1).trimEnd()}…` : candidate);
}

function inferImpact(value: string, policyArea: string) {
  const textValue = normalize(`${value} ${policyArea}`);
  if (/\b(tax|fee|budget|grant|contract|donation|expense|spending|financial|fiscal|revenue|\$|million|fund)\b/.test(textValue)) {
    return "This may affect taxes, fees, public budgets, grants, contracts, or how local money is spent.";
  }
  if (/\b(housing|zoning|planning|development|permit|land use|subdivision)\b/.test(textValue)) {
    return "This may affect housing, development, permits, neighborhood growth, or land-use rules.";
  }
  if (/\b(road|street|traffic|transportation|transit|sidewalk|bridge|infrastructure)\b/.test(textValue)) {
    return "This may affect roads, traffic, transportation access, or public infrastructure.";
  }
  if (/\b(water|sewer|utility|electric|stormwater|waste)\b/.test(textValue)) {
    return "This may affect utilities, water, sewer, waste, or other everyday public services.";
  }
  if (/\b(school|student|teacher|education|district|trustees)\b/.test(textValue)) {
    return "This may affect schools, students, district budgets, or education services.";
  }
  if (/\b(police|fire|sheriff|emergency|911|public safety|court|jail)\b/.test(textValue)) {
    return "This may affect public safety, emergency response, courts, or local enforcement priorities.";
  }
  return "This may affect residents, services, rules, oversight, or public resources connected to local government.";
}

function getStoryType(domain: RelationshipDomain): RelationshipRecord["storyType"] {
  if (domain === "votingCards") return "vote";
  if (domain === "meetings" || domain === "agendaItems") return "meeting";
  if (domain === "courtCases") return "case";
  if (domain === "spendingRecords") return "spending";
  if (domain === "projects") return "project";
  if (domain === "issues") return "issue";
  if (domain === "elections") return "election";
  if (domain === "officialActionRecords") return "official";
  return "source";
}

function getStoryJurisdiction(record: JsonRecord) {
  return text(record.jurisdiction_display_name) || text(record.jurisdiction) || text(record.jurisdictionName) || text(record.communityName) || null;
}

function getSourceLabel(record: JsonRecord, domain: RelationshipDomain) {
  if (domain === "votingCards") return text(record.source_item_number) || "Voting card source";
  if (domain === "meetings") return text(record.meeting_type) || "Meeting source";
  if (domain === "agendaItems" || domain === "spendingRecords") return text(record.item_number) ? `Agenda Item ${text(record.item_number)}` : "Agenda source";
  if (domain === "courtCases") return text(record.caseNumber) ? `Case ${text(record.caseNumber)}` : "Court source";
  if (domain === "issues") return "Issue source";
  if (domain === "elections") return "Election source";
  if (domain === "officialActionRecords" && text(record.role_category)) return "Current official source";
  if (domain === "officialActionRecords") return "Official action source";
  return "Source";
}

function getSourceDetail(record: JsonRecord, domain: RelationshipDomain) {
  const parts = [
    getSourceLabel(record, domain),
    text(record.body_name) || text(record.governing_body_display_name) || text(record.public_body_name) || text(record.courtName) || text(record.jurisdiction_body),
    text(record.source_title) || text(record.title) || text(record.office),
  ].filter(Boolean);
  return parts.length ? [...new Set(parts)].join(" · ") : null;
}

function makeStory(record: JsonRecord, domain: RelationshipDomain) {
  const sourceTitle = text(record.source_title) || text(record.title) || getRecordTitle(record, domain);
  const policyArea = text(record.policy_area) || text(record.policyArea);
  const jurisdiction = getStoryJurisdiction(record);
  const storyType = getStoryType(domain);
  const sourceDetail = getSourceDetail(record, domain);

  if (domain === "votingCards") {
    const headline = cleanCitizenText(text(record.public_question) || text(record.question_text) || text(record.public_title), "Should residents weigh in on this government action?");
    const summary = cleanCitizenText(text(record.citizen_summary) || text(record.plain_language_summary) || text(record.plain_purpose) || sourceTitle, "This vote card summarizes a government action in plain language.", 260);
    return {
      storyType,
      storyHeadline: headline.endsWith("?") ? headline : `Should ${headline.replace(/^should\s+/i, "")}?`,
      storySummary: summary,
      storyWhyItMatters: text(record.why_it_matters) || inferImpact(`${headline} ${summary} ${sourceTitle}`, policyArea),
      storyJurisdiction: jurisdiction,
      storySourceLabel: getSourceLabel(record, domain),
      storySourceDetail: sourceDetail,
    };
  }

  if (domain === "meetings") {
    const headline = cleanCitizenText(sourceTitle, "Upcoming public meeting", 150);
    const summary = cleanCitizenText(text(record.meeting_summary) || `${headline} is a public meeting with agendas, minutes, or packets available for review.`, "Public meeting details are available.", 260);
    return {
      storyType,
      storyHeadline: headline,
      storySummary: summary,
      storyWhyItMatters: "Meetings are where public bodies discuss issues, take votes, approve spending, and create the official record residents can inspect.",
      storyJurisdiction: jurisdiction,
      storySourceLabel: getSourceLabel(record, domain),
      storySourceDetail: sourceDetail,
    };
  }

  if (domain === "spendingRecords") {
    const headline = cleanCitizenText(text(record.fiscal_impact_summary) || text(record.financial_impact) || sourceTitle, "Spending item needs review", 150);
    return {
      storyType,
      storyHeadline: headline,
      storySummary: cleanCitizenText(text(record.plain_english_explanation) || text(record.report_name) || sourceTitle, "This record may involve public spending, campaign finance, or fiscal impact.", 260),
      storyWhyItMatters: inferImpact(`${headline} ${sourceTitle}`, "Budget"),
      storyJurisdiction: jurisdiction,
      storySourceLabel: getSourceLabel(record, domain),
      storySourceDetail: sourceDetail,
    };
  }
  if (domain === "projects") {
    const headline = cleanCitizenText(text(record.project_title) || sourceTitle, "Public project or capital program", 150);
    return {
      storyType,
      storyHeadline: headline,
      storySummary: cleanCitizenText(text(record.summary) || sourceTitle, "This appears to be a public project, capital improvement, or infrastructure-related program.", 280),
      storyWhyItMatters: inferImpact(`${headline} ${text(record.summary)} ${text(record.cost)}`, "Budget Transportation Utilities"),
      storyJurisdiction: jurisdiction,
      storySourceLabel: text(record.source_label) || getSourceLabel(record, domain),
      storySourceDetail: sourceDetail,
    };
  }

  if (domain === "issues") {
    const headline = cleanCitizenText(text(record.issueText) || sourceTitle, "Active civic issue", 120);
    return {
      storyType,
      storyHeadline: headline,
      storySummary: cleanCitizenText(text(record.summary) || `${headline} is connected to local records and statewide civic activity.`, "This issue is connected to civic records.", 260),
      storyWhyItMatters: inferImpact(`${headline} ${text(record.summary)}`, policyArea),
      storyJurisdiction: jurisdiction,
      storySourceLabel: getSourceLabel(record, domain),
      storySourceDetail: sourceDetail,
    };
  }

  if (domain === "courtCases") {
    const headline = cleanCitizenText(sourceTitle, "Public case record", 150);
    return {
      storyType,
      storyHeadline: headline,
      storySummary: cleanCitizenText(text(record.plain_language_summary) || text(record.summary) || "This public case record may affect civic rights, local services, or government accountability.", "Public case metadata is available.", 260),
      storyWhyItMatters: "Court cases can affect rights, services, local rules, public accountability, or how government decisions are interpreted.",
      storyJurisdiction: jurisdiction,
      storySourceLabel: getSourceLabel(record, domain),
      storySourceDetail: sourceDetail,
    };
  }

  const headline = cleanCitizenText(sourceTitle, getRecordTitle(record, domain), 150);
  return {
    storyType,
    storyHeadline: headline,
    storySummary: cleanCitizenText(text(record.summary) || text(record.action_text) || sourceTitle, "Source-backed civic record available for review.", 260),
    storyWhyItMatters: inferImpact(`${headline} ${sourceTitle}`, policyArea),
    storyJurisdiction: jurisdiction,
    storySourceLabel: getSourceLabel(record, domain),
    storySourceDetail: sourceDetail,
  };
}

function getSourceUrl(record: JsonRecord) {
  const sourceUrls = Array.isArray(record.source_urls) ? record.source_urls.map(text).filter(Boolean) : [];
  return text(record.source_url) || text(record.sourceUrl) || text(record.agenda_url) || text(record.minutes_url) || sourceUrls[0] || null;
}

function getRecordDate(record: JsonRecord, domain: RelationshipDomain) {
  const meeting = meetingById.get(text(record.meeting_id) || text(record.related_meeting_id));
  const item = itemById.get(text(record.topic_item_id) || text(record.related_agenda_item_id));
  const itemMeeting = item ? meetingById.get(text(item.meeting_id)) : undefined;
  const electionYear = numberValue(record.election_year) ?? numberValue(record.electionYear);
  const reportYear = numberValue(record.report_year) ?? numberValue(record.reportYear);

  if (domain === "meetings") return dateValue(record.meeting_date);
  if (domain === "agendaItems") return dateValue(meeting?.meeting_date) ?? dateValue(record.updated_at) ?? dateValue(record.created_at);
  if (domain === "votingCards") return dateValue(record.meeting_date) ?? dateValue(meeting?.meeting_date) ?? dateValue(itemMeeting?.meeting_date) ?? dateValue(record.updated_at);
  if (domain === "issues") return dateValue(record.latestActivityAt) ?? dateValue(record.updated_at) ?? dateValue(record.createdAt);
  if (domain === "courtCases") {
    return dateValue(record.dispositionDate) ?? dateValue(record.filingDate) ?? dateValue(record.updated_at) ?? dateValue(record.updatedAt) ?? dateValue(record.createdAt);
  }
  if (domain === "spendingRecords") {
    return (
      dateValue(record.filedAt) ??
      dateValue(record.filingDate) ??
      dateValue(record.updated_at) ??
      dateValue(meeting?.meeting_date) ??
      (reportYear ? `${reportYear}-12-31T00:00:00.000Z` : null)
    );
  }
  if (domain === "projects") return dateValue(record.updated_at) ?? dateValue(record.timeline) ?? dateValue(meeting?.meeting_date);
  if (domain === "elections") return electionYear ? `${electionYear}-11-03T00:00:00.000Z` : dateValue(record.filingDate);
  if (domain === "officialActionRecords") return dateValue(record.last_verified_at) ?? dateValue(meeting?.meeting_date) ?? dateValue(record.created_at) ?? dateValue(record.updated_at);
  return null;
}

function getSourceUpdatedAt(record: JsonRecord, domain: RelationshipDomain) {
  return dateValue(record.last_verified_at) ?? dateValue(record.updated_at) ?? dateValue(record.updatedAt) ?? dateValue(record.created_at) ?? dateValue(record.createdAt) ?? getRecordDate(record, domain);
}

function getVotingCardHref(record: JsonRecord) {
  const canonicalDecisionId =
    canonicalVotingCardIdBySourceId.get(text(record.id)) ??
    canonicalVotingCardIdBySourceId.get(text(record.sourceVotingCardId)) ??
    canonicalVotingCardIdBySourceId.get(text(record.topic_item_id)) ??
    canonicalVotingCardIdBySourceId.get(text(record.agendaItemId));
  if (canonicalDecisionId) return `/decisions/${canonicalDecisionId}`;
  return text(record.source_topic_href) || text(record.source_event_href) || (text(record.meeting_id) ? `/events/${text(record.meeting_id)}` : null);
}

function getHref(record: JsonRecord, domain: RelationshipDomain) {
  if (domain === "meetings") return `/events/${text(record.id)}`;
  if (domain === "agendaItems") return text(record.meeting_id) ? `/events/${text(record.meeting_id)}#${text(record.id)}` : null;
  if (domain === "votingCards") return getVotingCardHref(record);
  if (domain === "issues") return text(record.issueSlug) ? `/issues/${text(record.issueSlug)}` : null;
  if (domain === "courtCases") return text(record.id) ? `/cases/${text(record.id)}` : null;
  if (domain === "elections") return text(record.id) ? `/elections/${text(record.id)}` : null;
  if (domain === "officialActionRecords") return text(record.profile_url) || (text(record.official_id) ? `/officials/${text(record.official_id)}` : null);
  if (domain === "projects") return text(record.id) ? `/projects/${text(record.id)}` : text(record.source_url) || null;
  return null;
}

function sourceDocumentValues(record: JsonRecord) {
  const values = [
    text(record.source_url),
    text(record.sourceUrl),
    text(record.agenda_url),
    text(record.minutes_url),
    text(record.packet_url),
    text(record.sourceFile),
    text(record.source_file),
    text(record.cached_path),
    text(record.cached_text_path),
    text(record.source_path),
  ];

  for (const value of Array.isArray(record.source_urls) ? record.source_urls : []) values.push(text(value));
  for (const value of Array.isArray(record.relatedSourceUrls) ? record.relatedSourceUrls : []) values.push(text(value));
  return [...new Set(values.filter(Boolean))];
}

function isSchoolOrSpecialDistrictRecord(record: JsonRecord, title: string) {
  const value = normalize(
    [
      title,
      text(record.body_name),
      text(record.governing_body_display_name),
      text(record.jurisdiction_body),
      text(record.civic_layer),
      text(record.civic_layer_label),
    ].join(" "),
  );
  return /\b(school|district|trustees|authority|board|commission|advisory|surcharge|water|fire|library|parks|transit)\b/.test(value);
}

function getRelationshipScope(linkType: LinkType, communityId: string | null, link: LinkResult, record: JsonRecord, title: string): RelationshipScope {
  if (linkType === "statewide_overlay") return "statewide_overlay";
  if (linkType === "federal_overlay") return "federal_overlay";
  if (linkType === "direct") return "direct_local";
  if (communityId) {
    const countyId = getCountyIdForCommunity(communityId);
    if (!countyCommunityIdSet.has(communityId) && countyId && link.localCommunityIds.includes(countyId) && link.localCommunityIds.length > 1) {
      return "county";
    }
  }
  if (isSchoolOrSpecialDistrictRecord(record, title)) return "school_special_district";
  return "inferred_local";
}

function relationshipRecord(
  record: JsonRecord,
  domain: RelationshipDomain,
  sourcePath: string,
  link: LinkResult,
  linkType: LinkType,
  index: number,
  sourceDocs: string[],
  communityId: string | null = null,
): RelationshipRecord {
  const title = getRecordTitle(record, domain);
  const story = makeStory(record, domain);
  return {
    id: getRecordId(record, domain, index),
    title,
    ...story,
    sourcePath,
    linkType,
    relationshipScope: getRelationshipScope(linkType, communityId, link, record, title),
    linkBasis: link.linkBasis,
    reviewStatus: getReviewStatus(record),
    confidence: getConfidence(record),
    date: getRecordDate(record, domain),
    sourceCount: sourceDocs.length,
    sourceUpdatedAt: getSourceUpdatedAt(record, domain),
    sourceUrl: getSourceUrl(record),
    href: getHref(record, domain),
    needsReview: isNeedsReview(record),
    statewideOverlay: linkType === "statewide_overlay",
    federalOverlay: linkType === "federal_overlay",
  };
}

function makeBucket(communityId: string): CommunityRelationshipBucket {
  const community = canonicalCommunities.find((entry) => entry.id === communityId);
  return {
    communityId,
    name: community?.name ?? communityId,
    counts: { ...emptyDomainCounts(), sourceDocuments: 0 },
    localCounts: emptyDomainCounts(),
    statewideOverlayCounts: emptyDomainCounts(),
    linkCounts: {
      direct: 0,
      inferred: 0,
      statewideOverlay: 0,
      federalOverlay: 0,
    },
    reviewCounts: {
      approved: 0,
      ready: 0,
      needsReview: 0,
      unknown: 0,
    },
    confidenceCounts: {
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    },
    recordIds: emptyRelationshipRecordIds(),
    records: emptyRelationshipRecords(),
  };
}

function bumpReviewAndConfidence(bucket: CommunityRelationshipBucket, record: RelationshipRecord) {
  const status = record.reviewStatus.toLowerCase();
  if (record.needsReview) bucket.reviewCounts.needsReview += 1;
  else if (status.includes("approved") || status.includes("verified")) bucket.reviewCounts.approved += 1;
  else if (status.includes("ready")) bucket.reviewCounts.ready += 1;
  else bucket.reviewCounts.unknown += 1;

  if (record.confidence === null) bucket.confidenceCounts.unknown += 1;
  else if (record.confidence >= 0.75) bucket.confidenceCounts.high += 1;
  else if (record.confidence >= 0.5) bucket.confidenceCounts.medium += 1;
  else bucket.confidenceCounts.low += 1;
}

function addRecordToBucket(bucket: CommunityRelationshipBucket, domain: RelationshipDomain, record: RelationshipRecord, sourceDocs: string[]) {
  if (bucket.records[domain].some((entry) => entry.id === record.id && entry.linkType === record.linkType)) {
    return;
  }

  bucket.records[domain].push(record);
  bucket.recordIds[domain].push(record.id);
  bucket.counts[domain] += 1;
  if (record.linkType === "statewide_overlay") {
    bucket.statewideOverlayCounts[domain] += 1;
    bucket.linkCounts.statewideOverlay += 1;
  } else if (record.linkType === "federal_overlay") {
    bucket.linkCounts.federalOverlay += 1;
  } else {
    bucket.localCounts[domain] += 1;
    bucket.linkCounts[record.linkType] += 1;
  }
  bumpReviewAndConfidence(bucket, record);

  for (const value of sourceDocs) {
    const sourceDocument: SourceDocumentRecord = {
      id: `source-${hashId(`${record.id}:${value}`)}`,
      sourceUrl: value.startsWith("http") ? value : null,
      sourcePath: value.startsWith("http") ? null : value,
      relatedRecordId: record.id,
      relatedRecordType: domain,
      linkType: record.linkType,
      reviewStatus: record.reviewStatus,
      needsReview: record.needsReview,
    };
    if (!bucket.records.sourceDocuments.some((entry) => entry.id === sourceDocument.id)) {
      bucket.records.sourceDocuments.push(sourceDocument);
      bucket.recordIds.sourceDocuments.push(sourceDocument.id);
      bucket.counts.sourceDocuments += 1;
    }
  }
}

function main() {
  const buckets = new Map<string, CommunityRelationshipBucket>();
  for (const community of canonicalCommunities) {
    buckets.set(community.id, makeBucket(community.id));
  }

  const totals = {
    recordsProcessed: 0,
    directLinkCount: 0,
    inferredLinkCount: 0,
    statewideOnlyCount: 0,
    federalOnlyCount: 0,
    unlinkedCount: 0,
    needsReviewCount: 0,
    lowConfidenceCount: 0,
  };
  const unlinked: Record<RelationshipDomain, string[]> = {
    meetings: [],
    agendaItems: [],
    votingCards: [],
    issues: [],
    courtCases: [],
    spendingRecords: [],
    projects: [],
    elections: [],
    officialActionRecords: [],
  };
  const generatedOfficialRecords = generateOfficialRecords();
  const generatedProjectRecords = generateProjectRecords();
  const generatedEventRecords = generateEventRecords();
  const rssCapabilities = generateRssCapabilities();

  const sources: Array<{
    domain: RelationshipDomain;
    sourcePath: string;
    records: JsonRecord[];
    linker: (record: JsonRecord) => LinkResult;
  }> = [
    { domain: "meetings", sourcePath: "data/generated/public-meetings.json", records: asRecords("data/generated/public-meetings.json"), linker: linkMeeting },
    { domain: "agendaItems", sourcePath: "data/generated/public-meeting-items.json", records: asRecords("data/generated/public-meeting-items.json"), linker: linkMeetingItem },
    { domain: "votingCards", sourcePath: "data/generated/public-meeting-voting-cards.json", records: asRecords("data/generated/public-meeting-voting-cards.json"), linker: linkVotingCard },
    { domain: "issues", sourcePath: "data/generated/issues-runtime.json", records: asRecords("data/generated/issues-runtime.json"), linker: linkIssue },
    {
      domain: "courtCases",
      sourcePath: "data/generated/public-court-cases-runtime.json",
      records: asRecords("data/generated/public-court-cases-runtime.json"),
      linker: (record) => linkRuntimeText(record, ["jurisdiction", "jurisdictionName", "communityName", "title", "body_or_department"]),
    },
    {
      domain: "courtCases",
      sourcePath: "data/generated/public-cases-runtime.json",
      records: asRecords("data/generated/public-cases-runtime.json"),
      linker: (record) => linkRuntimeText(record, ["jurisdiction", "jurisdictionName", "communityName", "title", "body_or_department"]),
    },
    {
      domain: "spendingRecords",
      sourcePath: "data/generated/public-meeting-items.json",
      records: asRecords("data/generated/public-meeting-items.json").filter((record) => Boolean(text(record.fiscal_impact_summary) || text(record.financial_impact))),
      linker: linkMeetingItem,
    },
    {
      domain: "spendingRecords",
      sourcePath: "data/generated/nv-sos-campaign-finance-records.json",
      records: asRecords("data/generated/nv-sos-campaign-finance-records.json"),
      linker: (record) => linkRuntimeText(record, ["jurisdiction", "district", "office", "candidate_name"]),
    },
    {
      domain: "projects",
      sourcePath: "data/generated/nevada-community-projects.json",
      records: generatedProjectRecords,
      linker: (record) => linkRuntimeText(record, ["jurisdiction", "communityName", "agency", "project_title", "summary"]),
    },
    {
      domain: "elections",
      sourcePath: "data/generated/nv-sos-candidate-records.json",
      records: asRecords("data/generated/nv-sos-candidate-records.json"),
      linker: (record) => linkRuntimeText(record, ["jurisdiction", "district", "office"]),
    },
    {
      domain: "officialActionRecords",
      sourcePath: "data/generated/officials-runtime.json",
      records: asRecords("data/generated/officials-runtime.json"),
      linker: (record) => linkRuntimeText(record, ["jurisdiction_body", "action_text", "official_name_raw"]),
    },
    {
      domain: "officialActionRecords",
      sourcePath: "data/generated/current-officials-runtime.json",
      records: generatedOfficialRecords,
      linker: linkOfficialRecord,
    },
  ];

  for (const source of sources) {
    source.records.forEach((record, index) => {
      totals.recordsProcessed += 1;
      const link = source.linker(record);
      const direct = link.linkBasis === "direct_community_id";
      const linkType: LinkType = direct ? "direct" : "inferred";
      const sourceDocs = sourceDocumentValues(record);
      const relationship = relationshipRecord(record, source.domain, source.sourcePath, link, linkType, index, sourceDocs);

      if (relationship.needsReview) totals.needsReviewCount += 1;
      if (relationship.confidence !== null && relationship.confidence < 0.5) totals.lowConfidenceCount += 1;

      if (link.localCommunityIds.length) {
        if (direct) totals.directLinkCount += 1;
        else totals.inferredLinkCount += 1;
        for (const communityId of link.localCommunityIds) {
          const bucket = buckets.get(communityId);
          if (bucket) addRecordToBucket(bucket, source.domain, relationshipRecord(record, source.domain, source.sourcePath, link, linkType, index, sourceDocs, communityId), sourceDocs);
        }
        return;
      }

      if (link.stateOnly) {
        totals.statewideOnlyCount += 1;
        const stateBucket = buckets.get("nevada");
        const stateRecord = { ...relationship, linkType: "direct" as const, relationshipScope: "direct_local" as const };
        if (stateBucket) addRecordToBucket(stateBucket, source.domain, stateRecord, sourceDocs);
        for (const community of localCommunities) {
          const bucket = buckets.get(community.id);
          if (bucket) {
            addRecordToBucket(
              bucket,
              source.domain,
              { ...relationship, linkType: "statewide_overlay", relationshipScope: "statewide_overlay", statewideOverlay: true },
              sourceDocs,
            );
          }
        }
        return;
      }

      if (link.federalOnly) {
        totals.federalOnlyCount += 1;
        const federalBucket = buckets.get("united-states");
        if (federalBucket) addRecordToBucket(federalBucket, source.domain, { ...relationship, linkType: "direct" as const, relationshipScope: "direct_local" as const }, sourceDocs);
        for (const community of localCommunities) {
          const bucket = buckets.get(community.id);
          if (bucket) {
            addRecordToBucket(
              bucket,
              source.domain,
              { ...relationship, linkType: "federal_overlay", relationshipScope: "federal_overlay", federalOverlay: true },
              sourceDocs,
            );
          }
        }
        return;
      }

      totals.unlinkedCount += 1;
      unlinked[source.domain].push(relationship.id);
    });
  }

  const communities = Object.fromEntries(
    [...buckets.entries()].map(([communityId, bucket]) => [
      communityId,
      {
        ...bucket,
        records: Object.fromEntries(
          Object.entries(bucket.records).map(([domain, records]) => [
            domain,
            records.slice(0, domain === "sourceDocuments" ? 25 : 8),
          ]),
        ),
      },
    ]),
  );

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceArtifacts: sources.map((source) => ({
      domain: source.domain,
      sourcePath: source.sourcePath,
      recordCount: source.records.length,
    })),
    totals,
    communities,
    unlinked,
  };

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(
    OFFICIALS_OUTPUT_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), records: generatedOfficialRecords }, null, 2)}\n`,
  );
  fs.writeFileSync(
    PROJECTS_OUTPUT_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), records: generatedProjectRecords }, null, 2)}\n`,
  );
  fs.writeFileSync(
    EVENTS_OUTPUT_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), records: generatedEventRecords }, null, 2)}\n`,
  );
  fs.writeFileSync(RSS_OUTPUT_PATH, `${JSON.stringify(rssCapabilities, null, 2)}\n`);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(totals, null, 2));
  console.log(`[nevada-community-relationships] Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();
