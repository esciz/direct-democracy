import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "upcoming-meeting-coverage-audit.json");
const SEED_PATH = path.join(process.cwd(), "data", "seed", "public-meeting-sources.json");

type MeetingSource = {
  id: string;
  name: string;
  jurisdiction: string;
  active: boolean;
};

type PublicBody = {
  id: string;
  seed_source_id: string;
};

type Meeting = {
  id: string;
  public_body_id: string;
  meeting_date: string | null;
  title: string;
  source_urls: string[];
};

type DirectProvider = {
  source_id: string;
  provider_name: string;
  jurisdiction: string;
  meetings_discovered: number;
  meetings_parsed: number;
  failures: number;
  newest_meeting_found: string | null;
};

type ManualProvider = {
  provider_id: string;
  source_name: string;
  status: string;
  newest_meeting_found?: string | null;
};

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function generatedPath(fileName: string) {
  return path.join(GENERATED_DIR, fileName);
}

function parseTime(value: string | null | undefined) {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : null;
}

const generatedAt = new Date().toISOString();
const now = Date.now();
const sources = readJson<MeetingSource[]>(SEED_PATH, []).filter((source) => source.active);
const bodies = readJson<PublicBody[]>(generatedPath("public-meeting-bodies.json"), []);
const meetings = readJson<Meeting[]>(generatedPath("public-meetings.json"), []);
const directProviders = readJson<DirectProvider[]>(generatedPath("public-meeting-provider-report.json"), []);
const manualProviders = readJson<ManualProvider[]>(generatedPath("public-meeting-manual-provider-report.json"), []);
const directById = new Map(directProviders.map((provider) => [provider.source_id, provider]));
const manualById = new Map(manualProviders.map((provider) => [provider.provider_id, provider]));
const sourceById = new Map(sources.map((source) => [source.id, source]));
const bodyById = new Map(bodies.map((body) => [body.id, body]));
const providerIds = new Set([
  ...sources.map((source) => source.id),
  ...directProviders.map((provider) => provider.source_id),
  ...manualProviders.map((provider) => provider.provider_id),
]);

const rows = [...providerIds].map((providerId) => {
  const source = sourceById.get(providerId);
  const direct = directById.get(providerId);
  const manual = manualById.get(providerId);
  const providerMeetings = meetings
    .filter((meeting) => bodyById.get(meeting.public_body_id)?.seed_source_id === providerId)
    .filter((meeting) => parseTime(meeting.meeting_date) !== null)
    .sort((left, right) => (parseTime(left.meeting_date) ?? 0) - (parseTime(right.meeting_date) ?? 0));
  const upcomingMeetings = providerMeetings.filter((meeting) => (parseTime(meeting.meeting_date) ?? 0) >= now);
  const newestKnownMeeting = providerMeetings.at(-1) ?? null;
  const hasParsedProvider = Boolean(
    (direct?.meetings_parsed ?? 0) > 0 ||
    manual?.status === "parsed" ||
    manual?.status === "partially_parsed",
  );
  const failures = direct?.failures ?? 0;
  const status = upcomingMeetings.length
    ? "upcoming_found"
    : !source && !direct && !manual
      ? "source_gap"
      : failures > 0
        ? "source_failure"
        : hasParsedProvider
          ? "zero_upcoming_review"
          : "adapter_gap";

  return {
    providerId,
    providerName: source?.name ?? direct?.provider_name ?? manual?.source_name ?? providerId,
    jurisdiction: source?.jurisdiction ?? direct?.jurisdiction ?? "Jurisdiction pending",
    status,
    sourceConfigured: Boolean(source || direct || manual),
    directProviderStatus: direct
      ? {
          meetingsDiscovered: direct.meetings_discovered,
          meetingsParsed: direct.meetings_parsed,
          failures,
        }
      : null,
    manualProviderStatus: manual?.status ?? null,
    totalDatedMeetings: providerMeetings.length,
    upcomingMeetings: upcomingMeetings.length,
    nextUpcomingAt: upcomingMeetings[0]?.meeting_date ?? null,
    newestKnownMeetingAt: newestKnownMeeting?.meeting_date ?? direct?.newest_meeting_found ?? manual?.newest_meeting_found ?? null,
    upcomingExamples: upcomingMeetings.slice(0, 5).map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      meetingDate: meeting.meeting_date,
      sourceUrl: meeting.source_urls[0] ?? null,
    })),
    nextAction:
      status === "upcoming_found"
        ? "Continue daily monitoring."
        : status === "zero_upcoming_review"
          ? "Check the official calendar for a legitimately empty horizon, a late-posted agenda, or a date/parser change."
          : status === "source_failure"
            ? "Inspect the failed source retrieval before treating the calendar as empty."
            : status === "adapter_gap"
              ? "Add or repair the provider adapter; the configured source is not producing dated meetings."
              : "Register an official meeting calendar source.",
  };
}).sort((left, right) => left.jurisdiction.localeCompare(right.jurisdiction) || left.providerName.localeCompare(right.providerName));

const totals = {
  configuredProviders: rows.filter((row) => row.sourceConfigured).length,
  providersWithUpcomingMeetings: rows.filter((row) => row.status === "upcoming_found").length,
  upcomingMeetings: rows.reduce((total, row) => total + row.upcomingMeetings, 0),
  zeroUpcomingReview: rows.filter((row) => row.status === "zero_upcoming_review").length,
  sourceFailures: rows.filter((row) => row.status === "source_failure").length,
  adapterGaps: rows.filter((row) => row.status === "adapter_gap").length,
  sourceGaps: rows.filter((row) => row.status === "source_gap").length,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, totals, rows }, null, 2)}\n`);
console.log(JSON.stringify(totals, null, 2));
console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
