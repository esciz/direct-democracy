import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildDecisionIntelligence } from "@/lib/civic/decision-intelligence";
import type {
  MeetingVotingCardRecord,
  PublicBodyRecord,
  PublicMeetingItemRecord,
  PublicMeetingRecord,
  VoteRecord,
} from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "voting-cards.json");

type SourceReference = {
  label: string;
  url: string | null;
  path: string | null;
  snippet: string | null;
};

export type GeneratedVotingCard = {
  id: string;
  sourceVotingCardId: string;
  agendaItemId: string;
  meetingId: string;
  title: string;
  summary: string;
  whyItMatters: string;
  affectedGroups: string[];
  jurisdiction: string;
  meeting: {
    id: string;
    title: string;
    date: string | null;
    bodyName: string;
    href: string;
  };
  decisionType: string;
  voteOutcome: string;
  voteCount: {
    yes: number;
    no: number;
    abstain: number;
    absent: number;
    unknown: number;
    totalKnown: number;
    display: string;
  };
  financialImpact: {
    estimatedAmount: number | null;
    description: string | null;
    raw: string | null;
  };
  relatedIssues: string[];
  relatedOfficials: Array<{
    id: string | null;
    name: string;
    actionType: string;
    actionText: string;
  }>;
  sourceReferences: SourceReference[];
  confidence: number;
  reviewStatus: string;
  generatedAt: string;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function recordsFrom<T>(fileName: string): T[] {
  const value = readJson<unknown>(fileName, []);
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { records?: unknown[] }).records)) {
    return (value as { records: T[] }).records;
  }
  return [];
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function sourceReferencesFor(card: MeetingVotingCardRecord, item: PublicMeetingItemRecord | undefined, meeting: PublicMeetingRecord | undefined): SourceReference[] {
  const references: SourceReference[] = [];
  const urls = unique([card.source_url, item?.source_url, meeting?.agenda_url, meeting?.minutes_url, meeting?.packet_url, ...(meeting?.source_urls ?? [])].filter(Boolean) as string[]);
  for (const [index, url] of urls.entries()) {
    references.push({
      label: index === 0 ? "Primary source" : "Supporting source",
      url,
      path: item?.source_local_path ?? null,
      snippet: card.source_snippets[index] ?? item?.source_snippet ?? null,
    });
  }
  if (!references.length && item?.source_local_path) {
    references.push({
      label: "Cached source text",
      url: null,
      path: item.source_local_path,
      snippet: item.source_snippet ?? card.source_snippets[0] ?? null,
    });
  }
  return references.filter((reference) => reference.url || reference.path || reference.snippet);
}

function voteCountFor(card: MeetingVotingCardRecord, votes: VoteRecord[]) {
  const relatedVotes = votes.filter((vote) => vote.meeting_item_id === card.topic_item_id);
  const counts = { yes: 0, no: 0, abstain: 0, absent: 0, unknown: 0 };
  for (const vote of relatedVotes) {
    if (vote.vote === "yes") counts.yes += 1;
    else if (vote.vote === "no") counts.no += 1;
    else if (vote.vote === "abstain" || vote.vote === "recused") counts.abstain += 1;
    else if (vote.vote === "absent") counts.absent += 1;
    else counts.unknown += 1;
  }

  for (const action of card.related_official_actions) {
    if (action.action_type === "VOTE_YES") counts.yes += 1;
    else if (action.action_type === "VOTE_NO") counts.no += 1;
    else if (action.action_type === "ABSTAIN") counts.abstain += 1;
    else if (action.action_type === "ABSENT") counts.absent += 1;
  }

  const totalKnown = counts.yes + counts.no + counts.abstain + counts.absent;
  const display = totalKnown ? `${counts.yes}-${counts.no}${counts.abstain ? `, ${counts.abstain} abstain` : ""}` : "Vote count not parsed";
  return { ...counts, totalKnown, display };
}

