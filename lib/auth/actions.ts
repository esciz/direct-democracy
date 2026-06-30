"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DEV_ONLY_AUTH_ENABLED, GUEST_BROWSE_USER_ID, MOCK_AUTH_COOKIE, NEW_USER_DEMO_ID, PUBLIC_SESSION_VALUE } from "@/lib/auth/constants";
import { clearAuthSessionCookies, getAuthCookieOptions } from "@/lib/auth/cookies";
import { getSeedUserById, seedUsers } from "@/lib/auth/mock-users";
import { changeLocalPassword, createEmailVerificationRequest, updateEmailVerificationDeliveryStatus } from "@/lib/identity/accounts";
import { authenticateDurableLocalAccount, createDurableLocalAccount } from "@/lib/identity/durable-accounts";
import { sendIdentityEmail } from "@/lib/identity/email";
import { MFA_SESSION_COOKIE } from "@/lib/identity/mfa-session";
import { evaluateVoterVerification } from "@/lib/onboarding/voter-provider";
import { getUserProfileContent, updateUserProfileContent } from "@/lib/profile/details";
import { getCurrentSessionUser } from "@/lib/server/auth-session";
import { setStoredPublicProfiles, getAllPublicProfiles } from "@/lib/server/elections-context";
import {
  buildCandidateOfficialMatchStatus,
  buildRoleMatchSummary,
  clearOnboardingDraft,
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

async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
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

  const localResult = await authenticateDurableLocalAccount(email, password);
  if (localResult.ok) {
    const cookieStore = await cookies();
    cookieStore.set(MOCK_AUTH_COOKIE, localResult.account.id, getAuthCookieOptions());
    cookieStore.delete(MFA_SESSION_COOKIE);
    if (localResult.account.mustChangePassword) redirect("/account/security/change-password");
    if (localResult.account.mfaEnrollmentRequired && !localResult.account.mfaEnrolledAt) redirect("/account/security/mfa/enroll");
    if (localResult.account.mfaEnabled) redirect("/account/security/mfa/challenge");
    redirect("/");
  }

  const matchedUser = DEV_ONLY_AUTH_ENABLED ? seedUsers.find((user) => user.email.toLowerCase() === email && user.id !== GUEST_BROWSE_USER_ID) : null;

  if (!matchedUser) {
    return {
      status: "error",
      message: "We couldn't sign you in. Check your email and password.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, matchedUser.id, getAuthCookieOptions());

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

  let registeredAccountId: string;
  try {
    const account = await createDurableLocalAccount({
      email,
      name: fullName,
      password,
      emailVerified: false,
      role: "citizen",
    });
    registeredAccountId = account.id;
  } catch {
    return {
      status: "error",
      message: "If that email can be used, we will continue account setup. Try signing in or resetting your password.",
    };
  }

  await setOnboardingDraft({
    accountName: fullName,
    accountEmail: email,
    emailVerificationStatus: "unverified",
    antiBotScreened: true,
  });

  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, registeredAccountId, getAuthCookieOptions());

  redirect("/get-started?step=verify");
}

export async function signOutCurrentUser() {
  const cookieStore = await cookies();
  clearAuthSessionCookies(cookieStore);
  redirect("/auth");
}

export async function changeCurrentPassword(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const currentUser = await getCurrentSessionUser();
  const currentPassword = getFormString(formData, "currentPassword");
  const nextPassword = getFormString(formData, "nextPassword");
  const confirmPassword = getFormString(formData, "confirmPassword");
  const fieldErrors: Record<string, string> = {};

  if (!currentUser) {
    return { status: "error", message: "Please sign in again." };
  }
  if (nextPassword.length < 12) {
    fieldErrors.nextPassword = "Use at least 12 characters.";
  }
  if (nextPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }
  if (Object.keys(fieldErrors).length) {
    return { ...AUTH_ERROR_STATE, fieldErrors };
  }

  const result = changeLocalPassword(currentUser.id, currentPassword, nextPassword);
  if (!result.ok) {
    return { status: "error", message: "The password could not be changed. Check your current password." };
  }

  return { status: "success", message: "Password changed. Continue to the admin console or civic dashboard." };
}

export async function changeCurrentPasswordFromForm(formData: FormData) {
  const result = await changeCurrentPassword({ status: "idle" }, formData);
  if (result.status === "success") redirect("/");
  redirect("/account/security/change-password?error=password");
}

export async function requestCurrentEmailVerificationAction() {
  const currentUser = await getCurrentSessionUser();
  if (!currentUser) redirect("/auth");

  const request = createEmailVerificationRequest(currentUser.id);
  if (!request.ok) redirect("/account/verification?status=email-error#email-verification");
  if (request.alreadyVerified) redirect("/account/verification?status=email-already-verified#email-verification");

  const origin = await getRequestOrigin();
  const verificationUrl = `${origin}/account/verify-email?token=${encodeURIComponent(request.token)}`;
  const delivery = await sendIdentityEmail({
    to: request.account.email,
    purpose: "account_email_verification",
    subject: "Verify your Direct Democracy email",
    text: [
      "Verify your Direct Democracy email address using this secure one-time link:",
      verificationUrl,
      `This link expires at ${new Date(request.expiresAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} Pacific time.`,
      "If you did not request this, you can ignore this email.",
    ].join("\n\n"),
  });
  updateEmailVerificationDeliveryStatus(currentUser.id, delivery.status);
  redirect(`/account/verification?status=${delivery.ok ? "email-sent" : "email-send-failed"}#email-verification`);
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
    cookieStore.set(MOCK_AUTH_COOKIE, PUBLIC_SESSION_VALUE, getAuthCookieOptions());
    await clearOnboardingDraft();

    redirect("/auth");
  } else {
    if (!getSeedUserById(nextUserId)) {
      return;
    }

    cookieStore.set(MOCK_AUTH_COOKIE, nextUserId, getAuthCookieOptions());
  }

  redirect(typeof redirectTo === "string" && redirectTo ? redirectTo : "/");
}

export async function startDemoOnboarding() {
  if (!DEV_ONLY_AUTH_ENABLED) redirect("/auth");

  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, NEW_USER_DEMO_ID, getAuthCookieOptions());

  await clearOnboardingDraft();
  redirect("/get-started?step=account&internal=1");
}

export async function startGuestBrowsing() {
  if (!DEV_ONLY_AUTH_ENABLED) redirect("/auth");

  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, GUEST_BROWSE_USER_ID, getAuthCookieOptions());

  await clearOnboardingDraft();
  redirect("/explore");
}

export async function beginGuidedOnboarding(formData: FormData) {
  if (!DEV_ONLY_AUTH_ENABLED) redirect("/auth");

  const fullName = getFormString(formData, "fullName");
  const email = getFormString(formData, "email");
  const phoneNumber = getFormString(formData, "phoneNumber");
  const claimProfileId = getFormString(formData, "claimProfileId");
  const seedUserId = resolveOnboardingSeedUserId(fullName);
  const cookieStore = await cookies();

  cookieStore.set(MOCK_AUTH_COOKIE, seedUserId, getAuthCookieOptions());

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
    manualReviewStatus: verification.status === "strongMatch" ? "notNeeded" : "available",
    riskFlags:
      verification.status === "possibleMatch"
        ? matchedProfile
          ? ["ambiguousVoterMatch", "claimRequiresEnhancedVerification"]
          : ["ambiguousVoterMatch"]
        : verification.status === "sourceUnavailable" || verification.status === "noMatch"
          ? ["manualReviewRequired"]
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
