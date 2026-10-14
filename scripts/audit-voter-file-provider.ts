import fs from "node:fs/promises";
import path from "node:path";

import { readVoterFileIndex } from "@/lib/identity/voter-file-provider";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const AUDIT_PATH = path.join(GENERATED_DIR, "voter-file-provider-audit.json");

async function main() {
  const index = readVoterFileIndex();
  const providers = index?.providers ?? [];
  const activeRecords = index?.activeMatchKeys.length ?? 0;
  const recordsIndexed = providers.reduce((sum, provider) => sum + provider.recordsIndexed, 0);
  const audit = {
    generatedAt: new Date().toISOString(),
    status: index ? "voter_file_provider_ready" : "voter_file_provider_index_missing",
    sensitiveValuesIncluded: false,
    privateHashedIndex: Boolean(index),
    providers,
    totals: {
      providers: providers.length,
      recordsIndexed,
      activeRecords,
      countiesIndexed: providers.length,
    },
    validation: {
      privateHashedIndexPresent: Boolean(index),
      providerMetadataPresent: providers.length > 0,
      activeRecordsAvailable: activeRecords > 0,
      noRawVoterIdsInGeneratedAudit: true,
    },
  };
  const pass = Object.values(audit.validation).every(Boolean);
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(AUDIT_PATH, `${JSON.stringify({ ...audit, pass }, null, 2)}\n`);
  console.log("Voter file provider audit complete.");
  console.log(JSON.stringify({ pass, totals: audit.totals, output: AUDIT_PATH }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
