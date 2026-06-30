import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import dns from "node:dns/promises";
import path from "node:path";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "sprint-4-launch-readiness-report.json");
const PUBLIC_DOMAIN = process.env.DIRECT_DEMOCRACY_PUBLIC_DOMAIN || "directyourdemocracy.com";
const PRODUCTION_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.DIRECT_DEMOCRACY_PUBLIC_URL || `https://${PUBLIC_DOMAIN}`;
const demoModeValue = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE ?? process.env.ENABLE_DEMO_MODE ?? "";

type GateStatus = "green" | "yellow" | "red";

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

function configured(name: string) {
  const value = process.env[name];
  return Boolean(value && value.trim() && !/replace-with|placeholder|paste_[a-z0-9_]*_here/i.test(value));
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function status(ok: boolean, warning = false): GateStatus {
  if (ok) return "green";
  if (warning) return "yellow";
  return "red";
}

function missingEnv(names: string[]) {
  return names.filter((name) => !configured(name));
}

async function dnsStatus(domain: string) {
  try {
    const [a, cname, mx, txt] = await Promise.allSettled([
      dns.resolve4(domain),
      dns.resolveCname(domain),
      dns.resolveMx(domain),
      dns.resolveTxt(domain),
    ]);
    const aRecords = a.status === "fulfilled" ? a.value : [];
    const cnameRecords = cname.status === "fulfilled" ? cname.value : [];
    const mxRecords = mx.status === "fulfilled" ? mx.value : [];
    const txtRecords = txt.status === "fulfilled" ? txt.value.flat() : [];
    return {
      checked: true,
      domain,
      hasARecord: aRecords.length > 0,
      hasCnameRecord: cnameRecords.length > 0,
      hasMxRecord: mxRecords.length > 0,
      hasSpfRecord: txtRecords.some((record) => record.toLowerCase().includes("v=spf1")),
      hasDkimLikeRecord: txtRecords.some((record) => record.toLowerCase().includes("dkim") || record.toLowerCase().includes("p=mig")),
      recordCounts: {
        a: aRecords.length,
        cname: cnameRecords.length,
        mx: mxRecords.length,
        txt: txtRecords.length,
      },
    };
  } catch {
    return {
      checked: true,
      domain,
      hasARecord: false,
      hasCnameRecord: false,
      hasMxRecord: false,
      hasSpfRecord: false,
      hasDkimLikeRecord: false,
      recordCounts: {
        a: 0,
        cname: 0,
        mx: 0,
        txt: 0,
      },
    };
  }
}

async function httpStatus(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      checked: true,
      url: url.replace(/^https?:\/\//, ""),
      status: response.status,
      ok: response.status >= 200 && response.status < 400,
      redirected: response.status >= 300 && response.status < 400,
    };
  } catch (error) {
    return {
      checked: true,
      url: url.replace(/^https?:\/\//, ""),
      status: null,
      ok: false,
      redirected: false,
      error: error instanceof Error && error.name === "AbortError" ? "timeout" : "unreachable",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const sprint3 = readJson<{ status?: string; totals?: Record<string, unknown>; blockers?: unknown[]; warnings?: unknown[] }>("sprint-3-readiness-report.json", {});
  const productionTrust = readJson<{ status?: string; readiness?: Record<string, string>; failures?: string[]; sensitiveValuesIncluded?: boolean }>("production-trust-readiness.json", {});
  const secrets = readJson<{ missingRequiredDomains?: string[]; sensitiveValuesIncluded?: boolean }>("secrets-audit.json", {});
  const email = readJson<{ status?: string; providerConfigured?: boolean; providerConfiguredPendingTest?: boolean; latestEmailTest?: Record<string, unknown>; sensitiveValuesIncluded?: boolean }>("email-provider-audit.json", {});
  const evidence = readJson<{ status?: string; storageConfigured?: boolean; controls?: Record<string, unknown>; sensitiveValuesIncluded?: boolean }>("evidence-storage-audit.json", {});
  const browser = readJson<{ status?: string; controls?: Record<string, unknown>; sensitiveValuesIncluded?: boolean }>("browser-session-storage-audit.json", {});
  const worker = readJson<{ worker?: { configured?: boolean; status?: string; deadLetters?: number; staleRunningJobs?: number }; latestSmokeTest?: { status?: string }; sensitiveValuesIncluded?: boolean }>("worker-queue-audit.json", {});
  const backup = readJson<{ backup?: string; restore?: string }>("backup-recovery-audit.json", {});
  const restore = readJson<{ restore?: string; restoreTestDatabaseConfigured?: boolean; restoreTestDatabaseSeparateFromPrimary?: boolean; sensitiveValuesIncluded?: boolean }>("restore-audit.json", {});
  const authSession = readJson<{ pass?: boolean; sensitiveValuesIncluded?: boolean }>("auth-session-boundary-audit.json", {});
  const accountUx = readJson<{ pass?: boolean; sensitiveValuesIncluded?: boolean }>("account-verification-ux-audit.json", {});
  const adminVerification = readJson<{ pass?: boolean; sensitiveValuesIncluded?: boolean }>("admin-verification-workflow-audit.json", {});
  const emailVerification = readJson<{ pass?: boolean; sensitiveValuesIncluded?: boolean }>("email-verification-flow-audit.json", {});
  const browse = readJson<{ audit?: { totals?: Record<string, unknown> } }>("browse-preview-audit.json", {});
  const community = readJson<{ totals?: Record<string, unknown> }>("nevada-community-coverage-report.json", {});
  const sprint2 = readJson<{ status?: string; gates?: Record<string, Record<string, unknown>>; remainingWork?: unknown[] }>("sprint-2-readiness-report.json", {});

  const rootDns = await dnsStatus(PUBLIC_DOMAIN);
  const wwwDns = await dnsStatus(`www.${PUBLIC_DOMAIN}`);
  const publicHttp = await httpStatus(PRODUCTION_URL);

  const productionEnvMissing = missingEnv([
    "DATABASE_URL",
    "DIRECT_DEMOCRACY_EMAIL_PROVIDER",
    "DIRECT_DEMOCRACY_EMAIL_FROM",
    "DIRECT_DEMOCRACY_EMAIL_API_KEY",
    "IDENTITY_EVIDENCE_ENCRYPTION_KEY",
    "IDENTITY_EVIDENCE_STORAGE_BUCKET",
    "PLAYWRIGHT_SESSION_STORAGE_KEY",
    "PLAYWRIGHT_SESSION_STORAGE_BUCKET",
    "DIRECT_DEMOCRACY_WORKER_ENABLED",
    "DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED",
    "DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL",
  ]);
  const demoModeDisabled = demoModeValue !== "true";
  const urlEnvMissing = missingEnv(["NEXT_PUBLIC_APP_URL"]);
  const trustFailures = productionTrust.failures ?? [];
  const trustReadiness = productionTrust.readiness ?? {};
  const productionTrustReady = productionTrust.status === "ready" && trustFailures.length === 0;
  const emailReady = email.status === "production_configured" || (email.providerConfigured === true && email.latestEmailTest?.status === "sent");
  const evidenceReady = evidence.status === "production_storage_configured" && evidence.storageConfigured === true;
  const browserReady = browser.status === "production_storage_configured";
  const workerReady = worker.worker?.configured === true && worker.latestSmokeTest?.status === "smoke_passed";
  const backupReady = backup.backup === "backup_configured";
  const restoreReady = restore.restore === "restore_tested" && restore.restoreTestDatabaseSeparateFromPrimary === true;
  const secretsReady = Array.isArray(secrets.missingRequiredDomains) && secrets.missingRequiredDomains.length === 0 && productionEnvMissing.length === 0;
  const domainDnsReady = (rootDns.hasARecord || rootDns.hasCnameRecord) && (wwwDns.hasARecord || wwwDns.hasCnameRecord);
  const emailDnsReady = rootDns.hasMxRecord && rootDns.hasSpfRecord;
  const productionHttpReady = publicHttp.ok;
  const appSecurityReady = authSession.pass === true && accountUx.pass === true && adminVerification.pass === true && emailVerification.pass === true;
  const sourceBoundariesReady =
    fileContains("app/admin/layout.tsx", "requireAdminPage") &&
    fileContains("app/admin/page.tsx", 'redirect("/admin/operations")') &&
    fileContains("proxy.ts", 'pathname.startsWith("/api/admin/")') &&
    fileContains("proxy.ts", "isSeededDemoSessionId") &&
    fileContains("proxy.ts", "response.cookies.delete(MOCK_AUTH_COOKIE)") &&
    fileContains("app/auth/sign-out/route.ts", "MOCK_AUTH_COOKIE");
  const sprint3Ready = sprint3.status === "ready_with_warnings" || sprint3.status === "ready_for_sprint_4";
  const browseNoDemo = asNumber(browse.audit?.totals?.categoriesWithDemoData) === 0;
  const communityNavigable = asNumber(community.totals?.communityPagesReady) >= 39 || asNumber(community.totals?.totalCommunities) >= 39;
  const sprint2ReadyEnough = sprint2.status === "green" || sprint2.status === "yellow" || sprint2.status === "ready_with_warnings";

  const gates = {
    sprint3Closure: {
      status: status(sprint3Ready, sprint3.status === "ready_with_warnings"),
      sprint3Status: sprint3.status ?? "missing",
      sprint3Blockers: sprint3.blockers?.length ?? null,
      sprint3Warnings: sprint3.warnings?.length ?? null,
    },
    productionTrustServices: {
      status: status(productionTrustReady, trustFailures.length <= 3),
      productionTrustStatus: productionTrust.status ?? "missing",
      failures: trustFailures,
      readiness: trustReadiness,
    },
    productionEnvironment: {
      status: status(secretsReady && demoModeDisabled, productionEnvMissing.length <= 2 && demoModeDisabled),
      missingRequiredDomains: secrets.missingRequiredDomains ?? [],
      missingRequiredEnvironment: productionEnvMissing,
      missingPublicUrlEnvironment: urlEnvMissing,
      demoModeDisabled,
      sensitiveValuesIncluded: secrets.sensitiveValuesIncluded === true ? true : false,
    },
    domainAndEmailDns: {
      status: status(domainDnsReady && emailDnsReady && productionHttpReady, domainDnsReady || emailDnsReady),
      publicDomain: PUBLIC_DOMAIN,
      productionUrl: PRODUCTION_URL.replace(/^https?:\/\//, ""),
      rootDns,
      wwwDns,
      emailDnsReady,
      productionHttp: publicHttp,
    },
    identityAndVerification: {
      status: status(appSecurityReady, authSession.pass === true && accountUx.pass === true),
      authSessionAudit: authSession.pass ?? false,
      accountVerificationUx: accountUx.pass ?? false,
      adminVerificationWorkflow: adminVerification.pass ?? false,
      emailVerificationFlow: emailVerification.pass ?? false,
    },
    privateStorageAndWorker: {
      status: status(evidenceReady && browserReady && workerReady, evidenceReady || browserReady || workerReady),
      evidence: evidence.status ?? "missing",
      browserSessions: browser.status ?? "missing",
      workerConfigured: worker.worker?.configured ?? false,
      latestWorkerSmoke: worker.latestSmokeTest?.status ?? "missing",
    },
    backupAndRestore: {
      status: status(backupReady && restoreReady, backupReady),
      backup: backup.backup ?? "missing",
      restore: restore.restore ?? "missing",
      restoreSeparateFromPrimary: restore.restoreTestDatabaseSeparateFromPrimary ?? false,
    },
    publicProductData: {
      status: status(browseNoDemo && communityNavigable, browseNoDemo || communityNavigable),
      browseCategoriesWithDemoData: browse.audit?.totals?.categoriesWithDemoData ?? null,
      communityPagesReady: community.totals?.communityPagesReady ?? null,
      totalCommunities: community.totals?.totalCommunities ?? null,
      sprint2DataQualityStatus: sprint2.status ?? "missing",
      sprint2ReadyEnough,
      remainingSprint2Work: sprint2.remainingWork?.length ?? null,
    },
    routeAndApiProtection: {
      status: status(sourceBoundariesReady, false),
      adminLayoutProtected: fileContains("app/admin/layout.tsx", "requireAdminPage"),
      adminRedirectCanonical: fileContains("app/admin/page.tsx", 'redirect("/admin/operations")'),
      adminApiProxyProtected: fileContains("proxy.ts", 'pathname.startsWith("/api/admin/")'),
      productionRejectsSeededDemoSessions: fileContains("proxy.ts", "isSeededDemoSessionId") && fileContains("proxy.ts", "response.cookies.delete(MOCK_AUTH_COOKIE)"),
      signOutRoutePresent: fileContains("app/auth/sign-out/route.ts", "MOCK_AUTH_COOKIE"),
    },
  };

  const blockers: string[] = [];
  for (const [name, gate] of Object.entries(gates)) {
    if (gate.status === "red") blockers.push(name);
  }
  const warnings: string[] = [];
  for (const [name, gate] of Object.entries(gates)) {
    if (gate.status === "yellow") warnings.push(name);
  }
  if (urlEnvMissing.length) warnings.push("public-url-env-not-set");
  if (email.providerConfiguredPendingTest) warnings.push("email-production-test-pending");
  if (!productionHttpReady) blockers.push("production-domain-http-not-ready");
  if (!domainDnsReady) blockers.push("custom-domain-dns-not-ready");
  if (!emailDnsReady) blockers.push("email-dns-not-ready");

  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];
  const report = {
    generatedAt: new Date().toISOString(),
    sprint: "Sprint 4",
    title: "Launch Readiness & Production QA",
    status: uniqueBlockers.length ? "blocked" : uniqueWarnings.length ? "ready_with_warnings" : "ready_for_launch_candidate",
    recommendation: uniqueBlockers.length
      ? "Do not launch publicly yet. Clear red gates, then rerun npm run sprint4:launch-readiness."
      : uniqueWarnings.length
        ? "Launch candidate is possible after product owner accepts warnings. Clear yellow gates before broad public launch."
        : "Ready for launch candidate QA.",
    gates,
    totals: {
      blockers: uniqueBlockers.length,
      warnings: uniqueWarnings.length,
      productionEnvMissing: productionEnvMissing.length,
      trustFailures: trustFailures.length,
      sourceBackedDecisionsAvailable: sprint3.totals?.sourceBackedDecisionsAvailable ?? null,
      sourceBackedProjectsAvailable: sprint3.totals?.sourceBackedProjectsAvailable ?? null,
    },
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    requiredValidation: [
      "npm run sprint3:readiness",
      "npm run auth:session-audit",
      "npm run verification:account-ux-audit",
      "npm run admin:verification-workflow-audit",
      "npm run email:verification-flow-audit",
      "npm run secrets:audit",
      "npm run email:audit",
      "npm run evidence:storage-audit",
      "npm run browser-sessions:audit",
      "npm run worker:audit",
      "npm run backup:audit",
      "npm run restore:audit",
      "npm run production:trust-audit",
      "npm run typecheck",
      "npm run build",
    ],
    launchGoNoGo: {
      publicLaunch: uniqueBlockers.length === 0 ? "go_with_owner_acceptance" : "no_go",
      localDemo: "go",
      nextAction: uniqueBlockers.length
        ? "Clear DNS/domain, production trust, storage, worker, backup/restore, and route protection blockers."
        : "Run user-role QA scripts and prepare the launch candidate deployment.",
    },
    sensitiveValuesIncluded: false,
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Generated Sprint 4 launch readiness report at ${OUTPUT_PATH}`);
  console.log(JSON.stringify({
    status: report.status,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    domain: {
      rootDnsReady: rootDns.hasARecord || rootDns.hasCnameRecord,
      wwwDnsReady: wwwDns.hasARecord || wwwDns.hasCnameRecord,
      emailDnsReady,
      productionHttpReady,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
