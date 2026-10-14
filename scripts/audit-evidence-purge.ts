import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { getEvidenceStorageStatus } from "@/lib/identity/evidence-storage";
import { readIdentityStore } from "@/lib/identity/storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "evidence-purge-audit.json");

async function main() {
  const now = Date.now();
  const store = readIdentityStore();
  const dueForPurge = store.verificationEvidence.filter((record) => !record.purgedAt && new Date(record.purgeAfter).getTime() <= now);
  const status = getEvidenceStorageStatus();
  const provenance = createAuditProvenance({
    artifactName: "evidence-purge-audit",
    databaseReachability: "not_required",
    storageBackend: status,
    workerBackend: "operator_or_worker",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    status,
    totalEvidenceMetadataRecords: store.verificationEvidence.length,
    dueForPurge: dueForPurge.length,
    alreadyPurged: store.verificationEvidence.filter((record) => record.purgedAt).length,
    rawEvidenceIncluded: false,
    privateStorageOnly: true,
    purgeCommand: "npm run evidence:purge",
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("evidence-purge-audit", report);
  console.log("Evidence purge audit complete.");
  console.log(JSON.stringify({ status: report.status, dueForPurge: report.dueForPurge }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
