import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
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
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
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

export async function getDecisionCards() {
  const artifact = await readJson<Artifact<DecisionCardRecord>>("voting-cards.json", { records: [] });
  return artifact.records ?? [];
}

export async function getDecisionById(decisionId: string) {
  const cards = await getDecisionCards();
  return cards.find((card) => card.id === decisionId) ?? null;
}

export async function getDecisionPageData(decisionId: string) {
  const decision = await getDecisionById(decisionId);
  if (!decision) return null;

  const [votesArtifact, actionsArtifact, projectsArtifact, issuesArtifact] = await Promise.all([
    readJson<Artifact<DecisionVoteRecord> | DecisionVoteRecord[]>("public-meeting-votes.json", { records: [] }),
    readJson<Artifact<DecisionActionResult> | DecisionActionResult[]>("public-meeting-action-results.json", { records: [] }),
    readJson<Artifact<DecisionProject>>("projects-runtime.json", { records: [] }),
    readJson<Artifact<DecisionIssue>>("issues-runtime.json", { records: [] }),
  ]);

  const votes = artifactRecords(votesArtifact).filter((vote) => vote.meeting_item_id === decision.agendaItemId || vote.meeting_id === decision.meetingId);
  const actionResult = artifactRecords(actionsArtifact).find((action) => action.meetingItemId === decision.agendaItemId) ?? null;
  const projects = (projectsArtifact.records ?? []).filter((project) => {
    const related = new Set([...(project.relatedVotingCards ?? []), ...(project.relatedVotes ?? [])]);
    return related.has(decision.id) || related.has(decision.sourceVotingCardId ?? "");
  });
  const issues = (issuesArtifact.records ?? []).filter((issue) => issueMatchesDecision(issue, decision));

  const namedVotes = votes.filter((vote) => ["yes", "no", "abstain", "absent"].includes(vote.vote));
  const motionMetadata = votes.filter((vote) => vote.action_type === "MOTION_MADE" || vote.action_type === "MOTION_SECONDED");
  const reviewVotes = votes.filter((vote) => vote.needs_roll_call_review || vote.review_status?.includes("review"));

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
