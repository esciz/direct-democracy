"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById } from "@/lib/community/communities";
import { getStoredTopIssues, getStoredTopIssueUpvotes, setStoredTopIssues, setStoredTopIssueUpvotes } from "@/lib/community/issues";
import { getCanonicalIssueTextOrNull } from "@/lib/issues/utils";
import { getFollowedCommunityIds, setFollowedCommunityIds } from "@/lib/server/community-context";
import type { TopIssueSubmissionSummary, TopIssueUpvoteSummary, VoteQuestionScope } from "@/types/domain";

function withCommunity(path: string, communityId: string) {
  const url = new URL(path, "http://local.test");
  url.searchParams.set("communityId", communityId);
  return `${url.pathname}${url.search}`;
}

export async function submitTopIssue(formData: FormData) {
  const currentUser = await getCurrentUser();
  const issueText = formData.get("issueText");
  const scope = formData.get("scope");
  const returnPath = formData.get("returnPath");
  const fallbackPath = typeof returnPath === "string" ? returnPath : "/my-community";

  const canonicalIssueText = typeof issueText === "string" ? getCanonicalIssueTextOrNull(issueText.trim()) : null;

  if (!canonicalIssueText || typeof scope !== "string" || typeof returnPath !== "string") {
    redirect(`${fallbackPath}${fallbackPath.includes("?") ? "&" : "?"}issue=error`);
  }

  const nextScope: VoteQuestionScope = scope === "local" || scope === "state" || scope === "national" ? scope : "local";
  const jurisdictionName =
    nextScope === "local" ? currentUser.jurisdictionName : nextScope === "state" ? "Nevada" : "United States";

  const nextIssue: TopIssueSubmissionSummary = {
    id: `issue_created_${Date.now()}`,
    userId: currentUser.id,
    userName: currentUser.name,
    issueText: canonicalIssueText,
    scope: nextScope,
    source: "curated",
    jurisdictionName,
    createdAt: new Date().toISOString(),
  };

  const storedIssues = await getStoredTopIssues();
  await setStoredTopIssues([nextIssue, ...storedIssues.filter((issue) => issue.userId !== currentUser.id)]);

  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}issue=success`);
}

export async function toggleTopIssueUpvote(formData: FormData) {
  const currentUser = await getCurrentUser();
  const issueId = formData.get("issueId");
  const returnPath = formData.get("returnPath");

  if (typeof issueId !== "string" || typeof returnPath !== "string") {
    redirect("/my-community");
  }

  const storedUpvotes = await getStoredTopIssueUpvotes();
  const existing = storedUpvotes.find((upvote) => upvote.issueId === issueId && upvote.userId === currentUser.id);

  if (existing) {
    await setStoredTopIssueUpvotes(
      storedUpvotes.filter((upvote) => !(upvote.issueId === issueId && upvote.userId === currentUser.id)),
    );
  } else {
    const nextUpvote: TopIssueUpvoteSummary = {
      id: `issue_upvote_created_${Date.now()}`,
      issueId,
      userId: currentUser.id,
      createdAt: new Date().toISOString(),
    };
    await setStoredTopIssueUpvotes([nextUpvote, ...storedUpvotes]);
  }

  redirect(returnPath);
}

export async function followCommunity(formData: FormData) {
  const communityId = formData.get("communityId");
  const returnPath = formData.get("returnPath");

  if (typeof communityId !== "string" || typeof returnPath !== "string" || !getCommunityById(communityId)) {
    redirect("/my-community");
  }

  const followed = await getFollowedCommunityIds();
  await setFollowedCommunityIds([...new Set([...followed, communityId])]);
  redirect(`${withCommunity(returnPath, communityId)}${returnPath.includes("?") ? "&" : "?"}community=followed`);
}

export async function unfollowCommunity(formData: FormData) {
  const communityId = formData.get("communityId");
  const returnPath = formData.get("returnPath");

  if (typeof communityId !== "string" || typeof returnPath !== "string") {
    redirect("/my-community");
  }

  const followed = await getFollowedCommunityIds();
  await setFollowedCommunityIds(followed.filter((id) => id !== communityId));
  redirect(`${withCommunity(returnPath, communityId)}${returnPath.includes("?") ? "&" : "?"}community=unfollowed`);
}
