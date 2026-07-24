import { cookies } from "next/headers";

import { getCommunityById } from "@/lib/community/communities";
import { getAllPetitions } from "@/lib/petitions/store";
import type {
  AuthUser,
  PetitionSummary,
  TopIssueSubmissionSummary,
  TopIssueSummary,
  TopIssueUpvoteSummary,
  VoteQuestionScope,
} from "@/types/domain";

const TOP_ISSUES_COOKIE = "dd_top_issues";
const TOP_ISSUE_UPVOTES_COOKIE = "dd_top_issue_upvotes";

function isTopIssueSubmission(value: unknown): value is TopIssueSubmissionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const issue = value as Record<string, unknown>;
  return (
    typeof issue.id === "string" &&
    typeof issue.userId === "string" &&
    typeof issue.userName === "string" &&
    typeof issue.issueText === "string" &&
    typeof issue.scope === "string" &&
    typeof issue.jurisdictionName === "string" &&
    typeof issue.createdAt === "string"
  );
}

function isTopIssueUpvote(value: unknown): value is TopIssueUpvoteSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const upvote = value as Record<string, unknown>;
  return (
    typeof upvote.id === "string" &&
    typeof upvote.issueId === "string" &&
    typeof upvote.userId === "string" &&
    typeof upvote.createdAt === "string"
  );
}

function scopeMatchesCommunity(issue: Pick<TopIssueSummary, "jurisdictionName">, communityId: string, user: AuthUser) {
  const community = getCommunityById(communityId);

  if (!community) {
    return issue.jurisdictionName === user.jurisdictionName;
  }

  return community.jurisdictionMatches.includes(issue.jurisdictionName);
}

function scopeMatchesFilter(scope: VoteQuestionScope, selectedScope?: VoteQuestionScope | "all") {
  if (!selectedScope || selectedScope === "all") {
    return true;
  }

  return scope === selectedScope;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
}

export async function getRelatedPetitionForIssue(issue: TopIssueSummary): Promise<PetitionSummary | null> {
  const petitions = await getAllPetitions();
  const issueTokens = tokenize(issue.issueText);

  return (
    petitions
      .filter((petition) => petition.jurisdictionName === issue.jurisdictionName)
      .find((petition) => {
        const petitionTokens = new Set(tokenize(`${petition.title} ${petition.summary}`));
        return issueTokens.some((token) => petitionTokens.has(token));
      }) ?? null
  );
}

export async function getStoredTopIssues() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TOP_ISSUES_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTopIssueSubmission) : [];
  } catch {
    return [];
  }
}

export async function setStoredTopIssues(issues: TopIssueSubmissionSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(TOP_ISSUES_COOKIE, JSON.stringify(issues.slice(0, 50)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getStoredTopIssueUpvotes() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TOP_ISSUE_UPVOTES_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTopIssueUpvote) : [];
  } catch {
    return [];
  }
}

export async function setStoredTopIssueUpvotes(upvotes: TopIssueUpvoteSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(TOP_ISSUE_UPVOTES_COOKIE, JSON.stringify(upvotes.slice(0, 120)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getTopIssuesForUser(user: AuthUser, selectedScope: VoteQuestionScope | "all" = "all", communityId?: string) {
  const storedIssues = await getStoredTopIssues();
  const storedUpvotes = await getStoredTopIssueUpvotes();

  const writeInIssues: TopIssueSummary[] = storedIssues.map((issue) => ({
    id: issue.id,
    issueText: issue.issueText,
    scope: issue.scope,
    jurisdictionName: issue.jurisdictionName,
    source: issue.source ?? "writeIn",
    createdAt: issue.createdAt,
    createdByUserId: issue.userId,
    createdByName: issue.userName,
    upvoteCount: 0,
    viewerHasUpvoted: false,
  }));

  return writeInIssues
    .filter((issue) => scopeMatchesCommunity(issue, communityId ?? "carson-city", user))
    .filter((issue) => scopeMatchesFilter(issue.scope, selectedScope))
    .map((issue) => {
      const upvotes = storedUpvotes.filter((upvote) => upvote.issueId === issue.id);

      return {
        ...issue,
        upvoteCount: issue.upvoteCount + upvotes.length,
        viewerHasUpvoted: upvotes.some((upvote) => upvote.userId === user.id),
      };
    })
    .sort((a, b) => {
      if (b.upvoteCount !== a.upvoteCount) {
        return b.upvoteCount - a.upvoteCount;
      }

      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
}

export async function getTopIssueById(user: AuthUser, issueId: string) {
  const issues = await getTopIssuesForUser(user, "all");
  const issue = issues.find((entry) => entry.id === issueId);

  if (!issue) {
    return null;
  }

  const relatedPetition = await getRelatedPetitionForIssue(issue);

  return {
    issue,
    relatedPetition,
  };
}
