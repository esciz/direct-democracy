import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "restore-audit.json");

function readRestoreSmokeTest() {
  const filePath = path.join(GENERATED_DIR, "restore-smoke-test-audit.json");
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function sameConfiguredDatabase(left?: string, right?: string) {
  return Boolean(left && right && left.trim() === right.trim());
}

async function main() {
  const latestSmoke = readRestoreSmokeTest();
  const restoreTestDatabaseConfigured = Boolean(process.env.DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL);
  const restoreTestDatabaseSeparateFromPrimary = restoreTestDatabaseConfigured
    ? !sameConfiguredDatabase(process.env.DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL, process.env.DATABASE_URL)
    : false;
  const latestSmokeReady = latestSmoke?.status === "restore_smoke_test_ready_for_operator";
  const restoreTested = process.env.DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED === "true"
    && restoreTestDatabaseConfigured
    && restoreTestDatabaseSeparateFromPrimary
    && latestSmokeReady;
  const provenance = createAuditProvenance({
    artifactName: "restore-audit",
    databaseReachability: restoreTestDatabaseConfigured && restoreTestDatabaseSeparateFromPrimary ? "restore_target_configured_unverified" : "restore_target_unconfigured",
    storageBackend: "backup_restore",
    workerBackend: "operator",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    restore: restoreTested ? "restore_tested" : "restore_untested",
    restoreTestDatabaseConfigured,
    restoreTestDatabaseSeparateFromPrimary,
    latestSmokeTest: latestSmoke,
    destructivePrimaryRestoreAvailable: false,
    primaryDatabaseTouched: false,
    sensitiveValuesIncluded: false,
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("restore-audit", report);
  console.log("Restore audit complete.");
  console.log(JSON.stringify({ restore: report.restore, restoreTestDatabaseConfigured: report.restoreTestDatabaseConfigured }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
