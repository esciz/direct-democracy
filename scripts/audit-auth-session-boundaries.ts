import fs from "node:fs/promises";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "auth-session-boundary-audit.json");

async function main() {
  const sessionSource = await fs.readFile(path.join(process.cwd(), "lib/server/auth-session.ts"), "utf8");
  const constantsSource = await fs.readFile(path.join(process.cwd(), "lib/auth/constants.ts"), "utf8");
  const proxySource = await fs.readFile(path.join(process.cwd(), "proxy.ts"), "utf8");
  const adminPermissionsSource = await fs.readFile(path.join(process.cwd(), "lib/admin/permissions.ts"), "utf8");
  const authActionsSource = await fs.readFile(path.join(process.cwd(), "lib/auth/actions.ts"), "utf8");
  const authCookieSource = await fs.readFile(path.join(process.cwd(), "lib/auth/cookies.ts"), "utf8");
  const signOutRouteSource = await fs.readFile(path.join(process.cwd(), "app/auth/sign-out/route.ts"), "utf8");
  const audit = {
    generatedAt: new Date().toISOString(),
    status: "auth_session_boundaries_audited",
    sensitiveValuesIncluded: false,
    validation: {
      activeIdentityAccountsCanHydrateSession: sessionSource.includes('identityAccount.status === "active"') && !sessionSource.includes('identityAccount.status === "active" && identityAccount.emailVerificationStatus === "verified"'),
      adminAccessStillRequiresVerifiedEmail: adminPermissionsSource.includes('identityAccount.emailVerificationStatus !== "verified"'),
      signInSetsIdentitySessionCookie: authActionsSource.includes("cookieStore.set(MOCK_AUTH_COOKIE, localResult.account.id"),
      registrationStillCreatesUnverifiedCitizen: authActionsSource.includes("emailVerified: false") && authActionsSource.includes('role: "citizen"'),
      demoModeRequiresExplicitOptIn: constantsSource.includes('DEV_ONLY_AUTH_ENABLED = demoModeEnv === "true"'),
      productionSessionRejectsSeededUsers: sessionSource.includes("DEV_ONLY_AUTH_ENABLED ? getSeedUserById(userId) : null"),
      productionProxyRedirectsMissingOrSeededSession:
        proxySource.includes("isSeededDemoSessionId") &&
        proxySource.includes('authUrl.searchParams.set("next"') &&
        proxySource.includes("expireSessionCookie(response)"),
      seededCredentialFallbackRequiresDemoMode: authActionsSource.includes("DEV_ONLY_AUTH_ENABLED ? seedUsers.find"),
      loginAndRegistrationUseDurableIdentity:
        authActionsSource.includes("authenticateDurableLocalAccount") &&
        authActionsSource.includes("createDurableLocalAccount") &&
        sessionSource.includes("getDurableAuthUserById"),
      productionCookieCanSpanRootAndWww:
        authCookieSource.includes("DIRECT_DEMOCRACY_PUBLIC_DOMAIN") &&
        authCookieSource.includes('replace(/^www\\./, "")') &&
        authActionsSource.includes("getAuthCookieOptions"),
      signOutClearsDomainCookie:
        signOutRouteSource.includes("clearAuthSessionCookies") &&
        authCookieSource.includes("getAuthCookieDeleteOptions"),
      staticInfographicHtmlBypassesAuthProxy:
        proxySource.includes('pathname.startsWith("/infographics/")') &&
        proxySource.includes("html|ico"),
    },
  };
  const pass = Object.values(audit.validation).every(Boolean);
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ ...audit, pass }, null, 2)}\n`);
  console.log("Auth session boundary audit complete.");
  console.log(JSON.stringify({ pass, output: OUTPUT_PATH }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
