import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { slugify, summarizeText } from "@/lib/public-meetings/shared";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "projects-runtime.json");
const AUDIT_OUTPUT_PATH = path.join(GENERATED_DIR, "project-status-audit.json");

type GeneratedVotingCardsArtifact = {
  generatedAt: string;
  records: Array<{
    id: string;
    agendaItemId: string;
    meetingId: string;
    title: string;
    summary: string;
    whyItMatters: string;
    jurisdiction: string;
    meeting: { id: string; title: string; date: string | null; bodyName: string; href: string };
    decisionType: string;
    voteOutcome: string;
    financialImpact: { estimatedAmount: number | null; description: string | null; raw: string | null };
    relatedIssues: string[];
    sourceReferences: Array<{ label: string; url: string | null; path: string | null; snippet: string | null }>;
    confidence: number;
    reviewStatus: string;
  }>;
};

type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  status: ProjectLifecycleStatus;
  statusReason: string;
  lastPublicAction: string | null;
  nextKnownMilestone: string | null;
  responsibleBody: string | null;
  jurisdiction: string;
  budget: number | null;
  budgetDescription: string | null;
  startDate: string | null;
  sourceMeetings: Array<{ id: string; title: string; date: string | null; href: string }>;
  relatedMeetings: string[];
  relatedVotes: string[];
  relatedVotingCards: string[];
  relatedIssues: string[];
  sourceReferences: Array<{ label: string; url: string | null; path: string | null; snippet: string | null }>;
  confidence: number;
  needsReview: boolean;
  reviewStatus: "source_backed" | "needs_review";
  generatedAt: string;
};

type ProjectLifecycleStatus = "proposed" | "approved" | "funded" | "in_progress" | "delayed" | "completed" | "canceled" | "unknown";

const PROJECT_SIGNAL =
  /\b(project|capital improvement|construction|build|facility|expansion|renovation|replacement|repair|road|street|bridge|water|sewer|stormwater|utility|contract|award|infrastructure|plant|park|airport|public safety facility)\b/i;
const SPENDING_SIGNAL = /\b(spend|fund|budget|appropriat|allocate|expenditure|expense|purchase|award|contract|grant|\$[\d,])\b/i;

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function projectStatus(card: GeneratedVotingCardsArtifact["records"][number]): { status: ProjectLifecycleStatus; reason: string } {
  const text = `${card.title} ${card.summary} ${card.whyItMatters} ${card.financialImpact.description ?? ""} ${card.financialImpact.raw ?? ""}`.toLowerCase();
  if (/\b(completed|final acceptance|closeout|closed out)\b/.test(text)) return { status: "completed", reason: "Source text indicates completion or final acceptance." };
  if (/\b(canceled|cancelled|terminate|terminated|rescinded)\b/.test(text)) return { status: "canceled", reason: "Source text indicates cancellation or termination." };
  if (/\b(delayed|postponed|deferred|continued|tabled)\b/.test(text) || card.voteOutcome === "continued") return { status: "delayed", reason: "Source text indicates delay, deferral, continuation, or tabling." };
  if (/\b(construction|notice to proceed|work is underway|in progress|phase)\b/.test(text)) return { status: "in_progress", reason: "Source text indicates construction, phase work, or work underway." };
  if (card.financialImpact.estimatedAmount || /\b(fund|funding|grant|appropriat|budget|contract|award)\b/.test(text)) {
    return { status: card.voteOutcome === "approved" || card.voteOutcome === "unknown" ? "funded" : "proposed", reason: "Source text identifies funding, budget, grant, contract, or award activity." };
  }
  if (card.voteOutcome === "approved") return { status: "approved", reason: "Decision outcome is approved, but project implementation status is not stated." };
  if (card.voteOutcome === "proposed" || card.voteOutcome === "pending") return { status: "proposed", reason: "Decision is proposed or pending." };
  return { status: "unknown", reason: "Source-backed project signal exists, but lifecycle status is unclear." };
}

function nextMilestone(text: string) {
  const milestone = text.match(/\b(?:through|until|by|from)\s+([A-Z][a-z]+\s+\d{1,2},\s+20\d{2}|20\d{2}|FY\s*20\d{2}(?:[-/]\d{2,4})?)\b/);
  return milestone?.[0] ?? null;
}

function projectName(title: string) {
  return summarizeText(
    title
      .replace(/^should\s+/i, "")
      .replace(/\?$/g, "")
      .replace(/\b(the city|the county|the school district|this public body)\s+/i, "")
      .replace(/\b(approve|fund|spend|authorize|award)\s+/i, ""),
    110,
  );
}

