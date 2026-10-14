import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getDurableIdentityStorageStatus, getDurableOperationStorageStatus, isDatabaseConfigured } from "@/lib/identity/durable-storage";
import { runDatabaseConnectivityAudit } from "@/lib/identity/database-diagnostics";
import { prisma } from "@/lib/prisma";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "database-health-audit.json");

async function safeCount(sql: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(sql);
    return { ok: true as const, count: Number(rows[0]?.count ?? 0) };
  } catch (error) {
    return { ok: false as const, count: null, error: error instanceof Error ? error.message : "unknown_error" };
  }
}

async function main() {
  const connectivity = await runDatabaseConnectivityAudit({ timeoutMs: 4000 });
  const canInspectSchema = connectivity.probes.readOnlyQuery.status === "ok";
  const identity = canInspectSchema
    ? await getDurableIdentityStorageStatus()
    : { status: connectivity.classification, configured: isDatabaseConfigured(), ready: false, missingTables: [], error: "schema inspection skipped because read-only connectivity failed." };
  const operations = canInspectSchema
    ? await getDurableOperationStorageStatus()
    : { status: connectivity.classification, configured: isDatabaseConfigured(), ready: false, missingTables: [], error: "schema inspection skipped because read-only connectivity failed." };
  const checks = {
    databaseConfigured: isDatabaseConfigured(),
    identityStorageReady: identity.ready,
    operationStorageReady: operations.ready,
    orphanedGrants: identity.ready ? await safeCount('select count(*)::bigint as count from "IdentityPermissionGrant" g left join "IdentityAccount" a on a."id" = g."accountId" where a."id" is null') : null,
    orphanedSessions: identity.ready ? await safeCount('select count(*)::bigint as count from "IdentitySession" s left join "IdentityAccount" a on a."id" = s."accountId" where a."id" is null') : null,
    expiredActiveSessions: identity.ready ? await safeCount('select count(*)::bigint as count from "IdentitySession" where "revokedAt" is null and "expiresAt" < now()') : null,
    staleOperations: operations.ready ? await safeCount(`select count(*)::bigint as count from "AdminOperation" where "status" in ('queued','starting','running') and coalesce("heartbeatAt","queuedAt") < now() - interval '30 minutes'`) : null,
    duplicateEligibilitySnapshots: identity.ready ? await safeCount(`select count(*)::bigint as count from (select "accountId","snapshotType","jurisdictionId","communityId",count(*) from "IdentityEligibilitySnapshot" where "revokedAt" is null group by 1,2,3,4 having count(*) > 1) d`) : null,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    connectivity: {
      classification: connectivity.classification,
      hostSummary: connectivity.configuration.hostSummary,
      readOnlyQuery: connectivity.probes.readOnlyQuery.status,
      migrationTable: connectivity.probes.migrationTable.status,
      schema: connectivity.probes.schema.status,
      credentialsRedacted: connectivity.safe.credentialsRedacted,
    },
    identity,
    operations,
    checks,
    backup: process.env.DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED === "true" ? "backup_configured" : "backup_unconfigured",
    restore: process.env.DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED === "true" ? "restore_tested" : "restore_untested",
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log("Database health audit complete.");
  console.log(JSON.stringify({ connectivity: connectivity.classification, identity: identity.status, operations: operations.status, backup: report.backup, restore: report.restore }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
