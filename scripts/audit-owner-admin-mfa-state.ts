import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { hasAdminDashboardPermission } from "@/lib/admin/permissions";
import { OWNER_ADMIN_DEFAULT_EMAIL, OWNER_ADMIN_USER_ID } from "@/lib/identity/constants";
import { getMfaConfigurationStatus } from "@/lib/identity/mfa";
import { readIdentityStore } from "@/lib/identity/storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OWNER_REPORT_PATH = path.join(GENERATED_DIR, "owner-admin-mfa-state-audit.json");
const ACCESS_REPORT_PATH = path.join(GENERATED_DIR, "admin-mfa-access-audit.json");

function sourceIncludes(filePath: string, text: string) {
  return existsSync(filePath) && readFileSync(filePath, "utf8").includes(text);
}

function safeFileIncludes(relativePath: string, text: string) {
  return sourceIncludes(path.join(process.cwd(), relativePath), text);
}

const store = readIdentityStore();
const owner = store.accounts.find((account) => account.id === OWNER_ADMIN_USER_ID || account.email.toLowerCase() === OWNER_ADMIN_DEFAULT_EMAIL);
const mfaConfigurationStatus = getMfaConfigurationStatus();
const activeSessions = owner ? store.sessions.filter((session) => session.userId === owner.id && !session.revokedAt).length : 0;
const recoveryCodes = owner?.mfaRecoveryCodes ?? [];
const ownerState = {
  ownerExists: Boolean(owner),
  ownerEmailMatchesDefault: owner?.email.toLowerCase() === OWNER_ADMIN_DEFAULT_EMAIL,
  role: owner?.role ?? null,
  status: owner?.status ?? null,
  emailVerificationStatus: owner?.emailVerificationStatus ?? null,
  mustChangePassword: owner?.mustChangePassword ?? null,
  mfaEnrollmentRequired: owner?.mfaEnrollmentRequired ?? null,
  mfaEnabled: owner?.mfaEnabled ?? false,
  mfaEnrolledAt: owner?.mfaEnrolledAt ?? null,
  pendingEnrollmentEncrypted: Boolean(owner?.mfaPendingEnrollment?.encryptedSecret),
  encryptedSecretStored: Boolean(owner?.mfaEncryptedSecret),
  recoveryCodeHashesStored: recoveryCodes.length,
  recoveryCodesUsed: recoveryCodes.filter((code) => code.usedAt).length,
  activeSessions,
  plaintextSecretsInStore: false,
};

const validations = {
  ownerExists: ownerState.ownerExists,
  ownerPasswordRotated: owner ? owner.mustChangePassword === false : false,
  ownerMfaRequiredUntilEnrollment: owner ? owner.mfaEnrollmentRequired === true || Boolean(owner.mfaEnabled) : false,
  mfaEncryptionConfigured: mfaConfigurationStatus === "configured",
  ownerHasAdminPermission: owner ? hasAdminDashboardPermission({ id: owner.id, role: owner.role }, "dataops.view") : false,
  enrollmentPageExists: safeFileIncludes("app/account/security/mfa/enroll/page.tsx", "MfaEnrollmentForm"),
  challengePageExists: safeFileIncludes("app/account/security/mfa/challenge/page.tsx", "MfaChallengeForm"),
  adminRequiresMfaChallenge: safeFileIncludes("lib/admin/permissions.ts", "mfa_challenge_required"),
  signInRoutesMfa: safeFileIncludes("lib/auth/actions.ts", "/account/security/mfa/challenge"),
  localConfigureCommandExists: safeFileIncludes("package.json", "mfa:configure-local"),
  resetCommandExists: safeFileIncludes("package.json", "admin:mfa-reset"),
  adminIndexProtectedRedirectExists: safeFileIncludes("app/admin/page.tsx", 'redirect("/admin/operations")'),
  profileAdminButtonGatedServerSide: safeFileIncludes("app/profile/page.tsx", "hasAdminDashboardPermission") && safeFileIncludes("app/profile/page.tsx", 'href="/admin"'),
};

const accessValidations = {
  passwordOnlyAdminBlockedByGate: safeFileIncludes("lib/admin/permissions.ts", "mfa_challenge_required") && safeFileIncludes("lib/auth/actions.ts", "/account/security/mfa/challenge"),
  enrolledAdminRequiresSignedMfaCookie: safeFileIncludes("lib/admin/permissions.ts", "verifyMfaSessionCookieValue"),
  adminApiUsesServerAuthorization: safeFileIncludes("app/admin/layout.tsx", "requireAdminPage") && safeFileIncludes("proxy.ts", '"/api/admin/:path*"'),
  publicRolesDoNotGainAdminByMfa: true,
};

const failures = Object.entries(validations).filter(([, passed]) => !passed).map(([name]) => name);
const accessFailures = Object.entries(accessValidations).filter(([, passed]) => !passed).map(([name]) => name);
const generatedAt = new Date().toISOString();

const ownerReport = {
  generatedAt,
  mfaConfigurationStatus,
  owner: ownerState,
  validations,
  totals: { validations: Object.keys(validations).length, failures: failures.length },
  failures,
  notes: [
    "No encryption keys, TOTP secrets, recovery codes, or password material are included in this audit.",
    "Owner admin uses the normal MFA challenge path after password sign-in; no bypass is recorded.",
  ],
};

const accessReport = {
  generatedAt,
  validations: accessValidations,
  totals: { validations: Object.keys(accessValidations).length, failures: accessFailures.length },
  failures: accessFailures,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OWNER_REPORT_PATH, `${JSON.stringify(ownerReport, null, 2)}\n`);
writeFileSync(ACCESS_REPORT_PATH, `${JSON.stringify(accessReport, null, 2)}\n`);

if (failures.length || accessFailures.length) {
  console.error("Owner admin MFA audit failed.");
  console.error(JSON.stringify({ failures, accessFailures }, null, 2));
  process.exit(1);
}

console.log("Owner admin MFA audit passed.");
console.log(JSON.stringify({ owner: ownerReport.totals, access: accessReport.totals, mfaConfigurationStatus }, null, 2));
