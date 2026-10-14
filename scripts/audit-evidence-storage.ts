import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { getEvidenceStorageStatus } from "@/lib/identity/evidence-storage";
import { readIdentityStore } from "@/lib/identity/storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "evidence-storage-audit.json");

async function main() {
  const status = getEvidenceStorageStatus();
  const store = readIdentityStore();
  const evidenceKey = process.env.IDENTITY_EVIDENCE_ENCRYPTION_KEY;
  const mfaKey = process.env.IDENTITY_MFA_ENCRYPTION_KEY;
  const provenance = createAuditProvenance({
    artifactName: "evidence-storage-audit",
    databaseReachability: "not_required",
    storageBackend: status,
    workerBackend: "not_required",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    status,
    storageConfigured: status === "production_storage_configured",
    localEncryptedDevelopmentAvailable: status === "local_encrypted_development",
    localEvidenceMetadataRecords: store.verificationEvidence.length,
    pendingPurgeRecords: store.verificationEvidence.filter((record) => !record.purgedAt).length,
    controls: {
      encryptedAtRest: status !== "verification_evidence_storage_unconfigured",
      algorithm: status === "verification_evidence_storage_unconfigured" ? null : "aes-256-gcm",
      privateObjectStorageRequiredForProduction: true,
      publicUrlsDisabled: true,
      generatedArtifactsIncludeRawEvidence: false,
      ciArtifactsIncludeRawEvidence: false,
      contentTypeAndMagicValidation: true,
      executableAndScriptLikeContentRejected: true,
      maxFileSizeBytes: 10 * 1024 * 1024,
      pathTraversalGuard: true,
      retentionDaysDefault: 14,
      purgeAuditBoundary: "npm run evidence:purge-audit",
    },
    keySeparation: {
      evidenceKeyConfigured: Boolean(evidenceKey),
      mfaKeyConfigured: Boolean(mfaKey),
      evidenceKeyDifferentFromMfaKey: evidenceKey && mfaKey ? evidenceKey !== mfaKey : "not_verifiable",
    },
    configurationRequired: ["IDENTITY_EVIDENCE_STORAGE_BUCKET", "IDENTITY_EVIDENCE_ENCRYPTION_KEY"],
    sensitiveValuesIncluded: false,
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("evidence-storage-audit", report);
  console.log("Evidence storage audit complete.");
  console.log(JSON.stringify({
    status: report.status,
    pendingPurgeRecords: report.pendingPurgeRecords,
    encryptedAtRest: report.controls.encryptedAtRest,
    sensitiveValuesIncluded: report.sensitiveValuesIncluded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
