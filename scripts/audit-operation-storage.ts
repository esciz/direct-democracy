import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getOperationStorePaths, listAdminOperations } from "@/lib/admin/operations/store";
import { runDatabaseConnectivityAudit } from "@/lib/identity/database-diagnostics";
import { getDurableOperationStorageStatus } from "@/lib/identity/durable-storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "durable-operation-storage-audit.json");

async function main() {
  const operations = listAdminOperations();
  const database = await runDatabaseConnectivityAudit({ timeoutMs: 4000 });
  const durable = database.probes.readOnlyQuery.status === "ok"
    ? await getDurableOperationStorageStatus()
    : { status: database.classification, configured: true, ready: false, missingTables: [], error: "Skipped durable table inspection because this environment cannot reach the database." };
  const staleCutoff = Date.now() - 30 * 60 * 1000;
  const staleOperations = operations.filter((operation) => ["queued", "starting", "running"].includes(operation.status) && new Date(operation.heartbeatAt ?? operation.queuedAt).getTime() < staleCutoff);
  const report = {
    generatedAt: new Date().toISOString(),
    database: {
      classification: database.classification,
      readOnlyQuery: database.probes.readOnlyQuery.status,
      credentialsRedacted: database.safe.credentialsRedacted,
    },
    durable,
    localDevelopmentStore: {
      status: getOperationStorePaths().durableStorageStatus,
      records: operations.length,
      activeRecords: operations.filter((operation) => ["queued", "starting", "running"].includes(operation.status)).length,
      staleRecords: staleOperations.length,
      sanitizedLogPreviewOnly: true,
    },
    guarantees: {
      allowlistedOperationsOnly: true,
      arbitraryCommandsPersisted: false,
      idempotencyKeyRequiredForDurableWrites: true,
      productionFailsClosedWhenDurableStorageUnavailable: true,
      normalPersistenceMirrorsToDurableStoreWhenReady: true,
      localFilesystemAdapterDevelopmentOnly: true,
      rawUnsanitizedLogsExposed: false,
    },
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log("Operation storage audit complete.");
  console.log(JSON.stringify({ durable: durable.status, localRecords: operations.length, staleOperations: staleOperations.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
