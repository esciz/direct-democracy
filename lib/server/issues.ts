import "server-only";

import { getCommunityById, getDefaultCommunityForJurisdiction, seededCommunities } from "@/lib/community/communities";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getAllOrganizations } from "@/lib/organizations/store";
import { getPublicPeopleDirectory } from "@/lib/profile/discovery";
import {
  getCanonicalIssueText,
  getCanonicalIssueTextOrNull,
  getCanonicalIssueTitles,
  getIssueTopicSummary,
  issueTextMatchesQuery,
  normalizeIssueText,
  slugifyIssueText,
  valuesMatchIssueText,
} from "@/lib/issues/utils";
import type { AuthUser, TopIssueSummary, VoteQuestionScope } from "@/types/domain";

function dedupeIssues(issues: TopIssueSummary[]) {
  const unique = new Map<string, TopIssueSummary>();

  for (const issue of issues) {
    const canonicalIssueText = getCanonicalIssueText(issue.issueText);
    const key = normalizeIssueText(canonicalIssueText);
    const existing = unique.get(key);

    if (!existing) {
      unique.set(key, {
        ...issue,
        issueText: canonicalIssueText,
      });
      continue;
    }

    unique.set(key, {
      ...existing,
      issueText: canonicalIssueText,
      jurisdictionName: existing.source === "curated" || issue.source === "curated" ? "Across the platform" : existing.jurisdictionName,
      source: existing.source === "curated" || issue.source === "curated" ? "curated" : "writeIn",
      createdAt: Date.parse(existing.createdAt) > Date.parse(issue.createdAt) ? existing.createdAt : issue.createdAt,
      upvoteCount: existing.upvoteCount + issue.upvoteCount,
      viewerHasUpvoted: existing.viewerHasUpvoted || issue.viewerHasUpvoted,
    });
  }

  return [...unique.values()];
}

function inferScopeFromJurisdiction(jurisdictionName: string): VoteQuestionScope {
  if (jurisdictionName === "United States") {
    return "national";
  }

  if (jurisdictionName === "Nevada") {
    return "state";
  }

  return "local";
}

function buildCanonicalIssueSummary(issueText: string, user: AuthUser): TopIssueSummary {
  return {
    id: `issue_topic_${slugifyIssueText(issueText)}`,
    issueText,
    scope: inferScopeFromJurisdiction(user.jurisdictionName),
    jurisdictionName: "Across the platform",
    source: "curated",
    createdAt: "2026-01-01T00:00:00.000Z",
    upvoteCount: 0,
    viewerHasUpvoted: false,
  };
}

export async function getIssueDirectoryForUser(user: AuthUser, options?: { communityId?: string; query?: string }) {
  const community = options?.communityId ? getCommunityById(options.communityId) : getDefaultCommunityForJurisdiction(user.jurisdictionName);
  const issues = dedupeIssues([
    ...(await getTopIssuesForUser(user, "all", community?.id)),
    ...getCanonicalIssueTitles().map((issueText) => buildCanonicalIssueSummary(issueText, user)),
  ]);

  if (!options?.query?.trim()) {
    return issues;
  }

  return issues.filter((issue) => issueTextMatchesQuery(issue.issueText, options.query ?? ""));
}

export async function getIssuePickerOptions(user: AuthUser, communityId?: string) {
  void user;
  void communityId;
  return getCanonicalIssueTitles();
}

export async function getPeopleForIssue(user: AuthUser, issueText: string) {
  const people = await getPublicPeopleDirectory(user);

  return people
    .filter((person) => person.topIssuesPreview.some((issue) => valuesMatchIssueText(issueText, issue)))
    .slice(0, 6);
}

export async function getOrganizationsForIssue(user: AuthUser, issueText: string) {
  const organizations = await getAllOrganizations(user);

  return organizations
    .filter((organization) => organization.issueTags.some((issueTag) => valuesMatchIssueText(issueText, issueTag)))
    .slice(0, 6);
}

export function getIssueSummary(issueText: string) {
  return getIssueTopicSummary(issueText);
}

export async function getIssueByRouteParam(user: AuthUser, issueParam: string, communityId?: string) {
  const issues = dedupeIssues(
    communityId
      ? await getTopIssuesForUser(user, "all", communityId)
      : (
          await Promise.all(
            seededCommunities.map((community) => getTopIssuesForUser(user, "all", community.id)),
          )
        ).flat(),
  );
  const normalizedParam = normalizeIssueText(issueParam);
  const canonicalMatch = getCanonicalIssueTitles().find(
    (title) =>
      slugifyIssueText(title) === normalizedParam ||
      normalizeIssueText(title) === normalizedParam ||
      `issue_topic_${slugifyIssueText(title)}` === issueParam,
  );

  return (
    issues.find((issue) => issue.id === issueParam) ??
    issues.find((issue) => slugifyIssueText(issue.issueText) === normalizedParam || normalizeIssueText(issue.issueText) === normalizedParam) ??
    (canonicalMatch ? buildCanonicalIssueSummary(canonicalMatch, user) : null) ??
    null
  );
}

export async function ensureIssueReferenceForUser(
  user: AuthUser,
  issueText: string,
  options?: { scope?: VoteQuestionScope; jurisdictionName?: string },
) {
  const sanitized = getCanonicalIssueTextOrNull(issueText)?.trim();
  if (!sanitized) {
    return null;
  }

  const allIssues = dedupeIssues(await getTopIssuesForUser(user, "all"));
  const normalized = normalizeIssueText(sanitized);
  const existing =
    allIssues.find((issue) => normalizeIssueText(issue.issueText) === normalized) ??
    allIssues.find((issue) => slugifyIssueText(issue.issueText) === slugifyIssueText(sanitized));

  if (existing) {
    return existing;
  }

  const jurisdictionName = options?.jurisdictionName ?? user.jurisdictionName;
  const nextScope = options?.scope ?? inferScopeFromJurisdiction(jurisdictionName);
  return {
    id: `issue_topic_${slugifyIssueText(sanitized)}`,
    issueText: sanitized,
    scope: nextScope,
    jurisdictionName,
    source: "curated" as const,
    createdAt: new Date().toISOString(),
    createdByUserId: user.id,
    createdByName: user.name,
    upvoteCount: 0,
    viewerHasUpvoted: false,
  } satisfies TopIssueSummary;
}
