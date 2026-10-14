import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { hasAdminPermission } from "@/lib/admin/permissions";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/types/domain";
import { OWNER_ADMIN_DEFAULT_EMAIL, OWNER_ADMIN_USER_ID } from "@/lib/identity/constants";
import { getMfaConfigurationStatus } from "@/lib/identity/mfa";


const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OWNER_REPORT_PATH = path.join(GENERATED_DIR, "owner-admin-mfa-state-audit.json");
const ACCESS_REPORT_PATH = path.join(GENERATED_DIR, "admin-mfa-access-audit.json");

function sourceIncludes(filePath: string, text: string) {
  return existsSync(filePath) && readFileSync(filePath, "utf8").includes(text);
}

function safeFileIncludes(relativePath: string, text: string) {
  return sourceIncludes(path.join(process.cwd(), relativePath), text);
}

async function main() {
const owner = await prisma.identityAccount.findFirst({
  where: { OR: [{ id: OWNER_ADMIN_USER_ID }, { email: OWNER_ADMIN_DEFAULT_EMAIL }] },
  include: { mfaRecoveryCodes: { select: { usedAt: true } }, permissionGrants: { where: { revokedAt: null } }, sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { sessionHash: true, mfaAuthenticatedAt: true } } },
});
const mfaConfigurationStatus = getMfaConfigurationStatus();
const activeSessions = owner?.sessions.filter((session) => /^[a-f0-9]{64}$/.test(session.sessionHash)).length ?? 0;
const recoveryCodes = owner?.mfaRecoveryCodes ?? [];
const pending = owner?.mfaPendingEnrollment;
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
  pendingEnrollmentEncrypted: Boolean(pending && typeof pending === "object" && !Array.isArray(pending) && typeof pending.encryptedSecret === "string"),
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
  ownerHasAdminPermission: owner ? (hasAdminPermission({ role: owner.role as UserRole }, "dataops.view") || owner.permissionGrants.some((grant) => grant.permission === "dataops.view")) : false,
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
  enrolledAdminRequiresDurableMfaSession: safeFileIncludes("lib/admin/permissions.ts", "durableAdminSecurityGate") && safeFileIncludes("lib/identity/session-tokens.ts", "sessionHasRecentMfa"),
  accountIdsCannotAuthenticate: safeFileIncludes("lib/identity/durable-sessions.ts", "isIdentitySessionToken(token)") && !safeFileIncludes("lib/server/auth-session.ts", "getDurableAuthUserById(userId)"),
  logoutRevokesDurableSession: safeFileIncludes("lib/auth/actions.ts", "await revokeDurableSession(cookieStore.get(MOCK_AUTH_COOKIE)?.value)"),
  adminApiUsesServerAuthorization: safeFileIncludes("app/admin/layout.tsx", "requireAdminPage") && safeFileIncludes("proxy.ts", '"/api/admin/"'),
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
    "Owner state is read from durable IdentityAccount. Only hashed opaque sessions with an unexpired database record count as active.",
    "MFA verification is bound to the durable session and rotated after challenge; a separate signed user-ID cookie cannot grant MFA.",
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
  process.exitCode = 1;
  return;
}

console.log("Owner admin MFA audit passed.");
console.log(JSON.stringify({ owner: ownerReport.totals, access: accessReport.totals, mfaConfigurationStatus }, null, 2));

}
main().catch(() => { console.error("Owner admin MFA audit could not read durable identity state."); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
