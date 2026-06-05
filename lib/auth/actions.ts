"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEV_ONLY_AUTH_ENABLED, GUEST_BROWSE_USER_ID, MOCK_AUTH_COOKIE, NEW_USER_DEMO_ID, PUBLIC_SESSION_VALUE } from "@/lib/auth/constants";
import { getSeedUserById, seedUsers } from "@/lib/auth/mock-users";
import { getUserProfileContent, updateUserProfileContent } from "@/lib/profile/details";
import { getCurrentSessionUser } from "@/lib/server/auth-session";
import { setStoredPublicProfiles, getAllPublicProfiles } from "@/lib/server/elections-context";
import {
  buildCandidateOfficialMatchStatus,
  buildRoleMatchSummary,
  clearOnboardingDraft,
  evaluateVoterVerification,
  getClaimMatchForProfile,
  getMatchedPublicProfileForIdentity,
  getOnboardingJurisdictionFromCommunity,
  getOnboardingDraft,
  resolveOnboardingSeedUserId,
  setOnboardingDraft,
} from "@/lib/server/onboarding";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getMockAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const AUTH_ERROR_STATE: AuthFormState = {
  status: "error",
  message: "Please review the highlighted fields.",
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateEmailPassword(email: string, password: string) {
  const fieldErrors: Record<string, string> = {};

  if (!isValidEmail(email)) {
    fieldErrors.email = "Please enter a valid email.";
  }

  if (password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  }

  return fieldErrors;
}

export async function signInWithDemoCredentials(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();
  const password = getFormString(formData, "password");
  const fieldErrors = validateEmailPassword(email, password);

  if (Object.keys(fieldErrors).length) {
    return { ...AUTH_ERROR_STATE, fieldErrors };
  }

  const matchedUser = seedUsers.find((user) => user.email.toLowerCase() === email && user.id !== GUEST_BROWSE_USER_ID);

  if (!matchedUser) {
    return {
      status: "error",
      message: "We couldn't sign you in. Check your email and password.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, matchedUser.id, getMockAuthCookieOptions());

  redirect("/");
}

export async function registerDemoAccount(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = getFormString(formData, "fullName");
  const email = getFormString(formData, "email").toLowerCase();
  const password = getFormString(formData, "password");
  const confirmPassword = getFormString(formData, "confirmPassword");
  const fieldErrors = validateEmailPassword(email, password);

  if (!fullName) {
    fieldErrors.fullName = "Please enter your name.";
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length) {
    return { ...AUTH_ERROR_STATE, fieldErrors };
  }

  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, NEW_USER_DEMO_ID, getMockAuthCookieOptions());

  await setOnboardingDraft({
    accountName: fullName,
    accountEmail: email,
    emailVerificationStatus: "unverified",
    antiBotScreened: true,
  });

  redirect("/get-started?step=verify");
}

export async function requestDemoPasswordReset(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();

  if (!isValidEmail(email)) {
    return {
      ...AUTH_ERROR_STATE,
      fieldErrors: {
        email: "Please enter a valid email.",
      },
    };
  }

  return {
    status: "success",
    message: "If an account exists for that email, a reset link has been sent.",
  };
}

export async function switchDevUser(formData: FormData) {
  if (!DEV_ONLY_AUTH_ENABLED) {
    return;
  }

  const nextUserId = formData.get("userId");
  const redirectTo = formData.get("redirectTo");

  if (typeof nextUserId !== "string") {
    return;
  }

  const cookieStore = await cookies();

  if (nextUserId === PUBLIC_SESSION_VALUE) {
    cookieStore.set(MOCK_AUTH_COOKIE, PUBLIC_SESSION_VALUE, getMockAuthCookieOptions());
    await clearOnboardingDraft();

    redirect("/auth");
  } else {
    if (!getSeedUserById(nextUserId)) {
      return;
    }

    cookieStore.set(MOCK_AUTH_COOKIE, nextUserId, getMockAuthCookieOptions());
  }

  redirect(typeof redirectTo === "string" && redirectTo ? redirectTo : "/");
}

export async function startDemoOnboarding() {
  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, NEW_USER_DEMO_ID, getMockAuthCookieOptions());

  await clearOnboardingDraft();
  redirect("/get-started?step=account&internal=1");
}

export async function startGuestBrowsing() {
  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, GUEST_BROWSE_USER_ID, getMockAuthCookieOptions());

  await clearOnboardingDraft();
  redirect("/explore");
}

export async function beginGuidedOnboarding(formData: FormData) {
  const fullName = getFormString(formData, "fullName");
  const email = getFormString(formData, "email");
  const phoneNumber = getFormString(formData, "phoneNumber");
  const claimProfileId = getFormString(formData, "claimProfileId");
  const seedUserId = resolveOnboardingSeedUserId(fullName);
  const cookieStore = await cookies();

  cookieStore.set(MOCK_AUTH_COOKIE, seedUserId, getMockAuthCookieOptions());

  await setOnboardingDraft({
    accountName: fullName,
    accountEmail: email,
    emailVerificationStatus: email ? "verified" : "unverified",
    phoneNumber,
    phoneVerificationStatus: phoneNumber ? "verified" : "pending",
    antiBotScreened: true,
    claimTargetProfileId: claimProfileId || null,
  });

  redirect(`/get-started?step=verify${claimProfileId ? `&claimProfile=${encodeURIComponent(claimProfileId)}` : ""}`);
}

