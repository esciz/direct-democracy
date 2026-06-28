import { prisma } from "@/lib/prisma";
import { getParticipationActivationRuntime } from "@/lib/civic-signals/participation-activation";
import { getStakeholderAnalyticsRuntime } from "@/lib/civic-signals/stakeholder-analytics";

export async function getParticipationAdminDashboard() {
  const [activation, stakeholder, recentResponses, topQuestions] = await Promise.all([
    getParticipationActivationRuntime(),
    getStakeholderAnalyticsRuntime(),
    prisma.voteResponse.findMany({
      include: {
        question: {
          select: {
            questionText: true,
            sourceName: true,
            sourceUrl: true,
            jurisdiction: { select: { name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.voteQuestion.findMany({
      where: {
        generatedFromRealData: true,
        reviewStatus: { in: ["approved", "verified"] },
        sourceUrl: { not: null },
      },
      include: {
        jurisdiction: { select: { name: true } },
        responses: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  return {
    activation,
    stakeholder,
    recentResponses: recentResponses.map((response) => ({
      id: response.id,
      answer: response.answer,
      provenance: response.provenance,
      countsInAnalytics: response.countsInAnalytics,
      provenanceNote: response.provenanceNote,
      updatedAt: response.updatedAt.toISOString(),
      questionText: response.question.questionText,
      jurisdictionName: response.question.jurisdiction.name,
      sourceName: response.question.sourceName,
      sourceUrlPresent: Boolean(response.question.sourceUrl),
    })),
    topQuestions: topQuestions.map((question) => {
      const analyticsResponses = question.responses.filter((response) => response.provenance === "real_participant" && response.countsInAnalytics);
      return {
        id: question.id,
        questionText: question.questionText,
        jurisdictionName: question.jurisdiction.name,
        sourceName: question.sourceName,
        sourceUrlPresent: Boolean(question.sourceUrl),
        totalResponses: question.responses.length,
        analyticsResponses: analyticsResponses.length,
        excludedResponses: question.responses.length - analyticsResponses.length,
        publicSegmentCount: stakeholder.records.find((record) => record.questionId === question.id)?.publicSegments ?? 0,
        suppressedSegmentCount: stakeholder.records.find((record) => record.questionId === question.id)?.suppressedSegments ?? 0,
      };
    }),
  };
}
