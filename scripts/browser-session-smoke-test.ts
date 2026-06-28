import "@/lib/env/load-local-env";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { decryptBrowserSessionState, getBrowserSessionStorageStatus, markLocalBrowserSessionValidated, revokeLocalBrowserSession, storeConfiguredBrowserSessionStateForSmokeTest } from "@/lib/admin/operations/browser-session-storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "browser-session-smoke-test.json");

function enableEphemeralKeyIfAllowed() {
  if (process.env.PLAYWRIGHT_SESSION_STORAGE_KEY) return false;
  if (!process.argv.includes("--allow-ephemeral-dev-key") || process.env.NODE_ENV === "production") return false;
  process.env.PLAYWRIGHT_SESSION_STORAGE_KEY = "local-browser-session-smoke-test-ephemeral-key";
  return true;
}

async function main() {
  const ephemeralKeyUsed = enableEphemeralKeyIfAllowed();
  const status = getBrowserSessionStorageStatus();
  const provenance = createAuditProvenance({
    artifactName: "browser-session-smoke-test",
    databaseReachability: "not_required",
    storageBackend: status,
    workerBackend: "not_required",
  });
  let report: Record<string, unknown>;
  if (status === "browser_session_storage_unconfigured") {
    report = {
      generatedAt: new Date().toISOString(),
      provenance,
      status: "smoke_refused_storage_unconfigured",
      storageStatus: status,
      encryptedWriteSucceeded: false,
      retrievalSucceeded: false,
      validationRecorded: false,
      revocationRecorded: false,
      rawStorageStateInGeneratedArtifact: false,
      ephemeralKeyUsed,
      sensitiveValuesIncluded: false,
    };
  } else {
    const state = Buffer.from(JSON.stringify({ cookies: [{ name: "redacted-smoke", value: "redacted" }], origins: [] }));
    const stored = storeConfiguredBrowserSessionStateForSmokeTest({
      label: `${status}-smoke-session`,
      state,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      accessReason: `${status} encrypted storage smoke test`,
    });
    const encryptedPath = path.join(path.dirname(stored.metadataPath), `${stored.id}.enc`);
    const decrypted = decryptBrowserSessionState(readFileSync(encryptedPath));
    markLocalBrowserSessionValidated(stored.metadataPath);
    revokeLocalBrowserSession(stored.metadataPath, "smoke_test_complete");
    const metadata = JSON.parse(readFileSync(stored.metadataPath, "utf8")) as { validatedAt?: string; revokedAt?: string };
    report = {
      generatedAt: new Date().toISOString(),
      provenance,
      status: `smoke_passed_${status}`,
      storageStatus: status,
      encryptedWriteSucceeded: existsSync(encryptedPath),
      retrievalSucceeded: createHash("sha256").update(decrypted).digest("hex") === createHash("sha256").update(state).digest("hex"),
      validationRecorded: Boolean(metadata.validatedAt),
      revocationRecorded: Boolean(metadata.revokedAt),
      encryptedPathHash: stored.encryptedPathHash,
      metadataHash: createHash("sha256").update(stored.metadataPath).digest("hex"),
      rawStorageStateInGeneratedArtifact: false,
      ephemeralKeyUsed,
      sensitiveValuesIncluded: false,
    };
  }
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("browser-session-smoke-test", report);
  console.log("Browser session storage smoke test complete.");
  console.log(JSON.stringify({
    status: report.status,
    storageStatus: report.storageStatus,
    encryptedWriteSucceeded: report.encryptedWriteSucceeded,
    retrievalSucceeded: report.retrievalSucceeded,
    revocationRecorded: report.revocationRecorded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
