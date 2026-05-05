"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { BOOST_COST, getAllCreditBoosts, getCreditBalance, getStoredCreditBoosts, setStoredCreditBoosts } from "@/lib/engagement/credits";
import type { CreditBoostSummary } from "@/types/domain";

function redirectWithStatus(returnPath: string, key: string, value: string) {
  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}${key}=${value}`);
}

export async function boostTopIssue(formData: FormData) {
  const currentUser = await getCurrentUser();
  const issueId = formData.get("issueId");
  const returnPath = formData.get("returnPath");

  if (typeof issueId !== "string" || typeof returnPath !== "string") {
    redirect("/my-community");
  }

  const [balance, allBoosts, storedBoosts] = await Promise.all([
    getCreditBalance(currentUser.id),
    getAllCreditBoosts(),
    getStoredCreditBoosts(),
  ]);

  if (allBoosts.some((boost) => boost.userId === currentUser.id && boost.targetType === "issue" && boost.targetId === issueId)) {
    redirectWithStatus(returnPath, "boost", "exists");
  }

  if (balance < BOOST_COST) {
    redirectWithStatus(returnPath, "boost", "insufficient");
  }

  const nextBoost: CreditBoostSummary = {
    id: `boost_issue_${Date.now()}`,
    userId: currentUser.id,
    targetType: "issue",
    targetId: issueId,
    createdAt: new Date().toISOString(),
    creditsSpent: BOOST_COST,
  };

  await setStoredCreditBoosts([nextBoost, ...storedBoosts]);
  redirectWithStatus(returnPath, "boost", "success");
}

export async function boostTopVoice(formData: FormData) {
  const currentUser = await getCurrentUser();
  const targetUserId = formData.get("targetUserId");
  const returnPath = formData.get("returnPath");

  if (typeof targetUserId !== "string" || typeof returnPath !== "string") {
    redirect("/my-community");
  }

  if (targetUserId === currentUser.id) {
    redirectWithStatus(returnPath, "boost", "self");
  }

  const [balance, allBoosts, storedBoosts] = await Promise.all([
    getCreditBalance(currentUser.id),
    getAllCreditBoosts(),
    getStoredCreditBoosts(),
  ]);

  if (allBoosts.some((boost) => boost.userId === currentUser.id && boost.targetType === "voice" && boost.targetId === targetUserId)) {
    redirectWithStatus(returnPath, "boost", "exists");
  }

  if (balance < BOOST_COST) {
    redirectWithStatus(returnPath, "boost", "insufficient");
  }

  const nextBoost: CreditBoostSummary = {
    id: `boost_voice_${Date.now()}`,
    userId: currentUser.id,
    targetType: "voice",
    targetId: targetUserId,
    createdAt: new Date().toISOString(),
    creditsSpent: BOOST_COST,
  };

  await setStoredCreditBoosts([nextBoost, ...storedBoosts]);
  redirectWithStatus(returnPath, "boost", "success");
}
