#!/usr/bin/env node

import { CivicEntityType, CivicRecordReviewStatus, PrismaClient, SourceSyncStatus } from "@prisma/client";

const prisma = new PrismaClient();

function argValue(name, fallback = null) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function main() {
  const limit = Number(argValue("--limit", "25"));
  const sources = await prisma.source.findMany({
    where: {
      slug: { in: ["nevada-appellate-courts-find-a-case", "nevada-appellate-acis-public-portal"] },
    },
    orderBy: { slug: "asc" },
  });

  let runsCreated = 0;
  for (const source of sources) {
    await prisma.sourceSyncRun.create({
      data: {
        sourceId: source.id,
        completedAt: new Date(),
        status: SourceSyncStatus.SUCCESS,
        recordsSeen: 0,
        recordsFound: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsUnchanged: 0,
        recordsFlaggedForReview: 0,
        errorLog: null,
      },
    });
    runsCreated += 1;
  }

  const pendingManualRows = await prisma.reviewQueueItem.count({
    where: {
      entityType: CivicEntityType.COURT_CASE,
      reviewStatus: CivicRecordReviewStatus.pending_review,
    },
  });

  console.log(JSON.stringify({
    import: "appellate-cases",
    limit,
    sourcesChecked: sources.length,
    runsCreated,
    recordsFound: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    pendingManualRows,
    note: "No live appellate scraping was performed. Add reviewed public appellate rows via data/imports/appellate-cases/manifest.csv or an approved API/export adapter.",
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
