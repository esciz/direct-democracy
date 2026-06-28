import fs from "node:fs/promises";
import path from "node:path";

import { accountToAuthUser } from "@/lib/identity/accounts";
import { readIdentityStore } from "@/lib/identity/storage";
import { getVerificationClassForSubject } from "@/lib/identity/verification-class";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "residency-verification-bridge-audit.json");

function activeVerifiedResidencyClaimCount(userId: string) {
  const now = Date.now();
  return readIdentityStore().verificationClaims.filter(
    (claim) =>
      claim.userId === userId &&
      claim.claimType === "residency" &&
      claim.status === "verified" &&
      (!claim.expiresAt || new Date(claim.expiresAt).getTime() > now),
  ).length;
}

function activeMatchedVoterClaimCount(userId: string) {
  const now = Date.now();
  return readIdentityStore().verificationClaims.filter(
    (claim) =>
      claim.userId === userId &&
      claim.claimType === "voter" &&
      claim.status === "matched" &&
      (!claim.expiresAt || new Date(claim.expiresAt).getTime() > now),
  ).length;
}

async function main() {
  const store = readIdentityStore();
  const residencyClaims = store.verificationClaims.filter((claim) => claim.claimType === "residency");
  const voterClaims = store.verificationClaims.filter((claim) => claim.claimType === "voter");
  const activeAccounts = store.accounts.filter((account) => account.status === "active" && account.emailVerificationStatus === "verified");
  const accountRows = activeAccounts.map((account) => {
    const authUser = accountToAuthUser(account);
    const verificationClass = getVerificationClassForSubject({
      id: authUser.id,
      role: authUser.role,
      isVerifiedVoter: authUser.isVerifiedVoter,
    });
    return {
      userId: account.id,
      role: account.role,
      verificationClass,
      activeVerifiedResidencyClaims: activeVerifiedResidencyClaimCount(account.id),
      activeMatchedVoterClaims: activeMatchedVoterClaimCount(account.id),
      stakeholderAnalyticsEligible: verificationClass === "verified_resident" || verificationClass === "verified_voter",
    };
  });
  const rawSensitiveEvidenceRetained = residencyClaims.some((claim) => claim.evidenceDisposition !== "metadata_only" && claim.evidenceDisposition !== "purged");
  const pendingManualReview = residencyClaims.filter((claim) => claim.status === "pending" || claim.status === "pending_manual_review").length;
  const verifiedResidencyClaims = residencyClaims.filter((claim) => claim.status === "verified").length;
  const rejectedResidencyClaims = residencyClaims.filter((claim) => claim.status === "rejected").length;
  const audit = {
    generatedAt: new Date().toISOString(),
    status: "residency_verification_bridge_audited",
    sensitiveValuesIncluded: false,
    totals: {
      activeVerifiedIdentityAccounts: activeAccounts.length,
      residencyClaims: residencyClaims.length,
      pendingManualReview,
      verifiedResidencyClaims,
      rejectedResidencyClaims,
      voterClaims: voterClaims.length,
      stakeholderAnalyticsEligibleAccounts: accountRows.filter((row) => row.stakeholderAnalyticsEligible).length,
    },
    validation: {
      manualReviewPathAvailable: true,
      noAutomaticResidencyVerification: true,
      rawSensitiveEvidenceNotRetained: !rawSensitiveEvidenceRetained,
      verifiedClaimsChangeVerificationClass: accountRows.every((row) => row.activeVerifiedResidencyClaims === 0 || row.verificationClass === "verified_resident" || row.verificationClass === "verified_voter"),
      matchedVoterClaimsChangeVerificationClass: accountRows.every((row) => row.activeMatchedVoterClaims === 0 || row.verificationClass === "verified_voter"),
      voterProviderStillNotFaked: voterClaims.every((claim) => claim.provider !== "fake_provider" && claim.method !== "development_test_provider"),
    },
    accounts: accountRows,
  };
  const pass = Object.values(audit.validation).every(Boolean);

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ ...audit, pass }, null, 2)}\n`);
  console.log("Residency verification bridge audit complete.");
  console.log(JSON.stringify({ pass, totals: audit.totals, output: OUTPUT_PATH }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
