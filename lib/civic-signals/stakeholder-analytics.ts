import { prisma } from "@/lib/prisma";
import { MINIMUM_COHORT_SIZE, SIGNAL_POLICY_VERSION, summarizeSignals, type ParticipationSignal } from "@/lib/identity/signals";
import { getVerificationClassForSubject } from "@/lib/identity/verification-class";

const PUBLIC_REVIEW_STATUSES = ["approved", "verified"] as const;

export type StakeholderSegmentId = "all_verified_participants" | "verified_residents" | "verified_voters" | "trusted_citizen_stewards";

export type StakeholderSegmentSummary =
  | {
      segmentId: StakeholderSegmentId;
      label: string;
      suppressed: true;
      reason: "minimum_cohort_size" | "no_verified_responses";
      minimumCohortSize: number;
    }
  | {
      segmentId: StakeholderSegmentId;
      label: string;
      suppressed: false;
      count: number;
      yes: number;
      no: number;
      skip: number;
      supportPercent: number;
      voteWeight: 1;
    };

export type StakeholderAnalyticsRecord = {
  questionId: string;
  questionText: string;
  entityType: string | null;
  entityName: string | null;
  jurisdictionName: string;
  scope: string;
  sourceName: string | null;
  sourceUrl: string | null;
  lastUpdatedAt: string;
  responseCount: number;
  verifiedResponseCount: number;
  suppressedSegments: number;
  publicSegments: number;
  segments: StakeholderSegmentSummary[];
};

export type StakeholderAnalyticsRuntime = {
  generatedAt: string;
  policy: {
    policyVersion: string;
    minimumCohortSize: number;
    hiddenWeighting: false;
    voteWeight: 1;
    unrestrictedCrossFilteringAllowed: false;
    individualRecordsExposed: false;
  };
  totals: {
    questionsAnalyzed: number;
    totalResponses: number;
    verifiedResponses: number;
    publicSegments: number;
    suppressedSegments: number;
  };
  records: StakeholderAnalyticsRecord[];
};

type QuestionRow = Awaited<ReturnType<typeof loadVoteQuestions>>[number];
type ResponseRow = QuestionRow["responses"][number];

function segmentLabel(segmentId: StakeholderSegmentId) {
  switch (segmentId) {
    case "all_verified_participants":
      return "All verified participants";
    case "verified_residents":
      return "Verified residents";
    case "verified_voters":
      return "Verified voters";
    case "trusted_citizen_stewards":
      return "Trusted Citizen stewards";
  }
}

function verificationClassFor(row: ResponseRow): ParticipationSignal["verificationClass"] | null {
  const verificationClass = getVerificationClassForSubject(row.user);
  return verificationClass === "verified_resident" || verificationClass === "verified_voter" ? verificationClass : null;
}

function signalFor(row: ResponseRow): ParticipationSignal | null {
  const verificationClass = verificationClassFor(row);
  if (!verificationClass) return null;
  return {
    id: row.id,
    answer: row.answer,
    verificationClass,
    weight: 1,
  };
}

function summarizeSegment(segmentId: StakeholderSegmentId, rows: ResponseRow[]): StakeholderSegmentSummary {
  const signals = rows.map(signalFor).filter((signal): signal is ParticipationSignal => Boolean(signal));
  if (!signals.length) {
    return {
      segmentId,
      label: segmentLabel(segmentId),
      suppressed: true,
      reason: "no_verified_responses",
      minimumCohortSize: MINIMUM_COHORT_SIZE,
    };
  }

  const summary = summarizeSignals(signals).allVerified;
  if (summary.suppressed) {
    return {
      segmentId,
      label: segmentLabel(segmentId),
      suppressed: true,
      reason: "minimum_cohort_size",
      minimumCohortSize: MINIMUM_COHORT_SIZE,
    };
  }

  return {
    segmentId,
    label: segmentLabel(segmentId),
    suppressed: false,
    count: summary.count ?? 0,
    yes: summary.yes ?? 0,
    no: summary.no ?? 0,
    skip: summary.skip ?? 0,
    supportPercent: summary.supportPercent ?? 0,
    voteWeight: 1,
  };
}

async function loadVoteQuestions() {
  return prisma.voteQuestion.findMany({
    where: {
      generatedFromRealData: true,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
      sourceUrl: { not: null },
    },
    include: {
      jurisdiction: { select: { name: true } },
      responses: {
        where: {
          provenance: "real_participant",
          countsInAnalytics: true,
        },
        include: {
          user: {
            select: {
              id: true,
              role: true,
              isVerifiedVoter: true,
              jurisdiction: { select: { name: true } },
            },
          },
        },
      }
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getStakeholderAnalyticsRuntime(): Promise<StakeholderAnalyticsRuntime> {
  const questions = await loadVoteQuestions();
  const records: StakeholderAnalyticsRecord[] = [];

  for (const question of questions) {
    const questionRows = question.responses;
    const verifiedRows = questionRows.filter((row) => Boolean(verificationClassFor(row)));
    const residentRows = questionRows.filter((row) => verificationClassFor(row) === "verified_resident");
    const voterRows = questionRows.filter((row) => verificationClassFor(row) === "verified_voter");
    const trustedRows = questionRows.filter((row) => row.user.role === "trustedCitizen" && Boolean(verificationClassFor(row)));
    const segments = [
      summarizeSegment("all_verified_participants", verifiedRows),
      summarizeSegment("verified_residents", residentRows),
      summarizeSegment("verified_voters", voterRows),
      summarizeSegment("trusted_citizen_stewards", trustedRows),
    ];

    records.push({
      questionId: question.id,
      questionText: question.questionText,
      entityType: question.civicEntityType,
      entityName: question.civicEntityName,
      jurisdictionName: question.jurisdiction.name,
      scope: question.scope,
      sourceName: question.sourceName,
      sourceUrl: question.sourceUrl,
      lastUpdatedAt: question.updatedAt.toISOString(),
      responseCount: questionRows.length,
      verifiedResponseCount: verifiedRows.length,
      suppressedSegments: segments.filter((segment) => segment.suppressed).length,
      publicSegments: segments.filter((segment) => !segment.suppressed).length,
      segments,
    });
  }

  const sortedRecords = records.sort((left, right) => right.verifiedResponseCount - left.verifiedResponseCount || right.lastUpdatedAt.localeCompare(left.lastUpdatedAt));

  return {
    generatedAt: new Date().toISOString(),
    policy: {
      policyVersion: SIGNAL_POLICY_VERSION,
      minimumCohortSize: MINIMUM_COHORT_SIZE,
      hiddenWeighting: false,
      voteWeight: 1,
      unrestrictedCrossFilteringAllowed: false,
      individualRecordsExposed: false,
    },
    totals: {
      questionsAnalyzed: sortedRecords.length,
      totalResponses: questions.reduce((sum, question) => sum + question.responses.length, 0),
      verifiedResponses: questions.reduce((sum, question) => sum + question.responses.filter((row) => Boolean(verificationClassFor(row))).length, 0),
      publicSegments: sortedRecords.reduce((sum, record) => sum + record.publicSegments, 0),
      suppressedSegments: sortedRecords.reduce((sum, record) => sum + record.suppressedSegments, 0),
    },
    records: sortedRecords,
  };
}
