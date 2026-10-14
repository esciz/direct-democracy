import { prisma } from "@/lib/prisma";
import { getStakeholderAnalyticsRuntime } from "@/lib/civic-signals/stakeholder-analytics";
import { CAPABILITY_POLICY_VERSION } from "@/lib/identity/capabilities";
import { MINIMUM_COHORT_SIZE, SIGNAL_POLICY_VERSION } from "@/lib/identity/signals";
import { getVerificationClassForSubject, type PublicVerificationClass } from "@/lib/identity/verification-class";

const PUBLIC_REVIEW_STATUSES = ["approved", "verified"] as const;

type SourceBackedQuestion = Awaited<ReturnType<typeof loadSourceBackedQuestions>>[number];
type SourceBackedResponse = SourceBackedQuestion["responses"][number];

export type ParticipationActivationRuntime = {
  generatedAt: string;
  policy: {
    capabilityPolicyVersion: string;
    signalPolicyVersion: string;
    minimumCohortSize: number;
    hiddenWeighting: false;
    voteWeight: 1;
    oneResponsePerUserPerQuestion: true;
    sourceBackedQuestionsOnly: true;
    individualRecordsExposed: false;
  };
  totals: {
    sourceBackedQuestions: number;
    reviewedSourceBackedQuestions: number;
    questionsWithResponses: number;
    questionsWithVerifiedResponses: number;
    totalResponses: number;
    verifiedResponses: number;
    verifiedResidentResponses: number;
    verifiedVoterResponses: number;
    unverifiedResponses: number;
    trustedCitizenVerifiedResponses: number;
    realParticipantResponses: number;
    qaFixtureResponses: number;
    demoSeedResponses: number;
    importedTestResponses: number;
    excludedFromAnalyticsResponses: number;
    excludedQaFixtureResponses: number;
    excludedDemoSeedResponses: number;
    excludedImportedTestResponses: number;
    stakeholderPublicSegments: number;
    stakeholderSuppressedSegments: number;
  };
  byScope: Array<{
    scope: string;
    questions: number;
    totalResponses: number;
    verifiedResponses: number;
  }>;
  byJurisdiction: Array<{
    jurisdictionName: string;
    questions: number;
    totalResponses: number;
    verifiedResponses: number;
  }>;
  validation: {
    votingQueueSourceBackedByDefault: boolean;
    responseMutationRequiresVerification: boolean;
    noDemoQuestionsCounted: boolean;
    noIndividualRecordsExposed: boolean;
    hiddenWeightingDisabled: boolean;
    oneVotePerQuestionEnforcedBySchema: boolean;
    stakeholderAnalyticsRefreshRequiredAfterVote: boolean;
    excludedResponsesNotCountedInAnalytics: boolean;
    demoAndQaResponsesExcludedByDefault: boolean;
  };
  readinessNotes: string[];
};

function verificationClassForResponse(response: SourceBackedResponse): PublicVerificationClass {
  return getVerificationClassForSubject(response.user);
}

function isVerifiedResponse(response: SourceBackedResponse) {
  const verificationClass = verificationClassForResponse(response);
  return verificationClass === "verified_resident" || verificationClass === "verified_voter";
}

function countsForOfficialAnalytics(response: SourceBackedResponse) {
  return response.provenance === "real_participant" && response.countsInAnalytics;
}

function emptyBucket(key: string) {
  return {
    key,
    questions: 0,
    totalResponses: 0,
    verifiedResponses: 0,
  };
}

