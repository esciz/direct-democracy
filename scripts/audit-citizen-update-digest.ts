import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "citizen-update-digest-audit.json");

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function contains(filePath: string, needle: string) {
  try {
    return fs.readFileSync(filePath, "utf8").includes(needle);
  } catch {
    return false;
  }
}

const votingCards = readJson<{ records?: unknown[] }>(path.join(GENERATED_DIR, "voting-cards.json"), { records: [] });
const projects = readJson<{ records?: unknown[] }>(path.join(GENERATED_DIR, "projects-runtime.json"), { records: [] });
const actionLoopAudit = readJson<{ totals?: { sourceBackedDecisionsAvailable?: number; sourceBackedProjectsAvailable?: number; concernEntryPoints?: number } }>(
  path.join(GENERATED_DIR, "citizen-action-loop-audit.json"),
  { totals: {} },
);

const files = {
  updates: path.join(ROOT, "lib", "citizen-actions", "updates.ts"),
  notifications: path.join(ROOT, "lib", "notifications", "store.ts"),
  notificationList: path.join(ROOT, "components", "ui", "notification-list.tsx"),
  profileUpdates: path.join(ROOT, "app", "profile", "updates", "page.tsx"),
  profile: path.join(ROOT, "app", "profile", "page.tsx"),
  types: path.join(ROOT, "types", "domain.ts"),
};

const checks = {
  digestModuleExists: fs.existsSync(files.updates),
  profileUpdatesRouteExists: fs.existsSync(files.profileUpdates),
  profileLinksToUpdates: contains(files.profile, "/profile/updates"),
  notificationTypeRegistered: contains(files.types, "\"watchlistUpdate\""),
  notificationsComputed: contains(files.notifications, "getComputedWatchlistUpdateNotifications"),
  notificationReadTracking: contains(files.notifications, "WATCHLIST_UPDATE_NOTIFICATION_READS_COOKIE"),
  notificationRoutesToDigest: contains(files.notificationList, "profile/updates"),
  updateRecordsHaveDestinations: contains(files.updates, "href: item.href"),
  updateRecordsHaveSourceLabels: contains(files.updates, "sourceLabel:"),
};

const failures = Object.entries(checks)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const sourceBackedDecisionsAvailable = actionLoopAudit.totals?.sourceBackedDecisionsAvailable ?? votingCards.records?.length ?? 0;
const sourceBackedProjectsAvailable = actionLoopAudit.totals?.sourceBackedProjectsAvailable ?? projects.records?.length ?? 0;

const audit = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? "failed" : "passed",
  totals: {
    sourceBackedDecisionsAvailable,
    sourceBackedProjectsAvailable,
    concernEntryPoints: actionLoopAudit.totals?.concernEntryPoints ?? 0,
    missingDestinationChecks: checks.updateRecordsHaveDestinations ? 0 : 1,
    notificationPathsConfigured: checks.notificationsComputed && checks.notificationRoutesToDigest,
  },
  checks,
  failures,
};

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log("Citizen update digest audit complete.");
console.log(JSON.stringify({ status: audit.status, ...audit.totals, failures: failures.length }, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
