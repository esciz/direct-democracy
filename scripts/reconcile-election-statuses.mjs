#!/usr/bin/env node

import { ElectionStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const completed = await prisma.election.updateMany({
    where: {
      electionDate: { lt: todayUtc },
      status: { not: ElectionStatus.COMPLETED },
    },
    data: { status: ElectionStatus.COMPLETED },
  });

  console.log(JSON.stringify({ cutoff: todayUtc.toISOString(), completed: completed.count }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
