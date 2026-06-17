import { CivicEntityType, CivicQuestionType, CivicRecordReviewStatus, type IssuePosition, type Prisma } from "@prisma/client";

import { getCanonicalIssueTextOrNull, slugifyIssueText } from "@/lib/issues/utils";
import { prisma } from "@/lib/prisma";
import type { PublicIssuePositionSummary } from "@/types/domain";

const PUBLIC_REVIEW_STATUSES = [CivicRecordReviewStatus.approved, CivicRecordReviewStatus.verified] as const;

const issuePositionInclude = {
  candidate: {
    include: {
      election: { select: { title: true } },
      office: { select: { title: true } },
      jurisdiction: { select: { name: true, slug: true } },
      source: { select: { name: true, url: true } },
    },
  },
  official: {
    include: {
      office: { select: { title: true } },
      jurisdiction: { select: { name: true, slug: true } },
      source: { select: { name: true, url: true } },
    },
  },
  source: { select: { name: true, url: true } },
  changes: { select: { id: true } },
} satisfies Prisma.IssuePositionInclude;

type IssuePositionRow = Prisma.IssuePositionGetPayload<{ include: typeof issuePositionInclude }>;

function publicWhere(): Prisma.IssuePositionWhereInput {
  return {
    reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
  };
}

function normalizeIssue(value: string) {
  const issueText = getCanonicalIssueTextOrNull(value) ?? value.trim();
  return {
    issueText,
    issueSlug: slugifyIssueText(issueText),
  };
}

function sourceNameFor(row: IssuePositionRow) {
  return row.evidenceSourceName ?? row.source?.name ?? row.candidate?.source?.name ?? row.official?.source?.name ?? "Imported public civic data";
}

function sourceUrlFor(row: IssuePositionRow) {
  return row.evidenceUrl ?? row.source?.url ?? row.candidate?.sourceUrl ?? row.candidate?.source?.url ?? row.official?.source?.url ?? null;
}

function mapPosition(row: IssuePositionRow): PublicIssuePositionSummary | null {
  const candidate = row.candidate;
  const official = row.official;

  if (!candidate && !official) {
    return null;
  }

  return {
    id: row.id,
    issueText: row.issueText,
    issueSlug: row.issueSlug,
    stance: row.stance,
    derivation: row.derivation,
    summary: row.summary,
    evidenceUrl: row.evidenceUrl,
    evidenceTitle: row.evidenceTitle,
    evidenceSourceName: row.evidenceSourceName,
    sourceName: sourceNameFor(row),
    sourceUrl: sourceUrlFor(row),
    confidenceScore: row.confidenceScore,
    reviewStatus: row.reviewStatus,
    verificationStatus: row.verificationStatus,
    positionDate: row.positionDate?.toISOString() ?? null,
    lastObservedAt: row.lastObservedAt.toISOString(),
    subject: candidate
      ? {
          id: candidate.id,
          type: "candidate",
          name: candidate.ballotName ?? candidate.fullName,
          href: `/candidates/${candidate.id}`,
          officeTitle: candidate.office?.title ?? candidate.election.title,
          partyText: candidate.partyText,
          jurisdictionName: candidate.jurisdiction.name,
        }
      : {
          id: official!.id,
          type: "official",
          name: official!.fullName,
          href: `/officials/${official!.id}`,
          officeTitle: official!.office.title,
          partyText: official!.partyText,
          jurisdictionName: official!.jurisdiction.name,
        },
    changeCount: row.changes.length,
  };
}

