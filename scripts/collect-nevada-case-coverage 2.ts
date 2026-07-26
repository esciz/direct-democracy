import "dotenv/config";

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { CivicRecordReviewStatus, CourtCasePublicVisibilityStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "data", "seed", "nevada-case-source-catalog.json");
const RUNTIME_PATH = path.join(ROOT, "data", "generated", "public-court-cases-runtime.json");
const OUTPUT_PATH = path.join(ROOT, "data", "generated", "nevada-case-coverage.json");

type CatalogSource = {
  id: string;
  name: string;
  authority: string;
  recordClass: string;
  courtLevels: string[];
  jurisdictions: string[];
  sourceUrl: string;
  accessMethod: string;
  collectionStatus: string;
  cadenceDays: number;
  privacyRule: string;
};

type Catalog = {
  version: number;
  updatedAt: string;
  requiredCounties: string[];
  sources: CatalogSource[];
};

type RuntimeCase = {
  id: string;
  caseNumber?: string | null;
  sourceUrl?: string | null;
  courtName?: string | null;
  jurisdictionName?: string | null;
  courtLevel?: string | null;
  reviewStatus?: string | null;
  publicVisibilityStatus?: string | null;
  isRealCourtRecord?: boolean;
  metadata?: {
    federalCourtLayer?: string | null;
  } | null;
};

type RuntimeFile = {
  records?: RuntimeCase[];
};

