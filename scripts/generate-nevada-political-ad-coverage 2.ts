import "dotenv/config";

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import type { PoliticalAd } from "@/types/domain";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const ADS_PATH = path.join(ROOT, "data", "generated", "nevada-political-ads.json");
const FINANCIAL_COVERAGE_PATH = path.join(ROOT, "data", "generated", "nevada-financial-coverage.json");
const SOURCE_CATALOG_PATH = path.join(ROOT, "data", "seed", "nevada-political-ad-source-catalog.json");
const OUTPUT_PATH = path.join(ROOT, "data", "generated", "nevada-political-ad-coverage.json");

type AdsFile = {
  generatedAt?: string;
  ads?: PoliticalAd[];
};

type SourceCatalog = {
  version: number;
  updatedAt: string;
  historicalCycles: number[];
  sources: Array<{
    id: string;
    name: string;
    authority: string;
    coverage: string;
    sourceUrl: string;
    accessMethod: string;
    collectionStatus: string;
    cadenceDays: number;
    creativeCoverage: boolean;
  }>;
};

type FinancialCoverage = {
  records?: Array<{
    entityType: "candidate" | "official";
    entityId: string;
    campaignFinance?: { fecCandidateId?: string | null };
  }>;
};

type Entity = {
  entityType: "candidate" | "official";
  entityId: string;
  name: string;
  office: string;
  jurisdiction: string;
  fecCandidateId: string | null;
};

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function normalizeName(value: string) {
  const commaParts = value.split(",").map((part) => part.trim());
  const reordered = commaParts.length === 2 ? `${commaParts[1]} ${commaParts[0]}` : value;
  return reordered
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|mr|mrs|ms|dr)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameMatches(left: string, right: string) {
  const leftName = normalizeName(left);
  const rightName = normalizeName(right);
  if (!leftName || !rightName) return false;
  if (leftName === rightName) return true;
  const leftTokens = leftName.split(" ");
  const rightTokens = rightName.split(" ");
  const leftLast = leftTokens.at(-1);
  const rightLast = rightTokens.at(-1);
  if (!leftLast || leftLast !== rightLast) return false;
  const aliases: Record<string, string[]> = {
    alexander: ["alex"],
    andrew: ["andy"],
    christopher: ["chris"],
    james: ["jim"],
    joseph: ["joe"],
    michael: ["mike"],
    robert: ["bob", "rob"],
    william: ["bill"],
  };
  const leftFirst = leftTokens[0];
  const rightFirst = rightTokens[0];
  return (
    leftFirst === rightFirst ||
    aliases[leftFirst]?.includes(rightFirst) ||
    aliases[rightFirst]?.includes(leftFirst)
  );
}

function isCreativeRecord(ad: PoliticalAd) {
  return !ad.id.startsWith("fec-nv-ie-") && Boolean(ad.platformUrl || ad.claims.length || ad.media.some((media) => media.mediaType !== "transcript"));
}

function recordMatchesEntity(ad: PoliticalAd, entity: Entity) {
  return ad.entityRelations.some((relation) => {
    if (relation.entityType !== "candidate" && relation.entityType !== "official") return false;
    if (relation.entityId === entity.entityId) return true;
    if (entity.fecCandidateId && relation.entityId === entity.fecCandidateId) return true;
    return nameMatches(relation.entityLabel, entity.name);
  });
}

