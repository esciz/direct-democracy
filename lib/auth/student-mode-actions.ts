"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import {
  isEduEmail,
} from "@/lib/auth/verification";
import { getCampusCommunities } from "@/lib/community/communities";
import { getUserProfileContent, updateUserProfileContent } from "@/lib/profile/details";
import {
  getPendingStudentVerificationMap,
  getStudentModeStateMap,
  setPendingStudentVerificationMap,
  setStudentModeStateMap,
} from "@/lib/server/auth-verification";

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function startStudentModeVerification(formData: FormData) {
  const currentUser = await getCurrentUser();
  const email = typeof formData.get("studentEmail") === "string" ? String(formData.get("studentEmail")).trim().toLowerCase() : "";
  const requestedCampusId =
    typeof formData.get("campusCommunityId") === "string" ? String(formData.get("campusCommunityId")).trim() : "";

  if (!isEduEmail(email)) {
    redirect("/profile?studentMode=invalid-email");
  }

  const validCampusId = getCampusCommunities().some((community) => community.id === requestedCampusId) ? requestedCampusId : "";

  if (!validCampusId) {
    redirect("/profile?studentMode=select-campus");
  }

  const code = generateVerificationCode();
  const pending = await getPendingStudentVerificationMap();

  pending[currentUser.id] = {
    email,
    code,
    campusCommunityId: validCampusId,
    createdAt: new Date().toISOString(),
  };

  await setPendingStudentVerificationMap(pending);

  redirect(`/profile?studentMode=code-sent&studentDemoCode=${code}`);
}

export async function confirmStudentModeVerification(formData: FormData) {
  const currentUser = await getCurrentUser();
  const code = typeof formData.get("studentVerificationCode") === "string" ? String(formData.get("studentVerificationCode")).trim() : "";
  const pending = await getPendingStudentVerificationMap();
  const activeRequest = pending[currentUser.id];

  if (!activeRequest) {
    redirect("/profile?studentMode=no-pending-code");
  }

  if (activeRequest.code !== code) {
    redirect("/profile?studentMode=invalid-code");
  }

  const studentModes = await getStudentModeStateMap();
  studentModes[currentUser.id] = {
    enabled: true,
    verified: true,
    email: activeRequest.email,
    campusCommunityId: activeRequest.campusCommunityId,
    verifiedAt: new Date().toISOString(),
  };
  delete pending[currentUser.id];

  await Promise.all([setStudentModeStateMap(studentModes), setPendingStudentVerificationMap(pending)]);

  const currentContent = await getUserProfileContent(currentUser.id);
  const campusCommunityIds = activeRequest.campusCommunityId
    ? Array.from(new Set([activeRequest.campusCommunityId, ...currentContent.campusCommunityIds])).slice(0, 1)
    : currentContent.campusCommunityIds;

  await updateUserProfileContent(currentUser.id, {
    ...currentContent,
    campusCommunityIds,
    favoriteClasses: currentContent.favoriteClasses ?? [],
  });

  redirect("/profile?studentMode=verified");
}

export async function disableStudentMode() {
  const currentUser = await getCurrentUser();
  const [studentModes, pending] = await Promise.all([getStudentModeStateMap(), getPendingStudentVerificationMap()]);

  delete studentModes[currentUser.id];
  delete pending[currentUser.id];

  await Promise.all([setStudentModeStateMap(studentModes), setPendingStudentVerificationMap(pending)]);

  redirect("/profile?studentMode=disabled");
}
