import fs from "node:fs";
import path from "node:path";

import { PUBLIC_DEMO_DATA_ENABLED } from "@/lib/auth/constants";
import { getCanonicalIssueTitles } from "@/lib/issues/utils";
import { mockCuratedTopIssues, mockTopIssueSubmissions } from "@/lib/mock-data";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const RUNTIME_PATH = path.join(GENERATED_DIR, "issues-runtime.json");
const AUDIT_PATH = path.join(GENERATED_DIR, "issues-audit-report.json");
const OUTPUT_PATH = path.join(GENERATED_DIR, "issues-report.json");

type IssueRuntimeRecord = {
  id: string;
  issueText: string;
  issueSlug?: string;
  jurisdictionName: string;
  sourceBacked: boolean;
  reviewStatus?: string;
  policyAreas?: string[];
  relatedSourceUrls?: string[];
  relationshipCounts?: {
    meetings?: number;
    agendaItems?: number;
    votingCards?: number;
    courtCases?: number;
    communitySubmissions?: number;
    votes?: number;
    sourceDocuments?: number;
  };
};

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function increment(map: Record<string, number>, key: string, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
}

function main() {
  const runtime = readJson<{ records?: IssueRuntimeRecord[] }>(RUNTIME_PATH, { records: [] });
  const audit = readJson<Record<string, unknown>>(AUDIT_PATH, {});
  const records = Array.isArray(runtime.records) ? runtime.records : [];
  const demoFallbackCount = mockCuratedTopIssues.length + mockTopIssueSubmissions.length + getCanonicalIssueTitles().length;
  const byJurisdiction: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const record of records) {
    increment(byJurisdiction, record.jurisdictionName || "Across the platform");
    const categories = record.policyAreas?.length ? record.policyAreas : [record.issueText];
    for (const category of categories) {
      increment(byCategory, category);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    runtimePath: "data/generated/issues-runtime.json",
    auditPath: fs.existsSync(AUDIT_PATH) ? "data/generated/issues-audit-report.json" : null,
    counts: {
      runtimeIssueCount: records.length,
      publicSourceBackedCount: records.filter((record) => record.sourceBacked).length,
      demoFallbackCount,
      hiddenDemoCount: PUBLIC_DEMO_DATA_ENABLED ? 0 : demoFallbackCount,
      productionVisibleIssueCount: PUBLIC_DEMO_DATA_ENABLED ? records.length + demoFallbackCount : records.length,
      issuesWithMeetings: records.filter((record) => (record.relationshipCounts?.meetings ?? 0) > 0).length,
      issuesWithVotes: records.filter((record) => (record.relationshipCounts?.votes ?? 0) > 0).length,
      issuesWithCourtRecords: records.filter((record) => (record.relationshipCounts?.courtCases ?? 0) > 0).length,
      issuesNeedingReview: records.filter((record) => record.reviewStatus === "needs_review").length,
      issuesMissingPlainEnglishTitle: records.filter((record) => !record.issueText?.trim() || /meeting materials/i.test(record.issueText)).length,
      issuesMissingSourceLinks: records.filter((record) => !record.relatedSourceUrls?.length).length,
    },
    issuesByJurisdiction: byJurisdiction,
    issuesByCategory: byCategory,
    relationshipCoverage: records.map((record) => ({
      id: record.id,
      issueText: record.issueText,
      jurisdictionName: record.jurisdictionName,
      categories: record.policyAreas ?? [],
      reviewStatus: record.reviewStatus ?? "unknown",
      sourceBacked: record.sourceBacked,
      hasSourceLinks: Boolean(record.relatedSourceUrls?.length),
      relationshipCounts: record.relationshipCounts ?? {},
    })),
    demoMode: {
      enabled: PUBLIC_DEMO_DATA_ENABLED,
      env: "NEXT_PUBLIC_ENABLE_DEMO_MODE or ENABLE_DEMO_MODE",
      publicBehavior: PUBLIC_DEMO_DATA_ENABLED
        ? "Demo fallback issues may appear alongside source-backed issue hubs."
        : "Demo fallback issues are hidden from public issue pages.",
    },
    auditSummary: {
      hasAuditReport: Boolean(Object.keys(audit).length),
      hasPrimaryIssueModel: (audit as { currentSchema?: { hasPrimaryIssueModel?: boolean } }).currentSchema?.hasPrimaryIssueModel ?? null,
    },
  };

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.counts, null, 2));
  console.log(`[issues] Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();
