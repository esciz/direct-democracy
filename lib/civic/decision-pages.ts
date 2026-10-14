import "server-only";

import { civicJsonPath, readCivicJson } from "@/lib/dataops/packed-runtime";
import { getPublicMeetingItems } from "@/lib/public-meetings/public-record-eligibility";
import { getPublicMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import { cachedTopicNeedsEvidenceReview } from "@/lib/public-meetings/evidence-review";
import type { MeetingVotingCardRecord, OfficialMeetingActionRecord, PublicMeetingItemRecord } from "@/lib/public-meetings/types";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

export type DecisionVoteCount = {
  yes: number;
  no: number;
  abstain: number;
  absent: number;
  unknown: number;
  totalKnown: number;
  display: string;
};

export type DecisionCardRecord = {
  id: string;
  sourceVotingCardId?: string;
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
  voteCount: DecisionVoteCount;
  financialImpact: {
    estimatedAmount: number | null;
    description: string | null;
    raw: string | null;
  };
  relatedIssues: string[];
  relatedOfficials: Array<{ id: string | null; name: string; actionType: string; actionText: string }>;
  sourceReferences: Array<{ label: string; url: string | null; path: string | null; snippet: string | null }>;
  confidence: number;
  reviewStatus: string;
  generatedAt: string;
};

export type DecisionVoteRecord = {
  id: string;
  meeting_item_id: string;
  meeting_id: string;
  official_id: string | null;
  official_name: string | null;
  vote: string;
  action_type: string;
  evidenceType: string;
  source_snippet: string | null;
  vote_text: string | null;
  confidence_score: number | null;
  source_url: string | null;
  motion_made_by?: string | null;
  seconded_by?: string | null;
  needs_roll_call_review?: boolean;
  review_status?: string | null;
  inference_rule?: string | null;
};

export type DecisionActionResult = {
  id: string;
  meetingId: string;
  meetingItemId: string;
  actionTitle: string;
  motionText: string | null;
  mover: string | null;
  seconder: string | null;
  outcome: string | null;
  voteCount: string | null;
  sourceSnippet: string | null;
  sourceUrl: string | null;
  sourcePath: string | null;
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
};

export type DecisionProject = {
  id: string;
  name: string;
  description: string;
  status: string;
  statusReason?: string | null;
  lastPublicAction?: string | null;
  nextKnownMilestone?: string | null;
  responsibleBody?: string | null;
  jurisdiction: string;
  budget: number | null;
  budgetDescription?: string | null;
  startDate: string | null;
  relatedVotingCards?: string[];
  relatedVotes?: string[];
  relatedIssues?: string[];
  sourceReferences: Array<{ label: string; url: string | null; path: string | null; snippet: string | null }>;
  confidence: number;
  needsReview: boolean;
  reviewStatus?: string;
};

export type DecisionIssue = {
  id: string;
  issueText: string;
  issueSlug?: string;
  summary?: string;
  jurisdictionName?: string;
  sourceBacked?: boolean;
  reviewStatus?: string;
  relationshipCounts?: Record<string, number>;
  relatedVotingCardIds?: string[];
};

type Artifact<T> = {
  generatedAt?: string;
  records?: T[];
};

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const filePath = civicJsonPath(path.join(GENERATED_DIR, fileName));
  if (!filePath) return fallback;
  return readCivicJson<T>(filePath);
}

function artifactRecords<T>(value: Artifact<T> | T[]): T[] {
  return Array.isArray(value) ? value : value.records ?? [];
}

function issueMatchesDecision(issue: DecisionIssue, decision: DecisionCardRecord) {
  const explicitIds = issue.relatedVotingCardIds ?? [];
  if (explicitIds.includes(decision.id) || explicitIds.includes(decision.sourceVotingCardId ?? "")) return true;
  return decision.relatedIssues.some((related) => {
    const normalized = related.toLowerCase();
    return (
      issue.id.toLowerCase() === normalized ||
      issue.issueText.toLowerCase() === normalized ||
      issue.issueSlug?.toLowerCase() === normalized
    );
  });
}

function publicOfficialActions(actions: OfficialMeetingActionRecord[]) {
  // Match the public runtime/profile approval and identity requirements. Parser
  // confidence or a source name alone cannot establish an official attribution.
  const approved = actions.filter((action) => action.review_status === "approved" && action.official_id && !action.needs_review
    && Boolean(action.source_url) && Boolean(action.official_name_raw?.trim())
    && (action.confidence >= 0.82 || (action.match_confidence ?? 0) >= 0.88));
  const voteTypes = new Set(["VOTE_YES", "VOTE_NO", "ABSTAIN", "ABSENT"]);
  return approved.filter((action) => !voteTypes.has(action.action_type) || !approved.some((other) =>
    other.meeting_id === action.meeting_id && other.topic_item_id === action.topic_item_id && other.official_id === action.official_id
    && voteTypes.has(other.action_type) && other.action_type !== action.action_type));
}

