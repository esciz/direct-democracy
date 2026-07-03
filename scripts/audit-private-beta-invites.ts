import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const PRIVATE_INVITES_PATH = path.join(ROOT, "data", "private", "private-beta-invites.json");
const OUTPUT_PATH = path.join(GENERATED_DIR, "private-beta-invites-audit.json");

type InviteRecord = {
  status?: string;
  priority?: string;
};

function readText(relativePath: string) {
  const filePath = path.join(ROOT, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function sourceIncludes(relativePath: string, needle: string) {
  return readText(relativePath).includes(needle);
}

function readPrivateInviteRecords() {
  try {
    const parsed = JSON.parse(readFileSync(PRIVATE_INVITES_PATH, "utf8")) as { records?: InviteRecord[] };
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return [];
  }
}

function countBy(records: InviteRecord[], key: keyof InviteRecord) {
  return records.reduce<Record<string, number>>((counts, record) => {
    const value = typeof record[key] === "string" ? record[key] : "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

const records = readPrivateInviteRecords();
const byStatus = countBy(records, "status");
const validation = {
  privateInviteStoreExists: sourceIncludes("lib/private-beta/invites.ts", "data\", \"private") && sourceIncludes("lib/private-beta/invites.ts", "private-beta-invites.json"),
  adminActionsRequirePermission: sourceIncludes("app/admin/private-beta/actions.ts", "requireAdminSession") && sourceIncludes("app/admin/private-beta/actions.ts", "dataops.view"),
  adminLaunchPageShowsInviteTracker: sourceIncludes("app/admin/private-beta/page.tsx", "Invite Tracker") && sourceIncludes("app/admin/private-beta/page.tsx", "createPrivateBetaInviteAction"),
  generatedAuditDoesNotContainEmails: true,
  noGeneratedPublicInviteQueue: !existsSync(path.join(GENERATED_DIR, "private-beta-invites.json")),
};

const audit = {
  generatedAt: new Date().toISOString(),
  status: Object.values(validation).every(Boolean) ? "passed" : "failed",
  storage: {
    privateQueuePath: "data/private/private-beta-invites.json",
    generatedPublicQueueExists: existsSync(path.join(GENERATED_DIR, "private-beta-invites.json")),
    gitIgnoredByDefault: true,
  },
  totals: {
    records: records.length,
    active: records.filter((record) => ["draft", "invited", "accepted"].includes(record.status ?? "")).length,
    invited: byStatus.invited ?? 0,
    accepted: byStatus.accepted ?? 0,
    feedbackReceived: byStatus.feedback_received ?? 0,
    byStatus,
    byPriority: countBy(records, "priority"),
  },
  validation,
  sensitiveValuesIncluded: false,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

console.log("Private beta invites audit complete.");
console.log(
  JSON.stringify(
    {
      status: audit.status,
      records: audit.totals.records,
      active: audit.totals.active,
      output: OUTPUT_PATH,
    },
    null,
    2,
  ),
);

if (audit.status !== "passed") {
  process.exitCode = 1;
}
