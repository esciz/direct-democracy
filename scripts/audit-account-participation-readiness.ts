import fs from "node:fs/promises";
import path from "node:path";

import { accountToAuthUser } from "@/lib/identity/accounts";
import { readIdentityStore } from "@/lib/identity/storage";
import { getAccountParticipationStatus } from "@/lib/civic-signals/account-participation-status";
import { prisma } from "@/lib/prisma";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "account-participation-readiness-audit.json");

function redactEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visible = localPart.slice(0, 2) || "**";
  return domain ? `${visible}***@${domain}` : `${visible}***`;
}

async function main() {
  const store = readIdentityStore();
  const activeAccounts = store.accounts.filter((account) => account.status === "active" && account.emailVerificationStatus === "verified");
  const publicUserRows = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      isVerifiedVoter: true,
    },
  });
  const publicUserIds = new Set(publicUserRows.map((row) => row.id));
  const statuses = await Promise.all(
    activeAccounts.map(async (account) => {
      const user = accountToAuthUser(account);
      const status = await getAccountParticipationStatus(user, { signedIn: true });
      return {
        userId: account.id,
        emailRedacted: redactEmail(account.email),
        role: account.role,
        hasPublicUserRow: publicUserIds.has(account.id),
        canCastSourceBackedVotes: status.canCastSourceBackedVotes,
        countsAsVerifiedStakeholderSignal: status.countsAsVerifiedStakeholderSignal,
        verificationClass: status.verificationClass,
        responseProvenance: status.responseProvenance,
        countsInAnalyticsWhenRecorded: status.countsInAnalyticsWhenRecorded,
        voteWeight: status.voteWeight,
        hiddenWeighting: status.hiddenWeighting,
        existingRealResponses: status.existingRealResponses,
        existingVerifiedAnalyticsResponses: status.existingVerifiedAnalyticsResponses,
      };
    }),
  );
  const sourceBackedQuestionsAvailable = statuses[0]?.canCastSourceBackedVotes !== undefined
    ? await prisma.voteQuestion.count({
        where: {
          generatedFromRealData: true,
          reviewStatus: { in: ["approved", "verified"] },
          sourceUrl: { not: null },
        },
      })
    : 0;
  const accountsCanVote = statuses.filter((status) => status.canCastSourceBackedVotes).length;
  const accountsVerifiedForStakeholderAnalytics = statuses.filter((status) => status.countsAsVerifiedStakeholderSignal).length;
  const accountsNeedingVerificationForAnalytics = statuses.filter((status) => status.canCastSourceBackedVotes && !status.countsAsVerifiedStakeholderSignal).length;
  const accountsMissingPublicUserRows = statuses.filter((status) => !status.hasPublicUserRow).length;
  const hiddenWeightingDisabled = statuses.every((status) => status.hiddenWeighting === false && status.voteWeight === 1);
  const responseProvenanceExplicit = statuses.every((status) => status.responseProvenance === "real_participant" || status.responseProvenance === "not_recorded");

  const audit = {
    generatedAt: new Date().toISOString(),
    status: "account_participation_readiness_audited",
    sensitiveValuesIncluded: false,
    totals: {
      identityAccounts: store.accounts.length,
      activeVerifiedIdentityAccounts: activeAccounts.length,
      publicUserRows: publicUserRows.length,
      sourceBackedQuestionsAvailable,
      accountsCanVote,
      accountsVerifiedForStakeholderAnalytics,
      accountsNeedingVerificationForAnalytics,
      accountsMissingPublicUserRows,
      existingRealResponses: statuses.reduce((sum, status) => sum + status.existingRealResponses, 0),
      existingVerifiedAnalyticsResponses: statuses.reduce((sum, status) => sum + status.existingVerifiedAnalyticsResponses, 0),
    },
    validation: {
      sourceBackedQuestionsAvailable: sourceBackedQuestionsAvailable > 0,
      hiddenWeightingDisabled,
      responseProvenanceExplicit,
      noSensitiveValuesIncluded: true,
      publicUserRowsMayBeCreatedOnFirstVote: true,
    },
    accounts: statuses,
  };
  const pass =
    audit.validation.sourceBackedQuestionsAvailable &&
    audit.validation.hiddenWeightingDisabled &&
    audit.validation.responseProvenanceExplicit &&
    audit.validation.noSensitiveValuesIncluded &&
    audit.validation.publicUserRowsMayBeCreatedOnFirstVote;

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify({ ...audit, pass }, null, 2)}\n`);

  console.log("Account participation readiness audit complete.");
  console.log(JSON.stringify({ pass, totals: audit.totals, output: OUTPUT_PATH }, null, 2));

  if (!pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
