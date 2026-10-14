import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const INPUT_PATH = path.join(process.cwd(), "data", "generated", "nevada-case-coverage.json");
const AUDIT_PATH = path.join(process.cwd(), "data", "generated", "nevada-case-coverage-audit.json");

type Coverage = {
  generatedAt: string;
  totals: Record<string, number>;
  sources: Array<{ id: string; publishedCaseCount: number }>;
  counties: Array<{ county: string; sourceRouteCount: number; status: string }>;
  publishedRecords: Array<{
    id: string;
    caseNumber: string | null;
    courtName: string | null;
    federalCourtLayer: string | null;
    sourceUrl: string | null;
    reviewStatus: string | null;
    publicVisibilityStatus: string | null;
  }>;
};

async function main() {
  if (!existsSync(INPUT_PATH)) {
    throw new Error("Run cases:nevada:collect before the Nevada case coverage audit.");
  }
  const coverage = JSON.parse(await readFile(INPUT_PATH, "utf8")) as Coverage;
  const missingCountyRoutes = coverage.counties
    .filter((county) => county.sourceRouteCount === 0)
    .map((county) => county.county);
  const invalidPublishedRecords = coverage.publishedRecords
    .filter(
      (record) =>
        !record.caseNumber ||
        !record.sourceUrl ||
        record.reviewStatus !== "approved" ||
        record.publicVisibilityStatus !== "public",
    )
    .map((record) => record.id);
  const demoRecordIds = coverage.publishedRecords
    .filter((record) => record.id === "case_carson_meeting_access" || record.id === "case_public_lands_notice")
    .map((record) => record.id);
  const duplicateRecordIds = coverage.publishedRecords
    .map((record) => record.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  const duplicateCourtCaseKeys = coverage.publishedRecords
    .map((record) => (record.caseNumber && record.courtName ? `${record.courtName}:${record.caseNumber}` : null))
    .filter((caseKey): caseKey is string => Boolean(caseKey))
    .filter((caseKey, index, caseKeys) => caseKeys.indexOf(caseKey) !== index);
  const requiredFederalSources = ["ninth-circuit-nevada-opinions", "us-supreme-court-nevada-cases"];
  const sourceIds = new Set(coverage.sources.map((source) => source.id));
  const missingFederalSourceRoutes = requiredFederalSources.filter((sourceId) => !sourceIds.has(sourceId));
  const missingFederalRecordLayers = [
    coverage.totals.federalCircuitCases > 0 ? null : "Ninth Circuit",
    coverage.totals.supremeCourtCases > 0 ? null : "U.S. Supreme Court",
  ].filter((entry): entry is string => Boolean(entry));
  const failures = [
    missingCountyRoutes.length ? `${missingCountyRoutes.length} Nevada counties lack a registered court source route.` : null,
    invalidPublishedRecords.length ? `${invalidPublishedRecords.length} public case records fail the source/review/visibility gate.` : null,
    demoRecordIds.length ? `${demoRecordIds.length} invented demo case records are present in the public repository.` : null,
    duplicateRecordIds.length ? `${duplicateRecordIds.length} duplicate public case IDs are present.` : null,
    duplicateCourtCaseKeys.length ? `${duplicateCourtCaseKeys.length} duplicate court-plus-case-number keys are present.` : null,
    missingFederalSourceRoutes.length ? `${missingFederalSourceRoutes.length} required federal appellate source routes are missing.` : null,
    missingFederalRecordLayers.length ? `${missingFederalRecordLayers.join(" and ")} reviewed Nevada-connected records are missing.` : null,
  ].filter((entry): entry is string => Boolean(entry));
  const output = {
    generatedAt: new Date().toISOString(),
    coverageGeneratedAt: coverage.generatedAt,
    strictPassed: failures.length === 0,
    totals: {
      ...coverage.totals,
      missingCountyRoutes: missingCountyRoutes.length,
      invalidPublishedRecords: invalidPublishedRecords.length,
      demoRecords: demoRecordIds.length,
      duplicateRecordIds: duplicateRecordIds.length,
      duplicateCourtCaseKeys: duplicateCourtCaseKeys.length,
      missingFederalSourceRoutes: missingFederalSourceRoutes.length,
      missingFederalRecordLayers: missingFederalRecordLayers.length,
    },
    gaps: {
      missingCountyRoutes,
      invalidPublishedRecords,
      demoRecordIds,
      duplicateRecordIds,
      duplicateCourtCaseKeys,
      missingFederalSourceRoutes,
      missingFederalRecordLayers,
    },
    failures,
  };
  await writeFile(AUDIT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output.totals, null, 2));
  console.log(`Strict coverage: ${output.strictPassed ? "passed" : "failed"}`);
  if (process.argv.includes("--strict") && !output.strictPassed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
