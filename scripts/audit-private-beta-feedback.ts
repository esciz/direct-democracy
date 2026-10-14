import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const PRIVATE_FEEDBACK_PATH = path.join(ROOT, "data", "private", "private-beta-feedback.json");
const OUTPUT_PATH = path.join(GENERATED_DIR, "private-beta-feedback-audit.json");

type FeedbackRecord = {
  status?: string;
  category?: string;
  severity?: string;
  publicReleaseNote?: string | null;
  containsPersonalData?: boolean;
  needsFollowUp?: boolean;
};

function readText(relativePath: string) {
  const filePath = path.join(ROOT, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function sourceIncludes(relativePath: string, needle: string) {
  return readText(relativePath).includes(needle);
}

function readPrivateFeedbackRecords() {
  try {
    const parsed = JSON.parse(readFileSync(PRIVATE_FEEDBACK_PATH, "utf8")) as { records?: FeedbackRecord[] };
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return [];
  }
}

function countBy(records: FeedbackRecord[], key: keyof FeedbackRecord) {
  return records.reduce<Record<string, number>>((counts, record) => {
    const value = typeof record[key] === "string" ? record[key] : "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

const records = readPrivateFeedbackRecords();
const openStatuses = new Set(["new", "triaged", "in_progress"]);
const validation = {
  publicFeedbackRouteExists: existsSync(path.join(ROOT, "app", "feedback", "page.tsx")),
  publicFeedbackActionRequiresSession:
    sourceIncludes("app/feedback/actions.ts", "getCurrentSessionUser") &&
    sourceIncludes("app/feedback/actions.ts", "/auth?next=%2Ffeedback"),
  feedbackStoreIsPrivate:
    sourceIncludes("lib/private-beta/feedback.ts", "data\", \"private") &&
    sourceIncludes("lib/private-beta/feedback.ts", "private-beta-feedback.json"),
  feedbackStoreHasReviewFlags:
    sourceIncludes("lib/private-beta/feedback.ts", "containsPersonalData") &&
    sourceIncludes("lib/private-beta/feedback.ts", "containsAccountIssue") &&
    sourceIncludes("lib/private-beta/feedback.ts", "needsFollowUp"),
  adminReviewRouteExists: existsSync(path.join(ROOT, "app", "admin", "private-beta-feedback", "page.tsx")),
  adminReviewActionRequiresPermission:
    sourceIncludes("app/admin/private-beta-feedback/actions.ts", "requireAdminSession") &&
    sourceIncludes("app/admin/private-beta-feedback/actions.ts", "review.approve"),
  adminCanWritePublicResolvedNotes:
    sourceIncludes("app/admin/private-beta-feedback/page.tsx", "publicReleaseNote") &&
    sourceIncludes("lib/private-beta/feedback.ts", "listPrivateBetaPublicUpdates"),
  testerHubRouteExists: existsSync(path.join(ROOT, "app", "private-beta", "page.tsx")),
  testerHubRequiresSession:
    sourceIncludes("app/private-beta/page.tsx", "getCurrentSessionUser") &&
    sourceIncludes("app/private-beta/page.tsx", "/auth?next=%2Fprivate-beta"),
  testerHubShowsOnlyPublicUpdates:
    sourceIncludes("app/private-beta/page.tsx", "listPrivateBetaPublicUpdates") &&
    !sourceIncludes("app/private-beta/page.tsx", "listPrivateBetaFeedback"),
  profileLinksToFeedback: sourceIncludes("app/profile/page.tsx", 'href="/feedback"'),
  profileLinksToBetaHub: sourceIncludes("app/profile/page.tsx", 'href="/private-beta"'),
  mainNavLinksToBetaHub: sourceIncludes("components/ui/main-nav.tsx", 'href="/private-beta"'),
  operationsLinksToReviewQueue: sourceIncludes("app/admin/operations/page.tsx", 'href="/admin/private-beta-feedback"'),
  noGeneratedPublicFeedbackQueue: !existsSync(path.join(GENERATED_DIR, "private-beta-feedback.json")),
};

const pass = Object.values(validation).every(Boolean);
const audit = {
  generatedAt: new Date().toISOString(),
  status: pass ? "passed" : "failed",
  storage: {
    privateQueuePath: "data/private/private-beta-feedback.json",
    generatedPublicQueueExists: existsSync(path.join(GENERATED_DIR, "private-beta-feedback.json")),
    gitIgnoredByDefault: true,
  },
  totals: {
    records: records.length,
    open: records.filter((record) => openStatuses.has(record.status ?? "")).length,
    publicUpdates: records.filter((record) => record.status === "resolved" && Boolean(record.publicReleaseNote)).length,
    needsFollowUp: records.filter((record) => record.needsFollowUp).length,
    containsPersonalData: records.filter((record) => record.containsPersonalData).length,
    byStatus: countBy(records, "status"),
    byCategory: countBy(records, "category"),
    bySeverity: countBy(records, "severity"),
  },
  validation,
  sensitiveValuesIncluded: false,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

console.log("Private beta feedback audit complete.");
console.log(
  JSON.stringify(
    {
      status: audit.status,
      records: audit.totals.records,
      open: audit.totals.open,
      needsFollowUp: audit.totals.needsFollowUp,
      output: OUTPUT_PATH,
    },
    null,
    2,
  ),
);

if (!pass) {
  process.exitCode = 1;
}
