import { CivicRecordReviewStatus, ElectionResultStatus, ProfileEnrichmentReviewStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const APPROVED_KNOWLEDGE = [ProfileEnrichmentReviewStatus.APPROVED, ProfileEnrichmentReviewStatus.VERIFIED];

export type CandidateEnrichmentPriorityRow = {
  id: string;
  name: string;
  race: string;
  electionDate: string;
  electionStatus: string;
  score: number;
  missingFields: string[];
  sourceName: string;
  sourceReadiness: "verified_results" | "reviewed_results" | "reviewed_advancement" | "filing_only" | "historical_unverified";
  sourceReadinessLabel: string;
  suggestedSearchQuery: string;
};

function textIncludes(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function hasArrayJson(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

export async function getHighPriorityCandidateEnrichmentQueue(limit = 25): Promise<CandidateEnrichmentPriorityRow[]> {
  const candidates = await prisma.candidate.findMany({
    include: {
      election: {
        select: {
          id: true,
          title: true,
          electionDate: true,
          status: true,
          source: { select: { name: true } },
        },
      },
      office: { select: { title: true } },
      jurisdiction: { select: { name: true, slug: true } },
      district: { select: { name: true } },
      source: { select: { name: true, adapterKey: true } },
      knowledgeEnrichments: {
        where: { reviewStatus: { in: APPROVED_KNOWLEDGE } },
        select: {
          aboutSummary: true,
          ownWordsSummary: true,
          issues: true,
          financeContext: true,
          socialLinks: true,
        },
      },
      issuePositions: {
        where: {
          reviewStatus: { in: [CivicRecordReviewStatus.approved, CivicRecordReviewStatus.verified] },
        },
        select: { id: true },
        take: 1,
      },
      results: { select: { id: true, resultStatus: true }, take: 1 },
      newsMentions: { select: { id: true }, take: 1 },
      campaignFinanceFilings: { select: { id: true }, take: 1 },
    },
    orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
    take: 500,
  });

  const raceCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = [candidate.electionId, candidate.officeId ?? candidate.office?.title ?? "office", candidate.districtId ?? candidate.district?.name ?? "district"].join("|");
    raceCounts.set(key, (raceCounts.get(key) ?? 0) + 1);
  }

  const now = new Date();
  return candidates
    .map((candidate) => {
      const officeTitle = candidate.office?.title ?? candidate.election.title;
      const name = candidate.ballotName ?? candidate.fullName;
      const raceKey = [candidate.electionId, candidate.officeId ?? candidate.office?.title ?? "office", candidate.districtId ?? candidate.district?.name ?? "district"].join("|");
      const approvedKnowledge = candidate.knowledgeEnrichments;
      const missingFields = [
        Boolean(candidate.campaignStatement) || approvedKnowledge.some((entry) => entry.aboutSummary) ? null : "bio",
        candidate.websiteUrl ? null : "website",
        Boolean(candidate.campaignStatement) || approvedKnowledge.some((entry) => entry.ownWordsSummary) ? null : "candidate statement",
        candidate.issuePositions.length || approvedKnowledge.some((entry) => hasArrayJson(entry.issues)) ? null : "issue priorities",
        candidate.campaignFinanceFilings.length || approvedKnowledge.some((entry) => entry.financeContext) ? null : "campaign finance",
        candidate.newsMentions.length ? null : "news mentions",
        hasArrayJson(candidate.socialLinks) || approvedKnowledge.some((entry) => hasArrayJson(entry.socialLinks)) ? null : "social links",
      ].filter((field): field is string => Boolean(field));

      const contested = (raceCounts.get(raceKey) ?? 0) > 1;
      const statewide = candidate.jurisdiction.slug === "nevada" || candidate.jurisdiction.name.toLowerCase() === "nevada";
      const federalOrState = textIncludes(officeTitle, [
        "u.s.",
        "us senate",
        "congress",
        "representative",
        "governor",
        "attorney general",
        "secretary of state",
        "treasurer",
        "controller",
        "assembly",
        "senate",
      ]);
      const judicial = textIncludes(officeTitle, ["judge", "court", "justice"]);
      const upcoming = candidate.election.electionDate ? candidate.election.electionDate >= now : false;
      const hasVerifiedResult = candidate.results.some(
        (result) => result.resultStatus === ElectionResultStatus.OFFICIAL || result.resultStatus === ElectionResultStatus.CERTIFIED,
      );
      const hasReviewedResult = candidate.results.length > 0;
      const hasReviewedAdvancement = candidate.source?.adapterKey === "manual-reviewed-election-result-bridge";
      const historicalWithoutResult = !hasReviewedResult && (candidate.election.status === "COMPLETED" || candidate.election.electionDate < now);
      const sourceReadiness: CandidateEnrichmentPriorityRow["sourceReadiness"] = hasVerifiedResult
        ? "verified_results"
        : hasReviewedResult
          ? "reviewed_results"
          : hasReviewedAdvancement
            ? "reviewed_advancement"
        : historicalWithoutResult
          ? "historical_unverified"
          : "filing_only";
      const sourceReadinessLabel = hasVerifiedResult
        ? "Official result linked"
        : hasReviewedResult
          ? "Reviewed result, certification pending"
          : hasReviewedAdvancement
            ? "Reviewed advancement, certification pending"
        : historicalWithoutResult
          ? "Past election, result missing"
          : "Filing only, not certified";
      const zeroDetails = missingFields.length >= 6;
      const score =
        (statewide ? 100 : 0) +
        (candidate.isIncumbent ? 90 : 0) +
        (candidate.status === "WON" ? 35 : 0) +
        (federalOrState ? 70 : 0) +
        (contested ? 50 : 0) +
        (judicial ? 40 : 0) +
        (upcoming ? 30 : 0) +
        (["filing_only", "reviewed_advancement"].includes(sourceReadiness) ? 80 : 0) +
        (sourceReadiness === "historical_unverified" ? -80 : 0) +
        (zeroDetails ? 60 : 0) +
        missingFields.length * 4;

      return {
        id: candidate.id,
        name,
        race: `${officeTitle} · ${candidate.jurisdiction.name}${candidate.district?.name ? ` · ${candidate.district.name}` : ""}`,
        electionDate: candidate.election.electionDate.toISOString(),
        electionStatus: candidate.election.status,
        score,
        missingFields,
        sourceName: candidate.source?.name ?? candidate.election.source?.name ?? "No linked source",
        sourceReadiness,
        sourceReadinessLabel,
        suggestedSearchQuery: `"${name}" ${officeTitle} Nevada`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
