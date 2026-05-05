"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import {
  getCaseById,
  getCaseSupportStatementAuthorName,
  getRemovedBriefThemeSupportKeys,
  getRemovedCaseFollowKeys,
  getStoredBriefThemes,
  getStoredBriefThemeSupports,
  getStoredCaseFollows,
  getStoredSupportStatements,
  setRemovedBriefThemeSupportKeys,
  setRemovedCaseFollowKeys,
  setStoredBriefThemes,
  setStoredBriefThemeSupports,
  setStoredCaseFollows,
  setStoredSupportStatements,
} from "@/lib/cases/store";
import type { CommunityBriefThemeSummary, SupportStatementSummary } from "@/types/domain";

function redirectWithError(path: string, error: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${error}`);
}

function getReturnPath(formData: FormData, fallback: string) {
  const returnPath = formData.get("returnPath");
  return typeof returnPath === "string" && returnPath ? returnPath : fallback;
}

export async function toggleCaseFollow(formData: FormData) {
  const user = await getCurrentUser();
  const caseId = formData.get("caseId");
  const returnPath = getReturnPath(formData, "/cases");

  if (typeof caseId !== "string") {
    redirect(returnPath);
  }

  const existing = await getStoredCaseFollows();
  const removedKeys = await getRemovedCaseFollowKeys();
  const existingIndex = existing.findIndex((entry) => entry.caseId === caseId && entry.userId === user.id);
  const caseDetail = await getCaseById(caseId, user);

  if (!caseDetail) {
    redirectWithError(returnPath, "case");
  }

  if (existingIndex >= 0) {
    await setStoredCaseFollows(existing.filter((_, index) => index !== existingIndex));
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}follow=removed`);
  }

  const removedKey = `${caseId}:${user.id}`;
  const seedFollowExists = caseDetail?.viewerIsFollowing ?? false;

  if (seedFollowExists && !removedKeys.includes(removedKey)) {
    await setRemovedCaseFollowKeys([removedKey, ...removedKeys]);
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}follow=removed`);
  }

  if (removedKeys.includes(removedKey)) {
    await setRemovedCaseFollowKeys(removedKeys.filter((key) => key !== removedKey));
  }

  const alreadySeededOrStored = existing.some((entry) => entry.caseId === caseId && entry.userId === user.id);

  if (alreadySeededOrStored) {
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}follow=added`);
  }

  await setStoredCaseFollows([
    {
      id: `case_follow_${caseId}_${user.id}`,
      caseId,
      userId: user.id,
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ]);

  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}follow=added`);
}

export async function supportCase(formData: FormData) {
  const user = await getCurrentUser();
  const caseId = formData.get("caseId");
  const statement = formData.get("statement");
  const isPublic = formData.get("isPublic") === "on";
  const returnPath = getReturnPath(formData, "/cases");

  if (typeof caseId !== "string") {
    redirect(returnPath);
  }

  if (!user.isVerifiedVoter) {
    redirectWithError(returnPath, "verification");
  }

  const caseDetail = await getCaseById(caseId, user);
  if (!caseDetail) {
    redirectWithError(returnPath, "case");
  }

  const trimmedStatement = typeof statement === "string" ? statement.trim() : "";
  if (trimmedStatement.length > 280) {
    redirectWithError(returnPath, "statement");
  }

  const existing = await getStoredSupportStatements();
  const nextStatement: SupportStatementSummary = {
    id: `case_statement_${caseId}_${user.id}`,
    caseId,
    userId: user.id,
    userName: getCaseSupportStatementAuthorName(user.id),
    statement: trimmedStatement || "This user publicly supports community attention on this case.",
    createdAt: new Date().toISOString(),
    isPublic,
  };

  await setStoredSupportStatements([
    nextStatement,
    ...existing.filter((entry) => !(entry.caseId === caseId && entry.userId === user.id)),
  ]);

  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}support=saved`);
}

export async function createCommunityBriefTheme(formData: FormData) {
  const user = await getCurrentUser();
  const caseId = formData.get("caseId");
  const title = formData.get("title");
  const description = formData.get("description");
  const returnPath = getReturnPath(formData, "/cases");

  if (user.role !== "trustedCitizen" && user.role !== "admin") {
    redirectWithError(returnPath, "theme-permissions");
  }

  if (typeof caseId !== "string") {
    redirectWithError(returnPath, "case");
  }

  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  const trimmedDescription = typeof description === "string" ? description.trim() : "";

  if (trimmedTitle.length < 6) {
    redirectWithError(returnPath, "theme-title");
  }

  if (trimmedDescription.length < 20) {
    redirectWithError(returnPath, "theme-description");
  }

  const existing = await getStoredBriefThemes();
  const nextTheme: Omit<CommunityBriefThemeSummary, "supportCount" | "viewerSupports"> = {
    id: `case_theme_${caseId}_${Date.now()}`,
    caseId,
    creatorUserId: user.id,
    creatorName: user.name,
    title: trimmedTitle,
    description: trimmedDescription,
    createdAt: new Date().toISOString(),
  };

  await setStoredBriefThemes([nextTheme, ...existing]);
  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}theme=created`);
}

export async function toggleBriefThemeSupport(formData: FormData) {
  const user = await getCurrentUser();
  const themeId = formData.get("themeId");
  const caseId = formData.get("caseId");
  const returnPath = getReturnPath(formData, "/cases");

  if (typeof themeId !== "string" || typeof caseId !== "string") {
    redirect(returnPath);
  }

  if (!user.isVerifiedVoter) {
    redirectWithError(returnPath, "verification");
  }

  const existing = await getStoredBriefThemeSupports();
  const removedKeys = await getRemovedBriefThemeSupportKeys();
  const existingIndex = existing.findIndex((entry) => entry.themeId === themeId && entry.userId === user.id);

  if (existingIndex >= 0) {
    await setStoredBriefThemeSupports(existing.filter((_, index) => index !== existingIndex));
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}themeSupport=removed`);
  }

  const removedKey = `${themeId}:${user.id}`;
  const caseDetail = await getCaseById(caseId, user);
  const viewerAlreadySupportsSeededTheme = caseDetail?.communityBriefThemes.some(
    (theme) => theme.id === themeId && theme.viewerSupports,
  );

  if (viewerAlreadySupportsSeededTheme && !removedKeys.includes(removedKey)) {
    await setRemovedBriefThemeSupportKeys([removedKey, ...removedKeys]);
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}themeSupport=removed`);
  }

  if (removedKeys.includes(removedKey)) {
    await setRemovedBriefThemeSupportKeys(removedKeys.filter((key) => key !== removedKey));
  }

  await setStoredBriefThemeSupports([
    {
      id: `case_theme_support_${themeId}_${user.id}`,
      themeId,
      userId: user.id,
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ]);

  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}themeSupport=added`);
}
