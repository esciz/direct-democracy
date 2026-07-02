import fs from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const EVENTS_PATH = path.join(GENERATED_DIR, "nevada-community-events.json");
const OUTPUT_PATH = path.join(GENERATED_DIR, "event-freshness-audit.json");

type EventRecord = {
  id?: string;
  title?: string;
  jurisdiction?: string;
  body_name?: string | null;
  start_at?: string | null;
  status?: string | null;
  source_url?: string | null;
  agenda_url?: string | null;
};

type EventArtifact = {
  generatedAt?: string;
  records?: EventRecord[];
};

function readArtifact() {
  try {
    return JSON.parse(fs.readFileSync(EVENTS_PATH, "utf8")) as EventArtifact;
  } catch {
    return { records: [] };
  }
}

function expectedStatus(record: EventRecord, nowMs: number) {
  if (record.status === "cancelled") return "cancelled";
  const startTime = Date.parse(record.start_at ?? "");
  if (!Number.isFinite(startTime)) return "unknown";
  return startTime >= nowMs ? "upcoming" : "completed";
}

function eventSummary(record: EventRecord, nowMs: number) {
  return {
    id: record.id ?? null,
    title: record.title ?? "Untitled event",
    jurisdiction: record.jurisdiction ?? null,
    bodyName: record.body_name ?? null,
    startAt: record.start_at ?? null,
    currentStatus: record.status ?? "unknown",
    expectedStatus: expectedStatus(record, nowMs),
    sourceUrl: record.source_url ?? record.agenda_url ?? null,
  };
}

const artifact = readArtifact();
const records = Array.isArray(artifact.records) ? artifact.records : [];
const now = new Date();
const nowMs = now.getTime();
const generatedAtMs = Date.parse(artifact.generatedAt ?? "");
const staleStatusRecords = records.filter((record) => {
  const expected = expectedStatus(record, nowMs);
  return expected !== "unknown" && (record.status ?? "unknown") !== expected;
});
const upcoming = records.filter((record) => expectedStatus(record, nowMs) === "upcoming");
const completed = records.filter((record) => expectedStatus(record, nowMs) === "completed");
const unknownDate = records.filter((record) => expectedStatus(record, nowMs) === "unknown");
const sourceBacked = records.filter((record) => Boolean(record.source_url || record.agenda_url));

const report = {
  generatedAt: now.toISOString(),
  sourceArtifact: "data/generated/nevada-community-events.json",
  sourceGeneratedAt: artifact.generatedAt ?? null,
  sourceAgeHours: Number.isFinite(generatedAtMs) ? Math.round(((nowMs - generatedAtMs) / (60 * 60 * 1000)) * 10) / 10 : null,
  totals: {
    records: records.length,
    sourceBacked: sourceBacked.length,
    upcoming: upcoming.length,
    completed: completed.length,
    unknownDate: unknownDate.length,
    staleStatusRecords: staleStatusRecords.length,
  },
  nextUpcoming: upcoming
    .slice()
    .sort((left, right) => Date.parse(left.start_at ?? "") - Date.parse(right.start_at ?? ""))
    .slice(0, 10)
    .map((record) => eventSummary(record, nowMs)),
  latestCompleted: completed
    .slice()
    .sort((left, right) => Date.parse(right.start_at ?? "") - Date.parse(left.start_at ?? ""))
    .slice(0, 10)
    .map((record) => eventSummary(record, nowMs)),
  staleStatusSamples: staleStatusRecords.slice(0, 25).map((record) => eventSummary(record, nowMs)),
};

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log("Event freshness audit complete.");
console.log(
  JSON.stringify(
    {
      sourceGeneratedAt: report.sourceGeneratedAt,
      sourceAgeHours: report.sourceAgeHours,
      records: report.totals.records,
      upcoming: report.totals.upcoming,
      completed: report.totals.completed,
      staleStatusRecords: report.totals.staleStatusRecords,
      output: OUTPUT_PATH,
    },
    null,
    2,
  ),
);

if (staleStatusRecords.length > 0) {
  process.exitCode = 1;
}
