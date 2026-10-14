import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PublicMeetingSourceSeed } from "@/lib/public-meetings/types";

const ROOT = process.cwd();
const GENERATED_DIR = path.join(ROOT, "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-jurisdiction-meeting-coverage.json");
const CATALOG_PATH = path.join(ROOT, "data", "seed", "nevada-jurisdiction-coverage.json");
const SEED_PATH = path.join(ROOT, "data", "seed", "public-meeting-sources.json");
const MANUAL_ROOT = path.join(ROOT, "data", "manual-sources", "public-meetings");

type Catalog = {
  version: number;
  scope: {
    description: string;
    countyGovernments: number;
    incorporatedCities: number;
    countySchoolDistricts: number;
    statewideLayers: number;
    unincorporatedCommunityPolicy: string;
    expansionClasses: string[];
  };
  verificationSources: Array<{ label: string; url: string }>;
  providers: Array<{
    id: string;
    name: string;
    providerGroup: "state" | "county" | "city" | "school";
    discoveryUrls: string[];
    platformHints?: string[];
  }>;
  jurisdictions: Array<{
    id: string;
    name: string;
    kind: "state" | "county" | "city" | "school";
    providerId: string;
    communityIds: string[];
  }>;
  communityInheritance: Array<{ communityId: string; providerId: string }>;
};

type ExtendedMeetingSourceSeed = PublicMeetingSourceSeed & {
  providerGroup?: "state" | "county" | "city" | "school";
  discoveryUrls?: string[];
  platformHints?: string[];
  coverageJurisdictionIds?: string[];
  directCollectionCadenceDays?: number;
  advancedCollectionCadenceDays?: number;
};

type ManualManifest = {
  entries?: Array<{ sourceKind?: string; parserStatus?: string }>;
  failures?: Array<{ reason?: string }>;
  collection?: {
    lastAttemptedAt?: string | null;
    lastSucceededAt?: string | null;
    pagesVisited?: number;
    pagesSucceeded?: number;
    discoveredPlatforms?: string[];
    strategy?: string[];
  };
};

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function manifestFor(providerId: string) {
  const filePath = path.join(MANUAL_ROOT, providerId, "manifest.json");
  return existsSync(filePath) ? readJson<ManualManifest>(filePath, {}) : null;
}

const generatedAt = new Date().toISOString();
const catalog = readJson<Catalog>(CATALOG_PATH, {
  version: 0,
  scope: {
    description: "",
    countyGovernments: 0,
    incorporatedCities: 0,
    countySchoolDistricts: 0,
    statewideLayers: 0,
    unincorporatedCommunityPolicy: "",
    expansionClasses: [],
  },
  verificationSources: [],
  providers: [],
  jurisdictions: [],
  communityInheritance: [],
});
const seeds = readJson<ExtendedMeetingSourceSeed[]>(SEED_PATH, []);
const seedById = new Map(seeds.map((seed) => [seed.id, seed]));
const requirementsByProvider = new Map<string, Catalog["jurisdictions"]>();

for (const requirement of catalog.jurisdictions) {
  const requirements = requirementsByProvider.get(requirement.providerId) ?? [];
  requirements.push(requirement);
  requirementsByProvider.set(requirement.providerId, requirements);
}

