import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getCanonicalIssueText, getCanonicalIssueTextOrNull, getIssueTopicSummary, hasTeacherPaySubjectEvidence, slugifyIssueText } from "@/lib/issues/utils";
import { getPublicMeetingItems } from "@/lib/public-meetings/public-record-eligibility";
import { getPublicMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import { cachedTopicNeedsEvidenceReview } from "@/lib/public-meetings/evidence-review";
import type { MeetingVotingCardRecord, PublicMeetingItemRecord } from "@/lib/public-meetings/types";
import type { VoteQuestionScope } from "@/types/domain";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "issues-runtime.json");

type AnyRecord = Record<string, unknown>;

type IssueAccumulator = {
  issueText: string;
  scope: VoteQuestionScope;
  jurisdictions: Map<string, number>;
  communities: Set<string>;
  policyAreas: Set<string>;
  sourceTypes: Set<string>;
  relatedMeetingIds: Set<string>;
  relatedAgendaItemIds: Set<string>;
  relatedVotingCardIds: Set<string>;
  relatedCourtCaseIds: Set<string>;
  relatedIssueReviewRequestIds: Set<string>;
  relatedSourceUrls: Set<string>;
  voteItemIds: Set<string>;
  spendingItemIds: Set<string>;
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
  latestActivityAt: string | null;
  confidenceSignals: number[];
};

