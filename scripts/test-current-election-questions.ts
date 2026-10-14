import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { currentElectionQuestionWhere, currentElectionWhere } from "../lib/feed/current-election-questions";

async function main() {
  const now = new Date("2026-09-20T04:00:00Z");
  const cutoff = currentElectionWhere(now);
  assert.deepEqual(cutoff, { electionDate: { gte: new Date("2026-09-19T00:00:00Z") }, status: { not: "COMPLETED" } });
  assert.deepEqual(currentElectionWhere(new Date("2026-11-04T07:30:00Z")), { electionDate: { gte: new Date("2026-11-03T00:00:00Z") }, status: { not: "COMPLETED" } }, "Election day remains open until local midnight");
  const calls: unknown[] = [];
  const fake = Object.fromEntries(["election", "candidate", "ballotQuestion"].map(name => [name, { findMany: async (query: unknown) => { calls.push(query); return [{ id: `current-${name}` }]; } }])) as unknown as Pick<PrismaClient, "election" | "candidate" | "ballotQuestion">;
  const where = await currentElectionQuestionWhere(fake, now);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls, [{ where: cutoff, select: { id: true } }, { where: { election: cutoff }, select: { id: true } }, { where: { election: cutoff }, select: { id: true } }]);
  assert.deepEqual(where.OR, [
    { civicEntityType: null },
    { civicEntityType: { notIn: ["ELECTION", "CANDIDATE", "BALLOT_MEASURE"] } },
    { civicEntityType: "ELECTION", civicEntityId: { in: ["current-election"] } },
    { civicEntityType: "CANDIDATE", civicEntityId: { in: ["current-candidate"] } },
    { civicEntityType: "BALLOT_MEASURE", civicEntityId: { in: ["current-ballotQuestion"] } },
  ]);
  assert.match(readFileSync("app/voting/history/page.tsx", "utf8"), /getVotingLibrary\(user,.*true\)/, "History must opt into retained historical questions");
  console.log("Current-election queue and retained-history tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
