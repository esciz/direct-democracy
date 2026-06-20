import fs from "node:fs";
import path from "node:path";

import { getCanonicalIssueText, getCanonicalIssueTextOrNull, getIssueTopicSummary, slugifyIssueText } from "@/lib/issues/utils";
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

function deriveIssueTextFromPolicyArea(policyArea: string, fallbackText: string) {
  if (policyArea && policyArea.toLowerCase() !== "other") {
    const canonicalPolicyArea = getCanonicalIssueTextOrNull(policyArea);
    if (canonicalPolicyArea) {
      return canonicalPolicyArea;
    }

    if (policyArea.length <= 36 && !/meeting materials|board of supervisors|city council|commission/i.test(policyArea)) {
      return policyArea;
    }

    return null;
  }
  return getCanonicalIssueTextOrNull(fallbackText);
}

function ingestVotingCards(issues: Map<string, IssueAccumulator>) {
  const cards = asRecords(readJson(path.join(GENERATED_DIR, "public-meeting-voting-cards.json")));

  for (const card of cards) {
    const policyArea = text(card.policy_area);
    const title = text(card.public_title) || text(card.title) || text(card.source_title);
    const summary = text(card.plain_language_summary) || text(card.citizen_summary) || text(card.question_text);
    const jurisdiction = text(card.jurisdiction_display_name) || text(card.jurisdiction);
    const issueText = deriveIssueTextFromPolicyArea(policyArea, `${title} ${summary}`);
    if (!issueText) {
      continue;
    }
    const issue = getOrCreateIssue(issues, issueText, inferScope(jurisdiction));

    issue.sourceTypes.add("meeting_voting_card");
    issue.policyAreas.add(policyArea || "Other");
    issue.relationshipCounts.votingCards += 1;
    issue.relationshipCounts.meetings += text(card.meeting_id) ? 1 : 0;
    issue.relationshipCounts.agendaItems += text(card.topic_item_id) ? 1 : 0;
    issue.relationshipCounts.votes += text(card.outcome_status) && text(card.outcome_status) !== "unknown" ? 1 : 0;
    issue.relationshipCounts.spendingRecords += text(card.financial_impact) ? 1 : 0;
    issue.relationshipCounts.sourceDocuments += Array.isArray(card.source_snippets) ? card.source_snippets.length : 0;
    issue.relatedVotingCardIds.add(text(card.id));
    issue.relatedMeetingIds.add(text(card.meeting_id));
    issue.relatedAgendaItemIds.add(text(card.topic_item_id));
    addJurisdiction(issue, jurisdiction);
    addSources(issue, card.source_url, card.source_event_href, card.source_topic_href);
    issue.latestActivityAt = addLatest(issue.latestActivityAt, text(card.meeting_date));
    issue.confidenceSignals.push(numberValue(card.confidence_score) ?? 0.68);
  }
}

function ingestAgendaItems(issues: Map<string, IssueAccumulator>) {
  const items = asRecords(readJson(path.join(GENERATED_DIR, "public-meeting-items.json")));

  for (const item of items) {
    const policyArea = text(item.policy_area);
    const title = text(item.title);
    const explanation = text(item.plain_english_explanation) || text(item.one_sentence_summary) || text(item.description);
    const issueText = deriveIssueTextFromPolicyArea(policyArea, `${title} ${explanation}`);
    if (!issueText) {
      continue;
    }
    const issue = getOrCreateIssue(issues, issueText, "local");

    issue.sourceTypes.add("agenda_item");
    issue.policyAreas.add(policyArea || "Other");
    issue.relationshipCounts.agendaItems += 1;
    issue.relationshipCounts.sourceDocuments += text(item.source_url) ? 1 : 0;
    issue.relationshipCounts.spendingRecords += text(item.financial_impact) || text(item.fiscal_impact_summary) ? 1 : 0;
    issue.relatedAgendaItemIds.add(text(item.id));
    issue.relatedMeetingIds.add(text(item.meeting_id));
    addSources(issue, item.source_url, item.source_page);
    issue.confidenceSignals.push(numberValue(item.confidence_score) ?? 0.45);
  }
}

function ingestCourtCases(issues: Map<string, IssueAccumulator>) {
  const cases = asRecords(readJson(path.join(GENERATED_DIR, "public-court-cases-runtime.json")));

  for (const courtCase of cases) {
    const tags = Array.isArray(courtCase.issueTags) ? courtCase.issueTags.map(text).filter(Boolean) : [];
    const issueText = tags[1] ?? tags[0] ?? `${text(courtCase.caseType)} ${text(courtCase.courtName)}`;
    const jurisdiction = text(courtCase.jurisdictionName) || "Nevada";
    const issue = getOrCreateIssue(issues, issueText, inferScope(jurisdiction));

    issue.sourceTypes.add("public_court_record");
    issue.policyAreas.add("Courts and Legal Rights");
    issue.relationshipCounts.courtCases += 1;
    issue.relationshipCounts.sourceDocuments += Array.isArray(courtCase.documents) ? courtCase.documents.length : 1;
    issue.relatedCourtCaseIds.add(text(courtCase.id));
    addJurisdiction(issue, jurisdiction);
    addSources(issue, courtCase.sourceUrl);
    issue.latestActivityAt = addLatest(issue.latestActivityAt, text(courtCase.dispositionDate) || text(courtCase.createdAt));
    issue.confidenceSignals.push(0.92);
  }
}

function ingestIssueReviewRequests(issues: Map<string, IssueAccumulator>) {
  const requests = asRecords(readJson(path.join(GENERATED_DIR, "issue-review-requests-runtime.json")));

  for (const request of requests) {
    const jurisdiction = text(request.jurisdictionName) || text(request.community);
    const issue = getOrCreateIssue(issues, text(request.category) || text(request.title), inferScope(jurisdiction));

    issue.sourceTypes.add("citizen_issue_submission");
    issue.policyAreas.add(text(request.category) || "Other");
    issue.relationshipCounts.communitySubmissions += 1;
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

function main() {
  const issues = new Map<string, IssueAccumulator>();

  ingestVotingCards(issues);
  ingestAgendaItems(issues);
  ingestCourtCases(issues);
  ingestIssueReviewRequests(issues);

  const records = [...issues.entries()]
    .map(([slug, issue]) => {
      const confidence = Math.round(Math.min(0.98, Math.max(0.35, average(issue.confidenceSignals))) * 100) / 100;
      const sourceBacked =
        issue.relationshipCounts.votingCards +
          issue.relationshipCounts.agendaItems +
          issue.relationshipCounts.courtCases +
          issue.relationshipCounts.sourceDocuments >
        0;

      return {
        id: `issue_real_${slug}`,
        issueText: issue.issueText,
        issueSlug: slug,
        summary: getIssueTopicSummary(issue.issueText),
        scope: issue.scope,
        jurisdictionName: dominantJurisdiction(issue),
        sourceBacked,
        reviewStatus: confidence >= 0.72 ? "generated" : "needs_review",
        sourceTypes: [...issue.sourceTypes].sort(),
        communities: compactSet(issue.communities, 24),
        policyAreas: compactSet(issue.policyAreas, 12),
        relationshipCounts: issue.relationshipCounts,
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

main();
