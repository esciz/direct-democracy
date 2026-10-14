#!/usr/bin/env node

import { CivicEntityType, CivicRecordReviewStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [sources, casesPending, casesApproved, casesVerified, privacyPending, documentsPending, duplicateGroups] = await Promise.all([
    prisma.courtJurisdiction.count(),
    prisma.courtCase.count({ where: { reviewStatus: CivicRecordReviewStatus.pending_review } }),
    prisma.courtCase.count({ where: { reviewStatus: CivicRecordReviewStatus.approved } }),
    prisma.courtCase.count({ where: { reviewStatus: CivicRecordReviewStatus.verified } }),
    prisma.courtCase.count({ where: { publicVisibilityStatus: "pending_privacy_review" } }),
    prisma.courtDocument.count({ where: { reviewStatus: CivicRecordReviewStatus.pending_review } }),
    prisma.courtCase.groupBy({
      by: ["caseNumber"],
      _count: { _all: true },
      having: { caseNumber: { _count: { gt: 1 } } },
      orderBy: { caseNumber: "asc" },
      take: 25,
    }),
  ]);

  console.log(JSON.stringify({
    review: "court-cases",
    courtSources: sources,
    cases: {
      pendingReview: casesPending,
      approved: casesApproved,
      verified: casesVerified,
      privacyPending,
    },
    documentsPending,
    duplicateCaseNumbers: duplicateGroups.map((entry) => ({ caseNumber: entry.caseNumber, count: entry._count._all })),
    nextStep: "Open /admin/data-factory/cases to inspect source registry, privacy warnings, duplicates, and pending review.",
    reviewQueueItems: await prisma.reviewQueueItem.count({ where: { entityType: CivicEntityType.COURT_CASE } }),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
