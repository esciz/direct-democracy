import type { AuthUser, UserSummary, UserVerificationState } from "@/types/domain";

export type VerificationOverrideMap = Record<string, UserVerificationState>;

export function isVerificationState(value: unknown): value is UserVerificationState {
  return value === "unverified" || value === "voterVerified";
}

export function isVerificationOverrideMap(value: unknown): value is VerificationOverrideMap {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isVerificationState);
}

export function isVoterVerifiedUser(user: Pick<AuthUser, "verificationState" | "isVerifiedVoter">) {
  return user.verificationState === "voterVerified" || user.isVerifiedVoter;
}

export function getVerificationLabel(state: UserVerificationState) {
  switch (state) {
    case "voterVerified":
      return "Voter-Verified Citizen";
    case "unverified":
      return "Unverified User";
  }
}

export function getVerificationDescription(state: UserVerificationState) {
  switch (state) {
    case "voterVerified":
      return "Full civic participation is unlocked, including voting, petition signing, endorsements, and messaging public officials.";
    case "unverified":
      return "You can explore civic records and communities now. Voter verification unlocks voting, petition signing, endorsements, and official messaging.";
  }
}

export function getUnlockedFeatureLabels(state: UserVerificationState) {
  if (state === "voterVerified") {
    return ["Browse communities", "RSVP to public events", "Voting", "Petitions", "Messaging officials"];
  }

  return ["Browse communities", "View civic records", "Follow issues"];
}

export function getLockedFeatureLabels(state: UserVerificationState) {
  if (state === "voterVerified") {
    return [];
  }

  return ["Voting", "Truth ratings", "Endorsements", "Petition signing", "Messaging officials"];
}
