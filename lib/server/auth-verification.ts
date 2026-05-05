import "server-only";

import { cookies } from "next/headers";

import type { UserSummary } from "@/types/domain";
import {
  isPendingStudentVerificationMap,
  isStudentModeStateMap,
  isVerificationOverrideMap,
  type PendingStudentVerificationMap,
  type StudentModeStateMap,
  type VerificationOverrideMap,
} from "@/lib/auth/verification";

const USER_VERIFICATION_COOKIE = "dd_user_verification_state";
const STUDENT_MODE_COOKIE = "dd_student_mode_state";
const STUDENT_MODE_PENDING_COOKIE = "dd_student_mode_pending";

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

export async function getStudentModeStateMap() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(STUDENT_MODE_COOKIE)?.value;

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return isStudentModeStateMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function setStudentModeStateMap(overrides: StudentModeStateMap) {
  const cookieStore = await cookies();
  cookieStore.set(STUDENT_MODE_COOKIE, JSON.stringify(overrides), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getPendingStudentVerificationMap() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(STUDENT_MODE_PENDING_COOKIE)?.value;

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return isPendingStudentVerificationMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function setPendingStudentVerificationMap(overrides: PendingStudentVerificationMap) {
  const cookieStore = await cookies();
  cookieStore.set(STUDENT_MODE_PENDING_COOKIE, JSON.stringify(overrides), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getStudentModeState(userId: string) {
  const overrides = await getStudentModeStateMap();
  return overrides[userId] ?? null;
}

export async function getPendingStudentVerification(userId: string) {
  const pending = await getPendingStudentVerificationMap();
  return pending[userId] ?? null;
}

export async function resolveUserVerification<T extends UserSummary>(user: T): Promise<T> {
  const overrides = await getVerificationOverrides();
  const studentModes = await getStudentModeStateMap();
  const studentMode = studentModes[user.id] ?? null;
  const baseState = overrides[user.id] ?? user.verificationState;
  const nextState =
    baseState === "voterVerified"
      ? "voterVerified"
      : studentMode?.enabled && studentMode.verified
        ? "campusVerified"
        : baseState;

  return {
    ...user,
    verificationState: nextState,
    isVerifiedVoter: nextState === "voterVerified",
    studentModeEnabled: studentMode?.enabled ?? user.studentModeEnabled ?? false,
    studentVerified: studentMode?.verified ?? user.studentVerified ?? false,
    studentEmail: studentMode?.email ?? user.studentEmail ?? null,
    studentCampusCommunityId: studentMode?.campusCommunityId ?? user.studentCampusCommunityId ?? null,
  };
}
