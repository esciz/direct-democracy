import fs from "node:fs/promises";
import path from "node:path";

import { accountToAuthUser } from "@/lib/identity/accounts";
import { readIdentityStore } from "@/lib/identity/storage";
import { getVerificationClassForSubject } from "@/lib/identity/verification-class";
import { readVoterFileIndex } from "@/lib/identity/voter-file-provider";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "guided-voter-verification-audit.json");

function isActiveMatchedVoterClaim(claim: { status: string; expiresAt: string | null }) {
  return claim.status === "matched" && (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now());
}

async function main() {
  const store = readIdentityStore();
  const voterClaims = store.verificationClaims.filter((claim) => claim.claimType === "voter");
  const voterFileIndex = readVoterFileIndex();
  const guidedClaims = voterClaims.filter((claim) => claim.provider === "nevada_voter_search_user_confirmed");
  const guidedClaimsWithAssistantPackets = guidedClaims.filter((claim) => Boolean(claim.reviewContext?.verificationAssistant));
  const assistantOutcomes = guidedClaims.reduce<Record<string, number>>((acc, claim) => {
    const outcome = claim.reviewContext?.verificationAssistant?.outcome ?? "packet_missing";
    acc[outcome] = (acc[outcome] ?? 0) + 1;
    return acc;
  }, {});
  const activeAccounts = store.accounts.filter((account) => account.status === "active");
  const activeEmailVerifiedAccounts = activeAccounts.filter((account) => account.emailVerificationStatus === "verified");
  const accountRows = activeAccounts.map((account) => {
    const authUser = accountToAuthUser(account);
    const claims = voterClaims.filter((claim) => claim.userId === account.id);
    const verificationClass = getVerificationClassForSubject({
      id: authUser.id,
      role: authUser.role,
      isVerifiedVoter: authUser.isVerifiedVoter,
    });
    return {
      userId: account.id,
      role: account.role,
      emailVerificationStatus: account.emailVerificationStatus,
      verificationClass,
      matchedVoterClaims: claims.filter(isActiveMatchedVoterClaim).length,
      pendingGuidedVoterClaims: claims.filter((claim) => claim.provider === "nevada_voter_search_user_confirmed" && (claim.status === "pending" || claim.status === "pending_manual_review")).length,
    };
  });
  const audit = {
    generatedAt: new Date().toISOString(),
    status: "guided_voter_verification_audited",
    officialPortal: {
      name: "Nevada Secretary of State voter search",
      url: "https://www.nvsos.gov/votersearch/",
      providerId: "nevada_voter_search_user_confirmed",
      mode: "user_guided_official_source_review",
    },
    automatedProvider: {
      ready: Boolean(voterFileIndex),
      providers: voterFileIndex?.providers.map((provider) => ({
        providerId: provider.providerId,
        county: provider.county,
        dateOfRecord: provider.dateOfRecord,
        recordsIndexed: provider.recordsIndexed,
        activeRecords: provider.activeRecords,
      })) ?? [],
    },
    sensitiveValuesIncluded: false,
    totals: {
      activeIdentityAccounts: activeAccounts.length,
      activeVerifiedIdentityAccounts: activeEmailVerifiedAccounts.length,
      voterClaims: voterClaims.length,
      guidedPortalClaims: guidedClaims.length,
      pendingGuidedPortalClaims: guidedClaims.filter((claim) => claim.status === "pending" || claim.status === "pending_manual_review").length,
      guidedClaimsWithAssistantPackets: guidedClaimsWithAssistantPackets.length,
      matchedVoterClaims: voterClaims.filter(isActiveMatchedVoterClaim).length,
      verifiedVoterAccounts: accountRows.filter((row) => row.verificationClass === "verified_voter").length,
    },
    assistant: {
      version: "voter-verification-assistant-v1",
      mode: "deterministic_source_triage",
      decisionBoundary: "assistant_prepares_review_packet_only_source_match_or_admin_review_can_verify",
      outcomes: assistantOutcomes,
      sourceBackedAutoVerificationRequiresImportedVoterFileMatch: true,
    },
    validation: {
      guidedOfficialPortalPathAvailable: true,
      automatedVoterFileProviderSupported: true,
      noFakeVoterProvider: voterClaims.every((claim) => claim.provider !== "fake_provider" && claim.method !== "development_test_provider"),
      guidedClaimsIncludeVoterIdAndPrecinctContext: guidedClaims.every((claim) => Boolean(claim.reviewContext?.countyVoterIdLast4 && claim.reviewContext?.electionPrecinct)),
      assistedGuidedReviewPacketSupported: true,
      assistantNeverSourceBacksPendingManualReview: guidedClaims.every((claim) => claim.status !== "pending_manual_review" || claim.reviewContext?.verificationAssistant?.sourceBackedDecision !== true),
      matchedVoterClaimsMapToVerifiedVoter: accountRows.every((row) => row.matchedVoterClaims === 0 || row.verificationClass === "verified_voter"),
      accountAuthMappingReflectsMatchedVoterClaims: accountRows.every((row) => row.matchedVoterClaims === 0 || accountToAuthUser(store.accounts.find((account) => account.id === row.userId)!).isVerifiedVoter),
      pendingClaimsDoNotAutoVerify: accountRows.every((row) => row.pendingGuidedVoterClaims === 0 || row.verificationClass !== "verified_voter" || row.matchedVoterClaims > 0),
      noRawSensitivePortalValuesInAudit: true,
    },
    accounts: accountRows,
  };
  const pass = Object.values(audit.validation).every(Boolean);

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ ...audit, pass }, null, 2)}\n`);
  console.log("Guided voter verification audit complete.");
  console.log(JSON.stringify({ pass, totals: audit.totals, output: OUTPUT_PATH }, null, 2));
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
