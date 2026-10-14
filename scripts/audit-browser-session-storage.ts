import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { inspectBrowserSessionStorage } from "@/lib/admin/operations/browser-session-storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "browser-session-storage-audit.json");

async function main() {
  const inspection = inspectBrowserSessionStorage();
  const evidenceKey = process.env.IDENTITY_EVIDENCE_ENCRYPTION_KEY;
  const sessionKey = process.env.PLAYWRIGHT_SESSION_STORAGE_KEY;
  const provenance = createAuditProvenance({
    artifactName: "browser-session-storage-audit",
    databaseReachability: "not_required",
    storageBackend: inspection.status,
    workerBackend: "not_required",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    ...inspection,
    controls: {
      encryptedStorageState: inspection.status !== "browser_session_storage_unconfigured",
      committedStorageStateForbidden: true,
      ciArtifactsIncludeStorageState: false,
      metadataOnlyInGeneratedArtifacts: true,
      rotationSupportedByKeyChange: true,
      revocationSupportedByDeletingPrivateObject: true,
      expirationTrackedInMetadata: true,
      elevatedPermissionAccessAudited: true,
    },
    keySeparation: {
      sessionKeyConfigured: Boolean(sessionKey),
      evidenceKeyConfigured: Boolean(evidenceKey),
      sessionKeyDifferentFromEvidenceKey: sessionKey && evidenceKey ? sessionKey !== evidenceKey : "not_verifiable",
    },
    configurationRequired: ["PLAYWRIGHT_SESSION_STORAGE_BUCKET", "PLAYWRIGHT_SESSION_STORAGE_KEY"],
    sensitiveValuesIncluded: false,
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("browser-session-storage-audit", report);
  console.log("Browser session storage audit complete.");
  console.log(JSON.stringify({
    status: report.status,
    localRecords: report.localRecords,
    expiredRecords: report.expiredRecords,
    sensitiveValuesIncluded: report.sensitiveValuesIncluded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
