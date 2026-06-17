import { prisma } from "@/lib/prisma";
import { ensureInitialRealDataCivicQuestions, getVotingLibrary } from "@/lib/feed/quick-votes";
import type { AuthUser, VoteQuestionCardSummary } from "@/types/domain";

const PUBLIC_REVIEW_STATUSES = ["approved", "verified"] as const;

export type CivicSignalEntityRow = {
  id: string;
  entityType: string;
  entityName: string;
  jurisdictionName: string;
  sourceName: string;
  sourceUrl: string | null;
  lastUpdated: string;
  confidenceScore: number;
  verificationStatus: string;
};

export type CivicSentimentRow = {
  id: string;
  entityType: string;
  entityName: string;
  jurisdictionName: string;
  approveCount: number;
  disapproveCount: number;
  supportCount: number;
  opposeCount: number;
  trustScore: number | null;
  responseCount: number;
  lastComputedAt: string;
};

export type CivicSignalsDashboard = {
  questions: VoteQuestionCardSummary[];
  elections: CivicSignalEntityRow[];
  legislativeVotes: CivicSignalEntityRow[];
  ballotMeasures: CivicSignalEntityRow[];
  registrationTurnout: CivicSignalEntityRow[];
  sentiment: CivicSentimentRow[];
};

export async function getCivicSignalsDashboard(user: AuthUser): Promise<CivicSignalsDashboard> {
  await ensureInitialRealDataCivicQuestions();

  const [questions, entityReviews, sentimentRows] = await Promise.all([
    getVotingLibrary(user, { scope: "all", category: "all", objectType: "all" }),
    prisma.civicEntityReview.findMany({
      where: {
        reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
        sourceUrl: { not: null },
      },
      include: {
        jurisdiction: { select: { name: true } },
      },
      orderBy: { lastUpdatedAt: "desc" },
      take: 150,
    }),
    prisma.civicSentimentAggregate.findMany({
      include: {
        jurisdiction: { select: { name: true } },
      },
      orderBy: { lastComputedAt: "desc" },
      take: 50,
    }),
  ]);
  const entityNameByKey = new Map(entityReviews.map((review) => [`${review.entityType}:${review.entityId}`, review.entityName]));
  const toEntityRow = (review: (typeof entityReviews)[number]): CivicSignalEntityRow => ({
    id: review.id,
    entityType: review.entityType,
    entityName: review.entityName,
    jurisdictionName: review.jurisdiction?.name ?? "Nevada",
    sourceName: review.sourceName ?? "Imported public civic data",
    sourceUrl: review.sourceUrl,
    lastUpdated: review.lastUpdatedAt.toISOString(),
    confidenceScore: review.confidenceScore,
    verificationStatus: review.verificationStatus,
  });

  return {
    questions,
    elections: entityReviews.filter((review) => review.entityType === "ELECTION").map(toEntityRow),
    legislativeVotes: entityReviews.filter((review) => review.entityType === "LEGISLATIVE_VOTE" || review.entityType === "BILL").map(toEntityRow),
    ballotMeasures: entityReviews.filter((review) => review.entityType === "BALLOT_MEASURE").map(toEntityRow),
    registrationTurnout: entityReviews.filter((review) => review.entityType === "REGISTRATION_TURNOUT").map(toEntityRow),
    sentiment: sentimentRows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityName: entityNameByKey.get(`${row.entityType}:${row.entityId}`) ?? row.entityId,
      jurisdictionName: row.jurisdiction?.name ?? "Nevada",
      approveCount: row.approveCount,
      disapproveCount: row.disapproveCount,
      supportCount: row.supportCount,
      opposeCount: row.opposeCount,
      trustScore: row.trustScore,
      responseCount: row.responseCount,
      lastComputedAt: row.lastComputedAt.toISOString(),
    })),
  };
}
