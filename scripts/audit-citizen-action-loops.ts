import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "citizen-action-loop-audit.json");

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function fileContains(filePath: string, needle: string) {
  try {
    return fs.readFileSync(filePath, "utf8").includes(needle);
  } catch {
    return false;
  }
}

const votingCards = readJson<{ records?: unknown[] }>(path.join(GENERATED_DIR, "voting-cards.json"), { records: [] });
const projects = readJson<{ records?: unknown[] }>(path.join(GENERATED_DIR, "projects-runtime.json"), { records: [] });
const residentQueue = readJson<{ records?: Array<{ publicationStatus?: string; review?: { status?: string } }> }>(
  path.join(ROOT, "data", "private", "resident-story-intake-review-queue.json"),
  { records: [] },
);

const files = {
  favoriteTypes: path.join(ROOT, "lib", "favorites", "types.ts"),
  decisionPage: path.join(ROOT, "app", "decisions", "[decisionId]", "page.tsx"),
  projectPage: path.join(ROOT, "app", "projects", "[projectId]", "page.tsx"),
  communityPage: path.join(ROOT, "app", "community", "[communitySlug]", "page.tsx"),
  profilePage: path.join(ROOT, "app", "profile", "page.tsx"),
  myCommunityPage: path.join(ROOT, "app", "my-community", "page.tsx"),
  adminOperationsPage: path.join(ROOT, "app", "admin", "operations", "page.tsx"),
};

const checks = {
  decisionFavoriteTypeRegistered: fileContains(files.favoriteTypes, "\"decision\""),
  projectFavoriteTypeRegistered: fileContains(files.favoriteTypes, "\"project\""),
  decisionFollowControl: fileContains(files.decisionPage, "targetType=\"decision\""),
  projectFollowControl: fileContains(files.projectPage, "targetType=\"project\""),
  communityFollowControl: fileContains(files.communityPage, "targetType=\"community\""),
  concernEntryPoints: [
    files.communityPage,
    files.decisionPage,
    files.projectPage,
  ].filter((filePath) => fileContains(filePath, "/cases/submit")).length,
  profileWatchlistVisible: fileContains(files.profilePage, "Your civic watchlist"),
  myCommunityResolvesDecisions: fileContains(files.myCommunityPage, "case \"decision\""),
  myCommunityResolvesProjects: fileContains(files.myCommunityPage, "case \"project\""),
  adminPanelVisible: fileContains(files.adminOperationsPage, "Citizen action loops"),
};

const pendingResidentConcerns = (residentQueue.records ?? []).filter((record) =>
  record.publicationStatus === "private_pending_review" || record.review?.status === "pending_review",
).length;

const failures = Object.entries(checks)
  .filter(([, value]) => typeof value === "boolean" ? !value : value === 0)
  .map(([key]) => key);

const audit = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? "failed" : "passed",
  totals: {
    sourceBackedDecisionsAvailable: votingCards.records?.length ?? 0,
    sourceBackedProjectsAvailable: projects.records?.length ?? 0,
    pendingResidentConcerns,
    concernEntryPoints: checks.concernEntryPoints,
  },
  checks,
  failures,
};

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log("Citizen action loop audit complete.");
console.log(JSON.stringify({ status: audit.status, ...audit.totals, failures: failures.length }, null, 2));

if (failures.length) {
  process.exitCode = 1;
}