async function findPublicIssuePositions(where: Prisma.IssuePositionWhereInput) {
  const rows = await prisma.issuePosition.findMany({
    where: {
      AND: [publicWhere(), where],
    },
    include: issuePositionInclude,
    orderBy: [{ issueText: "asc" }, { confidenceScore: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return rows.map(mapPosition).filter((position): position is PublicIssuePositionSummary => Boolean(position));
}

export async function getCandidateIssuePositions(candidateOrProfileId: string) {
  return findPublicIssuePositions({
    OR: [
      { candidateId: candidateOrProfileId },
      { candidate: { publicProfileId: candidateOrProfileId } },
    ],
  });
}

export async function getOfficialIssuePositions(officialOrProfileId: string) {
  return findPublicIssuePositions({
    OR: [
      { officialId: officialOrProfileId },
      { official: { publicProfileId: officialOrProfileId } },
    ],
  });
}

export async function getIssuePositionsByIssue(issueTextOrSlug: string) {
  const normalized = normalizeIssue(issueTextOrSlug);
  return findPublicIssuePositions({
    OR: [
      { issueSlug: normalized.issueSlug },
      { issueText: normalized.issueText },
    ],
  });
}

function getScopeForJurisdiction(slug: string | null | undefined): "local" | "state" | "national" {
  if (slug === "nevada") return "state";
  if (slug === "united-states") return "national";
  return "local";
}

function questionTextFor(position: IssuePositionRow) {
  const subjectName = position.candidate?.ballotName ?? position.candidate?.fullName ?? position.official?.fullName ?? "this public figure";
  return `Do you agree with ${subjectName}'s sourced position on ${position.issueText}?`;
}

async function upsertIssuePositionVoteQuestion(position: IssuePositionRow) {
  const candidate = position.candidate;
  const official = position.official;
  const jurisdiction = candidate?.jurisdiction ?? official?.jurisdiction ?? null;
  const jurisdictionId = candidate?.jurisdictionId ?? official?.jurisdictionId ?? null;
  const subjectName = candidate?.ballotName ?? candidate?.fullName ?? official?.fullName ?? null;
  const sourceUrl = sourceUrlFor(position);
  const sourceName = sourceNameFor(position);

  if (!jurisdiction || !jurisdictionId || !subjectName || !sourceUrl) {
    return { created: 0, updated: 0, skipped: 1 };
  }

  await prisma.civicEntityReview.upsert({
    where: {
      entityType_entityId: {
        entityType: CivicEntityType.ISSUE_POSITION,
        entityId: position.id,
      },
    },
    create: {
      entityType: CivicEntityType.ISSUE_POSITION,
      entityId: position.id,
      entityName: `${subjectName}: ${position.issueText}`,
      jurisdictionId,
      sourceId: position.sourceId,
      sourceUrl,
      sourceName,
      reviewStatus: position.reviewStatus,
      verificationStatus: position.verificationStatus,
      confidenceScore: position.confidenceScore,
      summary: position.summary ?? `Sourced issue position on ${position.issueText}.`,
      lastUpdatedAt: position.updatedAt,
    },
    update: {
      entityName: `${subjectName}: ${position.issueText}`,
      jurisdictionId,
      sourceId: position.sourceId,
      sourceUrl,
      sourceName,
      reviewStatus: position.reviewStatus,
      verificationStatus: position.verificationStatus,
      confidenceScore: position.confidenceScore,
      summary: position.summary ?? `Sourced issue position on ${position.issueText}.`,
      lastUpdatedAt: position.updatedAt,
    },
  });

  const generationKey = `real:issue-position:${position.id}:review`;
  const existing = await prisma.voteQuestion.findFirst({
    where: { generationKey },
    select: { id: true },
  });

  const data = {
    questionText: questionTextFor(position),
    category: "civic" as const,
    scope: getScopeForJurisdiction(jurisdiction.slug),
    jurisdictionId,
    sourceId: position.sourceId,
    sourceUrl,
    sourceName,
    sourceLastUpdatedAt: position.lastObservedAt,
    civicEntityType: CivicEntityType.ISSUE_POSITION,
    civicEntityId: position.id,
    civicEntityName: subjectName,
    civicQuestionType: CivicQuestionType.ISSUE_POSITION_REVIEW,
    confidenceScore: position.confidenceScore,
    reviewStatus: position.reviewStatus,
    verificationStatus: position.verificationStatus,
    generatedFromRealData: true,
  };

  if (existing) {
    await prisma.voteQuestion.update({
      where: { id: existing.id },
      data,
    });
    return { created: 0, updated: 1, skipped: 0 };
  }

  await prisma.voteQuestion.create({
    data: {
      generationKey,
      ...data,
    },
  });

  return { created: 1, updated: 0, skipped: 0 };
}

export async function generateVoteQuestionsFromApprovedIssuePositions() {
  const rows = await prisma.issuePosition.findMany({
    where: {
      AND: [
        publicWhere(),
        {
          OR: [{ evidenceUrl: { not: null } }, { source: { isNot: null } }],
        },
      ],
    },
    include: issuePositionInclude,
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });

  const totals = { found: rows.length, created: 0, updated: 0, skipped: 0 };

  for (const row of rows) {
    const result = await upsertIssuePositionVoteQuestion(row);
    totals.created += result.created;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
  }

  return totals;
}

export function normalizeIssuePositionInput(input: Pick<IssuePosition, "issueText">) {
  return normalizeIssue(input.issueText);
}
