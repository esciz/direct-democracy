import type { Prisma, PrismaClient } from "@prisma/client";

/** Election fields are date-only UTC values; compare against Nevada's local day. */
export function currentElectionWhere(now = new Date()): Prisma.ElectionWhereInput {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { electionDate: { gte: new Date(`${day}T00:00:00Z`) }, status: { not: "COMPLETED" } };
}

export async function currentElectionQuestionWhere(db: Pick<PrismaClient, "election" | "candidate" | "ballotQuestion">, now = new Date()): Promise<Prisma.VoteQuestionWhereInput> {
  const election = currentElectionWhere(now);
  const [elections, candidates, ballots] = await Promise.all([
    db.election.findMany({ where: election, select: { id: true } }),
    db.candidate.findMany({ where: { election }, select: { id: true } }),
    db.ballotQuestion.findMany({ where: { election }, select: { id: true } }),
  ]);
  return {
    OR: [
      { civicEntityType: null },
      { civicEntityType: { notIn: ["ELECTION", "CANDIDATE", "BALLOT_MEASURE"] } },
      { civicEntityType: "ELECTION", civicEntityId: { in: elections.map(row => row.id) } },
      { civicEntityType: "CANDIDATE", civicEntityId: { in: candidates.map(row => row.id) } },
      { civicEntityType: "BALLOT_MEASURE", civicEntityId: { in: ballots.map(row => row.id) } },
    ],
  };
}
