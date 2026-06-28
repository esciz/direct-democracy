import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const WORKFLOW_PATH = path.join(process.cwd(), ".github", "workflows", "dataops-daily.yml");
const OUTPUT_PATH = path.join(GENERATED_DIR, "github-network-worker-audit.json");
const IMPORT_SCRIPT_PATH = path.join(process.cwd(), "scripts", "import-officials-evidence.ts");
const PROMOTE_SCRIPT_PATH = path.join(process.cwd(), "scripts", "promote-current-officials.ts");

function includesAll(source: string, values: string[]) {
  return values.every((value) => source.includes(value));
}

const generatedAt = new Date().toISOString();
const workflow = existsSync(WORKFLOW_PATH) ? readFileSync(WORKFLOW_PATH, "utf8") : "";
const importScript = existsSync(IMPORT_SCRIPT_PATH) ? readFileSync(IMPORT_SCRIPT_PATH, "utf8") : "";
const promoteScript = existsSync(PROMOTE_SCRIPT_PATH) ? readFileSync(PROMOTE_SCRIPT_PATH, "utf8") : "";
const fixedModes = ["retrieve", "retrieve_and_reconcile", "validate_only", "promote_reviewed", "refresh_due_sources"];
const fixedSourceScopes = ["all", "department-directory", "board-of-supervisors", "staff-directory"];
const requiredEnv = [
  "OFFICIALS_EXECUTION_ENVIRONMENT",
  "OFFICIALS_NETWORK_ENABLED",
  "OFFICIALS_WORKER_BACKEND",
  "OFFICIALS_MODE",
  "OFFICIALS_JURISDICTION",
  "OFFICIALS_SOURCE_SCOPE",
];
const requiredSecrets = ["DATAOPS_USER_AGENT"];
const requiredVariables = ["DATAOPS_MAX_DOWNLOAD_BYTES", "DATAOPS_OCR_MAX_PAGES", "DATAOPS_OCR_TIMEOUT_MS", "DATAOPS_INSTALL_OCR_TOOLS"];

const findings = {
  workflowFilename: ".github/workflows/dataops-daily.yml",
  workflowExists: Boolean(workflow),
  scheduledTriggerPresent: /schedule:\s*\n\s*-\s*cron:/m.test(workflow),
  manualTriggerPresent: workflow.includes("workflow_dispatch:"),
  officialsRefreshStagePresent: workflow.includes("Officials source refresh") && workflow.includes("npm run officials:refresh"),
  protectedPromotionJobPresent: workflow.includes("officials-production-promotion") && workflow.includes("Promote reviewed officials runtime"),
  concurrencyProtectionPresent: workflow.includes("concurrency:") && workflow.includes("cancel-in-progress: false"),
  minimalPermissionsPresent: workflow.includes("permissions:") && workflow.includes("contents: read") && workflow.includes("actions: read"),
  workflowInputsAllowlisted: includesAll(workflow, fixedModes) && includesAll(workflow, fixedSourceScopes) && !/run:.*\$\{\{\s*github\.event\.inputs\.(script|command|url|branch)/i.test(workflow),
  arbitraryScriptsRejected: !workflow.includes("github.event.inputs.script") && !workflow.includes("github.event.inputs.command"),
  defaultBranchCompatiblePath: workflow.includes("actions/checkout@v4") && !workflow.includes("ref: ${{"),
  artifactHandoffPresent: workflow.includes("Upload Carson officials evidence handoff") && workflow.includes("data/raw/official-directories/**"),
  importCommandPresent: workflow.includes("npm run officials:import-evidence"),
  importCommandRecomputesHashes: importScript.includes("sha256(bytes)") && importScript.includes("officials_import_hash_mismatch"),
  importCommandRejectsUnsafePaths: importScript.includes("path.isAbsolute") && importScript.includes("destination_outside_cache"),
  artifactOnlyRunsRequireImport: promoteScript.includes("importRequiredBeforePromotion") && promoteScript.includes("officials_promotion_requires_imported_or_durable_evidence"),
  promotionConfirmationRequired: workflow.includes("officials_promotion_confirmation") && workflow.includes("promote-carson-city-officials"),
  rawHtmlNotUploadedWithPublicRuntimeArtifacts: (() => {
    const start = workflow.indexOf("name: dataops-generated-artifacts");
    if (start < 0) return false;
    const endMarker = workflow.indexOf("name: carson-city-officials-evidence", start);
    const section = workflow.slice(start, endMarker > start ? endMarker : workflow.length);
    return !section.includes("data/raw/official-directories");
  })(),
};

const failures: string[] = [];
for (const [key, value] of Object.entries(findings)) {
  if (key.endsWith("Filename")) continue;
  if (value !== true) failures.push(key);
}

const report = {
  generatedAt,
  status: failures.length ? "failed" : "passed",
  workflow: findings,
  requiredEnvironmentVariables: requiredEnv,
  requiredSecrets: requiredSecrets.map((name) => ({ name, scope: "repository secret", required: false })),
  requiredVariables: requiredVariables.map((name) => ({ name, scope: "repository variable", required: false })),
  persistenceMode: {
    durablePublicSourceStorage: process.env.PUBLIC_CIVIC_SOURCE_STORAGE === "configured" ? "configured" : "not_configured",
    defaultWhenDurableStorageMissing: "github_artifact_handoff_requires_import",
    artifactNamePattern: "carson-city-officials-evidence-${{ github.run_id }}",
  },
  promotionMode: {
    automaticScheduledPromotion: false,
    protectedEnvironment: "officials-production-promotion",
    confirmationValue: "promote-carson-city-officials",
    command: "npm run officials:promote -- --jurisdiction=carson-city --run-id=<run-id> --confirm=promote-carson-city-officials",
  },
  remainingOperatorActions: [
    "Push or merge this workflow to the default branch.",
    "Enable GitHub Actions if disabled.",
    "Create the officials-production-promotion protected environment.",
    "Run the workflow manually in retrieve_and_reconcile mode.",
    "Download/import the evidence artifact when durable public-source storage is not configured.",
    "Promote only after reviewing reconciliation output.",
  ],
  failures,
  sensitiveValuesIncluded: false,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  console.error("GitHub network worker audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("GitHub network worker audit passed.");
console.log(JSON.stringify({
  workflow: findings.workflowFilename,
  officialsRefreshStagePresent: findings.officialsRefreshStagePresent,
  protectedPromotionJobPresent: findings.protectedPromotionJobPresent,
  artifactHandoffPresent: findings.artifactHandoffPresent,
}, null, 2));
