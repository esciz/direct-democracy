"use server";

import { cookies } from "next/headers";

import { MOCK_AUTH_COOKIE } from "@/lib/auth/constants";
import { getAuthCookieOptions } from "@/lib/auth/cookies";
import { confirmDurableMfaEnrollment, verifyDurableMfaChallenge } from "@/lib/identity/durable-security";
import { rotateDurableSession } from "@/lib/identity/durable-sessions";
import { MFA_SESSION_COOKIE } from "@/lib/identity/mfa-session";
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
  const result = await confirmDurableMfaEnrollment(user.id, getCode(formData));
  if (!result.ok) {
    return { status: "error", message: "That code could not be confirmed. Check your authenticator app and try again." };
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(MOCK_AUTH_COOKIE)?.value;
  if (!token) return { status: "error", message: "Please sign in again." };
  cookieStore.set(MOCK_AUTH_COOKIE, await rotateDurableSession(token, { mfaAuthenticatedAt: new Date() }), getAuthCookieOptions());
  cookieStore.delete(MFA_SESSION_COOKIE);
  return {
    status: "success",
    message: "MFA enrollment complete. Save these recovery codes now; they will not be shown again.",
    recoveryCodes: result.recoveryCodes,
  };
}

export async function confirmMfaChallengeAction(_previous: MfaActionState, formData: FormData): Promise<MfaActionState> {
  const user = await getCurrentSessionUser();
  if (!user) return { status: "error", message: "Please sign in again." };
  const result = await verifyDurableMfaChallenge(user.id, getCode(formData));
  if (!result.ok) {
    if (result.reason === "mfa_setup_unavailable") {
      return { status: "error", message: "Your authenticator setup is unavailable. Enter one unused recovery code to sign in, or contact an operator for MFA recovery." };
    }
    return { status: "error", message: "That code could not be confirmed. Try again or use a recovery code." };
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(MOCK_AUTH_COOKIE)?.value;
  if (!token) return { status: "error", message: "Please sign in again." };
  cookieStore.set(MOCK_AUTH_COOKIE, await rotateDurableSession(token, { mfaAuthenticatedAt: new Date() }), getAuthCookieOptions());
  cookieStore.delete(MFA_SESSION_COOKIE);
  return {
    status: "success",
    message: "MFA confirmed. You can continue to the admin dashboard.",
  };
}
