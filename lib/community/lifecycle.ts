import type { IssueLifecycleSummary, PetitionSummary, SponsorshipRequestSummary, TopIssueSummary } from "@/types/domain";

export function getPetitionLifecycle(
  petition: Pick<PetitionSummary, "signatureCount" | "signatureGoal" | "eligibleForCosponsorship">,
  sponsorshipRequests: SponsorshipRequestSummary[],
  isDrafting = false,
): IssueLifecycleSummary {
  if (isDrafting) {
    return {
      currentStage: "Drafting",
      petitionSignatureCount: petition.signatureCount,
      petitionSignatureGoal: petition.signatureGoal,
      petitionEligibleForCosponsorship: petition.eligibleForCosponsorship,
      sponsorshipRequested: sponsorshipRequests.length > 0,
      explanation: "The petition has moved beyond sponsorship and is now being shaped into an early drafting proposal.",
    };
  }

  if (sponsorshipRequests.length > 0) {
    return {
      currentStage: "Sponsored",
      petitionSignatureCount: petition.signatureCount,
      petitionSignatureGoal: petition.signatureGoal,
      petitionEligibleForCosponsorship: petition.eligibleForCosponsorship,
      sponsorshipRequested: true,
      explanation: "A public sponsorship request has been posted for this petition and targeted officials can now review it publicly.",
    };
  }

  if (petition.eligibleForCosponsorship) {
    return {
      currentStage: "Seeking Sponsor",
      petitionSignatureCount: petition.signatureCount,
      petitionSignatureGoal: petition.signatureGoal,
      petitionEligibleForCosponsorship: petition.eligibleForCosponsorship,
      sponsorshipRequested: false,
      explanation: "This petition has reached the signature threshold and is ready for public sponsorship requests.",
    };
  }

  return {
    currentStage: "Petition",
    petitionSignatureCount: petition.signatureCount,
    petitionSignatureGoal: petition.signatureGoal,
    petitionEligibleForCosponsorship: petition.eligibleForCosponsorship,
    sponsorshipRequested: false,
    explanation: "The issue is in petition form and is still collecting signatures before it can seek sponsorship.",
  };
}

export function getIssueLifecycle(topIssue: TopIssueSummary, relatedPetition?: PetitionSummary | null): IssueLifecycleSummary {
  if (!relatedPetition) {
    return {
      currentStage: "Issue",
      sponsorshipRequested: false,
      explanation: `This topic is active in ${topIssue.jurisdictionName}, but it has not yet been connected to a petition in the MVP demo.`,
    };
  }

  return getPetitionLifecycle(relatedPetition, []);
}