const providerRows = catalog.providers.map((provider) => {
  const seed = seedById.get(provider.id);
  const manifest = manifestFor(provider.id);
  const entries = manifest?.entries ?? [];
  const discoveredKinds = [...new Set(entries.map((entry) => entry.sourceKind).filter(Boolean))].sort();
  const configuredUrls = [
    seed?.meetingIndexUrl,
    seed?.agendaArchiveUrl,
    seed?.minutesArchiveUrl,
    seed?.packetArchiveUrl,
    seed?.videoArchiveUrl,
    ...(seed?.discoveryUrls ?? []),
  ].filter((url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index);
  const requirements = requirementsByProvider.get(provider.id) ?? [];
  const sourceConfigured = Boolean(seed?.active && configuredUrls.length);
  return {
    providerId: provider.id,
    providerName: seed?.name ?? provider.name,
    providerGroup: seed?.providerGroup ?? provider.providerGroup,
    jurisdiction: seed?.jurisdiction ?? null,
    requirementIds: requirements.map((requirement) => requirement.id),
    communityIds: [...new Set(requirements.flatMap((requirement) => requirement.communityIds))],
    sourceConfigured,
    configuredUrls,
    scraperType: seed?.scraperType ?? null,
    platformHints: [...new Set([...(provider.platformHints ?? []), ...(seed?.platformHints ?? []), ...(manifest?.collection?.discoveredPlatforms ?? [])])],
    acquisitionMethods: [
      "daily_direct_source_check",
      "weekly_rendered_browser_discovery",
      "official_link_following",
      "public_json_capture",
      "linked_document_retrieval",
      "native_text_extraction",
      "ocr_fallback",
      "source_health_monitoring",
    ],
    directCollectionCadenceDays: seed?.directCollectionCadenceDays ?? null,
    advancedCollectionCadenceDays: seed?.advancedCollectionCadenceDays ?? null,
    advancedCollection: {
      lastAttemptedAt: manifest?.collection?.lastAttemptedAt ?? null,
      lastSucceededAt: manifest?.collection?.lastSucceededAt ?? null,
      pagesVisited: manifest?.collection?.pagesVisited ?? 0,
      pagesSucceeded: manifest?.collection?.pagesSucceeded ?? 0,
      discoveredKinds,
      cachedEntries: entries.length,
      failures: manifest?.failures?.length ?? 0,
    },
    status: !sourceConfigured
      ? "source_gap"
      : entries.length
        ? "advanced_collection_active"
        : manifest?.collection?.lastAttemptedAt && (manifest.failures?.length ?? 0) > 0
          ? "advanced_collection_blocked"
          : manifest?.collection?.lastAttemptedAt
            ? "advanced_collection_checked_no_records"
            : "configured_pending_first_advanced_pass",
  };
});

const providerRowById = new Map(providerRows.map((row) => [row.providerId, row]));
const jurisdictionRows = catalog.jurisdictions.map((requirement) => {
  const provider = providerRowById.get(requirement.providerId);
  return {
    jurisdictionId: requirement.id,
    jurisdictionName: requirement.name,
    kind: requirement.kind,
    communityIds: requirement.communityIds,
    providerId: requirement.providerId,
    sourceConfigured: provider?.sourceConfigured ?? false,
    providerStatus: provider?.status ?? "source_gap",
  };
});

const expectedCounts = {
  county: catalog.scope.countyGovernments,
  city: catalog.scope.incorporatedCities,
  school: catalog.scope.countySchoolDistricts,
  state: catalog.scope.statewideLayers,
};
const actualCounts = {
  county: jurisdictionRows.filter((row) => row.kind === "county").length,
  city: jurisdictionRows.filter((row) => row.kind === "city").length,
  school: jurisdictionRows.filter((row) => row.kind === "school").length,
  state: jurisdictionRows.filter((row) => row.kind === "state").length,
};
const countMismatches = Object.entries(expectedCounts)
  .filter(([kind, expected]) => actualCounts[kind as keyof typeof actualCounts] !== expected)
  .map(([kind, expected]) => `${kind}: expected ${expected}, found ${actualCounts[kind as keyof typeof actualCounts]}`);
const unmappedSeeds = seeds.filter((seed) => !catalog.providers.some((provider) => provider.id === seed.id)).map((seed) => seed.id);
const missingSources = jurisdictionRows.filter((row) => !row.sourceConfigured);

const totals = {
  requiredJurisdictions: jurisdictionRows.length,
  requiredProviders: providerRows.length,
  configuredProviders: providerRows.filter((row) => row.sourceConfigured).length,
  jurisdictionsWithConfiguredSource: jurisdictionRows.filter((row) => row.sourceConfigured).length,
  sourceGaps: missingSources.length,
  advancedCollectionActive: providerRows.filter((row) => row.status === "advanced_collection_active").length,
  pendingFirstAdvancedPass: providerRows.filter((row) => row.status === "configured_pending_first_advanced_pass").length,
  advancedCollectionBlocked: providerRows.filter((row) => row.status === "advanced_collection_blocked").length,
  advancedCollectionCheckedNoRecords: providerRows.filter((row) => row.status === "advanced_collection_checked_no_records").length,
  inheritedCommunities: catalog.communityInheritance.length,
  countMismatches: countMismatches.length,
  unmappedSeeds: unmappedSeeds.length,
};

const artifact = {
  generatedAt,
  catalogVersion: catalog.version,
  scope: catalog.scope,
  verificationSources: catalog.verificationSources,
  totals,
  expectedCounts,
  actualCounts,
  countMismatches,
  unmappedSeeds,
  missingSources,
  communityInheritance: catalog.communityInheritance,
  providerRows,
  jurisdictionRows,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify(totals, null, 2));
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);

if (process.argv.includes("--strict") && (missingSources.length || countMismatches.length || unmappedSeeds.length)) {
  process.exit(1);
}
