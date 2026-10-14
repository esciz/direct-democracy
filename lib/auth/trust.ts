import type {
  CandidateOfficialMatchStatus,
  ContactVerificationStatus,
  EnhancedIdentityStatus,
  ManualReviewStatus,
  UserVerificationState,
  VerificationMatchConfidence,
  VerificationRiskFlag,
  VerificationTrustSummary,
  VerificationTrustTier,
} from "@/types/domain";

export type VerificationRiskProfile = {
  emailStatus: ContactVerificationStatus;
  phoneStatus: ContactVerificationStatus;
  antiBotScreened: boolean;
  voterMatchStatus: UserVerificationState;
  voterMatchConfidence: VerificationMatchConfidence;
  enhancedIdentityStatus: EnhancedIdentityStatus;
  manualReviewStatus: ManualReviewStatus;
  candidateOfficialMatchStatus: CandidateOfficialMatchStatus;
  suspiciousSignals?: VerificationRiskFlag[];
  trustedCitizenSignalsStrong?: boolean;
};

const TRUST_LABELS: Record<VerificationTrustTier, string> = {
  guestBrowseOnly: "Guest / Browse only",
  accountCreated: "Account created",
  basicVerified: "Basic verified",
  verifiedCitizen: "Verified citizen",
  enhancedVerified: "Enhanced verified",
  claimEligible: "Claim-eligible / elevated trust",
  trustedCitizenEligible: "Trusted citizen eligible",
  candidateOfficialClaimCleared: "Candidate / official claim cleared",
};

const TRUST_PERMISSIONS: Record<VerificationTrustTier, string[]> = {
  guestBrowseOnly: ["Browse public pages and public content"],
  accountCreated: ["Start onboarding and save identity setup progress"],
  basicVerified: ["Continue verification with lower fraud risk"],
  verifiedCitizen: ["Standard civic participation", "Voting, signing, messaging, and basic civic actions"],
  enhancedVerified: ["Higher-confidence identity actions", "Eligible for escalated verification paths"],
  claimEligible: ["Start secure public-profile claim review"],
  trustedCitizenEligible: ["Eligible for trusted-citizen promotion checks"],
  candidateOfficialClaimCleared: ["Complete candidate/official profile claim"],
};

function buildExplanation(tier: VerificationTrustTier) {
  switch (tier) {
    case "guestBrowseOnly":
      return "Browsing is open, but civic participation is locked until an account is created and verified.";
    case "accountCreated":
      return "The account exists, but core verification steps still need to be completed before participation unlocks.";
    case "basicVerified":
      return "Email, phone, and baseline anti-abuse checks have passed, but voter verification is still required for civic actions.";
    case "verifiedCitizen":
      return "The user has a strong voter-registration match and can participate as a standard verified citizen.";
    case "enhancedVerified":
      return "Additional identity assurance has been completed for an ambiguous or higher-risk case.";
    case "claimEligible":
      return "Identity confidence is high enough to continue a public-profile claim review path.";
    case "trustedCitizenEligible":
      return "The account meets stronger trust requirements needed for elevated community roles.";
    case "candidateOfficialClaimCleared":
      return "Identity and public-record matching are strong enough to clear a candidate or official profile claim.";
  }
}

function buildNextStep(tier: VerificationTrustTier) {
  switch (tier) {
    case "guestBrowseOnly":
      return "Create an account and complete basic verification.";
    case "accountCreated":
      return "Verify email and phone, then continue to voter matching.";
    case "basicVerified":
      return "Complete voter record verification.";
    case "verifiedCitizen":
      return "Participation is unlocked. Enhanced verification is only needed for higher-risk actions.";
    case "enhancedVerified":
      return "Continue the elevated flow, such as trusted-citizen review or profile claiming.";
    case "claimEligible":
      return "Start candidate or official claim review.";
    case "trustedCitizenEligible":
      return "Proceed to trusted-citizen qualification checks.";
    case "candidateOfficialClaimCleared":
      return "Complete the claim and enter the app through the matched public role.";
  }
}

export function evaluateVerificationTrust(profile: VerificationRiskProfile): VerificationTrustSummary {
  const riskFlags = [...(profile.suspiciousSignals ?? [])];

  if (profile.voterMatchConfidence === "medium") {
    riskFlags.push("ambiguousVoterMatch");
  }

  if (
    profile.candidateOfficialMatchStatus === "possibleMatch" &&
    profile.enhancedIdentityStatus !== "verified" &&
    !riskFlags.includes("claimRequiresEnhancedVerification")
  ) {
    riskFlags.push("claimRequiresEnhancedVerification");
  }

  if (profile.manualReviewStatus === "requested" || profile.manualReviewStatus === "inReview") {
    if (!riskFlags.includes("manualReviewRequired")) {
      riskFlags.push("manualReviewRequired");
    }
  }

  let trustTier: VerificationTrustTier = "guestBrowseOnly";

  const basicVerified =
    profile.emailStatus === "verified" &&
    profile.phoneStatus === "verified" &&
    profile.antiBotScreened;

  if (basicVerified) {
    trustTier = "basicVerified";
  } else if (profile.emailStatus === "verified" || profile.phoneStatus === "verified" || profile.antiBotScreened) {
    trustTier = "accountCreated";
  }

  if (profile.voterMatchStatus === "voterVerified" && profile.voterMatchConfidence === "high") {
    trustTier = "verifiedCitizen";
  }

  if (profile.enhancedIdentityStatus === "verified") {
    trustTier = "enhancedVerified";
  }

  if (
    (profile.candidateOfficialMatchStatus === "strongMatch" &&
      profile.voterMatchStatus === "voterVerified" &&
      (profile.voterMatchConfidence === "high" || profile.enhancedIdentityStatus === "verified")) ||
    (profile.candidateOfficialMatchStatus === "possibleMatch" && profile.enhancedIdentityStatus === "verified")
  ) {
    trustTier = "claimEligible";
  }

  if (
    trustTier === "verifiedCitizen" &&
    profile.trustedCitizenSignalsStrong &&
    profile.manualReviewStatus !== "inReview" &&
    profile.manualReviewStatus !== "denied"
  ) {
    trustTier = "trustedCitizenEligible";
  }

  if (
    profile.candidateOfficialMatchStatus === "claimCleared" ||
    (profile.candidateOfficialMatchStatus === "strongMatch" &&
      (profile.enhancedIdentityStatus === "verified" || profile.manualReviewStatus === "approved"))
  ) {
    trustTier = "candidateOfficialClaimCleared";
  }

  return {
    trustTier,
    trustLabel: TRUST_LABELS[trustTier],
    explanation: buildExplanation(trustTier),
    permissions: TRUST_PERMISSIONS[trustTier],
    nextStep: buildNextStep(trustTier),
    checks: {
      emailStatus: profile.emailStatus,
      phoneStatus: profile.phoneStatus,
      antiBotScreened: profile.antiBotScreened,
      voterMatchStatus: profile.voterMatchStatus,
      voterMatchConfidence: profile.voterMatchConfidence,
      enhancedIdentityStatus: profile.enhancedIdentityStatus,
      manualReviewStatus: profile.manualReviewStatus,
      candidateOfficialMatchStatus: profile.candidateOfficialMatchStatus,
    },
    riskFlags,
  };
}
