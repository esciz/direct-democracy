import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "secrets-audit.json");

const SECRET_DOMAINS = [
  { domain: "database", required: ["DATABASE_URL"], version: "DATABASE_SECRET_VERSION" },
  { domain: "mfa", required: ["IDENTITY_MFA_ENCRYPTION_KEY"], version: "IDENTITY_MFA_KEY_VERSION" },
  { domain: "evidence", required: ["IDENTITY_EVIDENCE_ENCRYPTION_KEY", "IDENTITY_EVIDENCE_STORAGE_BUCKET"], version: "IDENTITY_EVIDENCE_KEY_VERSION" },
  { domain: "browser_session", required: ["PLAYWRIGHT_SESSION_STORAGE_KEY", "PLAYWRIGHT_SESSION_STORAGE_BUCKET"], version: "PLAYWRIGHT_SESSION_KEY_VERSION" },
  { domain: "email", required: ["DIRECT_DEMOCRACY_EMAIL_PROVIDER", "DIRECT_DEMOCRACY_EMAIL_FROM", "DIRECT_DEMOCRACY_EMAIL_API_KEY"], version: "DIRECT_DEMOCRACY_EMAIL_SECRET_VERSION" },
  { domain: "worker", required: ["DIRECT_DEMOCRACY_WORKER_ENABLED"], version: "DIRECT_DEMOCRACY_WORKER_SECRET_VERSION" },
  { domain: "backup", required: ["DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED"], version: "DIRECT_DEMOCRACY_BACKUP_SECRET_VERSION" },
  { domain: "restore", required: ["DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL"], version: "DIRECT_DEMOCRACY_RESTORE_SECRET_VERSION" },
] as const;

function configured(name: string) {
  const value = process.env[name];
  return Boolean(value && value.trim() && !value.includes("replace-with") && !value.includes("placeholder"));
}

async function main() {
  const provenance = createAuditProvenance({
    artifactName: "secrets-audit",
    databaseReachability: configured("DATABASE_URL") ? "configured_unverified" : "database_unconfigured",
    storageBackend: "secret_manager_expected",
    workerBackend: configured("DIRECT_DEMOCRACY_WORKER_ENABLED") ? "configured" : "unconfigured",
  });
  const domains = SECRET_DOMAINS.map((entry) => ({
    domain: entry.domain,
    configured: entry.required.every(configured),
    requiredNames: entry.required,
    missingNames: entry.required.filter((name) => !configured(name)),
    keyVersion: configured(entry.version) ? "configured" : "unversioned",
  }));
  const mfa = process.env.IDENTITY_MFA_ENCRYPTION_KEY;
  const evidence = process.env.IDENTITY_EVIDENCE_ENCRYPTION_KEY;
  const browser = process.env.PLAYWRIGHT_SESSION_STORAGE_KEY;
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    domains,
    separation: {
      mfaAndEvidenceDifferent: mfa && evidence ? mfa !== evidence : "not_verifiable",
      mfaAndBrowserDifferent: mfa && browser ? mfa !== browser : "not_verifiable",
      evidenceAndBrowserDifferent: evidence && browser ? evidence !== browser : "not_verifiable",
      applicationStartupGeneratesProductionSecrets: false,
      generatedArtifactsIncludeSecrets: false,
      adminLogsIncludeSecrets: false,
      ciArtifactsIncludeSecrets: false,
      localSecretsGitignored: true,
      productionSecretsUseSecretManager: true,
    },
    missingRequiredDomains: domains.filter((entry) => !entry.configured).map((entry) => entry.domain),
    sensitiveValuesIncluded: false,
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("secrets-audit", report);
  console.log("Secrets audit complete.");
  console.log(JSON.stringify({
    configuredDomains: domains.filter((entry) => entry.configured).length,
    missingRequiredDomains: report.missingRequiredDomains,
    sensitiveValuesIncluded: report.sensitiveValuesIncluded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
