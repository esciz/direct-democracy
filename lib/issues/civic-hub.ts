import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import type { PublicIssueHubSummary, VoteQuestionScope } from "@/types/domain";

export type IssueHubRecord = {
  id: string;
  issueText: string;
  issueSlug: string;
  summary: string;
  scope: VoteQuestionScope;
  jurisdictionName: string;
  sourceBacked: boolean;
  reviewStatus: "generated" | "needs_review" | "verified";
  sourceTypes: string[];
  communities: string[];
  policyAreas: string[];
  relationshipCounts: {
    meetings: number;
    agendaItems: number;
    votingCards: number;
    courtCases: number;
    communitySubmissions: number;
    votes: number;
    officials: number;
    newsStories: number;
    spendingRecords: number;
    projects: number;
    ballotQuestions: number;
    sourceDocuments: number;
  };
  relatedMeetingIds: string[];
  relatedAgendaItemIds: string[];
  relatedVotingCardIds: string[];
  relatedCourtCaseIds: string[];
  relatedIssueReviewRequestIds: string[];
  relatedSourceUrls: string[];
  latestActivityAt?: string | null;
  confidence: number;
};

type IssueHubRuntime = {
  records?: IssueHubRecord[];
};

const ISSUE_HUB_RUNTIME_PATH = path.join(process.cwd(), "data/generated/issues-runtime.json");

export async function getIssueHubRecords() {
  try {
    const parsed = JSON.parse(await fs.readFile(ISSUE_HUB_RUNTIME_PATH, "utf8")) as IssueHubRuntime;
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[issues] Unable to read generated issue hub runtime", error);
    }
    return [];
  }
}

export async function getIssueHubRecordByRouteParam(issueParam: string) {
  const records = await getIssueHubRecords();
  const normalized = issueParam.toLowerCase();

  return (
    records.find((record) => record.id === issueParam) ??
    records.find((record) => record.issueSlug === normalized) ??
    null
  );
}

export function issueHubRecordToTopIssueSummary(record: IssueHubRecord): PublicIssueHubSummary {
  const sourceCount = record.relatedSourceUrls.length || record.relationshipCounts.sourceDocuments;

  return {
    id: record.id,
    issueText: record.issueText,
    plainTitle: record.issueText,
    scope: record.scope,
    jurisdictionName: record.jurisdictionName,
    source: "curated",
    createdAt: record.latestActivityAt ?? "2024-01-01T00:00:00.000Z",
    createdByUserId: null,
    createdByName: "Direct Democracy civic records",
    upvoteCount: 0,
    viewerHasUpvoted: false,
    category: record.policyAreas[0] ?? record.issueText,
    sourceBacked: record.sourceBacked,
    reviewStatus: record.reviewStatus,
    confidence: record.confidence,
    sourceCount,
    linkedMeetingsCount: record.relationshipCounts.meetings,
    linkedVotesCount: record.relationshipCounts.votes,
    linkedCourtRecordsCount: record.relationshipCounts.courtCases,
    linkedAgendaItemsCount: record.relationshipCounts.agendaItems,
    linkedCommunitySubmissionCount: record.relationshipCounts.communitySubmissions,
    sourceDocumentCount: record.relationshipCounts.sourceDocuments,
    lastUpdatedAt: record.latestActivityAt,
    whyThisMatters: record.summary,
  };
}