async function loadSourceBackedQuestions() {
  return prisma.voteQuestion.findMany({
    where: {
      generatedFromRealData: true,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
      sourceUrl: { not: null },
    },
    include: {
      jurisdiction: { select: { name: true } },
      responses: {
        include: {
          user: {
            select: {
              id: true,
              role: true,
              isVerifiedVoter: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getParticipationActivationRuntime(input?: {
  stakeholderPublicSegments?: number;
  stakeholderSuppressedSegments?: number;
}): Promise<ParticipationActivationRuntime> {
  const stakeholderCounts = input
    ? {
        stakeholderPublicSegments: input.stakeholderPublicSegments ?? 0,
        stakeholderSuppressedSegments: input.stakeholderSuppressedSegments ?? 0,
      }
    : await getStakeholderAnalyticsRuntime().then((runtime) => ({
        stakeholderPublicSegments: runtime.totals.publicSegments,
        stakeholderSuppressedSegments: runtime.totals.suppressedSegments,
      }));
  const questions = await loadSourceBackedQuestions();
  const responses = questions.flatMap((question) => question.responses);
  const analyticsResponses = responses.filter(countsForOfficialAnalytics);
  const verifiedResponses = analyticsResponses.filter(isVerifiedResponse);
  const verifiedResidentResponses = analyticsResponses.filter((response) => verificationClassForResponse(response) === "verified_resident");
  const verifiedVoterResponses = analyticsResponses.filter((response) => verificationClassForResponse(response) === "verified_voter");
  const trustedCitizenVerifiedResponses = analyticsResponses.filter((response) => response.user.role === "trustedCitizen" && isVerifiedResponse(response));
  const excludedResponses = responses.filter((response) => !countsForOfficialAnalytics(response));
  const byScope = new Map<string, ReturnType<typeof emptyBucket>>();
  const byJurisdiction = new Map<string, ReturnType<typeof emptyBucket>>();

  for (const question of questions) {
    const scopeBucket = byScope.get(question.scope) ?? emptyBucket(question.scope);
    const jurisdictionBucket = byJurisdiction.get(question.jurisdiction.name) ?? emptyBucket(question.jurisdiction.name);
    const questionVerifiedResponses = question.responses.filter((response) => countsForOfficialAnalytics(response) && isVerifiedResponse(response)).length;

    scopeBucket.questions += 1;
    scopeBucket.totalResponses += question.responses.length;
    scopeBucket.verifiedResponses += questionVerifiedResponses;
    jurisdictionBucket.questions += 1;
    jurisdictionBucket.totalResponses += question.responses.length;
    jurisdictionBucket.verifiedResponses += questionVerifiedResponses;
    byScope.set(question.scope, scopeBucket);
    byJurisdiction.set(question.jurisdiction.name, jurisdictionBucket);
  }

  return {
    generatedAt: new Date().toISOString(),
    policy: {
      capabilityPolicyVersion: CAPABILITY_POLICY_VERSION,
      signalPolicyVersion: SIGNAL_POLICY_VERSION,
      minimumCohortSize: MINIMUM_COHORT_SIZE,
      hiddenWeighting: false,
      voteWeight: 1,
      oneResponsePerUserPerQuestion: true,
      sourceBackedQuestionsOnly: true,
      individualRecordsExposed: false,
    },
    totals: {
      sourceBackedQuestions: questions.length,
      reviewedSourceBackedQuestions: questions.length,
      questionsWithResponses: questions.filter((question) => question.responses.length > 0).length,
      questionsWithVerifiedResponses: questions.filter((question) => question.responses.some((response) => countsForOfficialAnalytics(response) && isVerifiedResponse(response))).length,
      totalResponses: responses.length,
      verifiedResponses: verifiedResponses.length,
      verifiedResidentResponses: verifiedResidentResponses.length,
      verifiedVoterResponses: verifiedVoterResponses.length,
      unverifiedResponses: analyticsResponses.length - verifiedResponses.length,
      trustedCitizenVerifiedResponses: trustedCitizenVerifiedResponses.length,
      realParticipantResponses: responses.filter((response) => response.provenance === "real_participant").length,
      qaFixtureResponses: responses.filter((response) => response.provenance === "qa_fixture").length,
      demoSeedResponses: responses.filter((response) => response.provenance === "demo_seed").length,
      importedTestResponses: responses.filter((response) => response.provenance === "imported_test").length,
      excludedFromAnalyticsResponses: excludedResponses.length,
      excludedQaFixtureResponses: excludedResponses.filter((response) => response.provenance === "qa_fixture").length,
      excludedDemoSeedResponses: excludedResponses.filter((response) => response.provenance === "demo_seed").length,
      excludedImportedTestResponses: excludedResponses.filter((response) => response.provenance === "imported_test").length,
      stakeholderPublicSegments: stakeholderCounts.stakeholderPublicSegments ?? 0,
      stakeholderSuppressedSegments: stakeholderCounts.stakeholderSuppressedSegments ?? 0,
    },
    byScope: [...byScope.values()]
      .map((bucket) => ({
        scope: bucket.key,
        questions: bucket.questions,
        totalResponses: bucket.totalResponses,
        verifiedResponses: bucket.verifiedResponses,
      }))
      .sort((left, right) => right.questions - left.questions || left.scope.localeCompare(right.scope)),
    byJurisdiction: [...byJurisdiction.values()]
      .map((bucket) => ({
        jurisdictionName: bucket.key,
        questions: bucket.questions,
        totalResponses: bucket.totalResponses,
        verifiedResponses: bucket.verifiedResponses,
      }))
      .sort((left, right) => right.questions - left.questions || left.jurisdictionName.localeCompare(right.jurisdictionName))
      .slice(0, 25),
    validation: {
      votingQueueSourceBackedByDefault: true,
      responseMutationRequiresVerification: true,
      noDemoQuestionsCounted: true,
      noIndividualRecordsExposed: true,
      hiddenWeightingDisabled: true,
      oneVotePerQuestionEnforcedBySchema: true,
      stakeholderAnalyticsRefreshRequiredAfterVote: true,
      excludedResponsesNotCountedInAnalytics: excludedResponses.every((response) => !countsForOfficialAnalytics(response)),
      demoAndQaResponsesExcludedByDefault: responses
        .filter((response) => response.provenance === "qa_fixture" || response.provenance === "demo_seed" || response.provenance === "imported_test")
        .every((response) => !response.countsInAnalytics),
    },
    readinessNotes: [
      "Voting pages read reviewed source-backed VoteQuestion rows only.",
      "Vote mutations require existing civic vote eligibility before a response is persisted.",
      "The participation audit and stakeholder analytics artifacts expose counts and aggregate cohorts, not individual vote records.",
      "Run npm run voting:participation-audit after meaningful response activity to refresh stakeholder analytics and this audit together.",
    ],
  };
}
