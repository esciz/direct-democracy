import type { UserProgressionSummary, UserRole } from "@/types/domain";

import { getUserSocialSummary } from "@/lib/social/follows";

export const ORDERED_ROLE_PROGRESSION: Array<{ role: UserRole; label: string }> = [
  { role: "citizen", label: "Citizen" },
  { role: "trustedCitizen", label: "Trusted Citizen" },
  { role: "candidate", label: "Candidate" },
  { role: "official", label: "Official" },
];

function getRoleIndex(role: UserRole) {
  const roleIndex = ORDERED_ROLE_PROGRESSION.findIndex((step) => step.role === role);
  return roleIndex >= 0 ? roleIndex : 0;
}

export function getSafeProgressionSteps(role: UserRole) {
  const normalizedIndex = getRoleIndex(role);

  return ORDERED_ROLE_PROGRESSION.map((step, index): UserProgressionSummary["steps"][number] => ({
    role: step.role,
    label: step.label,
    state: index < normalizedIndex ? "complete" : index === normalizedIndex ? "current" : "upcoming",
    requirement:
      step.role === "trustedCitizen"
        ? "Voter verification and community-backed support"
        : step.role === "candidate"
          ? "Run in an election"
          : step.role === "official"
            ? "Hold or win office"
            : undefined,
  }));
}

export function getSafeNextStepRequirement(role: UserRole) {
  if (role === "citizen") {
    return "Next milestone: Trusted Citizen. This opens after voter verification and demonstrated community support.";
  }

  if (role === "trustedCitizen") {
    return "Next milestone: Candidate. Trusted citizens can choose to run for office when they are ready.";
  }

  if (role === "candidate") {
    return "Next milestone: Official. Candidates who win or hold office appear here as officials.";
  }

  return "You are already at the highest public role currently shown in progression.";
}

export function getSafeUserProgressionSummary(role: UserRole) {
  const steps = getSafeProgressionSteps(role);

  return {
    currentRole: role,
    followerCount: 0,
    trustedCitizenScopes: [],
    steps,
    completedStepCount: steps.filter((step) => step.state === "complete").length,
    nextStepRequirement: getSafeNextStepRequirement(role),
  };
}

export async function getUserProgression(
  role: UserRole,
  userId: string,
  followerCount: number,
): Promise<UserProgressionSummary> {
  const social = await getUserSocialSummary(userId, followerCount);
  const trustedCitizenScopes = social.trustedProgressByCommunity;
  const nextEligibleScope = trustedCitizenScopes.find((scope) => scope.eligible);
  const nextIncompleteScope = trustedCitizenScopes.find((scope) => !scope.eligible && !scope.alreadyTrusted);

  const nextStepRequirement =
    role === "citizen"
      ? nextEligibleScope
        ? `You have met the current Trusted Citizen requirements in ${nextEligibleScope.communityName}.`
        : nextIncompleteScope
          ? `${Math.max(0, nextIncompleteScope.followerTarget - nextIncompleteScope.currentFollowers).toLocaleString()} more followers and ${Math.max(0, nextIncompleteScope.engagementTarget - nextIncompleteScope.engagedFollowerCount).toLocaleString()} more engaged supporters for ${nextIncompleteScope.communityName}.`
          : "Trusted Citizen progress appears once your community and verification details are set."
      : role === "trustedCitizen"
        ? "Trusted citizens may choose to run as candidates"
        : role === "candidate"
          ? "Candidates who hold office appear as officials"
          : undefined;

  return {
    currentRole: role,
    followerCount: social.followerCount,
    trustedCitizenScopes,
    steps: getSafeProgressionSteps(role).map((step) => ({
      ...step,
      requirement:
        step.role === "trustedCitizen"
          ? "Voter verification, community-specific follower support, and engaged supporters"
          : step.requirement,
    })),
    nextStepRequirement,
  };
}
