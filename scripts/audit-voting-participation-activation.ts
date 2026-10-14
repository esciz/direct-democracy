import fs from "node:fs/promises";
import path from "node:path";

import { getParticipationActivationRuntime } from "@/lib/civic-signals/participation-activation";
import { getStakeholderAnalyticsRuntime } from "@/lib/civic-signals/stakeholder-analytics";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "voting-participation-activation-audit.json");

async function main() {
  const stakeholder = await getStakeholderAnalyticsRuntime();
  const runtime = await getParticipationActivationRuntime({
    stakeholderPublicSegments: stakeholder.totals.publicSegments,
    stakeholderSuppressedSegments: stakeholder.totals.suppressedSegments,
  });
  const pass =
    runtime.validation.votingQueueSourceBackedByDefault &&
    runtime.validation.responseMutationRequiresVerification &&
    runtime.validation.noDemoQuestionsCounted &&
    runtime.validation.noIndividualRecordsExposed &&
    runtime.validation.hiddenWeightingDisabled &&
    runtime.validation.oneVotePerQuestionEnforcedBySchema &&
    runtime.validation.excludedResponsesNotCountedInAnalytics &&
    runtime.validation.demoAndQaResponsesExcludedByDefault &&
    runtime.policy.voteWeight === 1;

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    `${JSON.stringify({
      ...runtime,
      pass,
      stakeholderAnalyticsGeneratedAt: stakeholder.generatedAt,
    }, null, 2)}\n`,
  );

  console.log("Voting participation activation audit complete.");
  console.log(JSON.stringify({ pass, totals: runtime.totals, output: OUTPUT_PATH }, null, 2));

  if (!pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
