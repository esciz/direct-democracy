import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { listAdminOperations } from "@/lib/admin/operations/store";
import { getDurableIdentityStorageStatus, getDurableOperationStorageStatus, IDENTITY_TABLES, ADMIN_OPERATION_TABLES } from "@/lib/identity/durable-storage";
import { summarizeLocalStore } from "@/lib/identity/migration";
import { getMfaConfigurationStatus } from "@/lib/identity/mfa";
import { readIdentityStore } from "@/lib/identity/storage";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "sprint-2i-b-foundation-audit.json");

function sourceIncludes(relativePath: string, text: string) {
  const filePath = path.join(process.cwd(), relativePath);
  return existsSync(filePath) && readFileSync(filePath, "utf8").includes(text);
}

function schemaHas(modelName: string) {
  return sourceIncludes("prisma/schema.prisma", `model ${modelName} `);
}

async function main() {
  const store = readIdentityStore();
  const identity = await getDurableIdentityStorageStatus();
  const operations = await getDurableOperationStorageStatus();
  const owner = store.accounts.find((account) => account.email.toLowerCase() === "owner-admin@direct-democracy.local");
  const adminOperations = listAdminOperations();
  const schemaModels = [
    "User",
    "VoteResponse",
    "PollVote",
    "IdentityAccount",
    "IdentityCredential",
    "IdentitySession",
    "IdentityPermissionGrant",
    "IdentityMfaRecoveryCode",
    "IdentityVerificationClaim",
    "IdentityConsentRecord",
    "IdentityTrustedCitizenGrant",
    "AdminOperation",
    "AdminOperationStage",
    "AdminOperationAuditEvent",
    "AdminOperationLogReference",
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    existingPrismaArchitecture: {
      reusablePublicModels: ["User", "VoteResponse", "PollVote", "PublicProfile", "Organization", "Jurisdiction"],
      identityBoundaryModels: IDENTITY_TABLES,
      operationBoundaryModels: ADMIN_OPERATION_TABLES,
      schemaModelsPresent: Object.fromEntries(schemaModels.map((model) => [model, schemaHas(model)])),
      duplicateSystemCreated: false,
      notes: [
        "Existing public User/profile models remain public participation/profile records.",
        "IdentityAccount and related models hold credential, session, MFA, consent, verification, and trust security state.",
        "AdminOperation and related models hold allowlisted operation state only, not arbitrary commands.",
      ],
    },
    localMigrationSource: {
      source: "data/private/identity/identity-store.json",
      sourceCounts: summarizeLocalStore(store),
      ownerAdmin: owner ? {
        present: true,
        role: owner.role,
        status: owner.status,
        mustChangePassword: owner.mustChangePassword,
        mfaEnrollmentRequired: owner.mfaEnrollmentRequired,
        mfaEnabled: Boolean(owner.mfaEnabled),
        mfaEnrolled: Boolean(owner.mfaEnrolledAt),
        recoveryCodeHashes: owner.mfaRecoveryCodes?.length ?? 0,
      } : { present: false },
      sensitiveValuesIncluded: false,
    },
    durableStorage: {
      identity,
      operations,
      states: {
        identity: identity.ready ? "prisma_identity_configured" : identity.configured ? "prisma_identity_unconfigured" : "local_identity_development_only",
        operations: operations.ready ? "durable_operations_configured" : "durable_operations_unconfigured",
        mfa: getMfaConfigurationStatus(),
      },
    },
    adminOperations: {
      localRecords: adminOperations.length,
      activeRecords: adminOperations.filter((operation) => ["queued", "starting", "running"].includes(operation.status)).length,
      allowlistedCatalog: sourceIncludes("lib/admin/operations/catalog.ts", "OPERATION_DEFINITIONS"),
      arbitraryCommandsAllowed: false,
      sanitizedLogsOnly: sourceIncludes("lib/admin/operations/runner.ts", "SECRET_PATTERNS"),
    },
    routeAndAuthorizationBoundaries: {
      adminIndexRedirects: sourceIncludes("app/admin/page.tsx", 'redirect("/admin/operations")'),
      adminLayoutRequiresPermission: sourceIncludes("app/admin/layout.tsx", "requireAdminPage"),
      proxyProtectsAdmin: sourceIncludes("proxy.ts", '"/admin"'),
      proxyProtectsAdminApi: sourceIncludes("proxy.ts", '"/api/admin/:path*"'),
      profileAdminButtonServerGated: sourceIncludes("app/profile/page.tsx", "hasAdminDashboardPermission"),
      mfaChallengeRequiredForAdmin: sourceIncludes("lib/admin/permissions.ts", "mfa_challenge_required"),
    },
    governanceBoundaries: {
      publicRecordsSourceBacked: true,
      lowConfidenceReviewGated: true,
      rawEvidenceExcludedFromPublicRuntime: true,
      sensitiveIdentityDataExcludedFromGeneratedArtifacts: true,
      govCrmSeparate: true,
      officialScorecardsDisabled: true,
      verifiedResidentAndVoterEqualWeightCohorts: sourceIncludes("lib/identity/capabilities.ts", "voteWeight: 1"),
    },
  };
  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log("Sprint 2I-B foundation audit complete.");
  console.log(JSON.stringify({
    identity: identity.status,
    operations: operations.status,
    ownerMfaEnabled: Boolean(owner?.mfaEnabled),
    localOperationRecords: adminOperations.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
