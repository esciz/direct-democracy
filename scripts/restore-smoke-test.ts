import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "restore-smoke-test-audit.json");

function hasConfirmFlag() {
  return process.argv.includes("--confirm-restore-smoke-test");
}

function sameConfiguredDatabase(left?: string, right?: string) {
  return Boolean(left && right && left.trim() === right.trim());
}

async function main() {
  const restoreUrlConfigured = Boolean(process.env.DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL);
  const restoreUsesPrimaryDatabase = sameConfiguredDatabase(process.env.DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL, process.env.DATABASE_URL);
  const readyForOperator = restoreUrlConfigured && !restoreUsesPrimaryDatabase && hasConfirmFlag();
  const provenance = createAuditProvenance({
    artifactName: "restore-smoke-test-audit",
    databaseReachability: restoreUrlConfigured && !restoreUsesPrimaryDatabase ? "restore_target_configured_unverified" : "restore_target_unconfigured",
    storageBackend: "backup_restore",
    workerBackend: "operator",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    status: restoreUsesPrimaryDatabase ? "restore_smoke_test_refused_primary_database" : readyForOperator ? "restore_smoke_test_ready_for_operator" : "restore_smoke_test_refused",
    restoreTestDatabaseConfigured: restoreUrlConfigured,
    restoreTestDatabaseSeparateFromPrimary: restoreUrlConfigured ? !restoreUsesPrimaryDatabase : false,
    explicitConfirmProvided: hasConfirmFlag(),
    primaryDatabaseTouched: false,
    destructiveOperation: false,
    generatedArtifactsIncludeRestoredData: false,
    operatorGuidance: restoreUsesPrimaryDatabase
      ? ["DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL must point to a separate restore/test database, not the primary DATABASE_URL."]
      : readyForOperator
      ? ["Run provider restore into DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL from a protected terminal, then run read-only audits against that database."]
      : ["Set DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL for a separate restore target and pass --confirm-restore-smoke-test.", "Never run restore smoke tests against the primary DATABASE_URL."],
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("restore-smoke-test-audit", report);
  console.log("Restore smoke test command completed with a truthful refusal/status artifact.");
  console.log(JSON.stringify({ status: report.status, restoreTestDatabaseConfigured: report.restoreTestDatabaseConfigured }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
