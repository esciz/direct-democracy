import type { AuthUser, UserSummary, UserVerificationState } from "@/types/domain";

export type VerificationOverrideMap = Record<string, UserVerificationState>;
export type StudentModeState = {
  enabled: boolean;
  verified: boolean;
  email: string;
  campusCommunityId: string | null;
  verifiedAt: string;
};
export type StudentModeStateMap = Record<string, StudentModeState>;
export type PendingStudentVerification = {
  email: string;
  code: string;
  campusCommunityId: string | null;
  createdAt: string;
};
export type PendingStudentVerificationMap = Record<string, PendingStudentVerification>;

export function isVerificationState(value: unknown): value is UserVerificationState {
  return value === "unverified" || value === "campusVerified" || value === "voterVerified";
}

export function isVerificationOverrideMap(value: unknown): value is VerificationOverrideMap {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isVerificationState);
}

export function isStudentModeState(value: unknown): value is StudentModeState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const state = value as Record<string, unknown>;

  return (
    typeof state.enabled === "boolean" &&
    typeof state.verified === "boolean" &&
    typeof state.email === "string" &&
    (typeof state.campusCommunityId === "string" || state.campusCommunityId === null) &&
    typeof state.verifiedAt === "string"
  );
}

export function isStudentModeStateMap(value: unknown): value is StudentModeStateMap {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isStudentModeState);
}

export function isPendingStudentVerification(value: unknown): value is PendingStudentVerification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const pending = value as Record<string, unknown>;

  return (
    typeof pending.email === "string" &&
    typeof pending.code === "string" &&
    (typeof pending.campusCommunityId === "string" || pending.campusCommunityId === null) &&
    typeof pending.createdAt === "string"
  );
}

export function isPendingStudentVerificationMap(value: unknown): value is PendingStudentVerificationMap {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isPendingStudentVerification);
}

export function isEduEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.edu$/i.test(email.trim());
}

export function isVoterVerifiedUser(user: Pick<AuthUser, "verificationState" | "isVerifiedVoter">) {
  return user.verificationState === "voterVerified" || user.isVerifiedVoter;
}

export function isCampusVerifiedUser(user: Pick<AuthUser, "verificationState">) {
  return user.verificationState === "campusVerified";
}

export function getVerificationLabel(state: UserVerificationState) {
  switch (state) {
    case "voterVerified":
      return "Voter-Verified Citizen";
    case "campusVerified":
      return "Campus-Verified User";
    case "unverified":
      return "Unverified User";
  }
}

export function getVerificationDescription(state: UserVerificationState) {
  switch (state) {
    case "voterVerified":
      return "Full civic participation is unlocked, including voting, petition signing, endorsements, and messaging public officials.";
    case "campusVerified":
      return "Campus communities are publicly viewable by everyone, and your student verification now unlocks campus association, events, RSVPs, and attendance-based participation while official civic influence features stay locked.";
    case "unverified":
      return "You can explore all communities, including campus pages, and attend events, but campus membership and official civic influence features stay locked until you verify.";
  }
}

export function getUnlockedFeatureLabels(state: UserVerificationState) {
  if (state === "voterVerified") {
    return ["Browse communities", "RSVP to events", "Event-based posting", "Voting", "Petitions", "Messaging officials"];
  }

  if (state === "campusVerified") {
    return ["Browse communities", "Join campus communities", "RSVP to events", "Confirmed attendee event posts"];
  }

  return ["Browse communities", "View campus communities", "RSVP to events", "Confirmed attendee event posts"];
}

export function getLockedFeatureLabels(state: UserVerificationState) {
  if (state === "voterVerified") {
    return [];
  }

  return ["Voting", "Truth ratings", "Endorsements", "Petition signing", "Messaging officials"];
}

export function getStudentVerificationLabel(user: Pick<AuthUser, "studentModeEnabled" | "studentVerified">) {
  if (user.studentModeEnabled && user.studentVerified) {
    return "Student Verified";
  }

  if (user.studentModeEnabled) {
    return "Student Mode";
  }

  return "Student Mode Off";
}

export function getStudentVerificationDescription(user: Pick<AuthUser, "studentModeEnabled" | "studentVerified">) {
  if (user.studentModeEnabled && user.studentVerified) {
    return "Student Mode is on. Your .edu verification unlocks campus participation while voter-based civic permissions stay separate.";
  }

  if (user.studentModeEnabled) {
    return "Student Mode is almost ready. Finish .edu verification to show Student Verified on your profile and campus posts.";
  }

  return "Student Mode is optional and off by default. Turn it on with a verified .edu email to add campus identity features without unlocking voter-only civic actions.";
}
