import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "private-beta-live-smoke.json");

type RouteExpectation = {
  path: string;
  label: string;
  expected: "redirect_to_auth" | "auth_page" | "robots_disallow";
};

type RouteResult = {
  path: string;
  label: string;
  expected: RouteExpectation["expected"];
  url: string;
  finalUrl: string;
  status: number | null;
  location: string | null;
  xRobotsTag: string | null;
  ok: boolean;
  warning: boolean;
  reason: string;
};

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

function joinUrl(baseUrl: string, routePath: string) {
  return `${baseUrl}${routePath === "/" ? "" : routePath}`;
}

function hasNoIndex(value: string | null) {
  return Boolean(value?.toLowerCase().includes("noindex"));
}

function classifyRedirect(location: string | null) {
  if (!location) return false;
  return location === "/auth" || location.startsWith("/auth?") || location.includes("/auth?");
}

async function checkRoute(baseUrl: string, route: RouteExpectation): Promise<RouteResult> {
  const url = joinUrl(baseUrl, route.path);
  try {
    const headers = {
      "User-Agent": "DirectDemocracyPrivateBetaSmoke/1.0",
      Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
    };
    let finalUrl = url;
    let response = await fetch(finalUrl, { redirect: "manual", headers });
    let location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location?.startsWith("https://")) {
      const nextUrl = new URL(location);
      const currentUrl = new URL(finalUrl);
      const sameRoute = nextUrl.pathname === currentUrl.pathname || (nextUrl.pathname === "/" && currentUrl.pathname === "");
      if (sameRoute) {
        finalUrl = location;
        response = await fetch(finalUrl, { redirect: "manual", headers });
        location = response.headers.get("location");
      }
    }
    const xRobotsTag = response.headers.get("x-robots-tag");
    const body = await response.text();

    if (route.expected === "redirect_to_auth") {
      const redirectedToAuth = response.status >= 300 && response.status < 400 && classifyRedirect(location);
      const routeNotDeployedYet = response.status === 404;
      return {
        path: route.path,
        label: route.label,
        expected: route.expected,
        url,
        finalUrl,
        status: response.status,
        location,
        xRobotsTag,
        ok: redirectedToAuth && hasNoIndex(xRobotsTag),
        warning: routeNotDeployedYet,
        reason: redirectedToAuth
          ? hasNoIndex(xRobotsTag)
            ? "Protected route redirects logged-out visitors to auth and includes noindex."
            : "Protected route redirects to auth but is missing noindex header."
          : routeNotDeployedYet
            ? "Route is not live yet. This usually means the latest commit has not been deployed."
            : "Expected logged-out visitors to redirect to auth.",
      };
    }

    if (route.expected === "auth_page") {
      const demoLeakSignals = ["Casey Rivera", "Sofia Bennett", "Elena Ramirez"].filter((name) => body.includes(name));
      const ok = response.status === 200 && hasNoIndex(xRobotsTag) && demoLeakSignals.length === 0;
      return {
        path: route.path,
        label: route.label,
        expected: route.expected,
        url,
        finalUrl,
        status: response.status,
        location,
        xRobotsTag,
        ok,
        warning: response.status !== 200,
        reason: ok
          ? "Auth page loads without known demo account names and includes noindex."
          : demoLeakSignals.length
            ? `Auth page includes demo account name(s): ${demoLeakSignals.join(", ")}.`
            : response.status === 200
              ? "Auth page loaded but is missing expected noindex header."
              : "Auth page did not return HTTP 200.",
      };
    }

    const robotsOk = response.status === 200 && /User-Agent:\s*\*/i.test(body) && /Disallow:\s*\//i.test(body);
    return {
      path: route.path,
      label: route.label,
      expected: route.expected,
      url,
      finalUrl,
      status: response.status,
      location,
      xRobotsTag,
      ok: robotsOk,
      warning: !robotsOk,
      reason: robotsOk ? "robots.txt disallows crawling." : "robots.txt did not clearly disallow crawling.",
    };
  } catch (error) {
    return {
      path: route.path,
      label: route.label,
      expected: route.expected,
      url,
      finalUrl: url,
      status: null,
      location: null,
      xRobotsTag: null,
      ok: false,
      warning: true,
      reason: error instanceof Error ? error.message : "Network smoke request failed.",
    };
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  const routes: RouteExpectation[] = [
    { path: "/", label: "Main invite link", expected: "redirect_to_auth" },
    { path: "/auth", label: "Auth page", expected: "auth_page" },
    { path: "/private-beta", label: "Optional tester guide", expected: "redirect_to_auth" },
    { path: "/admin/private-beta", label: "Admin launch control", expected: "redirect_to_auth" },
    { path: "/robots.txt", label: "Robots", expected: "robots_disallow" },
  ];

  const results = baseUrl ? await Promise.all(routes.map((route) => checkRoute(baseUrl, route))) : [];
  const failures = results.filter((result) => !result.ok && !result.warning).map((result) => `${result.path}: ${result.reason}`);
  const warnings = [
    ...(!baseUrl ? ["NEXT_PUBLIC_APP_URL must be an https URL before live smoke can run."] : []),
    ...results.filter((result) => result.warning).map((result) => `${result.path}: ${result.reason}`),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    status: failures.length ? "failed" : warnings.length ? "passed_with_warnings" : "passed",
    baseUrl,
    totals: {
      routesChecked: results.length,
      passed: results.filter((result) => result.ok).length,
      warnings: warnings.length,
      failures: failures.length,
    },
    results,
    warnings,
    failures,
    sensitiveValuesIncluded: false,
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("Private beta live smoke complete.");
  console.log(
    JSON.stringify(
      {
        status: report.status,
        baseUrl: report.baseUrl,
        routesChecked: report.totals.routesChecked,
        warnings,
        failures,
        output: OUTPUT_PATH,
      },
      null,
      2,
    ),
  );

  if (failures.length) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
