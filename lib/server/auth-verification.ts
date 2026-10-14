import "server-only";

import { cookies } from "next/headers";
import { DEV_ONLY_AUTH_ENABLED } from "@/lib/auth/constants";

import type { UserSummary } from "@/types/domain";
import { isVerificationOverrideMap, type VerificationOverrideMap } from "@/lib/auth/verification";

const USER_VERIFICATION_COOKIE = "dd_user_verification_state";

export async function getVerificationOverrides() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(USER_VERIFICATION_COOKIE)?.value;

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return isVerificationOverrideMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function setVerificationOverrides(overrides: VerificationOverrideMap) {
  const cookieStore = await cookies();
  cookieStore.set(USER_VERIFICATION_COOKIE, JSON.stringify(overrides), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function resolveUserVerification<T extends UserSummary>(user: T): Promise<T> {
  // Real accounts carry durable verification state; unsigned demo cookies may
  // only customize the explicitly enabled local demo experience.
  if (!DEV_ONLY_AUTH_ENABLED) return user;
  const overrides = await getVerificationOverrides();
  const baseState = overrides[user.id] ?? user.verificationState;
  const nextState = baseState === "voterVerified" ? "voterVerified" : "unverified";

  return {
    ...user,
    verificationState: nextState,
    isVerifiedVoter: nextState === "voterVerified",
  };
}
