"use server";

import { cookies } from "next/headers";

import { MOCK_AUTH_COOKIE } from "@/lib/auth/constants";
import { getAuthCookieOptions } from "@/lib/auth/cookies";
import { confirmMfaEnrollment, verifyMfaChallenge } from "@/lib/identity/accounts";
import { createMfaSessionCookieValue, MFA_SESSION_COOKIE } from "@/lib/identity/mfa-session";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

export type MfaActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  recoveryCodes?: string[];
};

function getCode(formData: FormData) {
  const value = formData.get("code");
  return typeof value === "string" ? value.trim() : "";
}

export async function confirmMfaEnrollmentAction(_previous: MfaActionState, formData: FormData): Promise<MfaActionState> {
  const user = await getCurrentSessionUser();
  if (!user) return { status: "error", message: "Please sign in again." };
  const result = confirmMfaEnrollment(user.id, getCode(formData));
  if (!result.ok) {
    return { status: "error", message: "That code could not be confirmed. Check your authenticator app and try again." };
  }
  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, user.id, getAuthCookieOptions());
  cookieStore.set(MFA_SESSION_COOKIE, createMfaSessionCookieValue(user.id), getAuthCookieOptions());
  return {
    status: "success",
    message: "MFA enrollment complete. Save these recovery codes now; they will not be shown again.",
    recoveryCodes: result.recoveryCodes,
  };
}

export async function confirmMfaChallengeAction(_previous: MfaActionState, formData: FormData): Promise<MfaActionState> {
  const user = await getCurrentSessionUser();
  if (!user) return { status: "error", message: "Please sign in again." };
  const result = verifyMfaChallenge(user.id, getCode(formData));
  if (!result.ok) {
    return { status: "error", message: "That code could not be confirmed. Try again or use a recovery code." };
  }
  const cookieStore = await cookies();
  cookieStore.set(MOCK_AUTH_COOKIE, user.id, getAuthCookieOptions());
  cookieStore.set(MFA_SESSION_COOKIE, createMfaSessionCookieValue(user.id), getAuthCookieOptions());
  return {
    status: "success",
    message: "MFA confirmed. You can continue to the admin dashboard.",
  };
}
