import path from "node:path";

import type { MeetingPolicyArea, PublicMeetingSourceSeed } from "@/lib/public-meetings/types";

export const PUBLIC_MEETING_PATHS = {
  seedSources: "data/seed/public-meeting-sources.json",
  importRoot: "data/imports/meeting-records",
  importManifest: "data/imports/meeting-records/manifest.json",
  uploadRoot: "data/imports/meeting-records/uploads",
  rawRoot: "data/raw/public-meetings",
  textRoot: "data/generated/public-meeting-text",
  bodies: "data/generated/public-meeting-bodies.json",
  meetings: "data/generated/public-meetings.json",
  meetingItems: "data/generated/public-meeting-items.json",
  voteRecords: "data/generated/public-meeting-votes.json",
  officialActions: "data/generated/public-meeting-official-actions.json",
  meetingVotingCards: "data/generated/public-meeting-voting-cards.json",
  meetingVotingCardsRuntime: "data/generated/voting-cards-runtime.json",
  eventsRuntime: "data/generated/events-runtime.json",
  officialsRuntime: "data/generated/officials-runtime.json",
  officialActionReviewOverrides: "data/generated/public-meeting-official-action-review-overrides.json",
  officialRosterSeeds: "data/seed/public-meeting-official-rosters.json",
  officialRosterReport: "data/generated/public-meeting-official-roster-report.json",
  citizenQuestions: "data/generated/citizen-vote-questions.json",
  ingestionReport: "data/generated/public-meeting-ingestion-report.json",
  providerReport: "data/generated/public-meeting-provider-report.json",
  manualSourcesRoot: "data/manual-sources/public-meetings",
  manualProviderReport: "data/generated/public-meeting-manual-provider-report.json",
} as const;

export const PUBLIC_MEETING_OUTPUT_FILES = {
  public_bodies: PUBLIC_MEETING_PATHS.bodies,
  meetings: PUBLIC_MEETING_PATHS.meetings,
  meeting_items: PUBLIC_MEETING_PATHS.meetingItems,
  vote_records: PUBLIC_MEETING_PATHS.voteRecords,
  official_actions: PUBLIC_MEETING_PATHS.officialActions,
  meeting_voting_cards: PUBLIC_MEETING_PATHS.meetingVotingCards,
  meeting_voting_cards_runtime: PUBLIC_MEETING_PATHS.meetingVotingCardsRuntime,
  events_runtime: PUBLIC_MEETING_PATHS.eventsRuntime,
  officials_runtime: PUBLIC_MEETING_PATHS.officialsRuntime,
  official_action_review_overrides: PUBLIC_MEETING_PATHS.officialActionReviewOverrides,
  official_roster_report: PUBLIC_MEETING_PATHS.officialRosterReport,
  citizen_vote_questions: PUBLIC_MEETING_PATHS.citizenQuestions,
  ingestion_report: PUBLIC_MEETING_PATHS.ingestionReport,
  provider_report: PUBLIC_MEETING_PATHS.providerReport,
  manual_provider_report: PUBLIC_MEETING_PATHS.manualProviderReport,
} as const;

export function absolutePublicMeetingPath(relativePath: string) {
  return path.join(/* turbopackIgnore: true */ process.cwd(), relativePath);
}

export function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeTextLines(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function stripHtml(value: string | null | undefined) {
  return normalizeTextLines(
    String(value ?? "")
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"'),
  );
}

export function summarizeText(value: string | null | undefined, maxLength = 700) {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

export function slugify(value: string | null | undefined) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeName(value: string | null | undefined) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight || normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  const leftTokens = normalizedLeft.split(" ").filter(Boolean).sort();
  const rightTokens = normalizedRight.split(" ").filter(Boolean).sort();
  return leftTokens.length > 1 && leftTokens.length === rightTokens.length && leftTokens.every((token, index) => token === rightTokens[index]);
}

export function inferPolicyArea(text: string): MeetingPolicyArea {
  const value = text.toLowerCase();
  if (/\b(housing|affordable housing|rent|apartment|dwelling|residential)\b/.test(value)) return "Housing";
  if (/\b(zoning|rezon|variance|land use|parcel|development agreement|subdivision)\b/.test(value)) return "Zoning";
  if (/\b(tax|fee|assessment|rate increase|revenue)\b/.test(value)) return "Taxes";
  if (/\b(police|sheriff|fire|emergency|public safety|911|dispatch)\b/.test(value)) return "Public Safety";
  if (/\b(school|student|teacher|trustee|curriculum|campus)\b/.test(value)) return "Schools";
  if (/\b(road|street|traffic|transportation|transit|sidewalk|bike lane|airport)\b/.test(value)) return "Transportation";
  if (/\b(environment|water quality|air quality|conservation|emission|sustainability)\b/.test(value)) return "Environment";
  if (/\b(utility|utilities|water|sewer|wastewater|stormwater|power|electric)\b/.test(value)) return "Utilities";
  if (/\b(budget|appropriation|fiscal year|capital improvement|expenditure|grant|contract|not to exceed|\$[0-9])\b/.test(value)) return "Budget";
  if (/\b(labor|union|collective bargaining|employee|salary|wage|benefit)\b/.test(value)) return "Labor";
  if (/\b(health|hospital|mental health|clinic|medicaid|public health)\b/.test(value)) return "Healthcare";
  if (/\b(election|ballot|voter|precinct|campaign|redistrict)\b/.test(value)) return "Elections";
  if (/\b(license|business|permit|franchise|vendor|regulation)\b/.test(value)) return "Business Regulation";
  return "Other";
}

export function seedToBodyId(seed: PublicMeetingSourceSeed) {
  return `body-${seed.id || slugify(`${seed.name}-${seed.jurisdiction}`)}`;
}
