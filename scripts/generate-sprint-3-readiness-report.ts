import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "sprint-3-readiness-report.json");

type AuditStatus = "green" | "yellow" | "red";

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function fileContains(relativePath: string, needle: string) {
  const filePath = path.join(ROOT, relativePath);
  return existsSync(filePath) && readFileSync(filePath, "utf8").includes(needle);
}

function gateStatus(passed: boolean, warning = false): AuditStatus {
  if (passed) return "green";
  if (warning) return "yellow";
  return "red";
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const citizenActionAudit = readJson<{ status?: string; totals?: Record<string, unknown>; failures?: string[] }>("citizen-action-loop-audit.json", {});
const citizenUpdateAudit = readJson<{ status?: string; totals?: Record<string, unknown>; failures?: string[] }>("citizen-update-digest-audit.json", {});
const residentIntakeAudit = readJson<{ totals?: Record<string, unknown>; errors?: string[]; privacyBoundary?: Record<string, unknown> }>("resident-intake-shape-audit.json", {});
const residentRoutingAudit = readJson<{ totals?: Record<string, unknown>; failures?: string[] }>("resident-question-routing-audit.json", {});
const residentAnswersAudit = readJson<{ totals?: Record<string, unknown>; checks?: Record<string, boolean>; errors?: string[]; privacyBoundary?: Record<string, unknown> }>(
  "resident-question-answers-audit.json",
  {},
);
const residentLifecycleAudit = readJson<{ status?: string; totals?: Record<string, unknown>; privacyBoundary?: Record<string, unknown>; errors?: string[] }>(
  "resident-request-lifecycle-audit.json",
  {},
);
const accountReadinessAudit = readJson<{ status?: string; totals?: Record<string, unknown>; failures?: string[] }>("account-participation-readiness-audit.json", {});
const participationReadinessAudit = readJson<{ status?: string; totals?: Record<string, unknown>; failures?: string[] }>("participation-readiness-audit.json", {});

const actionFailures = citizenActionAudit.failures ?? [];
const updateFailures = citizenUpdateAudit.failures ?? [];
const intakeErrors = residentIntakeAudit.errors ?? [];
const routingFailures = residentRoutingAudit.failures ?? [];
const answerErrors = residentAnswersAudit.errors ?? [];
const lifecycleErrors = residentLifecycleAudit.errors ?? [];
const accountFailures = accountReadinessAudit.failures ?? [];
const participationFailures = participationReadinessAudit.failures ?? [];

const citizenLoopReady =
  citizenActionAudit.status === "passed" &&
  citizenUpdateAudit.status === "passed" &&
  numeric(citizenActionAudit.totals?.concernEntryPoints) >= 3 &&
  Boolean(citizenUpdateAudit.totals?.notificationPathsConfigured);

const residentRequestReady =
  numeric(residentIntakeAudit.totals?.validFixtures) >= 1 &&
  numeric(residentIntakeAudit.totals?.publicAnswersGeneratedOnlyAfterReview) >= 1 &&
  residentLifecycleAudit.status === "passed" &&
  numeric(residentLifecycleAudit.totals?.publishedAnswers) >= 1;

const privacyReady =
  residentIntakeAudit.privacyBoundary?.rawStoryPrivateByDefault === true &&
  residentIntakeAudit.privacyBoundary?.privateStatusOwnedBySubmitter === true &&
  residentAnswersAudit.privacyBoundary?.rawStoryPublic === false &&
  residentAnswersAudit.privacyBoundary?.internalRoutingNotesPublic === false &&
  residentLifecycleAudit.privacyBoundary?.rawStoryPublic === false &&
  residentLifecycleAudit.privacyBoundary?.privateReviewerNotesPublic === false &&
  residentLifecycleAudit.privacyBoundary?.publicAnswerContainsPrivateNeedles === false &&
  residentLifecycleAudit.privacyBoundary?.publicStorySummaryContainsPrivateNeedles === false;

const citizenStatusReady =
  fileContains("app/cases/submit/page.tsx", "Track status in your profile") &&
  fileContains("app/profile/updates/page.tsx", "My Civic Requests") &&
  fileContains("lib/cases/resident-intake-store.ts", "getResidentRequestStatusesForUser");

const adminReviewReady =
  fileContains("app/admin/cases/resident-intake/page.tsx", "Answer review workbench") &&
  fileContains("app/admin/cases/resident-intake/page.tsx", "ready-to-publish") &&
  fileContains("app/admin/cases/resident-intake/page.tsx", "Checklist complete");

const contextualAnswerReady =
  residentAnswersAudit.checks?.decisionsShowContextualAnswers === true &&
  residentAnswersAudit.checks?.projectsShowContextualAnswers === true &&
  residentAnswersAudit.checks?.communitiesShowContextualAnswers === true &&
  residentAnswersAudit.checks?.publicAnswersRouteExists === true;

const accountParticipationReady =
  (accountReadinessAudit.status === "passed" || Object.keys(accountReadinessAudit).length === 0) &&
  (participationReadinessAudit.status === "passed" || Object.keys(participationReadinessAudit).length === 0);

const blockers = [
  ...actionFailures.map((failure) => `citizen-action-loop:${failure}`),
  ...updateFailures.map((failure) => `citizen-update-digest:${failure}`),
  ...intakeErrors.map((error) => `resident-intake:${error}`),
  ...routingFailures.map((failure) => `resident-routing:${failure}`),
  ...answerErrors.map((error) => `resident-answers:${error}`),
  ...lifecycleErrors.map((error) => `resident-lifecycle:${error}`),
  ...accountFailures.map((failure) => `account-readiness:${failure}`),
  ...participationFailures.map((failure) => `participation-readiness:${failure}`),
];

if (!citizenLoopReady) blockers.push("citizen action/watchlist loop is not fully ready");
if (!residentRequestReady) blockers.push("resident request lifecycle is not fully proven");
if (!privacyReady) blockers.push("resident request privacy boundary is not fully proven");
if (!citizenStatusReady) blockers.push("citizen private request status surface is missing");
if (!adminReviewReady) blockers.push("admin answer review workbench is missing");
if (!contextualAnswerReady) blockers.push("reviewed answers are not surfaced across all contextual pages");

const warningItems = [
  "Resident request storage is still local JSON-backed; production launch needs durable private storage policy.",
  "Public answer count may be zero until real reviewed answers are published by an admin.",
  "Voter/resident verification remains a practical review workflow without a live Nevada SOS API partnership.",
  "Sprint 2 data-quality backlog continues for Nevada officials, meeting extraction, OCR, and vote review.",
];

const gates = {
  citizenActionLoop: {
    status: gateStatus(citizenLoopReady, actionFailures.length === 0 || updateFailures.length === 0),
    actionAuditStatus: citizenActionAudit.status ?? "unknown",
    updateAuditStatus: citizenUpdateAudit.status ?? "unknown",
    concernEntryPoints: citizenActionAudit.totals?.concernEntryPoints ?? 0,
    notificationPathsConfigured: citizenUpdateAudit.totals?.notificationPathsConfigured ?? false,
  },
  residentRequestLifecycle: {
    status: gateStatus(residentRequestReady, false),
    submittedRequests: residentLifecycleAudit.totals?.submittedRequests ?? 0,
    routedRequests: residentLifecycleAudit.totals?.routedRequests ?? 0,
    publishedAnswers: residentLifecycleAudit.totals?.publishedAnswers ?? 0,
    privateStatusRecords: residentLifecycleAudit.totals?.privateStatusRecords ?? 0,
  },
  privacyBoundary: {
    status: gateStatus(privacyReady, false),
    rawStoryPrivateByDefault: residentIntakeAudit.privacyBoundary?.rawStoryPrivateByDefault ?? false,
    privateStatusOwnedBySubmitter: residentIntakeAudit.privacyBoundary?.privateStatusOwnedBySubmitter ?? false,
    rawStoryPublic: residentLifecycleAudit.privacyBoundary?.rawStoryPublic ?? null,
    privateReviewerNotesPublic: residentLifecycleAudit.privacyBoundary?.privateReviewerNotesPublic ?? null,
    publicAnswerContainsPrivateNeedles: residentLifecycleAudit.privacyBoundary?.publicAnswerContainsPrivateNeedles ?? null,
  },
  citizenStatusExperience: {
    status: gateStatus(citizenStatusReady, false),
    confirmationLinksToProfileStatus: fileContains("app/cases/submit/page.tsx", "Track status in your profile"),
    profileStatusSurface: fileContains("app/profile/updates/page.tsx", "My Civic Requests"),
    privateStatusHelper: fileContains("lib/cases/resident-intake-store.ts", "getResidentRequestStatusesForUser"),
  },
  adminReviewExperience: {
    status: gateStatus(adminReviewReady, false),
    answerWorkbench: fileContains("app/admin/cases/resident-intake/page.tsx", "Answer review workbench"),
    readyToPublishFilter: fileContains("app/admin/cases/resident-intake/page.tsx", "ready-to-publish"),
    readinessChecklist: fileContains("app/admin/cases/resident-intake/page.tsx", "Checklist complete"),
  },
  contextualPublicAnswers: {
    status: gateStatus(contextualAnswerReady, false),
    answersRoute: residentAnswersAudit.checks?.publicAnswersRouteExists ?? false,
    decisions: residentAnswersAudit.checks?.decisionsShowContextualAnswers ?? false,
    projects: residentAnswersAudit.checks?.projectsShowContextualAnswers ?? false,
    communities: residentAnswersAudit.checks?.communitiesShowContextualAnswers ?? false,
  },
  accountParticipation: {
    status: gateStatus(accountParticipationReady, true),
    accountAuditStatus: accountReadinessAudit.status ?? "not_run_in_closeout",
    participationAuditStatus: participationReadinessAudit.status ?? "not_run_in_closeout",
  },
};

const allGreen = Object.values(gates).every((gate) => gate.status === "green");
const report = {
  generatedAt: new Date().toISOString(),
  sprint: "Sprint 3",
  status: allGreen && blockers.length === 0 ? "ready_for_sprint_4" : blockers.length ? "blocked" : "ready_with_warnings",
  recommendation:
    blockers.length
      ? "Do not close Sprint 3 until blockers are cleared."
      : allGreen
      ? "Sprint 3 can close. Move to Sprint 4 launch readiness and production QA."
      : "Sprint 3 can close with warnings. Move to Sprint 4 launch readiness and production QA, and carry the listed warnings into launch hardening.",
  gates,
  totals: {
    blockers: blockers.length,
    warnings: warningItems.length,
    concernEntryPoints: citizenActionAudit.totals?.concernEntryPoints ?? 0,
    sourceBackedDecisionsAvailable: citizenActionAudit.totals?.sourceBackedDecisionsAvailable ?? 0,
    sourceBackedProjectsAvailable: citizenActionAudit.totals?.sourceBackedProjectsAvailable ?? 0,
    residentLifecyclePublishedAnswers: residentLifecycleAudit.totals?.publishedAnswers ?? 0,
    citizenPrivateStatusSurfaces: residentAnswersAudit.totals?.citizenPrivateStatusSurfaces ?? 0,
  },
  blockers,
  warnings: warningItems,
  requiredValidation: [
    "npm run citizen-actions:audit",
    "npm run citizen-updates:audit",
    "npm run resident-request:lifecycle-audit",
    "npm run resident-intake:validate",
    "npm run resident-questions:audit",
    "npm run resident-answers:audit",
    "npm run typecheck",
    "npm run build",
  ],
  nextSprint: {
    id: "Sprint 4",
    title: "Launch Readiness & Production QA",
    focus: [
      "production environment parity",
      "custom domain readiness when DNS is ready",
      "guest/resident/voter/admin QA scripts",
      "real reviewed answer seeding",
      "durable private resident request storage",
    ],
  },
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Generated Sprint 3 readiness report at ${OUTPUT_PATH}`);
console.log(JSON.stringify({ status: report.status, blockers: blockers.length, warnings: warningItems.length, gates: Object.fromEntries(Object.entries(gates).map(([key, value]) => [key, value.status])) }, null, 2));

if (report.status === "blocked") {
  process.exitCode = 1;
}
