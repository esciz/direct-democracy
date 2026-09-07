"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEV_ONLY_AUTH_ENABLED, GUEST_BROWSE_USER_ID, MOCK_AUTH_COOKIE, NEW_USER_DEMO_ID, PUBLIC_SESSION_VALUE } from "@/lib/auth/constants";
import { clearAuthSessionCookies, getAuthCookieOptions } from "@/lib/auth/cookies";
import { getSeedUserById, seedUsers } from "@/lib/auth/mock-users";
import { createEmailVerificationRequest, updateEmailVerificationDeliveryStatus } from "@/lib/identity/accounts";
import { authenticateDurableLocalAccount, createDurableLocalAccount } from "@/lib/identity/durable-accounts";
import { createDurableSession, revokeDurableSession } from "@/lib/identity/durable-sessions";
import { changeDurablePassword } from "@/lib/identity/durable-security";
import { getEmailProviderStatus } from "@/lib/identity/email";
import { accountRecovery, identityEmailOrigin } from "@/lib/identity/account-recovery";
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
  getCanonicalOnboardingIssues,
  getMatchedPublicProfileForIdentity,
  getOnboardingCommunities,
  getOnboardingJurisdictionFromCommunity,
  getOnboardingDraft,
  resolveOnboardingSeedUserId,
  setOnboardingDraft,
} from "@/lib/server/onboarding";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getFormPassword(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
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

  if (password.length < 8 || password.length > 256) {
    fieldErrors.password = "Password must be between 8 and 256 characters.";
  }

  return fieldErrors;
}

export async function signInWithDemoCredentials(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();
  const password = getFormPassword(formData, "password");
  const fieldErrors = validateEmailPassword(email, password);

  if (Object.keys(fieldErrors).length) {
    return { ...AUTH_ERROR_STATE, fieldErrors };
  }

  const localResult = await authenticateDurableLocalAccount(email, password);
  if (localResult.ok) {
    const cookieStore = await cookies();
    await revokeDurableSession(cookieStore.get(MOCK_AUTH_COOKIE)?.value, "signed_in_again");
    cookieStore.set(MOCK_AUTH_COOKIE, localResult.sessionToken, getAuthCookieOptions());
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
  const password = getFormPassword(formData, "password");
  const confirmPassword = getFormPassword(formData, "confirmPassword");
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
  await revokeDurableSession(cookieStore.get(MOCK_AUTH_COOKIE)?.value, "account_registered");
  cookieStore.set(MOCK_AUTH_COOKIE, await createDurableSession(registeredAccountId), getAuthCookieOptions());

  redirect("/get-started?step=setup");
}

export async function signOutCurrentUser() {
  const cookieStore = await cookies();
  await revokeDurableSession(cookieStore.get(MOCK_AUTH_COOKIE)?.value);
  clearAuthSessionCookies(cookieStore);
  redirect("/auth");
}

export async function changeCurrentPassword(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const currentUser = await getCurrentSessionUser();
  const currentPassword = getFormPassword(formData, "currentPassword");
  const nextPassword = getFormPassword(formData, "nextPassword");
  const confirmPassword = getFormPassword(formData, "confirmPassword");
  const fieldErrors: Record<string, string> = {};

  if (!currentUser) {
    return { status: "error", message: "Please sign in again." };
  }
  if (nextPassword.length < 12 || nextPassword.length > 256) {
    fieldErrors.nextPassword = "Use between 12 and 256 characters.";
  }
  if (nextPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }
  if (Object.keys(fieldErrors).length) {
    return { ...AUTH_ERROR_STATE, fieldErrors };
  }

  const result = await changeDurablePassword(currentUser.id, currentPassword, nextPassword);
  if (!result.ok) {
    return { status: "error", message: "The password could not be changed. Check your current password." };
  }
  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, await createDurableSession(currentUser.id), getAuthCookieOptions());
  cookieStore.delete(MFA_SESSION_COOKIE);
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
  let status = "email-send-failed";
  try {
    const result = await accountRecovery.request({ accountId: currentUser.id, purpose: "account_email_verification", origin: identityEmailOrigin() });
    status = result.status === "sent" ? "email-sent" : result.status === "already_verified" ? "email-already-verified" : result.status === "rate_limited" ? "email-rate-limited" : "email-send-failed";
  } catch { /* A storage or delivery outage cannot verify the address. */ }
  redirect(`/account/verification?status=${status}#email-verification`);
}

