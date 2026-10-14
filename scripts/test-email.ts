import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { createOneTimeEmailToken, getEmailProviderStatus, redactEmailForAudit, sendIdentityEmail } from "@/lib/identity/email";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "email-test-audit.json");

function getArg(name: string) {
  const flag = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return flag?.split("=").slice(1).join("=");
}

async function main() {
  const recipient = getArg("--recipient");
  const confirmProduction = process.argv.includes("--confirm-production-send");
  if (!recipient || !recipient.includes("@")) {
    throw new Error("email_test_requires_--recipient=<address>");
  }

  const providerStatus = getEmailProviderStatus();
  const isProductionProvider = providerStatus === "production_provider_configured";
  const networkDisabled = process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1" || process.env.CODEX_SANDBOX_NETWORK_DISABLED === "true";
  const provenance = createAuditProvenance({
    artifactName: "email-test-audit",
    databaseReachability: "unknown",
    storageBackend: "email_provider",
    workerBackend: "manual_operator",
  });
  if (isProductionProvider && (!confirmProduction || networkDisabled)) {
    const report = {
      generatedAt: new Date().toISOString(),
      provenance,
      status: !confirmProduction ? "refused_production_without_confirm" : "refused_production_without_network",
      recipient: redactEmailForAudit(recipient),
      providerStatus,
      emailSent: false,
      productionConfirmed: false,
      queuedThroughDurableWorker: false,
      tokenPrinted: false,
      sensitiveValuesIncluded: false,
    };
    mkdirSync(GENERATED_DIR, { recursive: true });
    writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    writeProvenancedAudit("email-test-audit", report);
    console.log("Email test refused in production without --confirm-production-send.");
    console.log(JSON.stringify({ status: report.status, recipient: report.recipient }, null, 2));
    return;
  }

  const token = createOneTimeEmailToken("account_email_verification", 15);
  const delivery = await sendIdentityEmail({
    to: recipient,
    purpose: "account_email_verification",
    subject: "Direct Democracy email delivery test",
    text: `This is a Direct Democracy email delivery test. The generated audit does not include the one-time token. Token expires at ${token.expiresAt}.`,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    status: delivery.status,
    providerStatus,
    recipient: redactEmailForAudit(recipient),
    emailSent: delivery.ok,
    productionConfirmed: isProductionProvider && confirmProduction,
    queuedThroughDurableWorker: false,
    tokenCreated: true,
    tokenHashGenerated: true,
    tokenPrinted: false,
    tokenPersisted: false,
    sensitiveValuesIncluded: false,
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("email-test-audit", report);
  console.log("Email test complete.");
  console.log(JSON.stringify({ status: report.status, recipient: report.recipient, emailSent: report.emailSent }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