function buildProjects(): { generatedAt: string; sourceArtifacts: string[]; totals: Record<string, number>; records: ProjectRecord[] } {
  const generatedAt = new Date().toISOString();
  const votingCards = readJson<GeneratedVotingCardsArtifact>("voting-cards.json", { generatedAt, records: [] });
  const records = votingCards.records.flatMap((card): ProjectRecord[] => {
    const searchable = `${card.title} ${card.summary} ${card.whyItMatters} ${card.financialImpact.description ?? ""} ${card.financialImpact.raw ?? ""}`;
    const hasProjectSignal = PROJECT_SIGNAL.test(searchable);
    const hasApprovedSpending = SPENDING_SIGNAL.test(searchable) && ["approved", "proposed", "pending", "unknown"].includes(card.voteOutcome);
    if (!hasProjectSignal && !hasApprovedSpending) return [];
    if (!card.sourceReferences.length) return [];

    const name = projectName(card.title);
    const status = projectStatus(card);
    const searchableSummary = `${card.summary} ${card.whyItMatters} ${card.financialImpact.description ?? ""} ${card.financialImpact.raw ?? ""}`;
    return [
      {
        id: `project-${slugify(`${card.jurisdiction}-${name}-${card.agendaItemId}`).slice(0, 80)}`,
        name,
        description: summarizeText(card.summary || card.whyItMatters, 420),
        status: status.status,
        statusReason: status.reason,
        lastPublicAction: summarizeText(card.title, 260),
        nextKnownMilestone: nextMilestone(searchableSummary),
        responsibleBody: card.meeting.bodyName || null,
        jurisdiction: card.jurisdiction,
        budget: card.financialImpact.estimatedAmount,
        budgetDescription: card.financialImpact.description ?? card.financialImpact.raw,
        startDate: card.meeting.date,
        sourceMeetings: [
          {
            id: card.meeting.id,
            title: card.meeting.title,
            date: card.meeting.date,
            href: card.meeting.href,
          },
        ],
        relatedMeetings: [card.meeting.id],
        relatedVotes: [card.id],
        relatedVotingCards: [card.id],
        relatedIssues: card.relatedIssues,
        sourceReferences: card.sourceReferences,
        confidence: Math.max(0.1, Math.min(0.96, Number((card.confidence - (card.reviewStatus === "needs_review" ? 0.06 : 0)).toFixed(2)))),
        needsReview: card.reviewStatus !== "approved" || status.status === "unknown",
        reviewStatus: card.reviewStatus === "approved" && status.status !== "unknown" ? "source_backed" : "needs_review",
        generatedAt,
      },
    ];
  });

  const uniqueRecords = new Map<string, ProjectRecord>();
  for (const record of records) {
    const existing = uniqueRecords.get(record.id);
    if (!existing) {
      uniqueRecords.set(record.id, record);
      continue;
    }
    uniqueRecords.set(record.id, {
      ...existing,
      budget: existing.budget ?? record.budget,
      budgetDescription: existing.budgetDescription ?? record.budgetDescription,
      sourceMeetings: [...existing.sourceMeetings, ...record.sourceMeetings].filter(
        (meeting, index, meetings) => meetings.findIndex((candidate) => candidate.id === meeting.id) === index,
      ),
      relatedMeetings: [...new Set([...existing.relatedMeetings, ...record.relatedMeetings])],
      relatedVotes: [...new Set([...existing.relatedVotes, ...record.relatedVotes])],
      relatedVotingCards: [...new Set([...existing.relatedVotingCards, ...record.relatedVotingCards])],
      relatedIssues: [...new Set([...existing.relatedIssues, ...record.relatedIssues])],
      sourceReferences: [...existing.sourceReferences, ...record.sourceReferences].filter(
        (source, index, sources) => sources.findIndex((candidate) => `${candidate.url ?? ""}-${candidate.path ?? ""}` === `${source.url ?? ""}-${source.path ?? ""}`) === index,
      ),
      confidence: Math.max(existing.confidence, record.confidence),
      needsReview: existing.needsReview || record.needsReview,
      reviewStatus: existing.reviewStatus === "source_backed" && record.reviewStatus === "source_backed" ? "source_backed" : "needs_review",
    });
  }

  const output = [...uniqueRecords.values()].sort((left, right) => (Date.parse(right.startDate ?? "") || 0) - (Date.parse(left.startDate ?? "") || 0));

  return {
    generatedAt,
    sourceArtifacts: ["data/generated/voting-cards.json"],
    totals: {
      sourceVotingCards: votingCards.records.length,
      generatedProjects: output.length,
      projectsWithBudget: output.filter((project) => project.budget !== null).length,
      projectsWithSourceMeetings: output.filter((project) => project.sourceMeetings.length > 0).length,
    },
    records: output,
  };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const artifact = buildProjects();
writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
const statusCounts = artifact.records.reduce<Record<string, number>>((counts, project) => {
  counts[project.status] = (counts[project.status] ?? 0) + 1;
  return counts;
}, {});
const audit = {
  generatedAt: artifact.generatedAt,
  totals: {
    projects: artifact.records.length,
    needsReview: artifact.records.filter((project) => project.needsReview).length,
    withBudget: artifact.records.filter((project) => project.budget !== null).length,
    withNextKnownMilestone: artifact.records.filter((project) => project.nextKnownMilestone).length,
    withResponsibleBody: artifact.records.filter((project) => project.responsibleBody).length,
    withSourceReferences: artifact.records.filter((project) => project.sourceReferences.length > 0).length,
  },
  statusCounts,
  unclearStatusReasons: artifact.records
    .filter((project) => project.status === "unknown")
    .slice(0, 50)
    .map((project) => ({ id: project.id, name: project.name, statusReason: project.statusReason })),
};
writeFileSync(AUDIT_OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated ${artifact.records.length} projects at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
