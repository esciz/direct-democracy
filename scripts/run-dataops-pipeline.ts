import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const LOCK_PATH = path.join(GENERATED_DIR, ".dataops-pipeline.lock");
const OUTPUT_PATH = path.join(GENERATED_DIR, "dataops-pipeline-run.json");

type StageStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

type Stage = {
  id: string;
  description: string;
  commands: string[][];
  network?: boolean;
};

function argValue(name: string) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function runNodeScript(script: string, args: string[] = []) {
  return ["node", "--import", "tsx", script, ...args];
}

function networkSmokeTest() {
  try {
    execFileSync("curl", ["-I", "--max-time", "8", "https://www.google.com"], { stdio: "ignore" });
    return { available: true, reason: null };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network_smoke_test_failed";
    return { available: false, reason };
  }
}

const retrieveArgs = [
  argValue("limit") ? `--limit=${argValue("limit")}` : null,
  argValue("jurisdiction") ? `--jurisdiction=${argValue("jurisdiction")}` : null,
  argValue("host") ? `--host=${argValue("host")}` : null,
  argValue("document-type") ? `--document-type=${argValue("document-type")}` : null,
  process.argv.includes("--priority-only") ? "--priority-only" : null,
  process.argv.includes("--retry-only") ? "--retry-only" : null,
].filter(Boolean) as string[];

const stages: Stage[] = [
  { id: "register-sources", description: "Register RSS/feed sources.", commands: [runNodeScript("scripts/generate-rss-source-registry.ts")] },
  { id: "discover-documents", description: "Discover public meeting source documents.", commands: [runNodeScript("scripts/discover-public-meeting-source-documents.ts")] },
  { id: "monitor-sources", description: "Monitor source health from current artifacts.", commands: [runNodeScript("scripts/generate-dataops-source-registry.ts"), runNodeScript("scripts/generate-public-meeting-retrieval-queue.ts"), runNodeScript("scripts/monitor-civic-sources.ts")] },
  { id: "retrieve-documents", description: "Retrieve/cache queued remote documents.", network: true, commands: [runNodeScript("scripts/retrieve-public-meeting-documents.ts", retrieveArgs)] },
  { id: "verify-cache", description: "Verify cached content and reconcile cache counts.", commands: [runNodeScript("scripts/verify-public-meeting-cache-content.ts"), runNodeScript("scripts/audit-public-meeting-document-cache.ts")] },
  { id: "extract-native-text", description: "Extract native text from cached documents.", commands: [runNodeScript("scripts/extract-public-meeting-document-text.ts")] },
  { id: "ocr", description: "Audit OCR capabilities and execute bounded OCR candidates.", commands: [runNodeScript("scripts/audit-ocr-capabilities.ts"), runNodeScript("scripts/run-public-meeting-ocr.ts"), runNodeScript("scripts/extract-public-meeting-document-text.ts"), runNodeScript("scripts/audit-public-meeting-ocr.ts")] },
  { id: "source-completeness", description: "Regenerate source completeness and accountability readiness.", commands: [runNodeScript("scripts/generate-public-meeting-retrieval-queue.ts"), runNodeScript("scripts/audit-minutes-extraction.ts"), runNodeScript("scripts/generate-public-meeting-action-results.ts"), runNodeScript("scripts/generate-public-meeting-source-completeness.ts"), runNodeScript("scripts/audit-public-meeting-documents.ts")] },
  { id: "attendance", description: "Regenerate rosters and attendance.", commands: [runNodeScript("scripts/generate-governing-body-rosters.ts"), runNodeScript("scripts/generate-public-meeting-attendance.ts"), runNodeScript("scripts/audit-public-meeting-attendance.ts")] },
  { id: "votes", description: "Regenerate votes and attribution readiness.", commands: [runNodeScript("scripts/generate-public-meeting-votes.ts"), runNodeScript("scripts/audit-public-meeting-votes.ts"), runNodeScript("scripts/generate-vote-attribution-readiness.ts")] },
  { id: "accountability", description: "Regenerate voting cards, projects, and accountability graph.", commands: [runNodeScript("scripts/generate-voting-cards.ts"), runNodeScript("scripts/generate-projects.ts"), runNodeScript("scripts/generate-accountability-graph.ts")] },
  { id: "communities", description: "Regenerate community relationships and reports.", commands: [runNodeScript("scripts/generate-nevada-community-relationships.ts"), runNodeScript("scripts/report-nevada-community-coverage.ts"), runNodeScript("scripts/audit-nevada-community-linkage.ts"), runNodeScript("scripts/audit-browse-previews.ts")] },
  { id: "freshness-audit", description: "Record reprocessing and final DataOps freshness audit.", commands: [runNodeScript("scripts/reprocess-civic-data.ts", ["--all-cached"]), runNodeScript("scripts/monitor-civic-sources.ts"), runNodeScript("scripts/audit-dataops-freshness.ts")] },
];

