import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getDecisionTrustView } from "../lib/civic/public-decision-trust";

type VotingCard = {
  id: string;
  reviewStatus?: string | null;
  confidence?: number | null;
  sourceReferences?: unknown[] | null;
  voteCount?: { totalKnown?: number; display?: string };
  voteOutcome?: string;
};

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const artifact = JSON.parse(readFileSync(path.join(GENERATED_DIR, "voting-cards.json"), "utf8")) as { records?: VotingCard[] } | VotingCard[];
const records = Array.isArray(artifact) ? artifact : artifact.records ?? [];

const counts = {
  total: records.length,
  approved: 0,
  ready: 0,
  needsReview: 0,
  publicSpotlightReady: 0,
  cardsWithParsedVoteCount: 0,
  aggregateOrUnknownVoteOnly: 0,
  missingSources: 0,
};

const samples: Record<string, string[]> = {
  approved: [],
  ready: [],
  needs_review: [],
};

for (const record of records) {
  const trust = getDecisionTrustView(record);
  if (trust.state === "approved") counts.approved += 1;
  if (trust.state === "ready") counts.ready += 1;
  if (trust.state === "needs_review") counts.needsReview += 1;
  if (trust.isPublicSpotlightReady) counts.publicSpotlightReady += 1;
  if ((record.voteCount?.totalKnown ?? 0) > 0) counts.cardsWithParsedVoteCount += 1;
  else counts.aggregateOrUnknownVoteOnly += 1;
  if (!(record.sourceReferences?.length ?? 0)) counts.missingSources += 1;
  if (samples[trust.state].length < 5) samples[trust.state].push(record.id);
}

const audit = {
  generatedAt: new Date().toISOString(),
  policy: {
    approved: "Reviewed source-backed decisions appear as solid public records.",
    ready: "Source-backed previews appear publicly but disclose missing outcome, roll-call, or impact details.",
    needsReview: "Needs-review decisions are excluded from the main community spotlight and shown as limited data when surfaced.",
  },
  counts,
  samples,
  pass: counts.total === counts.approved + counts.ready + counts.needsReview && counts.missingSources === 0,
};

const outPath = path.join(GENERATED_DIR, "public-decision-trust-audit.json");
writeFileSync(outPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated public decision trust audit at ${outPath}`);
console.log(JSON.stringify({ counts, pass: audit.pass }, null, 2));
