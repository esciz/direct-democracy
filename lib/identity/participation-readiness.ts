import { canUserApproveEventProposal, canUserCreateDebate, canUserFlagFactualClaim, canUserMessagePublicFigures, canUserRateTruth, canUserSignPetitions } from "@/lib/auth/guards";
import { getVerificationDescription, getVerificationLabel } from "@/lib/auth/verification";
import { getCapabilitiesForUser, getVerificationClass, getVoteEligibilitySnapshot, hasCivicCapability } from "@/lib/identity/capabilities";
import { readIdentityStore } from "@/lib/identity/storage";
import type { AuthUser } from "@/types/domain";

export type ParticipationReadinessStatus = "ready" | "available_after_verification" | "stewardship_available" | "provider_needed";

export type ParticipationReadinessItem = {
  id: string;
  label: string;
  status: ParticipationReadinessStatus;
  description: string;
};

export type ParticipationReadinessSummary = {
  policyVersion: string;
  verificationLabel: string;
  verificationDescription: string;
  verificationClass: ReturnType<typeof getVerificationClass>;
  voteWeight: 1;
  hiddenWeighting: false;
  publicDataSeparation: string;
  trustedCitizenNote: string;
  trustedGrantStatus: "active" | "not_active";
  unlocked: ParticipationReadinessItem[];
  nextSteps: ParticipationReadinessItem[];
  stewardship: ParticipationReadinessItem[];
};

function statusFor(enabled: boolean, fallback: ParticipationReadinessStatus = "available_after_verification"): ParticipationReadinessStatus {
  return enabled ? "ready" : fallback;
}

function item(id: string, label: string, enabled: boolean, description: string, fallback?: ParticipationReadinessStatus): ParticipationReadinessItem {
  return {
    id,
    label,
    status: statusFor(enabled, fallback),
    description,
  };
}

export function getParticipationReadiness(user: AuthUser): ParticipationReadinessSummary {
  const capabilities = getCapabilitiesForUser(user);
  const verificationClass = getVerificationClass(user);
  const voteSnapshot = getVoteEligibilitySnapshot(user);
  const trustedGrant = readIdentityStore().trustedCitizenGrants.find((grant) => grant.userId === user.id && grant.status === "active") ?? null;
  const canVote = hasCivicCapability(user, "vote_on_eligible_civic_questions");
  const canDiscuss = hasCivicCapability(user, "participate_in_eligible_civic_discussions");
  const canSubmitEvidence = hasCivicCapability(user, "submit_evidence");
  const canCurateEvidence = hasCivicCapability(user, "curate_evidence");
  const canSteward = Boolean(trustedGrant) || user.role === "trustedCitizen";

  return {
    policyVersion: voteSnapshot.policyVersion,
    verificationLabel: getVerificationLabel(user.verificationState),
    verificationDescription: getVerificationDescription(user.verificationState),
    verificationClass,
    voteWeight: 1,
    hiddenWeighting: false,
    publicDataSeparation: "Public civic records, private verification evidence, and aggregate civic signals stay separated. Verification changes access, not vote weight.",
    trustedCitizenNote: "Trusted Citizen status unlocks stewardship tools such as evidence curation, debate creation, and limited community moderation. It does not make votes count more.",
    trustedGrantStatus: trustedGrant ? "active" : "not_active",
    unlocked: [
      item("browse", "Browse source-backed civic records", capabilities.includes("browse_public_civic_information"), "Read community dashboards, decisions, meetings, officials, projects, and source links."),
      item("profile", "Manage your civic profile", capabilities.includes("manage_own_profile"), "Keep your public bio, top issues, communities, and visibility settings current."),
      item("vote", "Cast equal-weight civic votes", canVote, "Voting records community sentiment with one vote per eligible participant. No role receives extra voting weight."),
      item("discussion", "Participate in civic discussions", canDiscuss, "Join eligible discussions and contribute context once verification allows participation."),
      item("evidence", "Submit evidence", canSubmitEvidence, "Submit source material or resident evidence through review-ready workflows."),
    ],
    nextSteps: [
      item("verification", "Complete verification when ready", canVote, "Verification unlocks voting, petitions, endorsements, and official messaging.", "provider_needed"),
      item("petitions", "Sign and create petitions", canUserSignPetitions(user), "Petitions require verification so public civic signals are harder to spoof."),
      item("official_messages", "Message officials", canUserMessagePublicFigures(user), "Official messaging unlocks after verification to keep outreach accountable."),
      item("truth_rating", "Rate source-backed claims", canUserRateTruth(user), "Truth rating is a stewardship action, not a voting-weight boost."),
    ],
    stewardship: [
      item("trusted_status", "Trusted Citizen stewardship", canSteward, "Trusted Citizen status is a reviewed stewardship role, not a popularity score.", "stewardship_available"),
      item("curate_evidence", "Curate evidence", canCurateEvidence, "Help organize source material and review context for public understanding.", "stewardship_available"),
      item("flag_claims", "Flag factual claims", canUserFlagFactualClaim(user), "Flag claims for review when public records or civic discussion need source checks.", "stewardship_available"),
      item("debates", "Create structured debates", canUserCreateDebate(user), "Start structured debates with evidence and moderation expectations.", "stewardship_available"),
      item("moderation", "Approve limited community proposals", canUserApproveEventProposal(user), "Stewardship can approve limited community proposals without becoming platform admin.", "stewardship_available"),
    ],
  };
}
