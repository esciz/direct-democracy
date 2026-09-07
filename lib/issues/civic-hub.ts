import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import { hasTeacherPaySubjectEvidence } from "@/lib/issues/utils";
import { getPublicMeetingItems } from "@/lib/public-meetings/public-record-eligibility";
import { getPublicMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import type { MeetingVotingCardRecord, PublicMeetingItemRecord } from "@/lib/public-meetings/types";
import type { PublicIssueHubSummary, VoteQuestionScope } from "@/types/domain";

export type IssueHubRecord = {
  id: string;
  issueText: string;
  issueSlug: string;
  summary: string;
  scope: VoteQuestionScope;
  jurisdictionName: string;
  sourceBacked: boolean;
  publicRelationshipEvidenceVersion?: number;
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

function needsLegacySubjectEvidence(record: IssueHubRecord) {
  const isTeacherPay = record.id === "issue_real_teacher-pay"
    || record.issueSlug === "teacher-pay"
    || /^teacher[\s-]+pay$/i.test(record.issueText?.trim() ?? "");
  // Older generators linked generic compensation and unrelated minutes to
  // Teacher Pay. Their aggregate counts/confidence cannot prove this topic.
  // Version 1 is emitted after the generator applies the public evidence gate.
  return isTeacherPay && record.publicRelationshipEvidenceVersion !== 1;
}

async function readCompatibilityEvidence<T>(filename: string): Promise<T[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(process.cwd(), "data/generated", filename), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Missing compact evidence holds only the affected legacy issue, never the
    // rest of the issue directory. No worker data or graph recomputation occurs.
    return [];
  }
}

async function filterLegacySubjectEvidence(records: IssueHubRecord[]) {
  const legacy = records.filter(needsLegacySubjectEvidence);
  if (!legacy.length) return records;
  const itemIds = new Set(legacy.flatMap((record) => record.relatedAgendaItemIds));
  const cardIds = new Set(legacy.flatMap((record) => record.relatedVotingCardIds));
  const [items, cards] = await Promise.all([
    itemIds.size ? readCompatibilityEvidence<PublicMeetingItemRecord>("public-meeting-items-runtime.json") : [],
    cardIds.size ? readCompatibilityEvidence<MeetingVotingCardRecord>("voting-cards-runtime.json") : [],
  ]);
  const supportedItemIds = new Set(getPublicMeetingItems(items.filter((item) => itemIds.has(item.id)))
    .filter((item) => hasTeacherPaySubjectEvidence(`${item.title} ${item.source_text || ""}`))
    .map((item) => item.id));
  const supportedCardIds = new Set(getPublicMeetingVotingCards(cards.filter((card) => cardIds.has(card.id)))
    .filter((card) => card.source_url && hasTeacherPaySubjectEvidence(`${card.source_title || ""} ${card.agenda_language_original || ""} ${(card.source_snippets ?? []).join(" ")}`))
    .map((card) => card.id));
  return records.filter((record) => !needsLegacySubjectEvidence(record)
    || record.relatedAgendaItemIds.some((id) => supportedItemIds.has(id))
    || record.relatedVotingCardIds.some((id) => supportedCardIds.has(id)));
}

export async function getIssueHubRecords() {
  try {
    const parsed = JSON.parse(await fs.readFile(ISSUE_HUB_RUNTIME_PATH, "utf8")) as IssueHubRuntime;
    return Array.isArray(parsed.records) ? await filterLegacySubjectEvidence(parsed.records) : [];
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
