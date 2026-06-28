import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { runDatabaseConnectivityAudit } from "@/lib/identity/database-diagnostics";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "database-connectivity-audit.json");

function parseTimeoutMs() {
  const flag = process.argv.find((arg) => arg.startsWith("--timeout-ms="));
  const value = flag?.split("=")[1];
  const parsed = value ? Number(value) : 5000;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 15000) : 5000;
}

async function main() {
  const audit = await runDatabaseConnectivityAudit({ timeoutMs: parseTimeoutMs() });
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

  console.log("Database connectivity diagnostic complete.");
  console.log(JSON.stringify({
    classification: audit.classification,
    provider: audit.configuration.provider,
    hostSummary: audit.configuration.hostSummary,
    dns: audit.probes.dns.status,
    tcp: audit.probes.tcp.status,
    readOnlyQuery: audit.probes.readOnlyQuery.status,
    migrationTable: audit.probes.migrationTable.status,
    schema: audit.probes.schema.status,
    sensitiveValuesIncluded: audit.sensitiveValuesIncluded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