async function loadEntities(financialCoverage: FinancialCoverage): Promise<Entity[]> {
  const financialByEntity = new Map(
    (financialCoverage.records ?? []).map((record) => [
      `${record.entityType}:${record.entityId}`,
      record.campaignFinance?.fecCandidateId ?? null,
    ]),
  );
  const [candidates, officials] = await Promise.all([
    prisma.candidate.findMany({
      include: {
        office: { select: { title: true } },
        jurisdiction: { select: { name: true } },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    }),
    prisma.official.findMany({
      where: { status: "CURRENT" },
      include: {
        office: { select: { title: true } },
        jurisdiction: { select: { name: true } },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    }),
  ]);
  return [
    ...candidates.map(
      (candidate): Entity => ({
        entityType: "candidate",
        entityId: candidate.id,
        name: candidate.fullName,
        office: candidate.office?.title ?? "Office pending",
        jurisdiction: candidate.jurisdiction.name,
        fecCandidateId: financialByEntity.get(`candidate:${candidate.id}`) ?? null,
      }),
    ),
    ...officials.map(
      (official): Entity => ({
        entityType: "official",
        entityId: official.id,
        name: official.fullName,
        office: official.office.title,
        jurisdiction: official.jurisdiction.name,
        fecCandidateId: financialByEntity.get(`official:${official.id}`) ?? null,
      }),
    ),
  ];
}

async function main() {
  const adsFile = await readJson<AdsFile>(ADS_PATH, { ads: [] });
  const financialCoverage = await readJson<FinancialCoverage>(FINANCIAL_COVERAGE_PATH, {});
  const sourceCatalog = await readJson<SourceCatalog>(SOURCE_CATALOG_PATH, {
    version: 0,
    updatedAt: "",
    historicalCycles: [],
    sources: [],
  });
  const ads = adsFile.ads ?? [];
  const entities = await loadEntities(financialCoverage);
  const records = entities.map((entity) => {
    const matches = ads.filter((ad) => recordMatchesEntity(ad, entity));
    const creative = matches.filter(isCreativeRecord);
    const filingOnly = matches.filter((ad) => !isCreativeRecord(ad));
    const cycles = [...new Set(matches.map((ad) => Number(ad.electionCycle)).filter(Number.isFinite))].sort((a, b) => b - a);
    const reportedSpend = matches.reduce((sum, ad) => sum + (ad.totalSpend ?? 0), 0);
    return {
      ...entity,
      status: matches.length ? "records_matched" : "sources_registered_no_match",
      adIds: matches.map((ad) => ad.id),
      totals: {
        matchedRecords: matches.length,
        creativeRecords: creative.length,
        filingOnlyRecords: filingOnly.length,
        recordsWithClaims: matches.filter((ad) => ad.claims.length > 0).length,
        reportedSpend: matches.some((ad) => ad.totalSpend !== null) ? reportedSpend : null,
        cyclesCovered: cycles,
      },
      sourceRoutes: sourceCatalog.sources.map((source) => ({
        id: source.id,
        name: source.name,
        sourceUrl: source.sourceUrl,
        collectionStatus: source.collectionStatus,
        creativeCoverage: source.creativeCoverage,
      })),
      coverageNote: matches.length
        ? `${creative.length} creative record(s) and ${filingOnly.length} spend/dissemination filing(s) are matched by source identity.`
        : "No reviewed ad record currently matches this person. Source routes are registered; this is not a claim that no ads exist.",
    };
  });
  const candidates = records.filter((record) => record.entityType === "candidate");
  const officials = records.filter((record) => record.entityType === "official");
  const output = {
    generatedAt: new Date().toISOString(),
    adsGeneratedAt: adsFile.generatedAt ?? null,
    sourceCatalogVersion: sourceCatalog.version,
    sourceCatalogUpdatedAt: sourceCatalog.updatedAt,
    historicalCycles: sourceCatalog.historicalCycles,
    coverageBoundary:
      "Creative archives, FCC orders, FEC independent-expenditure filings, and state campaign expenditures are different evidence layers. Spend-only records never imply that creative or claims were reviewed.",
    totals: {
      entities: records.length,
      candidates: candidates.length,
      currentOfficials: officials.length,
      sourceRoutes: sourceCatalog.sources.length,
      repositoryRecords: ads.length,
      creativeRecords: ads.filter(isCreativeRecord).length,
      filingOnlyRecords: ads.filter((ad) => !isCreativeRecord(ad)).length,
      entitiesWithMatchedRecords: records.filter((record) => record.adIds.length).length,
      candidatesWithMatchedRecords: candidates.filter((record) => record.adIds.length).length,
      officialsWithMatchedRecords: officials.filter((record) => record.adIds.length).length,
      entitiesWithCreative: records.filter((record) => record.totals.creativeRecords > 0).length,
    },
    sources: sourceCatalog.sources,
    records,
  };
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
