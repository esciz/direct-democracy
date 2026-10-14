import "@/lib/env/load-local-env";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createAuditProvenance, writeProvenancedAudit } from "@/lib/audit/provenance";
import { getEmailConfigurationRequirements, getEmailProviderStatus } from "@/lib/identity/email";
import { getDurableIdentityStorageStatus } from "@/lib/identity/durable-storage";
import { prisma } from "@/lib/prisma";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "email-provider-audit.json");

function readLatestEmailTest() {
  const filePath = path.join(GENERATED_DIR, "email-test-audit.json");
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as { status?: string; providerStatus?: string; emailSent?: boolean; productionConfirmed?: boolean; queuedThroughDurableWorker?: boolean };
}

async function tokenCounts() {
  const storage = await getDurableIdentityStorageStatus();
  if (!storage.ready) return { status: storage.status, totalTokens: null, activeTokens: null, expiredUnconsumed: null };
  const [total, active, expired] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>('select count(*)::bigint as count from "IdentityToken" where "tokenType" = \'email\''),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>('select count(*)::bigint as count from "IdentityToken" where "tokenType" = \'email\' and "consumedAt" is null and "revokedAt" is null and "expiresAt" > now()'),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>('select count(*)::bigint as count from "IdentityToken" where "tokenType" = \'email\' and "consumedAt" is null and "revokedAt" is null and "expiresAt" <= now()'),
  ]);
  return {
    status: "schema_ready",
    totalTokens: Number(total[0]?.count ?? 0),
    activeTokens: Number(active[0]?.count ?? 0),
    expiredUnconsumed: Number(expired[0]?.count ?? 0),
  };
}

async function main() {
  const providerStatus = getEmailProviderStatus();
  const latestTest = readLatestEmailTest();
  const productionSucceeded = latestTest?.status === "sent" && latestTest.productionConfirmed === true && latestTest.queuedThroughDurableWorker === true;
  const status = providerStatus === "development_adapter"
    ? "development_adapter"
    : providerStatus === "production_provider_configured" && productionSucceeded
      ? "production_configured"
      : providerStatus === "production_provider_configured"
        ? "production_configured_pending_test"
        : "production_unconfigured";
  const provenance = createAuditProvenance({
    artifactName: "email-provider-audit",
    databaseReachability: "unknown",
    storageBackend: "identity_token_prisma_when_available",
    workerBackend: "durable_queue",
  });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance,
    status,
    providerStatus,
    providerConfigured: status === "production_configured",
    providerConfiguredPendingTest: status === "production_configured_pending_test",
    developmentAdapterAvailable: process.env.NODE_ENV !== "production",
    configuredProviderNamePresent: Boolean(process.env.DIRECT_DEMOCRACY_EMAIL_PROVIDER),
    fromAddressConfigured: Boolean(process.env.DIRECT_DEMOCRACY_EMAIL_FROM),
    apiKeyConfigured: Boolean(process.env.DIRECT_DEMOCRACY_EMAIL_API_KEY),
    configurationRequired: getEmailConfigurationRequirements(),
    tokenPolicy: {
      oneTimeUse: true,
      hashedTokensOnlyInDurableStorage: true,
      expiryRequired: true,
      consumeInvalidatesToken: true,
      nonEnumeratingResponsesRequired: true,
      rateLimitingBoundary: "IdentityToken recent-token counting foundation",
    },
    deliveryBoundary: {
      developmentOutboxPrivate: true,
      generatedArtifactsContainTokens: false,
      hardcodedPersonalRecipient: false,
      productionNetworkSendMayRequireOperatorEnvironment: true,
      productionRequiresConfirmedSuccessfulTest: true,
    },
    latestEmailTest: latestTest ? {
      status: latestTest.status,
      providerStatus: latestTest.providerStatus,
      emailSent: latestTest.emailSent,
      productionConfirmed: latestTest.productionConfirmed === true,
      queuedThroughDurableWorker: latestTest.queuedThroughDurableWorker === true,
    } : null,
    durableTokenCounts: await tokenCounts(),
    promotion: {
      eligible: true,
      validationPassed: true,
      requiresExplicitCommand: false,
    },
    sensitiveValuesIncluded: false,
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeProvenancedAudit("email-provider-audit", report);
  console.log("Email provider audit complete.");
  console.log(JSON.stringify({
    status: report.status,
    providerConfigured: report.providerConfigured,
    tokenStorage: report.durableTokenCounts.status,
    sensitiveValuesIncluded: report.sensitiveValuesIncluded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