function selectedStages() {
  const from = argValue("from");
  const to = argValue("to");
  const fromIndex = from ? stages.findIndex((stage) => stage.id === from) : 0;
  const toIndex = to ? stages.findIndex((stage) => stage.id === to) : stages.length - 1;
  if (fromIndex === -1) throw new Error(`Unknown --from stage: ${from}`);
  if (toIndex === -1) throw new Error(`Unknown --to stage: ${to}`);
  return stages.slice(fromIndex, toIndex + 1);
}

function artifactMetrics() {
  const retrieval = readJson<{ audit?: { totals?: Record<string, number> } }>("dataops-retrieval-run.json", {});
  const text = readJson<{ audit?: { totals?: Record<string, number> } }>("public-meeting-document-text.json", {});
  const ocr = readJson<{ audit?: { totals?: Record<string, number> } }>("public-meeting-ocr-results.json", {});
  const source = readJson<{ totals?: Record<string, number> }>("public-meeting-source-completeness.json", {});
  const votes = readJson<{ totals?: Record<string, number> }>("public-meeting-vote-extraction-audit.json", {});
  return {
    documentsDownloaded: retrieval.audit?.totals?.downloaded ?? 0,
    documentsChanged: retrieval.audit?.totals?.updatedContent ?? retrieval.audit?.totals?.changed ?? 0,
    documentsExtracted: text.audit?.totals?.textExtracted ?? 0,
    pagesOcrd: ocr.audit?.totals?.pagesSucceeded ?? 0,
    ocrSucceeded: ocr.audit?.totals?.ocrSucceeded ?? 0,
    meetingsReadyForAccountability: source.totals?.meetingsReadyForAccountability ?? 0,
    sourceGapMeetings: source.totals?.meetingsBlockedBySourceGaps ?? 0,
    parserGapMeetings: source.totals?.meetingsBlockedByParserGaps ?? 0,
    parsedNamedVotes: votes.totals?.parsedNamedVotes ?? 0,
  };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const runId = `dataops-${new Date().toISOString()}`;
if (existsSync(LOCK_PATH) && !process.argv.includes("--force")) {
  throw new Error(`DataOps pipeline lock exists at ${LOCK_PATH}. Use --force only after confirming no run is active.`);
}
writeFileSync(LOCK_PATH, `${runId}\n`);

const startedAt = new Date().toISOString();
const offline = process.argv.includes("--offline") || process.env.DATAOPS_NETWORK_ENABLED === "false";
const smoke = offline ? { available: false, reason: "offline_mode_requested" } : networkSmokeTest();
const stageReports: Array<{ id: string; description: string; status: StageStatus; startedAt: string | null; completedAt: string | null; durationMs: number; error: string | null }> = [];

try {
  for (const stage of selectedStages()) {
    const report = { id: stage.id, description: stage.description, status: "pending" as StageStatus, startedAt: null as string | null, completedAt: null as string | null, durationMs: 0, error: null as string | null };
    stageReports.push(report);
    if (stage.network && !smoke.available) {
      report.status = "skipped";
      report.error = `network_unavailable:${smoke.reason}`;
      continue;
    }
    const started = Date.now();
    report.startedAt = new Date().toISOString();
    report.status = "running";
    try {
      for (const command of stage.commands) execFileSync(command[0], command.slice(1), { stdio: "inherit", env: process.env });
      report.status = "succeeded";
    } catch (error) {
      report.status = "failed";
      report.error = error instanceof Error ? error.message : "stage_failed";
      throw error;
    } finally {
      report.completedAt = new Date().toISOString();
      report.durationMs = Date.now() - started;
      writeFileSync(OUTPUT_PATH, `${JSON.stringify({ runId, startedAt, updatedAt: new Date().toISOString(), environment: { offline, networkAvailable: smoke.available, networkReason: smoke.reason, cwd: process.cwd() }, stages: stageReports, metrics: artifactMetrics() }, null, 2)}\n`);
    }
  }
} finally {
  rmSync(LOCK_PATH, { force: true });
}

const completedAt = new Date().toISOString();
const artifact = {
  runId,
  startedAt,
  completedAt,
  environment: { offline, networkAvailable: smoke.available, networkReason: smoke.reason, cwd: process.cwd() },
  stagesAttempted: stageReports.filter((stage) => stage.status !== "skipped").length,
  stagesSucceeded: stageReports.filter((stage) => stage.status === "succeeded").length,
  stagesFailed: stageReports.filter((stage) => stage.status === "failed").length,
  stagesSkipped: stageReports.filter((stage) => stage.status === "skipped").length,
  stages: stageReports,
  metrics: artifactMetrics(),
};
writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
if (artifact.stagesFailed) process.exit(1);
console.log(`DataOps pipeline completed: ${artifact.stagesSucceeded} succeeded, ${artifact.stagesSkipped} skipped.`);
console.log(JSON.stringify(artifact.metrics, null, 2));
