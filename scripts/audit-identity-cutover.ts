import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getAdminPermissions } from "@/lib/admin/permissions";
import { getDurableIdentityStorageStatus, productionIdentityFallbackAllowed } from "@/lib/identity/durable-storage";
import { runDatabaseConnectivityAudit } from "@/lib/identity/database-diagnostics";
import { summarizeLocalStore, summarizeDurableStore } from "@/lib/identity/migration";
import { readIdentityStore } from "@/lib/identity/storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "identity-cutover-audit.json");

function readGenerated(fileName: string) {
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function fileHas(relativePath: string, text: string) {
  const filePath = path.join(process.cwd(), relativePath);
  return existsSync(filePath) && readFileSync(filePath, "utf8").includes(text);
}

async function main() {
  const local = readIdentityStore();
  const durable = await getDurableIdentityStorageStatus();
  const database = await runDatabaseConnectivityAudit({ timeoutMs: 4000 });
  const owner = local.accounts.find((account) => account.role === "admin" || account.role === "platform_admin");
  const durableCounts = durable.ready ? await summarizeDurableStore().catch(() => null) : null;
  const migrationDryRun = readGenerated("identity-migration-audit.json");
  const migrationApply = readGenerated("identity-migration-apply-audit.json");
  const localFallbackAllowed = productionIdentityFallbackAllowed();
  const production = process.env.NODE_ENV === "production";
  const report = {
    generatedAt: new Date().toISOString(),
    database: {
      classification: database.classification,
      hostSummary: database.configuration.hostSummary,
      readOnlyQuery: database.probes.readOnlyQuery.status,
      migrationTable: database.probes.migrationTable.status,
      schema: database.probes.schema.status,
      credentialsRedacted: database.safe.credentialsRedacted,
    },
    localSource: {
      present: local.accounts.length > 0,
      sourceCounts: summarizeLocalStore(local),
      localJsonAllowedInProduction: false,
      localFallbackAllowedInCurrentEnvironment: localFallbackAllowed,
      localFallbackMustBeDisabledBeforeProduction: !production && localFallbackAllowed,
      sensitiveValuesIncluded: false,
    },
    durableTarget: {
      storageStatus: durable.status,
      ready: durable.ready,
      counts: durableCounts,
    },
    ownerAdmin: owner ? {
      present: true,
      role: owner.role,
      status: owner.status,
      passwordRotated: !owner.mustChangePassword,
      mfaEnabled: Boolean(owner.mfaEnabled),
      mfaEnrolled: Boolean(owner.mfaEnrolledAt),
      recoveryCodeHashesPreservedInSource: owner.mfaRecoveryCodes?.length ?? 0,
      adminPermissionCount: getAdminPermissions({ role: owner.role }).length,
    } : { present: false },
    migrations: {
      prismaMigrationDirectoryPresent: existsSync(path.join(process.cwd(), "prisma", "migrations")),
      sprint2iMigrationPresent: existsSync(path.join(process.cwd(), "prisma", "migrations", "20260621000000_sprint_2i_identity_operations_foundation", "migration.sql")),
      dryRun: migrationDryRun ? {
        ok: migrationDryRun.ok,
        wrote: migrationDryRun.wrote,
        status: migrationDryRun.status,
      } : null,
      apply: migrationApply ? {
        ok: migrationApply.ok,
        wrote: migrationApply.wrote,
        status: migrationApply.status,
      } : null,
    },
    sessionCutover: {
      rawSessionTokensMigrated: false,
      migrationRecordsPriorSessionsAsRevoked: fileHas("lib/identity/migration.ts", "identity_migration_cutover_requires_new_login"),
      logoutAllBoundaryPresent: fileHas("lib/identity/accounts.ts", "revoke") || fileHas("lib/auth/actions.ts", "logout"),
      passwordChangeRevokesSessions: fileHas("lib/identity/accounts.ts", "password_changed"),
      mfaResetRevokesSessions: fileHas("lib/identity/accounts.ts", "mfa_reset"),
      accountSuspensionRevokesSessions: fileHas("lib/identity/accounts.ts", "account_disabled"),
    },
    status: durable.ready
      ? "durable_identity_ready"
      : database.classification === "environment_network_unavailable"
        ? "blocked_by_environment_network"
        : "durable_identity_not_ready",
    nextOperatorCommands: [
      "npm run database:diagnose",
      "npm run prisma:migrate:status",
      "npm run identity:migrate -- --dry-run",
      "npm run identity:migrate -- --apply",
      "npm run identity:cutover-audit",
    ],
    sensitiveValuesIncluded: false,
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log("Identity cutover audit complete.");
  console.log(JSON.stringify({
    status: report.status,
    database: report.database.classification,
    durableReady: report.durableTarget.ready,
    dryRun: report.migrations.dryRun?.status ?? "missing",
    apply: report.migrations.apply?.status ?? "missing",
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
