import "@/lib/env/load-local-env";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { processClaimedIdentityJob } from "@/lib/identity/worker-handlers";
import { createDurableEmailToken, getEmailProviderStatus, redactEmailForAudit, type EmailPurpose } from "@/lib/identity/email";
import { claimNextJob, createDurableJob } from "@/lib/identity/worker-queue";
import { prisma } from "@/lib/prisma";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "email-test-audit.json");

function getArg(name: string) {
  const flag = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return flag?.split("=").slice(1).join("=");
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function networkEnabled() {
  return process.env.DIRECT_DEMOCRACY_NETWORK_ENABLED === "true" || process.env.OFFICIALS_NETWORK_ENABLED === "true";
}

function authorizedRecipient(recipient: string) {
  const configured = process.env.DIRECT_DEMOCRACY_EMAIL_TEST_RECIPIENT_ALLOWLIST;
  if (!configured) return false;
  return configured.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).includes(recipient.toLowerCase());
}

function writeReport(report: Record<string, unknown>) {
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("email-test-audit", report);
}

async function findOperatorAccountId() {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `select "id" from "IdentityAccount"
     where "status"='active'
       and "emailVerificationStatus"='verified'
       and "role" in ('admin','platform_admin')
     order by "createdAt" asc
     limit 1`,
  );
  return rows[0]?.id ?? null;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const recipient = getArg("--recipient");
  const confirmProduction = hasFlag("--confirm-production-send");
  const providerStatus = getEmailProviderStatus();
  const provenance = createAuditProvenance({
    artifactName: "email-test-audit",
    databaseReachability: "durable_queue_required",
    storageBackend: "identity_token_prisma_when_available",
    workerBackend: "durable_queue",
    generatedAt,
    networkCapability: networkEnabled() ? "available" : "unavailable",
  });
  const base = {
    generatedAt,
    provenance,
    providerStatus,
    productionConfirmed: false,
    emailSent: false,
    queuedThroughDurableWorker: false,
    tokenPrinted: false,
    sensitiveValuesIncluded: false,
  };

  if (!recipient || !recipient.includes("@")) {
    writeReport({ ...base, status: "refused_missing_recipient", recipient: null, reason: "email_production_test_requires_--recipient=<authorized-address>" });
    console.log("Production email test refused: missing recipient.");
    return;
  }
  if (!authorizedRecipient(recipient)) {
    writeReport({ ...base, status: "refused_recipient_not_authorized", recipient: redactEmailForAudit(recipient), reason: "Set DIRECT_DEMOCRACY_EMAIL_TEST_RECIPIENT_ALLOWLIST for explicit authorized recipients." });
    console.log("Production email test refused: recipient is not in DIRECT_DEMOCRACY_EMAIL_TEST_RECIPIENT_ALLOWLIST.");
    return;
  }
  if (!confirmProduction) {
    writeReport({ ...base, status: "refused_production_without_confirm", recipient: redactEmailForAudit(recipient), reason: "Pass --confirm-production-send to send a real provider email." });
    console.log("Production email test refused: confirmation flag missing.");
    return;
  }
  if (!networkEnabled()) {
    writeReport({ ...base, status: "refused_production_without_network", recipient: redactEmailForAudit(recipient), reason: "Set DIRECT_DEMOCRACY_NETWORK_ENABLED=true in a network-enabled operator environment." });
    console.log("Production email test refused: network-enabled environment flag missing.");
    return;
  }
  if (providerStatus !== "production_provider_configured") {
    writeReport({ ...base, status: "refused_production_provider_unconfigured", recipient: redactEmailForAudit(recipient), reason: providerStatus });
    console.log("Production email test refused: production email provider is not configured.");
    return;
  }

  const operatorAccountId = await findOperatorAccountId();
  if (!operatorAccountId) {
    writeReport({
      ...base,
      status: "blocked_no_verified_admin_account",
      recipient: redactEmailForAudit(recipient),
      tokenCreated: false,
      tokenHashPersisted: false,
      operatorAccountResolved: false,
    });
    console.log("Production email test blocked: no active verified admin account found for durable token ownership.");
    return;
  }

  const purpose: EmailPurpose = "account_email_verification";
  const token = await createDurableEmailToken({
    accountId: operatorAccountId,
    purpose,
    ttlMinutes: 15,
    metadata: { productionEmailTest: true },
  });
  if (!token.ok) {
    writeReport({
      ...base,
      status: "blocked_durable_token_storage_unavailable",
      recipient: redactEmailForAudit(recipient),
      reason: token.status,
      tokenCreated: true,
      tokenHashPersisted: false,
    });
    console.log("Production email test blocked: durable token storage unavailable.");
    return;
  }

  const idempotencyKey = `production-email-test:${recipient}:${generatedAt}`;
  const job = await createDurableJob({
    jobType: "email_delivery",
    actorAccountId: operatorAccountId,
    payload: {
      to: recipient,
      purpose,
      subject: "Direct Democracy production email delivery test",
      text: "This is a Direct Democracy production email delivery test. The generated audit contains no one-time token or provider secret.",
    },
    idempotencyKey,
    maxAttempts: 1,
  });
  if (!job.ok) {
    writeReport({
      ...base,
      status: "blocked_durable_queue_unavailable",
      recipient: redactEmailForAudit(recipient),
      reason: job.status,
      tokenCreated: true,
      tokenHashPersisted: true,
    });
    console.log("Production email test blocked: durable queue unavailable.");
    return;
  }

  const workerId = `production_email_test_${process.pid}`;
  const claimed = await claimNextJob(workerId);
  if (!claimed.ok || !claimed.job) {
    writeReport({
      ...base,
      status: "blocked_worker_claim_failed",
      recipient: redactEmailForAudit(recipient),
      reason: claimed.status,
      jobId: job.jobId,
      tokenCreated: true,
      tokenHashPersisted: true,
      queuedThroughDurableWorker: true,
    });
    console.log("Production email test blocked: worker could not claim queued email job.");
    return;
  }

  const result = await processClaimedIdentityJob(claimed.job, workerId);
  const sent = result.ok && result.job?.status === "succeeded";
  const report = {
    ...base,
    status: sent ? "sent" : "provider_send_failed",
    recipient: redactEmailForAudit(recipient),
    productionConfirmed: true,
    emailSent: sent,
    tokenCreated: true,
    tokenHashPersisted: true,
    tokenPrinted: false,
    operatorAccountResolved: true,
    queuedThroughDurableWorker: true,
    jobId: claimed.job.id,
    workerId,
    workerResult: result.job?.status ?? "unknown",
  };
  writeReport(report);
  console.log("Production email test complete.");
  console.log(JSON.stringify({ status: report.status, recipient: report.recipient, emailSent: report.emailSent, queuedThroughDurableWorker: true }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
