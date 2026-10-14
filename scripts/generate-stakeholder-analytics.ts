import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getStakeholderAnalyticsRuntime } from "@/lib/civic-signals/stakeholder-analytics";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const RUNTIME_PATH = path.join(GENERATED_DIR, "stakeholder-analytics-runtime.json");
const AUDIT_PATH = path.join(GENERATED_DIR, "stakeholder-analytics-audit.json");

async function main() {
  const runtime = await getStakeholderAnalyticsRuntime();
  const validation = {
    noIndividualRecordsExposed: runtime.policy.individualRecordsExposed === false,
    unrestrictedCrossFilteringDisabled: runtime.policy.unrestrictedCrossFilteringAllowed === false,
    hiddenWeightingDisabled: runtime.policy.hiddenWeighting === false,
    allPublicSegmentsVoteWeightOne: runtime.records.every((record) => record.segments.every((segment) => segment.suppressed || segment.voteWeight === 1)),
    smallCohortsSuppressed: runtime.records.every((record) =>
      record.segments.every((segment) => segment.suppressed || segment.count >= runtime.policy.minimumCohortSize),
    ),
    sourceBackedQuestionsOnly: runtime.records.every((record) => Boolean(record.sourceUrl)),
  };

  const audit = {
    generatedAt: runtime.generatedAt,
    policy: runtime.policy,
    totals: runtime.totals,
    validation,
    pass: Object.values(validation).every(Boolean),
    reviewNotes: [
      "Generated stakeholder analytics expose only aggregate segment summaries.",
      "No user IDs, names, addresses, demographic combinations, or individual vote records are written to the runtime artifact.",
      "Segments below the minimum cohort size are suppressed.",
    ],
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(RUNTIME_PATH, `${JSON.stringify(runtime, null, 2)}\n`);
  writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(`Generated stakeholder analytics at ${RUNTIME_PATH}`);
  console.log(JSON.stringify({ pass: audit.pass, ...audit.totals }, null, 2));

  if (!audit.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
