import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AccountabilityGraph } from "@/lib/community/accountability-graph";

type JsonRecord = Record<string, unknown>;
type Artifact<T> = { generatedAt?: string; records?: T[] };

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "accountability-navigation-audit.json");

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function records<T extends JsonRecord>(fileName: string): T[] {
  const value = readJson<Artifact<T> | T[]>(fileName, []);
  return Array.isArray(value) ? value : value.records ?? [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

const decisionCards = records<JsonRecord>("voting-cards.json");
const projects = records<JsonRecord>("projects-runtime.json");
const relationships = readJson<JsonRecord>("nevada-community-relationships.json", {});
const graph = readJson<AccountabilityGraph | null>("accountability-graph.json", null);
const decisionIds = new Set(decisionCards.map((card) => text(card.id)).filter(Boolean));
const sourceDecisionIds = new Set(decisionCards.map((card) => text(card.sourceVotingCardId)).filter(Boolean));

function decisionIdFromHref(href: string) {
  const match = href.match(/^\/decisions\/(.+)$/);
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

function isKnownDecisionHref(href: string) {
  const decisionId = decisionIdFromHref(href);
  return Boolean(decisionId && decisionIds.has(decisionId));
}

const projectsWithDecisionLinks = projects.filter((project) => {
  const related = [...((project.relatedVotingCards as string[] | undefined) ?? []), ...((project.relatedVotes as string[] | undefined) ?? [])];
  return related.some((id) => decisionIds.has(id) || sourceDecisionIds.has(id));
});

const relationshipRecords = Object.values((relationships.communities as Record<string, JsonRecord> | undefined) ?? {}).flatMap((bucket) => {
  const bucketRecords = bucket.records as Record<string, JsonRecord[]> | undefined;
  return bucketRecords?.votingCards ?? [];
});
const votingRelationshipLinks = relationshipRecords.map((record) => text(record.href)).filter(Boolean);
const deadRelationshipDecisionLinks = votingRelationshipLinks.filter((href) => href.startsWith("/decisions/") && !isKnownDecisionHref(href));
const relationshipVoteLinksToDecisionPages = votingRelationshipLinks.filter((href) => href.startsWith("/decisions/")).length;
const relationshipVoteLinksToSources = votingRelationshipLinks.filter((href) => href.startsWith("http")).length;
const relationshipVoteLinksMissing = relationshipRecords.filter((record) => !text(record.href) && !text(record.sourceUrl)).length;

const graphDecisionNodes = graph?.nodes.filter((node) => node.type === "decision") ?? [];
const graphDecisionNodesWithDecisionHref = graphDecisionNodes.filter((node) => node.href?.startsWith("/decisions/")).length;
const deadGraphDecisionLinks = graphDecisionNodes
  .map((node) => node.href ?? "")
  .filter((href) => href.startsWith("/decisions/") && !isKnownDecisionHref(href));

const sourceBackedDecisions = decisionCards.filter((card) => Array.isArray(card.sourceReferences) && card.sourceReferences.length > 0);
const decisionsMissingSourceReferences = decisionCards.filter((card) => !Array.isArray(card.sourceReferences) || card.sourceReferences.length === 0);
const decisionsNeedingReview = decisionCards.filter((card) => text(card.reviewStatus).includes("review") || (typeof card.confidence === "number" && card.confidence < 0.7));

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    decisions: decisionCards.length,
    sourceBackedDecisions: sourceBackedDecisions.length,
    decisionsNeedingReview: decisionsNeedingReview.length,
    decisionsMissingSourceReferences: decisionsMissingSourceReferences.length,
    projects: projects.length,
    projectsWithDecisionLinks: projectsWithDecisionLinks.length,
    relationshipVoteLinksToDecisionPages,
    relationshipVoteLinksToSources,
    relationshipVoteLinksMissing,
    graphDecisionNodes: graphDecisionNodes.length,
    graphDecisionNodesWithDecisionHref,
    deadRelationshipDecisionLinks: deadRelationshipDecisionLinks.length,
    deadGraphDecisionLinks: deadGraphDecisionLinks.length,
  },
  failures: [
    ...(decisionsMissingSourceReferences.length ? [`${decisionsMissingSourceReferences.length} decision(s) missing source references.`] : []),
    ...(deadRelationshipDecisionLinks.length ? [`${deadRelationshipDecisionLinks.length} relationship decision link(s) point to missing decisions.`] : []),
    ...(deadGraphDecisionLinks.length ? [`${deadGraphDecisionLinks.length} graph decision link(s) point to missing decisions.`] : []),
  ],
  samples: {
    deadRelationshipDecisionLinks: deadRelationshipDecisionLinks.slice(0, 10),
    deadGraphDecisionLinks: deadGraphDecisionLinks.slice(0, 10),
    projectsWithoutDecisionLinks: projects
      .filter((project) => !projectsWithDecisionLinks.includes(project))
      .slice(0, 10)
      .map((project) => ({ id: text(project.id), name: text(project.name) || text(project.title), jurisdiction: text(project.jurisdiction) })),
  },
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

console.log("Accountability navigation audit complete.");
console.log(JSON.stringify(report.totals, null, 2));

if (report.failures.length) {
  console.error(JSON.stringify({ failures: report.failures }, null, 2));
  process.exit(1);
}
