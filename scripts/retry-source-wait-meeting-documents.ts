import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "public-meeting-source-wait-report.json");

type DecisionQueueItem = {
  id: string;
  sourceVotingCardId: string;
  agendaItemId: string;
  title: string;
  jurisdiction: string;
  bodyName: string;
  meetingDate: string | null;
  nextAction: string;
  sourceRecoveryStatus?: string;
  sourceRecoveryReason?: string;
  adminHref: string;
  publicHref: string;
};

type SourceDocument = {
  id: string;
  meetingId: string;
  meetingItemIds: string[];
  organizationId: string | null;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  retrievalStatus: string;
};

type RetrievalRun = {
  audit?: { totals?: Record<string, number> };
  attempts?: Array<{ documentId: string; status: string; failureReason: string | null }>;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function argValue(name: string) {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: process.cwd(), stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function countBy<T>(items: T[], keyFor: (item: T) => string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFor(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function writeReport(stage: "before_retry" | "after_retry") {
  const generatedAt = new Date().toISOString();
  const queue = readJson<{ records?: DecisionQueueItem[]; priorityQueue?: DecisionQueueItem[] }>("decision-review-queue.json", { records: [], priorityQueue: [] });
  const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
  const retrievalRun = readJson<RetrievalRun>("dataops-retrieval-run.json", {});
  const queueItems = queue.records?.length ? queue.records : queue.priorityQueue ?? [];
  const sourceWaitItems = queueItems.filter((item) => item.nextAction === "await_minutes_or_result_source");
  const sourceTextRecoverableItems = queueItems.filter((item) => item.nextAction === "recover_minutes_or_action_result");
  const sourceWaitAgendaIds = new Set(sourceWaitItems.map((item) => item.agendaItemId));
  const relatedDocuments = documents.filter((document) => document.meetingItemIds.some((itemId) => sourceWaitAgendaIds.has(itemId)));

  const report = {
    generatedAt,
    stage,
    totals: {
      sourceWaitDecisions: sourceWaitItems.length,
      sourceTextRecoverableDecisions: sourceTextRecoverableItems.length,
      relatedDocuments: relatedDocuments.length,
      relatedRemoteDocuments: relatedDocuments.filter((document) => document.retrievalStatus === "remote_discovered").length,
      relatedLocalDocuments: relatedDocuments.filter((document) => document.retrievalStatus === "local_cached").length,
      latestRetrievalAttempts: retrievalRun.audit?.totals?.attempts ?? 0,
      latestDownloads: retrievalRun.audit?.totals?.downloaded ?? 0,
      latestFailures: retrievalRun.audit?.totals?.failed ?? 0,
      latestUnavailable: retrievalRun.audit?.totals?.unavailable ?? 0,
      latestBlockedByNetwork: retrievalRun.audit?.totals?.blockedByNetwork ?? 0,
    },
    byJurisdiction: countBy(sourceWaitItems, (item) => item.jurisdiction),
    byBody: countBy(sourceWaitItems, (item) => item.bodyName),
    bySourceRecoveryStatus: countBy(sourceWaitItems, (item) => item.sourceRecoveryStatus ?? "unknown"),
    relatedDocumentPlatforms: countBy(relatedDocuments, (document) => `${document.sourcePlatform}:${document.sourceHost ?? "local"}`),
    sample: sourceWaitItems.slice(0, 25).map((item) => ({
      title: item.title,
      jurisdiction: item.jurisdiction,
      bodyName: item.bodyName,
      meetingDate: item.meetingDate,
      sourceRecoveryStatus: item.sourceRecoveryStatus,
      sourceRecoveryReason: item.sourceRecoveryReason,
      adminHref: item.adminHref,
    })),
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote source-wait report to ${REPORT_PATH}`);
  console.log(JSON.stringify(report.totals, null, 2));
  return report;
}

const reportOnly = process.argv.includes("--report-only");
const limit = argValue("limit") ?? "150";
const maxBytes = argValue("max-bytes") ?? "50000000";
const timeoutMs = argValue("timeout-ms") ?? "15000";

writeReport("before_retry");
if (!reportOnly) {
  run("npm", ["run", "meetings:documents:discover"]);
  run("node", ["--import", "tsx", "scripts/retrieve-public-meeting-documents.ts", "--source-wait-only", `--limit=${limit}`, `--max-bytes=${maxBytes}`, `--timeout-ms=${timeoutMs}`]);
  run("npm", ["run", "meetings:documents:extract"]);
  run("npm", ["run", "action-results:generate:cached"]);
  run("npm", ["run", "votes:extract:cached"]);
  run("npm", ["run", "accountability:generate:cached"]);
  run("npm", ["run", "decisions:trust-audit"]);
  run("npm", ["run", "decisions:review-queue"]);
}
writeReport(reportOnly ? "before_retry" : "after_retry");
