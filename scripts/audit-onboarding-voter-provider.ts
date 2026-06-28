import fs from "node:fs/promises";
import path from "node:path";

import { evaluateVerificationTrust } from "@/lib/auth/trust";
import { evaluateVoterVerification, VOTER_VERIFICATION_PROVIDER_CONFIGURED } from "@/lib/onboarding/voter-provider";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "onboarding-voter-provider-audit.json");

async function main() {
  const sample = evaluateVoterVerification({
    legalFirstName: "Eli",
    legalLastName: "Scislowicz",
    dateOfBirth: "1990-01-01",
    streetAddress: "Private",
    jurisdictionName: "Nevada",
  });
  const trust = evaluateVerificationTrust({
    emailStatus: "verified",
    phoneStatus: "verified",
    antiBotScreened: true,
    voterMatchStatus: sample.status === "strongMatch" ? "voterVerified" : "unverified",
    voterMatchConfidence: sample.confidence,
    enhancedIdentityStatus: sample.status === "possibleMatch" ? "recommended" : "notNeeded",
    manualReviewStatus: sample.status === "sourceUnavailable" || sample.status === "possibleMatch" ? "available" : "notNeeded",
    candidateOfficialMatchStatus: "none",
    suspiciousSignals: sample.status === "sourceUnavailable" ? ["manualReviewRequired"] : [],
  });
  const audit = {
    generatedAt: new Date().toISOString(),
    status: "onboarding_voter_provider_audited",
    providerConfigured: VOTER_VERIFICATION_PROVIDER_CONFIGURED,
    sampleResult: {
      status: sample.status,
      confidence: sample.confidence,
      matchedRecordPresent: Boolean(sample.matchedRecord),
      sourceStatus: sample.sourceStatus,
    },
    trustTier: trust.trustTier,
    manualReviewStatus: trust.checks.manualReviewStatus,
    validation: {
      unavailableProviderDoesNotReturnNoMatch: VOTER_VERIFICATION_PROVIDER_CONFIGURED || sample.status === "sourceUnavailable",
      unavailableProviderDoesNotReturnFakeMatch: VOTER_VERIFICATION_PROVIDER_CONFIGURED || !sample.matchedRecord,
      unavailableProviderOffersManualReview: VOTER_VERIFICATION_PROVIDER_CONFIGURED || trust.checks.manualReviewStatus === "available",
      accountNotDemotedToGuestWhenBasicChecksExist: trust.trustTier !== "guestBrowseOnly",
      sensitiveValuesIncluded: false,
    },
  };
  const pass = Object.entries(audit.validation)
    .filter(([key]) => key !== "sensitiveValuesIncluded")
    .every(([, value]) => value) && audit.validation.sensitiveValuesIncluded === false;

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ ...audit, pass }, null, 2)}\n`);
  console.log("Onboarding voter provider audit complete.");
  console.log(JSON.stringify({ pass, providerConfigured: audit.providerConfigured, sampleResult: audit.sampleResult, trustTier: audit.trustTier, output: OUTPUT_PATH }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
