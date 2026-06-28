import fs from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { getStakeholderAnalyticsRuntime } from "@/lib/civic-signals/stakeholder-analytics";
import { getParticipationActivationRuntime } from "@/lib/civic-signals/participation-activation";
import { recordSourceBackedCivicVoteForUser } from "@/lib/feed/vote-recording";
import { getVotingLibrary, updateCivicSentimentAggregate } from "@/lib/feed/quick-votes";
import type { AuthUser } from "@/types/domain";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const REPORT_PATH = path.join(GENERATED_DIR, "voting-participation-loop-qa.json");
const PUBLIC_REVIEW_STATUSES = ["approved", "verified"] as const;
const FIXTURE_USER_ID = "qa_verified_participation_loop_user";

async function writeReport(report: Record<string, unknown>) {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

async function main() {
  const startedAt = new Date().toISOString();
  const question = await prisma.voteQuestion.findFirst({
    where: {
      generatedFromRealData: true,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
      sourceUrl: { not: null },
      jurisdiction: {
        name: { in: ["Carson City, Nevada", "Nevada"] },
      },
    },
    include: { jurisdiction: true },
    orderBy: [{ updatedAt: "desc" }],
  }) ?? await prisma.voteQuestion.findFirst({
    where: {
      generatedFromRealData: true,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
      sourceUrl: { not: null },
    },
    include: { jurisdiction: true },
    orderBy: [{ updatedAt: "desc" }],
  });

  if (!question) {
    const report = {
      generatedAt: startedAt,
      pass: false,
      status: "no_source_backed_question_available",
      reportPath: REPORT_PATH,
    };
    await writeReport(report);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
    return;
  }

  const before = await getParticipationActivationRuntime();
  const existingResponse = await prisma.voteResponse.findUnique({
    where: {
      userId_questionId: {
        userId: FIXTURE_USER_ID,
        questionId: question.id,
      },
    },
  });

  if (existingResponse) {
    await prisma.voteResponse.delete({ where: { id: existingResponse.id } });
    await updateCivicSentimentAggregate(question.id);
  }

  await prisma.user.upsert({
    where: { id: FIXTURE_USER_ID },
    create: {
      id: FIXTURE_USER_ID,
      email: "qa-verified-participation-loop@directdemocracy.local",
      username: "qa_verified_participation_loop",
      name: "QA Verified Participation Loop",
      role: "citizen",
      isVerifiedVoter: true,
      isAnonymousPublic: true,
      jurisdictionId: question.jurisdictionId,
    },
    update: {
      role: "citizen",
      isVerifiedVoter: true,
      isAnonymousPublic: true,
      jurisdictionId: question.jurisdictionId,
    },
  });

  const fixtureUser: AuthUser = {
    id: FIXTURE_USER_ID,
    email: "qa-verified-participation-loop@directdemocracy.local",
    name: "QA Verified Participation Loop",
    username: "qa_verified_participation_loop",
    bio: "Temporary non-public QA user removed after the verified participation loop check.",
    role: "citizen",
    verificationState: "voterVerified",
    jurisdictionName: question.jurisdiction.name,
    followerCount: 0,
    isVerifiedVoter: true,
    isAnonymousPublic: true,
  };

  let cleanupStatus = "not_started";
  let report: Record<string, unknown>;

  try {
    const recordResult = await recordSourceBackedCivicVoteForUser(fixtureUser, question.id, "yes", {
      provenance: "qa_fixture",
      countsInAnalytics: false,
      provenanceNote: "Temporary Sprint 3D/3E participation loop QA fixture; removed before command exits.",
    });
    const library = await getVotingLibrary(fixtureUser, { scope: "all", category: "all", objectType: "all" });
    const answeredQuestion = library.find((item) => item.id === question.id);
    const stakeholder = await getStakeholderAnalyticsRuntime();
    const after = await getParticipationActivationRuntime({
      stakeholderPublicSegments: stakeholder.totals.publicSegments,
      stakeholderSuppressedSegments: stakeholder.totals.suppressedSegments,
    });
    const individualLeakCheck = JSON.stringify(stakeholder).includes(FIXTURE_USER_ID) || JSON.stringify(after).includes(FIXTURE_USER_ID);
    const verifiedResponseDelta = after.totals.verifiedResponses - before.totals.verifiedResponses;
    const excludedQaDelta = after.totals.excludedQaFixtureResponses - before.totals.excludedQaFixtureResponses;
    const totalResponseDelta = after.totals.totalResponses - before.totals.totalResponses;
    const pass =
      recordResult.ok &&
      answeredQuestion?.userAnswer === "yes" &&
      verifiedResponseDelta === 0 &&
      totalResponseDelta === 1 &&
      excludedQaDelta === 1 &&
      stakeholder.totals.verifiedResponses === after.totals.verifiedResponses &&
      stakeholder.totals.publicSegments === 0 &&
      !individualLeakCheck;

    report = {
      generatedAt: new Date().toISOString(),
      pass,
      status: pass ? "verified_participation_loop_passed" : "verified_participation_loop_failed",
      question: {
        id: question.id,
        jurisdictionName: question.jurisdiction.name,
        sourceName: question.sourceName,
        sourceUrlPresent: Boolean(question.sourceUrl),
      },
      checks: {
        recordMutationAccepted: recordResult.ok,
        votingHistoryShowsAnswer: answeredQuestion?.userAnswer === "yes",
        verifiedResponseDelta,
        excludedQaDelta,
        totalResponseDelta,
        stakeholderAnalyticsRefreshed: stakeholder.totals.verifiedResponses === after.totals.verifiedResponses,
        aggregateStillSuppressedBelowThreshold: stakeholder.totals.publicSegments === 0,
        individualRecordsExposed: individualLeakCheck,
        fixtureWillBeRemoved: true,
      },
      before: before.totals,
      after: after.totals,
      reportPath: REPORT_PATH,
    };
  } finally {
    await prisma.voteResponse.deleteMany({ where: { userId: FIXTURE_USER_ID } });
    await prisma.user.deleteMany({ where: { id: FIXTURE_USER_ID } });
    await updateCivicSentimentAggregate(question.id);
    cleanupStatus = "fixture_removed";
  }

  report = {
    ...report!,
    cleanupStatus,
  };
  await writeReport(report);
  console.log(JSON.stringify(report, null, 2));

  if (!report.pass) {
    process.exitCode = 1;
  }
}

main()
  .catch(async (error) => {
    const report = {
      generatedAt: new Date().toISOString(),
      pass: false,
      status: "verified_participation_loop_error",
      message: error instanceof Error ? error.message : String(error),
      reportPath: REPORT_PATH,
    };
    await writeReport(report).catch(() => undefined);
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
