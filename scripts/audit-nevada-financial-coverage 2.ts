import "dotenv/config";

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const INPUT_PATH = path.join(process.cwd(), "data", "generated", "nevada-financial-coverage.json");
const AUDIT_PATH = path.join(process.cwd(), "data", "generated", "nevada-financial-coverage-audit.json");

type CoverageRecord = {
  entityType: "candidate" | "official";
  entityId: string;
  name: string;
  office: string;
  campaignFinance: {
    primarySourceId: string;
    primarySourceUrl: string;
    status: "verified_totals" | "derived_totals" | "source_matched_pending_extraction" | "source_registered";
    snapshot: unknown | null;
    aggregateSourceUrl: string | null;
    topContributors: unknown[];
  };
  personalFinancialDisclosure: {
    sourceId: string;
    sourceUrl: string;
    status: "matched_filings" | "source_registered";
    filings: unknown[];
  };
};

type CoverageFile = {
  generatedAt: string;
  records: CoverageRecord[];
};

function duplicateValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

async function main() {
  if (!existsSync(INPUT_PATH)) {
    throw new Error("Run npm run financials:nevada:collect before the financial coverage audit.");
  }
  const coverage = JSON.parse(await readFile(INPUT_PATH, "utf8")) as CoverageFile;
  const [candidateIds, officialIds] = await Promise.all([
    prisma.candidate.findMany({ select: { id: true } }).then((records) => records.map((record) => record.id)),
    prisma.official.findMany({ where: { status: "CURRENT" }, select: { id: true } }).then((records) => records.map((record) => record.id)),
  ]);
  const expectedKeys = new Set([
    ...candidateIds.map((id) => `candidate:${id}`),
    ...officialIds.map((id) => `official:${id}`),
  ]);
  const actualKeys = coverage.records.map((record) => `${record.entityType}:${record.entityId}`);
  const actualKeySet = new Set(actualKeys);
  const missingEntities = [...expectedKeys].filter((key) => !actualKeySet.has(key));
  const unexpectedEntities = actualKeys.filter((key) => !expectedKeys.has(key));
  const duplicateEntities = duplicateValues(actualKeys);
  const missingCampaignSources = coverage.records
    .filter((record) => !record.campaignFinance.primarySourceId || !record.campaignFinance.primarySourceUrl)
    .map((record) => `${record.entityType}:${record.entityId}`);
  const missingDisclosureSources = coverage.records
    .filter((record) => !record.personalFinancialDisclosure.sourceId || !record.personalFinancialDisclosure.sourceUrl)
    .map((record) => `${record.entityType}:${record.entityId}`);
  const invalidZeroSubstitutions = coverage.records
    .filter(
      (record) =>
        !record.campaignFinance.snapshot &&
        (record.campaignFinance as unknown as { totalRaised?: unknown }).totalRaised === 0,
    )
    .map((record) => `${record.entityType}:${record.entityId}`);
  const candidates = coverage.records.filter((record) => record.entityType === "candidate");
  const officials = coverage.records.filter((record) => record.entityType === "official");
  const aggregateReconciliationWarnings = coverage.records.flatMap((record) => {
    const campaign = record.campaignFinance as CoverageRecord["campaignFinance"] & {
      cycleHistory?: Array<{ totalRaised?: number; totalSpent?: number }>;
      allReportedTotals?: { totalRaised?: number; totalSpent?: number } | null;
    };
    if (!campaign.allReportedTotals || !campaign.cycleHistory?.length) return [];
    const cycleRaised = campaign.cycleHistory.reduce((sum, cycle) => sum + (Number(cycle.totalRaised) || 0), 0);
    const cycleSpent = campaign.cycleHistory.reduce((sum, cycle) => sum + (Number(cycle.totalSpent) || 0), 0);
    const allRaised = Number(campaign.allReportedTotals.totalRaised) || 0;
    const allSpent = Number(campaign.allReportedTotals.totalSpent) || 0;
    const raisedTolerance = Math.max(5, Math.abs(allRaised) * 0.001);
    const spentTolerance = Math.max(5, Math.abs(allSpent) * 0.001);
    if (Math.abs(allRaised - cycleRaised) <= raisedTolerance && Math.abs(allSpent - cycleSpent) <= spentTolerance) return [];
    return [{
      entityType: record.entityType,
      entityId: record.entityId,
      name: record.name,
      allReportedRaised: allRaised,
      itemizedCycleRaised: cycleRaised,
      allReportedSpent: allSpent,
      itemizedCycleSpent: cycleSpent,
    }];
  });
  const totals = {
    expectedEntities: expectedKeys.size,
    expectedCandidates: candidateIds.length,
    expectedCurrentOfficials: officialIds.length,
    auditedEntities: coverage.records.length,
    auditedCandidates: candidates.length,
    auditedCurrentOfficials: officials.length,
    campaignSourcesRegistered: coverage.records.filter((record) => record.campaignFinance.primarySourceUrl).length,
    campaignTotalsAvailable: coverage.records.filter((record) => record.campaignFinance.snapshot).length,
    candidateTotalsAvailable: candidates.filter((record) => record.campaignFinance.snapshot).length,
    officialTotalsAvailable: officials.filter((record) => record.campaignFinance.snapshot).length,
    verifiedFecTotals: coverage.records.filter((record) => record.campaignFinance.status === "verified_totals").length,
    derivedNevadaTotals: coverage.records.filter((record) => record.campaignFinance.status === "derived_totals").length,
    aggregateMatchesPendingExtraction: coverage.records.filter((record) => record.campaignFinance.status === "source_matched_pending_extraction").length,
    sourceRoutesOnly: coverage.records.filter((record) => record.campaignFinance.status === "source_registered").length,
    disclosureSourcesRegistered: coverage.records.filter((record) => record.personalFinancialDisclosure.sourceUrl).length,
    disclosureFilingsMatched: coverage.records.filter((record) => record.personalFinancialDisclosure.filings.length).length,
    contributorSamplesAvailable: coverage.records.filter((record) => record.campaignFinance.topContributors.length).length,
    missingEntities: missingEntities.length,
    unexpectedEntities: unexpectedEntities.length,
    duplicateEntities: duplicateEntities.length,
    missingCampaignSources: missingCampaignSources.length,
    missingDisclosureSources: missingDisclosureSources.length,
    invalidZeroSubstitutions: invalidZeroSubstitutions.length,
    aggregateReconciliationWarnings: aggregateReconciliationWarnings.length,
  };
  const strictFailures =
    missingEntities.length +
    unexpectedEntities.length +
    duplicateEntities.length +
    missingCampaignSources.length +
    missingDisclosureSources.length +
    invalidZeroSubstitutions.length +
    aggregateReconciliationWarnings.length;
  const output = {
    generatedAt: new Date().toISOString(),
    coverageGeneratedAt: coverage.generatedAt,
    strictPassed: strictFailures === 0,
    totals,
    gaps: {
      missingEntities,
      unexpectedEntities,
      duplicateEntities,
      missingCampaignSources,
      missingDisclosureSources,
      invalidZeroSubstitutions,
      aggregateReconciliationWarnings,
      extractionBacklog: coverage.records
        .filter((record) => !record.campaignFinance.snapshot)
        .map((record) => ({
          entityType: record.entityType,
          entityId: record.entityId,
          name: record.name,
          office: record.office,
          status: record.campaignFinance.status,
          aggregateSourceUrl: record.campaignFinance.aggregateSourceUrl,
        })),
    },
  };
  await writeFile(AUDIT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(totals, null, 2));
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
