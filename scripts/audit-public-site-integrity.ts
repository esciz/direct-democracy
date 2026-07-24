import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Severity = "critical" | "high" | "medium";

type Finding = {
  id: string;
  severity: Severity;
  area: string;
  summary: string;
  evidence: string[];
};

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-site-integrity-audit.json");
const findings: Finding[] = [];

const publicAggregationFiles = [
  "lib/community/issues.ts",
  "lib/debates/store.ts",
  "lib/elections/store.ts",
  "lib/events/civic-events.ts",
  "lib/feed/posts.ts",
  "lib/media/store.ts",
  "lib/petitions/store.ts",
  "lib/political-ads/store.ts",
  "lib/polls/store.ts",
  "lib/profile/reputation.ts",
  "lib/server/interviews.ts",
  "lib/server/profile-activity.ts",
  "lib/schools/store.ts",
  "app/posts/page.tsx",
  "app/feed/page.tsx",
  "app/petitions/[petitionId]/page.tsx",
];

function readText(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function readJson<T>(relativePath: string, fallback: T): T {
  try {
    return JSON.parse(readText(relativePath)) as T;
  } catch {
    return fallback;
  }
}

function addFinding(finding: Finding) {
  findings.push(finding);
}

const fixtureConsumers = publicAggregationFiles.filter((relativePath) => {
  const source = readText(relativePath);
  return (
    source.includes('from "@/lib/mock-data"') ||
    source.includes("from '@/lib/mock-data'") ||
    source.includes('process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true"')
  );
});

if (fixtureConsumers.length) {
  addFinding({
    id: "public-fixture-consumers",
    severity: "critical",
    area: "public content integrity",
    summary: "Public civic aggregation files still import the shared mock-data fixture.",
    evidence: fixtureConsumers,
  });
}

const canonicalRedirects = [
  ["app/top-issues/page.tsx", 'redirect("/issues")'],
  ["app/top-issues/[issueId]/page.tsx", 'redirect("/issues")'],
  ["app/community-priorities/page.tsx", 'redirect("/issues")'],
] as const;
const missingRedirects = canonicalRedirects
  .filter(([relativePath, marker]) => !readText(relativePath).includes(marker))
  .map(([relativePath]) => relativePath);

if (missingRedirects.length) {
  addFinding({
    id: "duplicate-issue-surfaces",
    severity: "critical",
    area: "information architecture",
    summary: "Legacy issue surfaces are no longer routed to the source-backed issue system.",
    evidence: missingRedirects,
  });
}

const retiredUrls = [
  "https://www.carson.org/",
  "https://www.carsoncityschools.com/parents/enrollment",
  "https://www.reno.gov/community/homelessness\"",
  "https://www.reno.gov/government/municipal-court",
];
const filesWithRetiredUrls = ["lib/services/store.ts", "lib/district-matching/source-adapters.ts"].flatMap((relativePath) => {
  const source = readText(relativePath);
  return retiredUrls.filter((url) => source.includes(url)).map((url) => `${relativePath}: ${url}`);
});

if (filesWithRetiredUrls.length) {
  addFinding({
    id: "retired-government-links",
    severity: "critical",
    area: "broken links",
    summary: "Known retired or 404 government URLs remain in public service records.",
    evidence: filesWithRetiredUrls,
  });
}

const providerRows = readJson<Array<{
  source_id: string;
  provider_name: string;
  meetings_parsed: number;
  failures: number;
  notes: string | null;
}>>("data/generated/public-meeting-provider-report.json", []);
const manualProviderRows = readJson<Array<{
  provider_id: string;
  parsed_meetings: number;
  parser_failures: number;
  parser_gaps?: string[];
}>>("data/generated/public-meeting-manual-provider-report.json", []);
const manualProviderById = new Map(manualProviderRows.map((provider) => [provider.provider_id, provider]));
const zeroMeetingProviders = providerRows.filter((provider) => {
  const manualProvider = manualProviderById.get(provider.source_id);
  return provider.meetings_parsed === 0 && (manualProvider?.parsed_meetings ?? 0) === 0;
});

if (zeroMeetingProviders.length) {
  addFinding({
    id: "meeting-provider-zero-yield",
    severity: "high",
    area: "meeting collection",
    summary: `${zeroMeetingProviders.length} registered meeting providers returned zero parsed meetings; zero yield is a collection barrier even when the importer reports no exception.`,
    evidence: zeroMeetingProviders.map(
      (provider) => {
        const manualProvider = manualProviderById.get(provider.source_id);
        const manualNotes = manualProvider?.parser_gaps?.join(" ") ?? null;
        return `${provider.provider_name} (${provider.source_id}): ${manualNotes ?? provider.notes ?? "No parser failure reason recorded."}`;
      },
    ),
  });
}

const officialsCoverage = readJson<{
  generatedAt?: string;
  rows?: Array<{ jurisdictionName: string; adapterStatus: string; sourceHealth: string }>;
}>("data/generated/officials-coverage-audit.json", {});
const unverifiedOfficialJurisdictions = (officialsCoverage.rows ?? []).filter((row) => row.adapterStatus !== "complete");

if (unverifiedOfficialJurisdictions.length) {
  addFinding({
    id: "official-roster-source-gaps",
    severity: "high",
    area: "official collection",
    summary: `${unverifiedOfficialJurisdictions.length} priority jurisdictions do not have complete source-verified official rosters.`,
    evidence: unverifiedOfficialJurisdictions.map(
      (row) => `${row.jurisdictionName}: ${row.adapterStatus} (${row.sourceHealth})`,
    ),
  });
}

const financeQuality = readJson<{
  generated_at?: string;
  total_records?: number;
  unmatched_records?: number;
  records_missing_candidate_name?: number;
  records_missing_office?: number;
  records_missing_totals?: number;
  duplicate_candidate_report_records?: unknown[];
}>("data/generated/nv-sos-data-quality-report.json", {});
const financeStatus = readJson<{
  session_status?: string;
  last_successful_live_fetch_at?: string | null;
  records_served_from_cache?: number;
  blocked_unique_urls?: number;
  next_recommended_action?: string;
}>("data/generated/nv-sos-operational-status.json", {});

if (
  (financeQuality.unmatched_records ?? 0) > 0 ||
  (financeQuality.records_missing_candidate_name ?? 0) > 0 ||
  (financeQuality.records_missing_office ?? 0) > 0 ||
  (financeQuality.records_missing_totals ?? 0) > 0
) {
  addFinding({
    id: "campaign-finance-reconciliation",
    severity: "high",
    area: "campaign finance collection",
    summary: "Nevada SOS finance records still have unresolved parsing and candidate-reconciliation gaps.",
    evidence: [
      `${financeQuality.unmatched_records ?? 0} unmatched of ${financeQuality.total_records ?? 0} records`,
      `${financeQuality.records_missing_candidate_name ?? 0} missing candidate names`,
      `${financeQuality.records_missing_office ?? 0} missing offices`,
      `${financeQuality.records_missing_totals ?? 0} missing totals`,
      `${financeQuality.duplicate_candidate_report_records?.length ?? 0} duplicate report groups`,
      `${financeStatus.blocked_unique_urls ?? 0} live URLs blocked by the current Nevada SOS session`,
      `last successful live fetch ${financeStatus.last_successful_live_fetch_at ?? "unknown"}`,
      `${financeStatus.records_served_from_cache ?? 0} cached records remain usable`,
      financeStatus.next_recommended_action ?? "Nevada SOS session recovery action is not recorded.",
    ],
  });
}

const dataopsRun = readJson<{
  completedAt?: string;
  updatedAt?: string;
  stagesAttempted?: number;
  stagesFailed?: number;
  stages?: Array<{ status?: string }>;
  metrics?: { upcomingMeetings?: number; sourceGapMeetings?: number; parserGapMeetings?: number };
}>("data/generated/dataops-pipeline-run.json", {});

const stagesAttempted = dataopsRun.stagesAttempted ?? dataopsRun.stages?.length ?? 0;
const stagesFailed = dataopsRun.stagesFailed ?? dataopsRun.stages?.filter((stage) => stage.status === "failed").length ?? 0;
if (stagesAttempted < 15 || stagesFailed > 0) {
  addFinding({
    id: "partial-dataops-run",
    severity: "high",
    area: "data operations",
    summary: "The latest recorded DataOps run was not a complete successful daily pipeline execution.",
    evidence: [
      `${stagesAttempted} of 15 stages attempted`,
      `${stagesFailed} stages failed`,
      `completed ${dataopsRun.completedAt ?? dataopsRun.updatedAt ?? "unknown"}`,
    ],
  });
}

if ((dataopsRun.metrics?.sourceGapMeetings ?? 0) > 0 || (dataopsRun.metrics?.parserGapMeetings ?? 0) > 0) {
  addFinding({
    id: "meeting-document-readiness",
    severity: "high",
    area: "meeting accountability",
    summary: "Some meeting records cannot yet support agenda, vote, and accountability detail because source documents or parsers are missing.",
    evidence: [
      `${dataopsRun.metrics?.sourceGapMeetings ?? 0} meetings blocked by source gaps`,
      `${dataopsRun.metrics?.parserGapMeetings ?? 0} meetings blocked by parser gaps`,
      `${dataopsRun.metrics?.upcomingMeetings ?? 0} upcoming meetings currently published`,
    ],
  });
}

function ageInDays(value: string | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? Math.floor((Date.now() - timestamp) / 86_400_000) : null;
}

const sourceRegistry = readJson<{ generatedAt?: string; records?: unknown[] }>("data/generated/dataops-source-registry.json", {});
const registryAgeDays = ageInDays(sourceRegistry.generatedAt);
if (registryAgeDays === null || registryAgeDays > 7) {
  addFinding({
    id: "stale-source-registry",
    severity: "high",
    area: "data operations",
    summary: "The source-health registry is older than the weekly maximum refresh interval.",
    evidence: [
      `generated ${sourceRegistry.generatedAt ?? "unknown"}`,
      `${registryAgeDays ?? "unknown"} days old`,
      `${sourceRegistry.records?.length ?? 0} registered sources`,
    ],
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  launchReady: !findings.some((finding) => finding.severity === "critical" || finding.severity === "high"),
  totals: {
    critical: findings.filter((finding) => finding.severity === "critical").length,
    high: findings.filter((finding) => finding.severity === "high").length,
    medium: findings.filter((finding) => finding.severity === "medium").length,
    publicAggregationFilesChecked: publicAggregationFiles.length,
    meetingProvidersChecked: providerRows.length,
  },
  findings,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report.totals, null, 2));
console.log(`Launch ready: ${report.launchReady ? "yes" : "no"}`);
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);

if (report.totals.critical > 0) {
  process.exit(1);
}