function relatedIssuesFor(card: MeetingVotingCardRecord, item: PublicMeetingItemRecord | undefined) {
  return unique([card.policy_area, item?.policy_area].filter(Boolean) as string[]).filter((value) => value !== "Other");
}

function buildCards() {
  const generatedAt = new Date().toISOString();
  const cards = recordsFrom<MeetingVotingCardRecord>("public-meeting-voting-cards.json");
  const meetings = recordsFrom<PublicMeetingRecord>("public-meetings.json");
  const items = recordsFrom<PublicMeetingItemRecord>("public-meeting-items.json");
  const bodies = recordsFrom<PublicBodyRecord>("public-meeting-bodies.json");
  const votes = recordsFrom<VoteRecord>("public-meeting-votes.json");
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const bodyById = new Map(bodies.map((body) => [body.id, body]));

  const output = cards.flatMap((card): GeneratedVotingCard[] => {
    const meeting = meetingById.get(card.meeting_id);
    const item = itemById.get(card.topic_item_id);
    const body = meeting ? bodyById.get(meeting.public_body_id) : undefined;
    const sourceReferences = sourceReferencesFor(card, item, meeting);
    if (!sourceReferences.length) return [];

    const intelligence = buildDecisionIntelligence({
      meeting,
      agendaItem: item,
      publicBody: body,
      votingCard: card,
      votes: votes.filter((vote) => vote.meeting_item_id === card.topic_item_id),
    });
    const voteCount = voteCountFor(card, votes);

    return [
      {
        id: card.id.replace(/^meeting-voting-card-/, "voting-card-"),
        sourceVotingCardId: card.id,
        agendaItemId: card.topic_item_id,
        meetingId: card.meeting_id,
        title: intelligence.citizenTitle,
        summary: intelligence.citizenSummary,
        whyItMatters: intelligence.whyItMatters,
        affectedGroups: intelligence.affectedGroups,
        jurisdiction: card.jurisdiction,
        meeting: {
          id: card.meeting_id,
          title: meeting?.title ?? card.body_name,
          date: card.meeting_date,
          bodyName: card.body_name,
          href: card.source_event_href || `/events/${card.meeting_id}`,
        },
        decisionType: intelligence.decisionType,
        voteOutcome: card.outcome_status,
        voteCount,
        financialImpact: {
          estimatedAmount: intelligence.estimatedFinancialImpact ?? null,
          description: intelligence.financialImpactDescription ?? null,
          raw: card.financial_impact,
        },
        relatedIssues: relatedIssuesFor(card, item),
        relatedOfficials: card.related_official_actions.map((action) => ({
          id: action.official_id,
          name: action.official_name_raw,
          actionType: action.action_type,
          actionText: action.action_text,
        })),
        sourceReferences,
        confidence: intelligence.confidence,
        reviewStatus: card.review_status,
        generatedAt,
      },
    ];
  });

  return {
    generatedAt,
    sourceArtifacts: [
      "data/generated/public-meeting-voting-cards.json",
      "data/generated/public-meeting-items.json",
      "data/generated/public-meetings.json",
      "data/generated/public-meeting-votes.json",
    ],
    totals: {
      sourceVotingCards: cards.length,
      generatedCards: output.length,
      skippedWithoutSources: cards.length - output.length,
      cardsWithFinancialImpact: output.filter((card) => card.financialImpact.estimatedAmount || card.financialImpact.raw).length,
      cardsWithParsedVotes: output.filter((card) => card.voteCount.totalKnown > 0).length,
      approved: output.filter((card) => card.reviewStatus === "approved").length,
      ready: output.filter((card) => card.reviewStatus === "ready").length,
      needsReview: output.filter((card) => card.reviewStatus === "needs_review").length,
    },
    records: output.sort((left, right) => (Date.parse(right.meeting.date ?? "") || 0) - (Date.parse(left.meeting.date ?? "") || 0)),
  };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const artifact = buildCards();
writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`Generated ${artifact.records.length} voting cards at ${OUTPUT_PATH}`);
