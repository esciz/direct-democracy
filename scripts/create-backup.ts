import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "backup-create-audit.json");

async function main() {
  const configured = process.env.DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED === "true";
  const provider = process.env.DIRECT_DEMOCRACY_DATABASE_BACKUP_PROVIDER ?? null;
  const provenance = createAuditProvenance({
    artifactName: "backup-create-audit",
    databaseReachability: "configured_unverified",
    storageBackend: configured ? "provider_backup" : "backup_unconfigured",
    workerBackend: "operator",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    status: configured ? "backup_create_requires_provider_operator" : "backup_create_refused_unconfigured",
    configured,
    providerConfigured: Boolean(provider),
    providerName: provider ? "configured" : null,
    backupDataWrittenToGeneratedArtifacts: false,
    databaseCredentialsPrinted: false,
    destructiveOperation: false,
    operatorGuidance: configured
      ? ["Use the configured database provider's snapshot/export workflow from a protected operator environment.", "Record the provider backup ID in the deployment runbook, not in generated public artifacts."]
      : ["Configure provider-backed database backups before durable identity cutover.", "Do not treat local JSON exports as production database backups."],
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("backup-create-audit", report);
  console.log("Backup create command completed with a truthful refusal/status artifact.");
  console.log(JSON.stringify({ status: report.status, configured: report.configured }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
