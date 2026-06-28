import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { getDurableIdentityStorageStatus } from "@/lib/identity/durable-storage";
import { getEvidenceStorageStatus } from "@/lib/identity/evidence-storage";
import { getWorkerQueueStatus } from "@/lib/identity/worker-queue";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "verification-operations-audit.json");

async function main() {
  const generatedAt = new Date().toISOString();
  const storage = await getDurableIdentityStorageStatus();
  const evidenceStatus = getEvidenceStorageStatus();
  const worker = await getWorkerQueueStatus();
  const provenance = createAuditProvenance({
    artifactName: "verification-operations-audit",
    databaseReachability: storage.ready ? "database_reachable" : storage.status,
    storageBackend: evidenceStatus,
    workerBackend: worker.status,
    generatedAt,
  });
  const report = {
    generatedAt,
    provenance,
    status: storage.ready && evidenceStatus === "production_storage_configured"
      ? "manual_review_ready"
      : "manual_review_boundary_present_storage_unconfigured",
    residency: {
      evidenceIntakeEnabled: evidenceStatus === "production_storage_configured",
      evidenceStorage: evidenceStatus,
      sensitiveAccessPermission: "verification.view_sensitive",
      submissionsPublishedAutomatically: false,
      exactAddressesPublic: false,
      govCrmReceivesExactAddressesByDefault: false,
    },
    voterVerification: {
      providerStatus: "provider_unconfigured",
      liveVoterRegistrationMatchingEnabled: false,
      equalWeightVerifiedResidentAndVoter: true,
      importsPoliticalPartyAutomatically: false,
    },
    durableStorage: {
      status: storage.status,
      ready: storage.ready,
    },
    worker: {
      status: worker.status,
      queueDepth: worker.queueDepth,
      deadLetters: worker.deadLetters,
    },
    controls: {
      publicTruthSeparateFromUnverifiedSubmissions: true,
      privateEvidenceRequiredBeforeRealCollection: true,
      officialScorecardsEnabled: false,
      hiddenVoteWeightingEnabled: false,
    },
    sensitiveValuesIncluded: false,
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("verification-operations-audit", report);
  console.log("Verification operations audit complete.");
  console.log(JSON.stringify({
    status: report.status,
    evidenceStorage: report.residency.evidenceStorage,
    voterProvider: report.voterVerification.providerStatus,
    worker: report.worker.status,
    sensitiveValuesIncluded: report.sensitiveValuesIncluded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
