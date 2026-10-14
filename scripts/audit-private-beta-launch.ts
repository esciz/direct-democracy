import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "private-beta-launch-control.json");

type ReadinessReport = {
  status?: string;
  blockers?: string[];
  warnings?: string[];
  gates?: Record<string, { status?: string }>;
  totals?: Record<string, unknown>;
};

type FeedbackAudit = {
  status?: string;
  totals?: Record<string, unknown>;
  validation?: Record<string, boolean>;
};

function readText(relativePath: string) {
  const filePath = path.join(ROOT, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function readGenerated<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function sourceIncludes(relativePath: string, needle: string) {
  return readText(relativePath).includes(needle);
}

function sourceMatches(relativePath: string, pattern: RegExp) {
  return pattern.test(readText(relativePath));
}

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.hostname === "localhost" ? trimmed : null;
  } catch {
    return null;
  }
}

const readiness = readGenerated<ReadinessReport>("private-beta-readiness-report.json", {});
const boundary = readGenerated<FeedbackAudit>("nevada-beta-boundary-audit.json", {});
const feedback = readGenerated<FeedbackAudit>("private-beta-feedback-audit.json", {});
const invites = readGenerated<FeedbackAudit>("private-beta-invites-audit.json", {});
const appUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
const host = appUrl ? new URL(appUrl).hostname : null;
const localHost = host === "localhost" || host === "127.0.0.1" || host?.endsWith(".localhost");
const vercelHost = host?.endsWith(".vercel.app") ?? false;

const validation = {
  readinessReportReady: readiness.status === "ready_for_private_link_sharing" || readiness.status === "ready_with_warnings",
  readinessHasNoBlockers: (readiness.blockers ?? []).length === 0,
  nevadaBoundaryAuditPassed: boundary.status === "passed",
  feedbackAuditPassed: feedback.status === "passed",
  invitesAuditPassed: invites.status === "passed",
  privateBetaRouteExists: existsSync(path.join(ROOT, "app", "private-beta", "page.tsx")),
  feedbackRouteExists: existsSync(path.join(ROOT, "app", "feedback", "page.tsx")),
  adminFeedbackRouteExists: existsSync(path.join(ROOT, "app", "admin", "private-beta-feedback", "page.tsx")),
  adminLaunchRouteExists: existsSync(path.join(ROOT, "app", "admin", "private-beta", "page.tsx")),
  testerHubRequiresAuth:
    sourceIncludes("app/private-beta/page.tsx", "getCurrentSessionUser") &&
    sourceIncludes("app/private-beta/page.tsx", "/auth?next=%2Fprivate-beta"),
  metadataNoIndex:
    sourceIncludes("app/layout.tsx", "robots:") &&
    sourceIncludes("app/layout.tsx", "index: false") &&
    sourceIncludes("app/layout.tsx", "follow: false"),
  robotsTxtDisallowsAll:
    sourceIncludes("app/robots.ts", "MetadataRoute.Robots") &&
    sourceMatches("app/robots.ts", /disallow:\s*["']\/["']/),
  xRobotsHeader:
    sourceIncludes("next.config.ts", "X-Robots-Tag") &&
    sourceIncludes("next.config.ts", "noindex, nofollow"),
  productionGateBlocksUnauthed:
    sourceIncludes("proxy.ts", "!DEV_ONLY_AUTH_ENABLED") &&
    sourceIncludes("proxy.ts", "/auth") &&
    sourceIncludes("proxy.ts", 'authUrl.searchParams.set("next"'),
  demoModeNotEnabled: (process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE ?? process.env.ENABLE_DEMO_MODE ?? "") !== "true",
  appUrlConfigured: Boolean(appUrl),
  appUrlUsesHttps: Boolean(appUrl && (appUrl.startsWith("https://") || localHost)),
  customDomainConfigured: Boolean(host && !localHost && !vercelHost),
};

const blockers = Object.entries({
  readinessReportReady: validation.readinessReportReady,
  readinessHasNoBlockers: validation.readinessHasNoBlockers,
  nevadaBoundaryAuditPassed: validation.nevadaBoundaryAuditPassed,
  feedbackAuditPassed: validation.feedbackAuditPassed,
  invitesAuditPassed: validation.invitesAuditPassed,
  privateBetaRouteExists: validation.privateBetaRouteExists,
  feedbackRouteExists: validation.feedbackRouteExists,
  adminFeedbackRouteExists: validation.adminFeedbackRouteExists,
  adminLaunchRouteExists: validation.adminLaunchRouteExists,
  testerHubRequiresAuth: validation.testerHubRequiresAuth,
  metadataNoIndex: validation.metadataNoIndex,
  robotsTxtDisallowsAll: validation.robotsTxtDisallowsAll,
  xRobotsHeader: validation.xRobotsHeader,
  productionGateBlocksUnauthed: validation.productionGateBlocksUnauthed,
  demoModeNotEnabled: validation.demoModeNotEnabled,
}).flatMap(([name, ok]) => (ok ? [] : [name]));

const warnings = Object.entries({
  appUrlConfigured: validation.appUrlConfigured,
  appUrlUsesHttps: validation.appUrlUsesHttps,
  customDomainConfigured: validation.customDomainConfigured,
}).flatMap(([name, ok]) => (ok ? [] : [name]));

const report = {
  generatedAt: new Date().toISOString(),
  status: blockers.length ? "blocked" : warnings.length ? "ready_with_warnings" : "ready_to_share_privately",
  recommendation: blockers.length
    ? "Do not invite testers yet. Fix launch-control blockers and rerun npm run private-beta:launch-audit."
    : warnings.length
      ? "Private tester sharing is allowed, but review warnings before sending beyond a tiny trusted group."
      : "Ready for private invite sharing. Keep no-index and auth gating enabled.",
  app: {
    baseUrl: appUrl,
    host,
    inviteUrl: appUrl,
    privateBetaUrl: appUrl ? `${appUrl}/private-beta` : null,
    authUrl: appUrl ? `${appUrl}/auth` : null,
    adminLaunchControlUrl: appUrl ? `${appUrl}/admin/private-beta` : null,
  },
  validation,
  blockers,
  warnings,
  readiness: {
    status: readiness.status ?? "missing",
    blockers: readiness.blockers ?? [],
    warnings: readiness.warnings ?? [],
    totals: readiness.totals ?? {},
  },
  boundary: {
    status: boundary.status ?? "missing",
    validation: boundary.validation ?? {},
  },
  feedback: {
    status: feedback.status ?? "missing",
    totals: feedback.totals ?? {},
  },
  invites: {
    status: invites.status ?? "missing",
    totals: invites.totals ?? {},
  },
  inviteChecklist: [
    "Push the latest commits to origin.",
    "Wait for Vercel production deploy to finish.",
    "Open the main invite URL in an incognito window.",
    "Confirm logged-out visitors land on /auth.",
    "Sign in as a real tester account.",
    "Optionally open /private-beta for the tester guide.",
    "Submit one feedback report.",
    "Confirm the report appears in /admin/private-beta-feedback.",
  ],
  sensitiveValuesIncluded: false,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log("Private beta launch audit complete.");
console.log(
  JSON.stringify(
    {
      status: report.status,
      blockers,
      warnings,
      inviteUrl: report.app.inviteUrl,
      optionalTesterGuideUrl: report.app.privateBetaUrl,
      output: OUTPUT_PATH,
    },
    null,
    2,
  ),
);

if (blockers.length) {
  process.exitCode = 1;
}
