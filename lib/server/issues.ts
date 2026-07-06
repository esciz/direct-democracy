import "server-only";

import { PUBLIC_DEMO_DATA_ENABLED } from "@/lib/auth/constants";
import { getCommunityById, getDefaultCommunityForJurisdiction, seededCommunities } from "@/lib/community/communities";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getAllOrganizations } from "@/lib/organizations/store";
import { getPublicPeopleDirectory } from "@/lib/profile/discovery";
import { getIssueHubRecordByRouteParam, getIssueHubRecords, issueHubRecordToTopIssueSummary } from "@/lib/issues/civic-hub";
import { PUBLIC_DISCUSSION_ISSUES, publicDiscussionIssueToSummary } from "@/lib/issues/framing";
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
import type { AuthUser, PublicIssueHubSummary, TopIssueSummary, VoteQuestionScope } from "@/types/domain";

function dedupeIssues<T extends TopIssueSummary>(issues: T[]) {
  const unique = new Map<string, T>();

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
    } as T);
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

function buildCanonicalIssueSummary(issueText: string, user: AuthUser): PublicIssueHubSummary {
  return {
    id: `issue_topic_${slugifyIssueText(issueText)}`,
    issueText,
    plainTitle: issueText,
    scope: inferScopeFromJurisdiction(user.jurisdictionName),
    jurisdictionName: "Across the platform",
    source: "curated",
    createdAt: "2026-01-01T00:00:00.000Z",
    upvoteCount: 0,
    viewerHasUpvoted: false,
    category: issueText,
    sourceBacked: false,
    sourceCount: 0,
    linkedMeetingsCount: 0,
    linkedVotesCount: 0,
    linkedCourtRecordsCount: 0,
    linkedAgendaItemsCount: 0,
    linkedCommunitySubmissionCount: 0,
    sourceDocumentCount: 0,
    lastUpdatedAt: null,
    whyThisMatters: getIssueTopicSummary(issueText),
    showDemoBadge: true,
  };
}

function getPublicDiscussionIssueSummaries() {
  return PUBLIC_DISCUSSION_ISSUES.map(publicDiscussionIssueToSummary);
}

export async function getIssueDirectoryForUser(user: AuthUser, options?: { communityId?: string; query?: string }): Promise<PublicIssueHubSummary[]> {
  const community = options?.communityId ? getCommunityById(options.communityId) : getDefaultCommunityForJurisdiction(user.jurisdictionName);
  const generatedIssueHubs = (await getIssueHubRecords())
    .filter((record) => record.sourceBacked)
    .map(issueHubRecordToTopIssueSummary);
  const publicDiscussionIssues = getPublicDiscussionIssueSummaries();
  const demoIssues: PublicIssueHubSummary[] = PUBLIC_DEMO_DATA_ENABLED
    ? [
        ...(await getTopIssuesForUser(user, "all", community?.id)).map((issue) => ({
          ...issue,
          plainTitle: issue.issueText,
          category: getCanonicalIssueText(issue.issueText),
          sourceBacked: false,
          sourceCount: 0,
          linkedMeetingsCount: 0,
          linkedVotesCount: 0,
          linkedCourtRecordsCount: 0,
          linkedAgendaItemsCount: 0,
          linkedCommunitySubmissionCount: 0,
          sourceDocumentCount: 0,
          lastUpdatedAt: issue.createdAt,
          whyThisMatters: getIssueTopicSummary(issue.issueText),
          showDemoBadge: true,
        } satisfies PublicIssueHubSummary)),
        ...getCanonicalIssueTitles().map((issueText) => buildCanonicalIssueSummary(issueText, user)),
      ]
    : [];
  const issues = dedupeIssues([...generatedIssueHubs, ...publicDiscussionIssues, ...demoIssues]);

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

export async function getIssueByRouteParam(user: AuthUser, issueParam: string, communityId?: string): Promise<PublicIssueHubSummary | null> {
  const generatedMatch = await getIssueHubRecordByRouteParam(issueParam);
  if (generatedMatch) {
    return issueHubRecordToTopIssueSummary(generatedMatch);
  }

  const normalizedParam = normalizeIssueText(issueParam);
  const publicDiscussionMatch = getPublicDiscussionIssueSummaries().find(
    (issue) =>
      issue.id === issueParam ||
      slugifyIssueText(issue.issueText) === normalizedParam ||
      normalizeIssueText(issue.issueText) === normalizedParam,
  );

  if (publicDiscussionMatch) {
    return publicDiscussionMatch;
  }

  if (!PUBLIC_DEMO_DATA_ENABLED) {
    return null;
  }

  const issues = dedupeIssues(
    communityId
      ? (await getTopIssuesForUser(user, "all", communityId)).map((issue) => ({
          ...issue,
          plainTitle: issue.issueText,
          category: getCanonicalIssueText(issue.issueText),
          sourceBacked: false,
          sourceCount: 0,
          linkedMeetingsCount: 0,
          linkedVotesCount: 0,
          linkedCourtRecordsCount: 0,
          linkedAgendaItemsCount: 0,
          linkedCommunitySubmissionCount: 0,
          sourceDocumentCount: 0,
          lastUpdatedAt: issue.createdAt,
          whyThisMatters: getIssueTopicSummary(issue.issueText),
          showDemoBadge: true,
        } satisfies PublicIssueHubSummary))
      : (
          await Promise.all(
            seededCommunities.map((community) => getTopIssuesForUser(user, "all", community.id)),
          )
        ).flat().map((issue) => ({
          ...issue,
          plainTitle: issue.issueText,
          category: getCanonicalIssueText(issue.issueText),
          sourceBacked: false,
          sourceCount: 0,
          linkedMeetingsCount: 0,
          linkedVotesCount: 0,
          linkedCourtRecordsCount: 0,
          linkedAgendaItemsCount: 0,
          linkedCommunitySubmissionCount: 0,
          sourceDocumentCount: 0,
          lastUpdatedAt: issue.createdAt,
          whyThisMatters: getIssueTopicSummary(issue.issueText),
          showDemoBadge: true,
        } satisfies PublicIssueHubSummary)),
  );
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
    plainTitle: sanitized,
    scope: nextScope,
    jurisdictionName,
    source: "curated" as const,
    createdAt: new Date().toISOString(),
    createdByUserId: user.id,
    createdByName: user.name,
    upvoteCount: 0,
    viewerHasUpvoted: false,
    category: sanitized,
    sourceBacked: false,
    sourceCount: 0,
    linkedMeetingsCount: 0,
    linkedVotesCount: 0,
    linkedCourtRecordsCount: 0,
    linkedAgendaItemsCount: 0,
    linkedCommunitySubmissionCount: 0,
    sourceDocumentCount: 0,
    lastUpdatedAt: null,
    whyThisMatters: getIssueTopicSummary(sanitized),
    showDemoBadge: true,
  } satisfies PublicIssueHubSummary;
}
