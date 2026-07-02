import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "private-beta-readiness-report.json");

type GateStatus = "green" | "yellow" | "red";

function readText(relativePath: string) {
  const filePath = path.join(ROOT, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function status(ok: boolean, warning = false): GateStatus {
  if (ok) return "green";
  if (warning) return "yellow";
  return "red";
}

function sourceIncludes(relativePath: string, needle: string) {
  return readText(relativePath).includes(needle);
}

function sourceMatches(relativePath: string, pattern: RegExp) {
  return pattern.test(readText(relativePath));
}

const demoModeValue = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE ?? process.env.ENABLE_DEMO_MODE ?? "";
const browseAudit = readJson<{
  totals?: {
    categories?: number;
    populatedCategories?: number;
    sourceBackedCategories?: number;
    demoBackedCategories?: number;
    failures?: number;
  };
  failures?: unknown[];
}>("browse-preview-audit.json", {});
const eventFreshness = readJson<{
  sourceGeneratedAt?: string | null;
  sourceAgeHours?: number | null;
  totals?: {
    records?: number;
    sourceBacked?: number;
    upcoming?: number;
    completed?: number;
    unknownDate?: number;
    staleStatusRecords?: number;
  };
}>("event-freshness-audit.json", {});
const communityReport = readJson<{
  totals?: {
    communityPagesReady?: number;
    communitiesWithUsefulDashboardData?: number;
    dashboardItemsMissingDestinations?: number;
    communitiesWithStaleDashboardData?: number;
  };
}>("nevada-community-coverage-report.json", {});
const authAudit = readJson<{ pass?: boolean; validation?: Record<string, boolean> }>("auth-session-boundary-audit.json", {});
const accountUxAudit = readJson<{ pass?: boolean; validation?: Record<string, boolean> }>("account-verification-ux-audit.json", {});
const guidedVoterAudit = readJson<{ pass?: boolean; validation?: Record<string, boolean> }>("guided-voter-verification-audit.json", {});
const feedbackAudit = readJson<{
  status?: string;
  totals?: { records?: number; open?: number; needsFollowUp?: number; containsPersonalData?: number };
  validation?: Record<string, boolean>;
}>("private-beta-feedback-audit.json", {});

const routeFiles = [
  "app/auth/page.tsx",
  "app/profile/page.tsx",
  "app/voting/page.tsx",
  "app/explore/page.tsx",
  "app/my-community/page.tsx",
  "app/account/verification/page.tsx",
  "app/admin/identity/page.tsx",
  "app/admin/operations/page.tsx",
];

const noIndexSignals = {
  metadataRobotsNoIndex:
    sourceIncludes("app/layout.tsx", "robots:") &&
    sourceIncludes("app/layout.tsx", "index: false") &&
    sourceIncludes("app/layout.tsx", "follow: false"),
  robotsTxtDisallowsAll:
    sourceIncludes("app/robots.ts", "MetadataRoute.Robots") &&
    sourceMatches("app/robots.ts", /userAgent:\s*["']\*["']/) &&
    sourceMatches("app/robots.ts", /disallow:\s*["']\/["']/),
  xRobotsHeader:
    sourceIncludes("next.config.ts", "X-Robots-Tag") &&
    sourceIncludes("next.config.ts", "noindex, nofollow"),
};

const authProtectionSignals = {
  productionGateEnabled:
    sourceIncludes("proxy.ts", "!DEV_ONLY_AUTH_ENABLED") &&
    sourceIncludes("proxy.ts", 'authUrl.searchParams.set("next"'),
  seededDemoSessionsExpired:
    sourceIncludes("proxy.ts", "isSeededDemoSessionId") &&
    sourceIncludes("proxy.ts", "expireSessionCookie(response)"),
  demoModeExplicitOptIn:
    sourceIncludes("lib/auth/constants.ts", 'DEV_ONLY_AUTH_ENABLED = demoModeEnv === "true"') &&
    sourceIncludes("app/auth/page.tsx", "demoEnabled={DEV_ONLY_AUTH_ENABLED}"),
  signOutPostAction:
    sourceIncludes("components/ui/main-nav.tsx", "signOutCurrentUser") &&
    sourceIncludes("app/profile/page.tsx", "signOutCurrentUser") &&
    !sourceIncludes("components/ui/main-nav.tsx", 'href="/auth/sign-out"') &&
    !sourceIncludes("app/profile/page.tsx", 'href="/auth/sign-out"'),
};

const usableProductSignals = {
  keyRoutesPresent: routeFiles.every((relativePath) => existsSync(path.join(ROOT, relativePath))),
  browseAuditPassed: asNumber(browseAudit.totals?.failures) === 0 && (browseAudit.failures?.length ?? 0) === 0,
  noBrowseDemoData: asNumber(browseAudit.totals?.demoBackedCategories) === 0,
  communityPagesReady: asNumber(communityReport.totals?.communityPagesReady) >= 39,
  communityDashboardsUseful: asNumber(communityReport.totals?.communitiesWithUsefulDashboardData) >= 39,
  noMissingDashboardDestinations: asNumber(communityReport.totals?.dashboardItemsMissingDestinations) === 0,
};

const freshnessSignals = {
  eventArtifactExists: asNumber(eventFreshness.totals?.records) > 0,
  eventSourcesAvailable: asNumber(eventFreshness.totals?.sourceBacked) > 0,
  noStaleEventStatuses: asNumber(eventFreshness.totals?.staleStatusRecords) === 0,
  eventArtifactFreshEnoughForPrivateBeta:
    typeof eventFreshness.sourceAgeHours === "number" ? eventFreshness.sourceAgeHours <= 72 : false,
  noStaleCommunityDashboardData: asNumber(communityReport.totals?.communitiesWithStaleDashboardData) === 0,
};

const verificationSignals = {
  authSessionAuditPassed: authAudit.pass === true,
  accountVerificationUxAuditPassed: accountUxAudit.pass === true,
  guidedVoterAuditPassed: guidedVoterAudit.pass === true,
};
const feedbackSignals = {
  feedbackAuditPassed: feedbackAudit.status === "passed",
  feedbackRouteAvailable: feedbackAudit.validation?.publicFeedbackRouteExists === true,
  feedbackRequiresSession: feedbackAudit.validation?.publicFeedbackActionRequiresSession === true,
  feedbackStoredPrivately: feedbackAudit.validation?.feedbackStoreIsPrivate === true,
  adminReviewAvailable: feedbackAudit.validation?.adminReviewRouteExists === true,
  feedbackDiscoverableFromProfile: feedbackAudit.validation?.profileLinksToFeedback === true,
  feedbackDiscoverableFromNav: feedbackAudit.validation?.mainNavLinksToFeedback === true,
};

const noIndexReady = Object.values(noIndexSignals).every(Boolean);
const authReady = Object.values(authProtectionSignals).every(Boolean) && demoModeValue !== "true";
const productReady = Object.values(usableProductSignals).every(Boolean);
const freshnessReady =
  freshnessSignals.eventArtifactExists &&
  freshnessSignals.eventSourcesAvailable &&
  freshnessSignals.noStaleEventStatuses &&
  freshnessSignals.noStaleCommunityDashboardData;
const freshnessWarning = !freshnessSignals.eventArtifactFreshEnoughForPrivateBeta;
const verificationReady = verificationSignals.authSessionAuditPassed && verificationSignals.accountVerificationUxAuditPassed;
const guidedVoterWarning = !verificationSignals.guidedVoterAuditPassed;
const feedbackReady = Object.values(feedbackSignals).every(Boolean);

const gates = {
  privateByLink: {
    status: status(noIndexReady),
    ...noIndexSignals,
  },
  authenticatedAccess: {
    status: status(authReady),
    demoModeValue: demoModeValue || "unset",
    ...authProtectionSignals,
  },
  productSurfaces: {
    status: status(productReady),
    routeFiles,
    browse: browseAudit.totals ?? {},
    community: communityReport.totals ?? {},
    ...usableProductSignals,
  },
  civicDataFreshness: {
    status: status(freshnessReady && !freshnessWarning, freshnessReady),
    sourceGeneratedAt: eventFreshness.sourceGeneratedAt ?? null,
    sourceAgeHours: eventFreshness.sourceAgeHours ?? null,
    eventTotals: eventFreshness.totals ?? {},
    ...freshnessSignals,
  },
  verificationUx: {
    status: status(verificationReady && !guidedVoterWarning, verificationReady),
    ...verificationSignals,
  },
  testerFeedbackLoop: {
    status: status(feedbackReady),
    totals: feedbackAudit.totals ?? {},
    ...feedbackSignals,
  },
};

const blockers = Object.entries(gates)
  .filter(([, gate]) => gate.status === "red")
  .map(([name]) => name);
const warnings = Object.entries(gates)
  .filter(([, gate]) => gate.status === "yellow")
  .map(([name]) => name);

if (guidedVoterWarning && !warnings.includes("guided-voter-audit")) {
  warnings.push("guided-voter-audit");
}
if (freshnessWarning && !warnings.includes("event-artifact-age")) {
  warnings.push("event-artifact-age");
}

const report = {
  generatedAt: new Date().toISOString(),
  sprint: "Private Beta Readiness",
  status: blockers.length ? "blocked" : warnings.length ? "ready_with_warnings" : "ready_for_private_link_sharing",
  recommendation: blockers.length
    ? "Do not share wider yet. Clear red gates, rerun private-beta:readiness, then verify the deployed auth flow."
    : warnings.length
      ? "Private link sharing is acceptable for trusted testers after owner review of warnings."
      : "Ready to share privately with invited testers. Keep no-index enabled until public launch.",
  gates,
  totals: {
    blockers: blockers.length,
    warnings: warnings.length,
    browseCategories: browseAudit.totals?.categories ?? null,
    sourceBackedBrowseCategories: browseAudit.totals?.sourceBackedCategories ?? null,
    eventRecords: eventFreshness.totals?.records ?? null,
    staleEventStatuses: eventFreshness.totals?.staleStatusRecords ?? null,
    communityPagesReady: communityReport.totals?.communityPagesReady ?? null,
    privateBetaFeedbackRecords: feedbackAudit.totals?.records ?? null,
    privateBetaFeedbackOpen: feedbackAudit.totals?.open ?? null,
  },
  blockers,
  warnings,
  requiredValidation: [
    "npm run events:freshness-audit",
    "npm run browse:audit",
    "npm run communities:report",
    "npm run auth:session-audit",
    "npm run verification:account-ux-audit",
    "npm run verification:guided-voter-audit",
    "npm run private-beta:feedback-audit",
    "npm run private-beta:readiness",
    "npm run typecheck",
    "npm run build",
  ],
  sensitiveValuesIncluded: false,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log("Private beta readiness audit complete.");
console.log(
  JSON.stringify(
    {
      status: report.status,
      blockers,
      warnings,
      noIndexReady,
      authReady,
      productReady,
      freshnessReady,
      verificationReady,
      feedbackReady,
      output: OUTPUT_PATH,
    },
    null,
    2,
  ),
);

if (blockers.length) {
  process.exitCode = 1;
}