export async function submitVoterVerification(formData: FormData) {
  const legalFirstName = getFormString(formData, "legalFirstName");
  const legalLastName = getFormString(formData, "legalLastName");
  const dateOfBirth = getFormString(formData, "dateOfBirth");
  const streetAddress = getFormString(formData, "streetAddress");
  const jurisdictionName = getFormString(formData, "jurisdictionName");
  const claimProfileId = getFormString(formData, "claimProfileId");
  const previous = (await getOnboardingDraft()) ?? {};
  const verification = evaluateVoterVerification({
    legalFirstName,
    legalLastName,
    dateOfBirth,
    streetAddress,
    jurisdictionName,
  });

  const nextDraft = {
    ...previous,
    legalFirstName,
    legalLastName,
    dateOfBirth,
    streetAddress,
    state: "Nevada",
    jurisdictionName,
    claimTargetProfileId: claimProfileId || previous.claimTargetProfileId || null,
    verificationStatus: verification.status,
    voterMatchConfidence: verification.confidence,
    matchedVoterRecordName: verification.matchedRecord
      ? `${verification.matchedRecord.legalFirstName} ${verification.matchedRecord.legalLastName}`
      : null,
  };
  const matchedProfile = await getMatchedPublicProfileForIdentity(nextDraft);

  await setOnboardingDraft({
    ...nextDraft,
    matchedPublicProfileId: matchedProfile?.id ?? null,
    matchedPublicProfileRole: matchedProfile
      ? matchedProfile.profileType === "official"
        ? "official"
        : "candidate"
      : null,
    candidateOfficialMatchStatus: buildCandidateOfficialMatchStatus(verification.status, matchedProfile),
    enhancedIdentityStatus: verification.status === "possibleMatch" ? "recommended" : "notNeeded",
    manualReviewStatus: verification.status === "possibleMatch" ? "available" : "notNeeded",
    riskFlags:
      verification.status === "possibleMatch"
        ? matchedProfile
          ? ["ambiguousVoterMatch", "claimRequiresEnhancedVerification"]
          : ["ambiguousVoterMatch"]
        : [],
  });

  redirect(`/get-started?step=verification-result${claimProfileId ? `&claimProfile=${encodeURIComponent(claimProfileId)}` : ""}`);
}

export async function submitCommunityAndIssuesSetup(formData: FormData) {
  const selectedCommunityId = getFormString(formData, "selectedCommunityId");
  const topIssueTitles = ["issue1", "issue2", "issue3"]
    .map((key) => getFormString(formData, key))
    .filter(Boolean);
  const claimProfileId = getFormString(formData, "claimProfileId");
  const previous = (await getOnboardingDraft()) ?? {};

  await setOnboardingDraft({
    ...previous,
    selectedCommunityId,
    jurisdictionName: getOnboardingJurisdictionFromCommunity(selectedCommunityId) || previous.jurisdictionName,
    topIssueTitles,
    claimTargetProfileId: claimProfileId || previous.claimTargetProfileId || null,
  });

  const currentUser = await getCurrentSessionUser();

  if (currentUser) {
    const currentContent = await getUserProfileContent(currentUser.id);
    await updateUserProfileContent(currentUser.id, {
      ...currentContent,
      primaryCommunityId: selectedCommunityId || currentContent.primaryCommunityId,
      localIssues: topIssueTitles.map((value) => ({ value, isCustom: false })),
      stateIssues: [],
      nationalIssues: [],
    });
  }

  redirect(`/get-started?step=role-match${claimProfileId ? `&claimProfile=${encodeURIComponent(claimProfileId)}` : ""}`);
}

export async function finishGuidedOnboarding(formData: FormData) {
  const claimProfileId = getFormString(formData, "claimProfileId");

  if (claimProfileId) {
    redirect(`/claim-profile/${claimProfileId}`);
  }

  redirect("/profile?onboarding=started");
}

export async function completeMatchedProfileClaim(formData: FormData) {
  const profileId = getFormString(formData, "profileId");
  const currentUser = await getCurrentSessionUser();
  const draft = await getOnboardingDraft();

  if (!currentUser || !profileId) {
    redirect(`/claim-profile/${profileId}`);
  }

  const claimMatch = await getClaimMatchForProfile(profileId, currentUser, draft);

  if (claimMatch.status !== "eligible" || !claimMatch.profile) {
    redirect(`/claim-profile/${profileId}?status=not-eligible`);
  }

  const profiles = await getAllPublicProfiles();
  const nextProfiles = profiles.map((profile) =>
    profile.id === profileId
      ? {
          ...profile,
          claimedByUserId: currentUser.id,
          isClaimed: true,
          claimStatus: "CLAIMED" as const,
          source: "user" as const,
        }
      : profile,
  );
  await setStoredPublicProfiles(nextProfiles);

  const claimedProfile = buildRoleMatchSummary(claimMatch.profile);
  await setOnboardingDraft({
    ...(draft ?? {}),
    matchedPublicProfileId: claimedProfile?.profileId ?? profileId,
    matchedPublicProfileRole: claimMatch.matchedRole === "official" ? "official" : "candidate",
  });

  redirect(`${claimMatch.matchedRole === "official" ? "/officials" : "/candidates"}/${profileId}?claim=success`);
}