function readJson(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function asRecords(value: unknown): AnyRecord[] {
  if (Array.isArray(value)) {
    return value.filter((record): record is AnyRecord => Boolean(record) && typeof record === "object");
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["records", "cards", "items", "events", "cases"]) {
      if (Array.isArray(object[key])) {
        return object[key].filter((record): record is AnyRecord => Boolean(record) && typeof record === "object");
      }
    }
  }

  return [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function inferScope(jurisdictionName: string): VoteQuestionScope {
  const normalized = jurisdictionName.toLowerCase();
  if (normalized.includes("united states") || normalized.includes("federal")) {
    return "national";
  }
  if (normalized === "nevada" || normalized.includes("statewide") || normalized.includes("supreme court")) {
    return "state";
  }
  return "local";
}

function addLatest(current: string | null, candidate: string) {
  if (!candidate) {
    return current;
  }

  if (!current || Date.parse(candidate) > Date.parse(current)) {
    return candidate;
  }

  return current;
}

function getOrCreateIssue(issues: Map<string, IssueAccumulator>, issueText: string, scope: VoteQuestionScope) {
  const canonical = getCanonicalIssueText(issueText);
  const slug = slugifyIssueText(canonical);
  const existing = issues.get(slug);

  if (existing) {
    return existing;
  }

  const next: IssueAccumulator = {
    issueText: canonical,
    scope,
    jurisdictions: new Map(),
    communities: new Set(),
    policyAreas: new Set(),
    sourceTypes: new Set(),
    relatedMeetingIds: new Set(),
    relatedAgendaItemIds: new Set(),
    relatedVotingCardIds: new Set(),
    relatedCourtCaseIds: new Set(),
    relatedIssueReviewRequestIds: new Set(),
    relatedSourceUrls: new Set(),
    voteItemIds: new Set(),
    spendingItemIds: new Set(),
    relationshipCounts: {
      meetings: 0,
      agendaItems: 0,
      votingCards: 0,
      courtCases: 0,
      communitySubmissions: 0,
      votes: 0,
      officials: 0,
      newsStories: 0,
      spendingRecords: 0,
      projects: 0,
      ballotQuestions: 0,
      sourceDocuments: 0,
    },
    latestActivityAt: null,
    confidenceSignals: [],
  };

  issues.set(slug, next);
  return next;
}

function addJurisdiction(issue: IssueAccumulator, jurisdictionName: string) {
  if (!jurisdictionName) {
    return;
  }

  issue.jurisdictions.set(jurisdictionName, (issue.jurisdictions.get(jurisdictionName) ?? 0) + 1);
  issue.communities.add(jurisdictionName);
}

function dominantJurisdiction(issue: IssueAccumulator) {
  const ranked = [...issue.jurisdictions.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return "Across the platform";
  }
  if (ranked.length > 1) {
    return "Across the platform";
  }
  return ranked[0]?.[0] ?? "Across the platform";
}

function addSources(issue: IssueAccumulator, ...values: unknown[]) {
  for (const value of values) {
    const source = text(value);
    if (source.startsWith("http")) {
      issue.relatedSourceUrls.add(source);
    }
  }
}

function deriveIssueTextFromPolicyArea(policyArea: string, fallbackText: string, sourceEvidence: string) {
  if (hasTeacherPaySubjectEvidence(sourceEvidence)) return "Teacher Pay";
  if (policyArea && policyArea.toLowerCase() !== "other") {
    const canonicalPolicyArea = getCanonicalIssueTextOrNull(policyArea);
    if (canonicalPolicyArea) {
      if (canonicalPolicyArea === "Teacher Pay") return null;
      return canonicalPolicyArea;
    }

    if (policyArea.length <= 36 && !/meeting materials|board of supervisors|city council|commission/i.test(policyArea)) {
      return policyArea;
    }

    return null;
  }
  const inferred = getCanonicalIssueTextOrNull(fallbackText);
  return inferred === "Teacher Pay" ? null : inferred;
}

function ingestVotingCards(issues: Map<string, IssueAccumulator>, cards: MeetingVotingCardRecord[]) {
  for (const card of cards) {
    const policyArea = text(card.policy_area);
    const title = text(card.public_title) || text(card.title) || text(card.source_title);
    const summary = text(card.plain_language_summary) || text(card.citizen_summary) || text(card.question_text);
    const jurisdiction = text(card.jurisdiction_display_name) || text(card.jurisdiction);
    const sourceEvidence = [card.source_title, card.agenda_language_original, ...(card.source_snippets ?? [])].map(text).join(" ");
    const issueText = deriveIssueTextFromPolicyArea(policyArea, `${title} ${summary}`, sourceEvidence);
    if (!issueText) {
      continue;
    }
    const issue = getOrCreateIssue(issues, issueText, inferScope(jurisdiction));

    issue.sourceTypes.add("meeting_voting_card");
    issue.policyAreas.add(policyArea || "Other");
    if (text(card.outcome_status) && text(card.outcome_status) !== "unknown") issue.voteItemIds.add(text(card.topic_item_id));
    if (text(card.financial_impact)) issue.spendingItemIds.add(text(card.topic_item_id));
    issue.relatedVotingCardIds.add(text(card.id));
    issue.relatedMeetingIds.add(text(card.meeting_id));
    issue.relatedAgendaItemIds.add(text(card.topic_item_id));
    addJurisdiction(issue, jurisdiction);
    addSources(issue, card.source_url, card.source_event_href, card.source_topic_href);
    issue.latestActivityAt = addLatest(issue.latestActivityAt, text(card.meeting_date));
    issue.confidenceSignals.push(numberValue(card.confidence_score) ?? 0.68);
  }
}

function ingestAgendaItems(issues: Map<string, IssueAccumulator>, items: PublicMeetingItemRecord[]) {
  for (const item of items) {
    const policyArea = text(item.policy_area);
    const title = text(item.title);
    const explanation = text(item.plain_english_explanation) || text(item.one_sentence_summary) || text(item.description);
    const issueText = deriveIssueTextFromPolicyArea(policyArea, `${title} ${explanation}`, `${title} ${text(item.source_text)}`);
    if (!issueText) {
      continue;
    }
    const issue = getOrCreateIssue(issues, issueText, "local");

    issue.sourceTypes.add("agenda_item");
    issue.policyAreas.add(policyArea || "Other");
    if (text(item.financial_impact) || text(item.fiscal_impact_summary)) issue.spendingItemIds.add(text(item.id));
    issue.relatedAgendaItemIds.add(text(item.id));
    issue.relatedMeetingIds.add(text(item.meeting_id));
    addSources(issue, item.source_url, item.source_page);
    issue.confidenceSignals.push(numberValue(item.confidence_score) ?? 0.45);
  }
}

function ingestCourtCases(issues: Map<string, IssueAccumulator>, cases: AnyRecord[]) {
  for (const courtCase of cases) {
    const tags = Array.isArray(courtCase.issueTags) ? courtCase.issueTags.map(text).filter(Boolean) : [];
    const issueText = tags[1] ?? tags[0] ?? `${text(courtCase.caseType)} ${text(courtCase.courtName)}`;
    const jurisdiction = text(courtCase.jurisdictionName) || "Nevada";
    const issue = getOrCreateIssue(issues, issueText, inferScope(jurisdiction));

    issue.sourceTypes.add("public_court_record");
    issue.policyAreas.add("Courts and Legal Rights");
    issue.relatedCourtCaseIds.add(text(courtCase.id));
    addJurisdiction(issue, jurisdiction);
    addSources(issue, courtCase.sourceUrl);
    for (const document of asRecords(courtCase.documents)) addSources(issue, document.sourceUrl, document.url);
    issue.latestActivityAt = addLatest(issue.latestActivityAt, text(courtCase.dispositionDate) || text(courtCase.createdAt));
    issue.confidenceSignals.push(0.92);
  }
}

function ingestIssueReviewRequests(issues: Map<string, IssueAccumulator>, requests: AnyRecord[]) {
  for (const request of requests) {
    const jurisdiction = text(request.jurisdictionName) || text(request.community);
    const issue = getOrCreateIssue(issues, text(request.category) || text(request.title), inferScope(jurisdiction));

    issue.sourceTypes.add("citizen_issue_submission");
    issue.policyAreas.add(text(request.category) || "Other");
    issue.relatedIssueReviewRequestIds.add(text(request.id));
    addJurisdiction(issue, jurisdiction);
    issue.latestActivityAt = addLatest(issue.latestActivityAt, text(request.submittedAt));
    issue.confidenceSignals.push(text(request.aiReviewStatus) === "verified" ? 0.78 : 0.45);

    for (const caseId of Array.isArray(request.relatedCaseIds) ? request.relatedCaseIds : []) {
      issue.relatedCourtCaseIds.add(text(caseId));
    }
  }
}

function compactSet(set: Set<string>, limit = 40) {
  return [...set].filter(Boolean).slice(0, limit);
}

function average(values: number[]) {
  if (!values.length) {
    return 0.5;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniqueRecords(value: unknown) {
  return [...new Map(asRecords(value).filter(record => text(record.id)).map(record => [text(record.id), record])).values()];
}

export function buildPublicIssueHubRecords(input: { meetingItems: unknown; votingCards: unknown; meetings: unknown; courtCases?: unknown; issueReviewRequests?: unknown }) {
  const issues = new Map<string, IssueAccumulator>();
  const meetingIds = new Set(uniqueRecords(input.meetings).map(meeting => text(meeting.id)));
  const publicItems = getPublicMeetingItems(uniqueRecords(input.meetingItems) as unknown as PublicMeetingItemRecord[])
    .filter(item => meetingIds.has(text(item.meeting_id)));
  const publicItemById = new Map(publicItems.map(item => [text(item.id), item]));
  const publicCards = getPublicMeetingVotingCards(uniqueRecords(input.votingCards) as unknown as MeetingVotingCardRecord[])
    .filter(card => {
      const item = publicItemById.get(text(card.topic_item_id));
      return meetingIds.has(text(card.meeting_id)) && item?.meeting_id === card.meeting_id && !cachedTopicNeedsEvidenceReview(item);
    });

  ingestVotingCards(issues, publicCards);
  ingestAgendaItems(issues, publicItems);
  ingestCourtCases(issues, uniqueRecords(input.courtCases));
  ingestIssueReviewRequests(issues, uniqueRecords(input.issueReviewRequests));

  const records = [...issues.entries()]
    .map(([slug, issue]) => {
      const countIds = (values: Set<string>) => [...values].filter(Boolean).length;
      const relationshipCounts = { ...issue.relationshipCounts,
        meetings: countIds(issue.relatedMeetingIds), agendaItems: countIds(issue.relatedAgendaItemIds),
        votingCards: countIds(issue.relatedVotingCardIds), courtCases: countIds(issue.relatedCourtCaseIds),
        communitySubmissions: countIds(issue.relatedIssueReviewRequestIds), sourceDocuments: countIds(issue.relatedSourceUrls),
        votes: countIds(issue.voteItemIds), spendingRecords: countIds(issue.spendingItemIds),
      };
      const confidence = Math.round(Math.min(0.98, Math.max(0.35, average(issue.confidenceSignals))) * 100) / 100;
      const sourceBacked =
        relationshipCounts.votingCards +
          relationshipCounts.agendaItems +
          relationshipCounts.courtCases +
          relationshipCounts.sourceDocuments >
        0;

      return {
        id: `issue_real_${slug}`,
        issueText: issue.issueText,
        issueSlug: slug,
        summary: getIssueTopicSummary(issue.issueText),
        scope: issue.scope,
        jurisdictionName: dominantJurisdiction(issue),
        sourceBacked,
        publicRelationshipEvidenceVersion: 1 as const,
        reviewStatus: confidence >= 0.72 ? "generated" : "needs_review",
        sourceTypes: [...issue.sourceTypes].sort(),
        communities: compactSet(issue.communities, 24),
        policyAreas: compactSet(issue.policyAreas, 12),
        relationshipCounts,
        relatedMeetingIds: compactSet(issue.relatedMeetingIds),
        relatedAgendaItemIds: compactSet(issue.relatedAgendaItemIds),
        relatedVotingCardIds: compactSet(issue.relatedVotingCardIds),
        relatedCourtCaseIds: compactSet(issue.relatedCourtCaseIds),
        relatedIssueReviewRequestIds: compactSet(issue.relatedIssueReviewRequestIds),
        relatedSourceUrls: compactSet(issue.relatedSourceUrls),
        latestActivityAt: issue.latestActivityAt,
        confidence,
      };
    })
    .sort((a, b) => {
      const scoreA = a.relationshipCounts.votingCards + a.relationshipCounts.agendaItems + a.relationshipCounts.courtCases * 3;
      const scoreB = b.relationshipCounts.votingCards + b.relationshipCounts.agendaItems + b.relationshipCounts.courtCases * 3;
      return scoreB - scoreA;
    });

  return records;
}

function main() {
  const records = buildPublicIssueHubRecords({
    meetingItems: readJson(path.join(GENERATED_DIR, "public-meeting-items.json")),
    votingCards: readJson(path.join(GENERATED_DIR, "public-meeting-voting-cards.json")),
    meetings: readJson(path.join(GENERATED_DIR, "public-meetings.json")),
    courtCases: readJson(path.join(GENERATED_DIR, "public-court-cases-runtime.json")),
    issueReviewRequests: readJson(path.join(GENERATED_DIR, "issue-review-requests-runtime.json")),
  });

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        records,
        metrics: {
          issueCount: records.length,
          sourceBackedCount: records.filter((record) => record.sourceBacked).length,
          needsReviewCount: records.filter((record) => record.reviewStatus === "needs_review").length,
          sourceTypes: [...new Set(records.flatMap((record) => record.sourceTypes))].sort(),
        },
      },
      null,
      2,
    )}\n`,
  );

  console.log(`[issues] Generated ${records.length} issue hub records at ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