export async function requestDemoPasswordReset(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = getFormString(formData, "email").toLowerCase();
  if (!isValidEmail(email)) return { ...AUTH_ERROR_STATE, fieldErrors: { email: "Please enter a valid email." } };
  if (getEmailProviderStatus() !== "production_provider_configured") return { status: "error", message: "Password recovery email is temporarily unavailable. Please try again later." };
  try {
    await accountRecovery.request({ email, purpose: "password_reset", origin: identityEmailOrigin() });
  } catch { /* Do not expose whether an email address exists during an outage. */ }
  return { status: "success", message: "If this email belongs to an eligible account, we’ll attempt to send a reset link. Check your inbox and spam folder; you can try again later if it does not arrive." };
}

export async function resetAccountPassword(_previousState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const token = getFormString(formData, "token");
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  const confirmPassword = typeof formData.get("confirmPassword") === "string" ? String(formData.get("confirmPassword")) : "";
  if (password.length < 8 || password.length > 256) return { ...AUTH_ERROR_STATE, fieldErrors: { password: "Use between 8 and 256 characters." } };
  if (password !== confirmPassword) return { ...AUTH_ERROR_STATE, fieldErrors: { confirmPassword: "Passwords do not match." } };
  try {
    const result = await accountRecovery.consume({ token, purpose: "password_reset", password });
    if (!result.ok) return { status: "error", message: "This reset link is invalid or expired. Request a new link from the sign-in page." };
    clearAuthSessionCookies(await cookies());
    return { status: "success", message: "Your password has been reset and existing sessions have been signed out. Sign in with your new password." };
  } catch {
    return { status: "error", message: "Your password could not be reset right now. Please try again." };
  }
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
  const currentUser = await getCurrentSessionUser();
  if (!currentUser) redirect("/auth");
  const selectedCommunityId = getFormString(formData, "selectedCommunityId");
  const topIssueTitles = [...new Set(["issue1", "issue2", "issue3"]
    .map((key) => getFormString(formData, key))
    .filter(Boolean))];
  const claimProfileId = getFormString(formData, "claimProfileId");
  const setupUrl = `/get-started?step=setup${claimProfileId ? `&claimProfile=${encodeURIComponent(claimProfileId)}` : ""}`;
  if (!getOnboardingCommunities().some((community) => community.id === selectedCommunityId)
    || topIssueTitles.some((title) => !getCanonicalOnboardingIssues().includes(title))) redirect(`${setupUrl}&error=preferences`);
  const previous = (await getOnboardingDraft()) ?? {};
  try {
    const currentContent = await getUserProfileContent(currentUser.id);
    await updateUserProfileContent(currentUser.id, {
      ...currentContent,
      primaryCommunityId: selectedCommunityId,
      localIssues: topIssueTitles.map((value) => ({ value, isCustom: false })),
    });
  } catch {
    console.error("[onboarding] Account preferences could not be saved.");
    redirect(`${setupUrl}&error=save`);
  }
  await setOnboardingDraft({
    ...previous,
    selectedCommunityId,
    jurisdictionName: getOnboardingJurisdictionFromCommunity(selectedCommunityId) || previous.jurisdictionName,
    topIssueTitles,
    claimTargetProfileId: claimProfileId || previous.claimTargetProfileId || null,
  });
  const nextStep = DEV_ONLY_AUTH_ENABLED || claimProfileId ? "role-match" : "finish";
  redirect(`/get-started?step=${nextStep}${claimProfileId ? `&claimProfile=${encodeURIComponent(claimProfileId)}` : ""}`);
}

export async function finishGuidedOnboarding(formData: FormData) {
  if (!await getCurrentSessionUser()) redirect("/auth");
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
