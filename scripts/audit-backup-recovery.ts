import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { isDatabaseConfigured } from "@/lib/identity/durable-storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "backup-recovery-audit.json");

function readGenerated(fileName: string) {
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

async function main() {
  const backupConfigured = process.env.DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED === "true";
  const latestRestoreSmokeTest = readGenerated("restore-smoke-test-audit.json");
  const restoreUrlConfigured = Boolean(process.env.DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL);
  const restoreUrlSeparateFromPrimary = restoreUrlConfigured && process.env.DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL !== process.env.DATABASE_URL;
  const restoreTested = process.env.DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED === "true"
    && restoreUrlConfigured
    && restoreUrlSeparateFromPrimary
    && latestRestoreSmokeTest?.status === "restore_smoke_test_ready_for_operator";
  const provenance = createAuditProvenance({
    artifactName: "backup-recovery-audit",
    databaseReachability: isDatabaseConfigured() ? "configured_unverified" : "database_unconfigured",
    storageBackend: backupConfigured ? "provider_backup" : "backup_unconfigured",
    workerBackend: "operator_or_worker",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    databaseConfigured: isDatabaseConfigured(),
    backup: backupConfigured ? "backup_configured" : "backup_unconfigured",
    restore: restoreTested ? "restore_tested" : "restore_untested",
    latestBackupCreate: readGenerated("backup-create-audit.json"),
    latestRestoreSmokeTest,
    controls: {
      providerBackedBackupRequired: true,
      destructivePrimaryRestoreCommandAvailable: false,
      prismaMigrateResetForbiddenForRemote: true,
      generatedArtifactsIncludeBackupData: false,
      backupSecretsIncluded: false,
      smokeTestRequiresSeparateRestoreDatabase: true,
    },
    operatorGuidance: [
      "Take a provider-backed database snapshot before identity:migrate -- --apply.",
      "Run restore smoke tests against a separate restore/test database only.",
      "Do not run destructive restores against the primary database from this repository.",
    ],
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("backup-recovery-audit", report);
  console.log("Backup and recovery audit complete.");
  console.log(JSON.stringify({ backup: report.backup, restore: report.restore, databaseConfigured: report.databaseConfigured }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
