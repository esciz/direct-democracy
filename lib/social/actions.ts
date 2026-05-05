"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { seedUsers } from "@/lib/auth/mock-users";
import { recordRoleTransition } from "@/lib/profile/role-progression";
import { hasEligibleTrustedScope } from "@/lib/social/trusted-status";
import {
  getAllFollows,
  getFollowState,
  getIssueFollowState,
  getRemovedFollowKeys,
  getStoredFollows,
  getStoredIssueFollows,
  setRemovedFollowKeys,
  setStoredFollows,
  setStoredIssueFollows,
} from "@/lib/social/follows";
import type { FollowSummary, IssueFollowSummary } from "@/types/domain";

function buildReturnPath(path: string, status: string) {
  return `${path}${path.includes("?") ? "&" : "?"}follow=${status}`;
}

export async function followUser(formData: FormData) {
  const currentUser = await getCurrentUser();
  const targetUserId = formData.get("targetUserId");
  const returnPath = formData.get("returnPath");

  if (typeof targetUserId !== "string" || typeof returnPath !== "string") {
    redirect("/profile");
  }

  if (targetUserId === currentUser.id) {
    redirect(buildReturnPath(returnPath, "self"));
  }

  if (!seedUsers.some((user) => user.id === targetUserId)) {
    redirect(buildReturnPath(returnPath, "missing"));
  }

  const storedFollows = await getStoredFollows();
  const removedKeys = await getRemovedFollowKeys();
  const followKey = `${currentUser.id}:${targetUserId}`;
  const alreadyFollowing = (await getAllFollows()).some(
    (follow) => follow.followerUserId === currentUser.id && follow.followingUserId === targetUserId,
  );

  if (alreadyFollowing) {
    redirect(buildReturnPath(returnPath, "exists"));
  }

  const nextFollow: FollowSummary = {
    id: `follow_created_${Date.now()}`,
    followerUserId: currentUser.id,
    followingUserId: targetUserId,
    createdAt: new Date().toISOString(),
  };

  await setStoredFollows([nextFollow, ...storedFollows.filter((follow) => !(follow.followerUserId === currentUser.id && follow.followingUserId === targetUserId))]);
  await setRemovedFollowKeys(removedKeys.filter((key) => key !== followKey));

  const targetUser = seedUsers.find((user) => user.id === targetUserId);
  if (targetUser?.role === "citizen") {
    const updatedFollowState = await getFollowState(currentUser.id, targetUserId, targetUser.followerCount);

    if (hasEligibleTrustedScope(updatedFollowState.trustedProgressByCommunity)) {
      await recordRoleTransition({
        userId: targetUser.id,
        userName: targetUser.name,
        fromRole: "citizen",
        toRole: "trustedCitizen",
        jurisdictionName: targetUser.jurisdictionName,
      });
    }
  }

  redirect(buildReturnPath(returnPath, "success"));
}

export async function unfollowUser(formData: FormData) {
  const currentUser = await getCurrentUser();
  const targetUserId = formData.get("targetUserId");
  const returnPath = formData.get("returnPath");

  if (typeof targetUserId !== "string" || typeof returnPath !== "string") {
    redirect("/profile");
  }

  const storedFollows = await getStoredFollows();
  const removedKeys = await getRemovedFollowKeys();
  const followKey = `${currentUser.id}:${targetUserId}`;
  await setStoredFollows(
    storedFollows.filter(
      (follow) => !(follow.followerUserId === currentUser.id && follow.followingUserId === targetUserId),
    ),
  );
  await setRemovedFollowKeys([...new Set([...removedKeys, followKey])]);

  redirect(buildReturnPath(returnPath, "removed"));
}

export async function followIssue(formData: FormData) {
  const currentUser = await getCurrentUser();
  const issueId = formData.get("issueId");
  const returnPath = formData.get("returnPath");

  if (typeof issueId !== "string" || typeof returnPath !== "string") {
    redirect("/my-community");
  }

  const issueState = await getIssueFollowState(currentUser.id, issueId);

  if (issueState.viewerIsFollowing) {
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}issueFollow=exists`);
  }

  const stored = await getStoredIssueFollows();
  const nextFollow: IssueFollowSummary = {
    id: `issue_follow_${Date.now()}`,
    userId: currentUser.id,
    issueId,
    createdAt: new Date().toISOString(),
  };

  await setStoredIssueFollows([nextFollow, ...stored.filter((entry) => !(entry.userId === currentUser.id && entry.issueId === issueId))]);
  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}issueFollow=success`);
}

export async function unfollowIssue(formData: FormData) {
  const currentUser = await getCurrentUser();
  const issueId = formData.get("issueId");
  const returnPath = formData.get("returnPath");

  if (typeof issueId !== "string" || typeof returnPath !== "string") {
    redirect("/my-community");
  }

  const stored = await getStoredIssueFollows();
  await setStoredIssueFollows(stored.filter((entry) => !(entry.userId === currentUser.id && entry.issueId === issueId)));
  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}issueFollow=removed`);
}
