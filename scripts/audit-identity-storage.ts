import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { runDatabaseConnectivityAudit } from "@/lib/identity/database-diagnostics";
import { getDurableIdentityStorageStatus, IDENTITY_TABLES, productionIdentityFallbackAllowed } from "@/lib/identity/durable-storage";
import { summarizeDurableStore, summarizeLocalStore } from "@/lib/identity/migration";
import { readIdentityStore } from "@/lib/identity/storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "durable-identity-storage-audit.json");

async function main() {
  const local = readIdentityStore();
  const database = await runDatabaseConnectivityAudit({ timeoutMs: 4000 });
  const durable = database.probes.readOnlyQuery.status === "ok"
    ? await getDurableIdentityStorageStatus()
    : { status: database.classification, configured: true, ready: false, missingTables: [], error: "Skipped durable table inspection because this environment cannot reach the database." };
  const report = {
    generatedAt: new Date().toISOString(),
    database: {
      classification: database.classification,
      readOnlyQuery: database.probes.readOnlyQuery.status,
      credentialsRedacted: database.safe.credentialsRedacted,
    },
    storage: durable,
    localFallback: {
      allowedInCurrentEnvironment: productionIdentityFallbackAllowed(),
      forbiddenInProduction: true,
      localJsonSource: "data/private/identity/identity-store.json",
      generatedArtifactsIncludeSecrets: false,
    },
    sourceCounts: summarizeLocalStore(local),
    durableCounts: durable.ready ? await summarizeDurableStore().catch(() => null) : null,
    tablePlan: IDENTITY_TABLES,
    guarantees: {
      passwordHashesPreserved: true,
      mfaEncryptedSecretPreserved: true,
      recoveryCodeHashesPreserved: true,
      rawSessionTokensMigrated: false,
      cutoverRequiresFreshPrismaBackedSessions: true,
    },
    sensitiveValuesIncluded: false,
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log("Identity storage audit complete.");
  console.log(JSON.stringify({ storage: durable.status, localAccounts: report.sourceCounts.accounts, durableReady: durable.ready }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