export async function getDecisionCards() {
  const [artifact, itemsArtifact, cardsArtifact, actionsArtifact] = await Promise.all([
    readJson<Artifact<DecisionCardRecord>>("voting-cards.json", { records: [] }),
    readJson<PublicMeetingItemRecord[]>("public-meeting-items-runtime.json", []),
    readJson<MeetingVotingCardRecord[]>("voting-cards-runtime.json", []),
    readJson<OfficialMeetingActionRecord[]>("officials-runtime.json", []),
  ]);
  const items = new Map(getPublicMeetingItems(itemsArtifact).filter((item) => !cachedTopicNeedsEvidenceReview(item)).map((item) => [item.id, item]));
  const cards = new Map(getPublicMeetingVotingCards(cardsArtifact).map((card) => [card.id, card]));
  const actions = publicOfficialActions(actionsArtifact);
  return (artifact.records ?? []).flatMap((decision) => {
    const item = items.get(decision.agendaItemId);
    const card = cards.get(decision.sourceVotingCardId ?? "");
    if (!["approved", "ready"].includes(decision.reviewStatus) || !(decision.confidence >= 0.8) || !item || !card
      || item.meeting_id !== decision.meetingId || card.meeting_id !== decision.meetingId || card.topic_item_id !== item.id) return [];
    return [{ ...decision, relatedOfficials: actions.filter((action) => action.meeting_id === decision.meetingId && action.topic_item_id === decision.agendaItemId)
      .map((action) => ({ id: action.official_id, name: action.official_name_raw, actionType: action.action_type, actionText: action.action_text })) }];
  });
}

export async function getDecisionById(decisionId: string) {
  const cards = await getDecisionCards();
  return cards.find((card) => card.id === decisionId) ?? null;
}

export async function getDecisionPageData(decisionId: string) {
  const decision = await getDecisionById(decisionId);
  if (!decision) return null;

  const [votesArtifact, actionsArtifact, projectsArtifact, issuesArtifact, officialActionsArtifact] = await Promise.all([
    readJson<Artifact<DecisionVoteRecord> | DecisionVoteRecord[]>("public-meeting-votes.json", { records: [] }),
    readJson<Artifact<DecisionActionResult> | DecisionActionResult[]>("public-meeting-action-results.json", { records: [] }),
    readJson<Artifact<DecisionProject>>("projects-runtime.json", { records: [] }),
    readJson<Artifact<DecisionIssue>>("issues-runtime.json", { records: [] }),
    readJson<OfficialMeetingActionRecord[]>("officials-runtime.json", []),
  ]);

  const officialActions = publicOfficialActions(officialActionsArtifact)
    .filter((action) => action.meeting_id === decision.meetingId && action.topic_item_id === decision.agendaItemId);
  const approvedActor = (name: string | null, actionType: string) => {
    const normalizedName = name?.trim().toLowerCase().replace(/\s+/g, " ");
    return normalizedName ? officialActions.find((action) => action.action_type === actionType
      && action.official_name_raw.trim().toLowerCase().replace(/\s+/g, " ") === normalizedName)?.official_name_raw ?? null : null;
  };
  const topicVotes = artifactRecords(votesArtifact).filter((vote) => vote.meeting_item_id === decision.agendaItemId && vote.meeting_id === decision.meetingId);
  const choiceByAction: Record<string, string> = { VOTE_YES: "yes", VOTE_NO: "no", ABSTAIN: "abstain", ABSENT: "absent", MOTION_MADE: "unknown", MOTION_SECONDED: "unknown" };
  const votes = topicVotes.flatMap((vote) => {
    if (vote.needs_roll_call_review || /review|reject|unmatched|suggested|pending/i.test(vote.review_status ?? "")
      || !vote.official_id || !vote.source_url || choiceByAction[vote.action_type] !== vote.vote) return [];
    const action = officialActions.find((action) => action.official_id === vote.official_id && action.action_type === vote.action_type);
    if (!action || vote.source_url !== action.source_url) return [];
    return [{ ...vote, official_name: action.official_name_raw,
      motion_made_by: approvedActor(vote.motion_made_by ?? null, "MOTION_MADE"), seconded_by: approvedActor(vote.seconded_by ?? null, "MOTION_SECONDED") }];
  });
  const result = artifactRecords(actionsArtifact).find((action) => action.meetingItemId === decision.agendaItemId
    && action.meetingId === decision.meetingId && !action.needsReview && action.confidence >= 0.72 && Boolean(action.sourceUrl)) ?? null;
  const actionResult = result ? { ...result, mover: approvedActor(result.mover, "MOTION_MADE"), seconder: approvedActor(result.seconder, "MOTION_SECONDED") } : null;
  const projects = (projectsArtifact.records ?? []).filter((project) => {
    const related = new Set([...(project.relatedVotingCards ?? []), ...(project.relatedVotes ?? [])]);
    return related.has(decision.id) || related.has(decision.sourceVotingCardId ?? "");
  });
  const issues = (issuesArtifact.records ?? []).filter((issue) => issueMatchesDecision(issue, decision));

  const namedVotes = votes.filter((vote) => ["yes", "no", "abstain", "absent"].includes(vote.vote));
  const motionMetadata = votes.filter((vote) => vote.action_type === "MOTION_MADE" || vote.action_type === "MOTION_SECONDED");
  const reviewVotes: DecisionVoteRecord[] = [];

  return {
    decision,
    actionResult,
    votes,
    namedVotes,
    motionMetadata,
    reviewVotes,
    projects,
    issues,
    generatedAt: decision.generatedAt,
    sourceCount: decision.sourceReferences.length,
  };
}
