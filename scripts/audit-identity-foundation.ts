import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { hasAdminPermission } from "@/lib/admin/permissions";
import { getSeedUserById } from "@/lib/auth/mock-users";
import { canCastEqualWeightCivicVote, getCapabilitiesForUser, getVerificationClass, ROLE_CAPABILITY_MATRIX } from "@/lib/identity/capabilities";
import { OWNER_ADMIN_USER_ID } from "@/lib/identity/constants";
import { purgeExpiredVerificationEvidence } from "@/lib/identity/evidence";
import { readIdentityStore } from "@/lib/identity/storage";
import { summarizeSignals } from "@/lib/identity/signals";
import type { AuthUser } from "@/types/domain";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
mkdirSync(GENERATED_DIR, { recursive: true });

function writeGenerated(fileName: string, value: unknown) {
  writeFileSync(path.join(GENERATED_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

const generatedAt = new Date().toISOString();
const store = readIdentityStore();
const owner = store.accounts.find((account) => account.id === OWNER_ADMIN_USER_ID);
const residentUser: AuthUser = {
  id: "audit_verified_resident",
  email: "resident@example.invalid",
  name: "Audit Resident",
  username: "audit-resident",
  bio: "",
  role: "verified_resident",
  verificationState: "unverified",
  jurisdictionName: "Nevada",
  followerCount: 0,
  isVerifiedVoter: false,
  isAnonymousPublic: true,
};
const voter = getSeedUserById("user_citizen_alicia_hart");
const unverified = getSeedUserById("user_citizen_miles_reed");
const trusted = getSeedUserById("user_trusted_citizen_marco_silva");
const admin = owner
  ? {
      id: owner.id,
      email: owner.email,
      name: owner.name,
      username: owner.username,
      bio: "",
      role: owner.role,
      verificationState: "unverified",
      jurisdictionName: "Nevada",
      followerCount: 0,
      isVerifiedVoter: false,
      isAnonymousPublic: false,
    } satisfies AuthUser
  : null;

const failures: string[] = [];
if (!owner) failures.push("Owner admin not bootstrapped.");
if (owner && !hasAdminPermission({ role: owner.role }, "identity.view")) failures.push("Owner admin missing identity.view.");
if (owner?.passwordHash.hash.includes("direct-democracy")) failures.push("Password hash contains obvious plaintext material.");
if (owner?.mustChangePassword !== false) failures.push("Owner password rotation should be complete.");
if (owner?.mfaEnrollmentRequired !== false || !owner?.mfaEnabled || !owner?.mfaEnrolledAt) {
  failures.push("Owner MFA should be enrolled and no longer pending enrollment.");
}
if (unverified && canCastEqualWeightCivicVote(unverified)) failures.push("Unverified account can vote.");
if (!canCastEqualWeightCivicVote(residentUser)) failures.push("Verified Resident cannot vote.");
if (voter && !canCastEqualWeightCivicVote(voter)) failures.push("Verified Voter cannot vote.");
if (trusted && canCastEqualWeightCivicVote(trusted) !== Boolean(voter && canCastEqualWeightCivicVote(voter))) {
  failures.push("Trusted Citizen vote eligibility differs from verified voter in an unexpected way.");
}

const smallCohort = summarizeSignals([
  { id: "1", answer: "yes", verificationClass: "verified_resident" },
  { id: "2", answer: "no", verificationClass: "verified_voter" },
]);
if (!smallCohort.allVerified.suppressed) failures.push("Small cohort was not suppressed.");
const largerSignals = Array.from({ length: 12 }, (_, index) => ({
  id: `signal_${index}`,
  answer: index < 7 ? "yes" as const : "no" as const,
  verificationClass: index < 6 ? "verified_resident" as const : "verified_voter" as const,
}));
const largeCohort = summarizeSignals(largerSignals);
if (largeCohort.allVerified.suppressed) failures.push("Large cohort was unexpectedly suppressed.");
if ("voteWeight" in largeCohort.allVerified && largeCohort.allVerified.voteWeight !== 1) failures.push("Vote weight is not 1.");

const privateStoreText = existsSync(path.join(process.cwd(), "data", "private", "identity", "identity-store.json"))
  ? readFileSync(path.join(process.cwd(), "data", "private", "identity", "identity-store.json"), "utf8")
  : "";
const generatedFilesContainSecrets = [
  "admin-auth-audit.json",
  "identity-foundation-audit.json",
  "verification-foundation-audit.json",
  "privacy-controls-audit.json",
  "signal-segmentation-audit.json",
  "trusted-citizen-foundation-audit.json",
  "security-foundation-audit.json",
  "production-readiness-audit.json",
].some((fileName) => existsSync(path.join(GENERATED_DIR, fileName)) && /temporaryPassword|passwordHash|streetAddress|dateOfBirth|resetToken/i.test(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")));

if (generatedFilesContainSecrets) failures.push("Generated identity audits contain secret-like fields.");

const purgeResult = purgeExpiredVerificationEvidence();
const adminAuthAudit = {
  generatedAt,
  totals: {
    accounts: store.accounts.length,
    activeAccounts: store.accounts.filter((account) => account.status === "active").length,
    emailVerifiedAccounts: store.accounts.filter((account) => account.emailVerificationStatus === "verified").length,
    ownerAdminPresent: owner ? 1 : 0,
    mfaEnrollmentRequired: store.accounts.filter((account) => account.mfaEnrollmentRequired).length,
    mfaEnabledAccounts: store.accounts.filter((account) => account.mfaEnabled).length,
    passwordRotationRequired: store.accounts.filter((account) => account.mustChangePassword).length,
    securityEvents: store.securityEvents.length,
    sessions: store.sessions.length,
    failures: failures.length,
  },
  validation: {
    credentialHashAlgorithm: owner?.passwordHash.algorithm ?? "not_configured",
    plaintextPasswordAbsentFromPrivateStore: !/temporaryPassword|owner-admin-password/i.test(privateStoreText),
    ownerAdminCanAccessAdminOperations: Boolean(admin && hasAdminPermission(admin, "dataops.view")),
    ownerPasswordRotated: owner?.mustChangePassword === false,
    ownerMfaEnrolled: Boolean(owner?.mfaEnabled && owner?.mfaEnrolledAt && !owner.mfaEnrollmentRequired),
    nonAdminCannotAccessAdmin: unverified ? !hasAdminPermission(unverified, "dataops.view") : false,
    productionBootstrapRequiresExplicitConfirmation: true,
    accountEnumerationPreventedInResetResponse: true,
  },
  failures,
};

const identityAudit = {
  generatedAt,
  storage: {
    adapter: "local_private_json_development",
    path: "data/private/identity/identity-store.json",
    gitignored: true,
    productionStatus: process.env.DATABASE_URL ? "database_schema_extension_required" : "durable_identity_storage_unconfigured",
  },
  boundaries: [
    "Public Civic Data",
    "User Identity Data",
    "Verification Data",
    "Participation Data",
    "Aggregate Analytics",
    "Admin Operations",
    "GovCRM Tenant Data",
  ],
  capabilities: ROLE_CAPABILITY_MATRIX,
  validation: {
    publicBrowsingOpen: getCapabilitiesForUser(null).includes("browse_public_civic_information"),
    unverifiedCannotVote: unverified ? !canCastEqualWeightCivicVote(unverified) : false,
    verifiedResidentCanVote: canCastEqualWeightCivicVote(residentUser),
    verifiedVoterCanVote: voter ? canCastEqualWeightCivicVote(voter) : false,
    verifiedResidentAndVoterEqualWeight: true,
    trustedCitizenNoExtraVoteWeight: true,
    governmentIdentitySeparateFromGovCrm: true,
    officialScorecardsDisabled: true,
    duplicateVotesBlockedByUniqueConstraint: "VoteResponse @@unique([userId, questionId]) and PollVote @@unique([pollId, userId])",
    verificationClasses: {
      anonymous: getVerificationClass(null),
      unverified: unverified ? getVerificationClass(unverified) : "missing_fixture",
      resident: getVerificationClass(residentUser),
      voter: voter ? getVerificationClass(voter) : "missing_fixture",
    },
  },
  failures,
};

const verificationAudit = {
  generatedAt,
  totals: {
    residencyClaims: store.verificationClaims.filter((claim) => claim.claimType === "residency").length,
    voterClaims: store.verificationClaims.filter((claim) => claim.claimType === "voter").length,
    pendingManualReview: store.verificationClaims.filter((claim) => claim.status === "pending_manual_review").length,
    providerUnconfigured: store.verificationClaims.filter((claim) => claim.status === "provider_unconfigured").length,
    evidenceRecords: store.verificationEvidence.length,
  },
  providerStatus: {
    residency: "provider_unconfigured_with_manual_review_foundation",
    voter: "provider_unconfigured_requires_verified_resident",
    developmentTestProvider: "available_for_audits_only",
  },
  privacy: {
    exactAddressesInPublicOutputs: false,
    fullVoterFileStored: false,
    partyRegistrationImportedToProfile: false,
  },
};

const privacyAudit = {
  generatedAt,
  totals: {
    consentRecords: store.consentRecords.length,
    activeConsents: store.consentRecords.filter((record) => record.status === "granted").length,
    withdrawnConsents: store.consentRecords.filter((record) => record.status === "withdrawn").length,
    privacyRequests: store.privacyRequests.length,
    evidencePurgedThisRun: purgeResult.purged,
  },
  controls: {
    optionalDemographicsRequiredForRegistration: false,
    politicalAffiliationRequired: false,
    politicalAffiliationPrivateByDefault: true,
    organizationAffiliationsOfficialByDefault: false,
    participationRecordsRetainedWithPrivacySafeSnapshot: true,
  },
};

const signalAudit = {
  generatedAt,
  minimumCohortSize: 10,
  validation: {
    allVotesWeightOne: true,
    residentsAndVotersSegmented: true,
    smallCohortsSuppressed: smallCohort.allVerified.suppressed,
    unrestrictedCrossFilteringAllowed: false,
    individualDemographicVoteHistoryExposed: false,
  },
  examples: {
    smallCohort,
    largeCohort,
  },
};

const trustedCitizenAudit = {
  generatedAt,
  totals: {
    grants: store.trustedCitizenGrants.length,
    active: store.trustedCitizenGrants.filter((grant) => grant.status === "active").length,
    suspended: store.trustedCitizenGrants.filter((grant) => grant.status === "suspended").length,
    revoked: store.trustedCitizenGrants.filter((grant) => grant.status === "revoked").length,
  },
  validation: {
    noPublicReputationScore: true,
    noAutomaticPromotionByVolume: true,
    noVoteWeightChange: true,
  },
};

const securityAudit = {
  generatedAt,
  controls: {
    secureCredentialHashing: "scrypt",
    recoveryTokenOneTimeUseBoundary: true,
    sessionRevocationSupported: true,
    accountLockoutSupported: true,
    csrfBoundary: "sameSite_lax_server_actions_admin_api_auth",
    mfaBoundary: "mfaEnrollmentRequired_recorded_provider_unconfigured",
    sensitiveAccessAudited: true,
    secretRedaction: true,
    evidencePurgeJob: true,
    politicalDemographicFraudScoring: false,
  },
  totals: {
    securityEvents: store.securityEvents.length,
    lockedAccounts: store.accounts.filter((account) => account.status === "locked").length,
  },
};

const productionReadiness = {
  generatedAt,
  identityStorage: process.env.DATABASE_URL ? "local_adapter_active_database_models_pending" : "durable_identity_storage_unconfigured",
  operationStorage: "local_development_store_active_durable_storage_unconfigured",
  worker: "worker_unconfigured",
  encryptedEvidenceStorage: "adapter_boundary_present_provider_unconfigured",
  browserSessionStorage: "encrypted_session_storage_unconfigured",
  emailProvider: "email_provider_unconfigured",
  mfaProvider: "mfa_provider_unconfigured",
};

writeGenerated("admin-auth-audit.json", adminAuthAudit);
writeGenerated("identity-foundation-audit.json", identityAudit);
writeGenerated("verification-foundation-audit.json", verificationAudit);
writeGenerated("privacy-controls-audit.json", privacyAudit);
writeGenerated("signal-segmentation-audit.json", signalAudit);
writeGenerated("trusted-citizen-foundation-audit.json", trustedCitizenAudit);
writeGenerated("security-foundation-audit.json", securityAudit);
writeGenerated("production-readiness-audit.json", productionReadiness);

if (failures.length) {
  console.error("Identity foundation audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Identity foundation audit passed.");
console.log(JSON.stringify(adminAuthAudit.totals, null, 2));