type SourceHealth = {
  checkedAt: string;
  ok: boolean;
  status: number | null;
  finalUrl: string;
  error: string | null;
};

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function federalCourtLayer(record: RuntimeCase) {
  const explicitLayer = normalize(record.metadata?.federalCourtLayer ?? "");
  const courtName = normalize(record.courtName ?? "");
  const sourceUrl = normalize(record.sourceUrl ?? "");
  if (
    explicitLayer === "us supreme" ||
    courtName.includes("supreme court of the united states") ||
    sourceUrl.includes("supremecourt gov")
  ) {
    return "us_supreme";
  }
  if (
    explicitLayer === "circuit appellate" ||
    courtName.includes("court of appeals") ||
    courtName.includes("ninth circuit") ||
    sourceUrl.includes("ca9 uscourts gov")
  ) {
    return "circuit_appellate";
  }
  return record.courtLevel === "federal" ? "district" : null;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function checkSource(source: CatalogSource): Promise<SourceHealth> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(source.sourceUrl, {
      method: "GET",
      headers: {
        accept: "text/html,application/json;q=0.9,*/*;q=0.5",
        "user-agent": "Direct Democracy Nevada public-case source monitor (admin@directyourdemocracy.com)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    await response.body?.cancel();
    return {
      checkedAt,
      ok: response.ok || response.status === 403,
      status: response.status,
      finalUrl: response.url || source.sourceUrl,
      error: response.ok || response.status === 403 ? null : `${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      checkedAt,
      ok: false,
      status: null,
      finalUrl: source.sourceUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const catalog = await readJson<Catalog>(CATALOG_PATH, {
    version: 0,
    updatedAt: "",
    requiredCounties: [],
    sources: [],
  });
  const runtime = await readJson<RuntimeFile>(RUNTIME_PATH, { records: [] });
  const previous = await readJson<{ sources?: Array<{ id: string; health?: SourceHealth }> }>(OUTPUT_PATH, {});
  const previousHealth = new Map((previous.sources ?? []).map((source) => [source.id, source.health]));
  const allowNetwork = !hasFlag("--no-network") && process.env.DATAOPS_NETWORK_ENABLED !== "false";

  const dbRows = await prisma.courtCase.findMany({
    where: {
      reviewStatus: { in: [CivicRecordReviewStatus.approved, CivicRecordReviewStatus.verified] },
      publicVisibilityStatus: CourtCasePublicVisibilityStatus.public,
    },
    select: {
      id: true,
      caseNumber: true,
      sourceUrl: true,
      jurisdiction: true,
      courtLevel: true,
      reviewStatus: true,
      publicVisibilityStatus: true,
      courtJurisdiction: { select: { name: true } },
    },
  });
  const published = new Map<string, RuntimeCase>();
  for (const row of dbRows) {
    const key = `${normalize(row.courtJurisdiction.name)}:${row.caseNumber}`;
    published.set(key, {
      id: row.id,
      caseNumber: row.caseNumber,
      sourceUrl: row.sourceUrl,
      courtName: row.courtJurisdiction.name,
      jurisdictionName: row.jurisdiction,
      courtLevel: row.courtLevel,
      reviewStatus: row.reviewStatus,
      publicVisibilityStatus: row.publicVisibilityStatus,
      isRealCourtRecord: true,
    });
  }
  for (const row of runtime.records ?? []) {
    if (
      row.isRealCourtRecord &&
      row.reviewStatus === "approved" &&
      row.publicVisibilityStatus === "public"
    ) {
      const key = row.caseNumber ? `${normalize(row.courtName ?? "")}:${row.caseNumber}` : row.id;
      published.set(key, row);
    }
  }

  const sourceRecords = [];
  for (const source of catalog.sources) {
    const health = allowNetwork ? await checkSource(source) : previousHealth.get(source.id) ?? null;
    const sourceNeedle = normalize(source.sourceUrl);
    const relatedCases = [...published.values()].filter((record) => {
      const url = normalize(record.sourceUrl ?? "");
      if (source.id === "nevada-appellate-advance-opinions") {
        return record.courtLevel === "state" || record.courtLevel === "appellate" || url.includes("nvcourts");
      }
      if (source.id === "ninth-circuit-nevada-opinions") {
        return federalCourtLayer(record) === "circuit_appellate";
      }
      if (source.id === "us-supreme-court-nevada-cases") {
        return federalCourtLayer(record) === "us_supreme";
      }
      return Boolean(url && sourceNeedle && (url.includes(sourceNeedle) || sourceNeedle.includes(url)));
    });
    sourceRecords.push({
      ...source,
      health,
      publishedCaseCount: relatedCases.length,
      coverageLayer: relatedCases.length ? "published_records" : "source_route",
    });
  }

  const counties = catalog.requiredCounties.map((county) => {
    const sources = catalog.sources.filter((source) =>
      source.jurisdictions.some((jurisdiction) => normalize(jurisdiction) === normalize(county)),
    );
    const records = [...published.values()].filter((record) =>
      normalize(record.jurisdictionName ?? "").includes(normalize(county)),
    );
    return {
      county,
      sourceRouteCount: sources.length,
      publishedCaseCount: records.length,
      status: records.length ? "records_published" : sources.length ? "source_routes_registered" : "missing_source_route",
      sourceIds: sources.map((source) => source.id),
    };
  });

  const records = [...published.values()];
  const stateAppellateCases = records.filter(
    (record) => record.courtLevel === "state" || record.courtLevel === "appellate",
  ).length;
  const federalDistrictCases = records.filter((record) => federalCourtLayer(record) === "district").length;
  const federalCircuitCases = records.filter((record) => federalCourtLayer(record) === "circuit_appellate").length;
  const supremeCourtCases = records.filter((record) => federalCourtLayer(record) === "us_supreme").length;
  const output = {
    generatedAt: new Date().toISOString(),
    catalogVersion: catalog.version,
    sourceCatalogUpdatedAt: catalog.updatedAt,
    collectionPolicy: {
      schedule: "Daily source monitoring with weekly source-route review; public records publish only after privacy and visibility review.",
      publicationBoundary:
        "A court directory or search route proves where records may be found. It does not prove that all cases are collected or safe to publish.",
      excluded:
        "Sealed, confidential, juvenile, protected, adoption, guardianship, and other non-public records are never eligible for the public repository.",
    },
    totals: {
      sourceRoutes: sourceRecords.length,
      reachableSourceRoutes: sourceRecords.filter((source) => source.health?.ok).length,
      requiredCounties: counties.length,
      countiesWithSourceRoutes: counties.filter((county) => county.sourceRouteCount > 0).length,
      publishedPublicCases: records.length,
      appellateCases: stateAppellateCases,
      stateAppellateCases,
      localTrialCases: records.filter((record) => record.courtLevel === "local" || record.courtLevel === "district").length,
      federalCases: federalDistrictCases + federalCircuitCases + supremeCourtCases,
      federalDistrictCases,
      federalCircuitCases,
      supremeCourtCases,
      administrativeCases: records.filter((record) => record.courtLevel === "administrative").length,
    },
    sources: sourceRecords,
    counties,
    publishedRecords: records.map((record) => ({
      id: record.id,
      caseNumber: record.caseNumber ?? null,
      courtName: record.courtName ?? null,
      courtLevel: record.courtLevel ?? null,
      federalCourtLayer: federalCourtLayer(record),
      jurisdictionName: record.jurisdictionName ?? null,
      sourceUrl: record.sourceUrl ?? null,
      reviewStatus: record.reviewStatus ?? null,
      publicVisibilityStatus: record.publicVisibilityStatus ?? null,
    })),
  };
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output.totals, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
