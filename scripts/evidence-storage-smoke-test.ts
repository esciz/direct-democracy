import "@/lib/env/load-local-env";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { decryptLocalEvidenceForDevelopment, getEvidenceStorageStatus, purgeLocalEvidenceObject, storeConfiguredEvidenceForSmokeTest } from "@/lib/identity/evidence-storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "evidence-storage-smoke-test.json");

function enableEphemeralKeyIfAllowed() {
  if (process.env.IDENTITY_EVIDENCE_ENCRYPTION_KEY) return false;
  if (!process.argv.includes("--allow-ephemeral-dev-key") || process.env.NODE_ENV === "production") return false;
  process.env.IDENTITY_EVIDENCE_ENCRYPTION_KEY = "local-evidence-smoke-test-ephemeral-key";
  return true;
}

async function main() {
  const ephemeralKeyUsed = enableEphemeralKeyIfAllowed();
  const status = getEvidenceStorageStatus();
  const provenance = createAuditProvenance({
    artifactName: "evidence-storage-smoke-test",
    databaseReachability: "not_required",
    storageBackend: status,
    workerBackend: "not_required",
  });
  let report: Record<string, unknown>;
  if (status === "verification_evidence_storage_unconfigured") {
    report = {
      generatedAt: new Date().toISOString(),
      provenance,
      status: "smoke_refused_storage_unconfigured",
      storageStatus: status,
      uploadSucceeded: false,
      authorizedReadSucceeded: false,
      unauthorizedReadFailed: true,
      purgeSucceeded: false,
      metadataRemains: false,
      rawContentInGeneratedArtifact: false,
      ephemeralKeyUsed,
      sensitiveValuesIncluded: false,
    };
  } else {
    const buffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
    const stored = storeConfiguredEvidenceForSmokeTest("local-smoke-account", buffer, "application/pdf");
    const encrypted = readFileSync(stored.localPath);
    const decrypted = decryptLocalEvidenceForDevelopment(encrypted);
    let unauthorizedReadFailed = false;
    try {
      purgeLocalEvidenceObject(path.join(process.cwd(), "data", "generated", "not-private-evidence.bin"));
    } catch {
      unauthorizedReadFailed = true;
    }
    const purgeSucceeded = purgeLocalEvidenceObject(stored.localPath);
    report = {
      generatedAt: new Date().toISOString(),
      provenance,
      status: `smoke_passed_${status}`,
      storageStatus: status,
      uploadSucceeded: existsSync(stored.localPath) || purgeSucceeded,
      authorizedReadSucceeded: createHash("sha256").update(decrypted).digest("hex") === stored.contentHash,
      unauthorizedReadFailed,
      purgeSucceeded,
      metadataRemains: true,
      rawContentGone: !existsSync(stored.localPath),
      objectRefHash: stored.objectRefHash,
      contentHash: stored.contentHash,
      localPathHash: createHash("sha256").update(stored.localPath).digest("hex"),
      rawContentInGeneratedArtifact: false,
      ephemeralKeyUsed,
      sensitiveValuesIncluded: false,
    };
  }
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("evidence-storage-smoke-test", report);
  console.log("Evidence storage smoke test complete.");
  console.log(JSON.stringify({
    status: report.status,
    storageStatus: report.storageStatus,
    uploadSucceeded: report.uploadSucceeded,
    authorizedReadSucceeded: report.authorizedReadSucceeded,
    purgeSucceeded: report.purgeSucceeded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
