import "dotenv/config";

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const INPUT_PATH = path.join(process.cwd(), "data", "generated", "nevada-political-ad-coverage.json");
const AUDIT_PATH = path.join(process.cwd(), "data", "generated", "nevada-political-ad-coverage-audit.json");

type Coverage = {
  generatedAt: string;
  totals: Record<string, number>;
  records: Array<{
    entityType: "candidate" | "official";
    entityId: string;
    sourceRoutes: Array<{ sourceUrl: string }>;
    totals: {
      matchedRecords: number;
      creativeRecords: number;
      filingOnlyRecords: number;
      reportedSpend: number | null;
    };
    adIds: string[];
  }>;
};

function duplicates(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

async function main() {
  if (!existsSync(INPUT_PATH)) {
    throw new Error("Run ads:coverage before the statewide political-ad coverage audit.");
  }
  const coverage = JSON.parse(await readFile(INPUT_PATH, "utf8")) as Coverage;
  const [candidateIds, officialIds] = await Promise.all([
    prisma.candidate.findMany({ select: { id: true } }).then((records) => records.map((record) => record.id)),
    prisma.official
      .findMany({ where: { status: "CURRENT" }, select: { id: true } })
      .then((records) => records.map((record) => record.id)),
  ]);
  const expected = new Set([
    ...candidateIds.map((id) => `candidate:${id}`),
    ...officialIds.map((id) => `official:${id}`),
  ]);
  const actual = coverage.records.map((record) => `${record.entityType}:${record.entityId}`);
  const actualSet = new Set(actual);
  const missingEntities = [...expected].filter((key) => !actualSet.has(key));
  const unexpectedEntities = actual.filter((key) => !expected.has(key));
  const duplicateEntities = [...new Set(duplicates(actual))];
  const missingSourceRoutes = coverage.records
    .filter((record) => !record.sourceRoutes.length || record.sourceRoutes.some((source) => !source.sourceUrl))
    .map((record) => `${record.entityType}:${record.entityId}`);
  const falseZeroSpend = coverage.records
    .filter((record) => !record.adIds.length && record.totals.reportedSpend === 0)
    .map((record) => `${record.entityType}:${record.entityId}`);
  const reconciliationWarnings = coverage.records
    .filter(
      (record) =>
        record.totals.matchedRecords !== record.adIds.length ||
        record.totals.matchedRecords !== record.totals.creativeRecords + record.totals.filingOnlyRecords,
    )
    .map((record) => `${record.entityType}:${record.entityId}`);
  const failures = [
    missingEntities.length ? `${missingEntities.length} candidates or current officials are missing ad coverage rows.` : null,
    unexpectedEntities.length ? `${unexpectedEntities.length} unexpected ad coverage rows are present.` : null,
    duplicateEntities.length ? `${duplicateEntities.length} duplicate entity coverage rows are present.` : null,
    missingSourceRoutes.length ? `${missingSourceRoutes.length} entity rows are missing ad source routes.` : null,
    falseZeroSpend.length ? `${falseZeroSpend.length} empty ad matches are represented as zero spend.` : null,
    reconciliationWarnings.length ? `${reconciliationWarnings.length} entity ad counts do not reconcile.` : null,
  ].filter((entry): entry is string => Boolean(entry));
  const output = {
    generatedAt: new Date().toISOString(),
    coverageGeneratedAt: coverage.generatedAt,
    strictPassed: failures.length === 0,
    totals: {
      ...coverage.totals,
      expectedEntities: expected.size,
      auditedEntities: coverage.records.length,
      missingEntities: missingEntities.length,
      unexpectedEntities: unexpectedEntities.length,
      duplicateEntities: duplicateEntities.length,
      missingSourceRoutes: missingSourceRoutes.length,
      falseZeroSpend: falseZeroSpend.length,
      reconciliationWarnings: reconciliationWarnings.length,
    },
    gaps: {
      missingEntities,
      unexpectedEntities,
      duplicateEntities,
      missingSourceRoutes,
      falseZeroSpend,
      reconciliationWarnings,
      noMatchedRecordEntities: coverage.records
        .filter((record) => !record.adIds.length)
        .map((record) => `${record.entityType}:${record.entityId}`),
    },
    failures,
  };
  await writeFile(AUDIT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output.totals, null, 2));
  console.log(`Strict coverage: ${output.strictPassed ? "passed" : "failed"}`);
  if (process.argv.includes("--strict") && !output.strictPassed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
