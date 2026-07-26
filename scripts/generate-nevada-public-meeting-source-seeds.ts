import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { PublicMeetingSourceSeed } from "@/lib/public-meetings/types";

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "data", "seed", "nevada-jurisdiction-coverage.json");
const SEED_PATH = path.join(ROOT, "data", "seed", "public-meeting-sources.json");

type CatalogProvider = {
  id: string;
  name: string;
  jurisdiction: string;
  level: PublicMeetingSourceSeed["level"];
  providerGroup: "state" | "county" | "city" | "school";
  website: string;
  discoveryUrls: string[];
  scraperType: PublicMeetingSourceSeed["scraperType"];
  agendaArchiveUrl?: string | null;
  minutesArchiveUrl?: string | null;
  packetArchiveUrl?: string | null;
  videoArchiveUrl?: string | null;
  replaceSourceUrls?: boolean;
  platformHints?: string[];
  allowedHosts?: string[];
};

type CatalogJurisdiction = {
  id: string;
  providerId: string;
};

type Catalog = {
  providers: CatalogProvider[];
  jurisdictions: CatalogJurisdiction[];
};

type ExtendedMeetingSourceSeed = PublicMeetingSourceSeed & {
  providerGroup?: CatalogProvider["providerGroup"];
  discoveryUrls?: string[];
  allowedHosts?: string[];
  platformHints?: string[];
  coverageJurisdictionIds?: string[];
  directCollectionCadenceDays?: number;
  advancedCollectionCadenceDays?: number;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

const catalog = readJson<Catalog>(CATALOG_PATH);
const existing = readJson<ExtendedMeetingSourceSeed[]>(SEED_PATH);
const existingById = new Map(existing.map((source) => [source.id, source]));
const jurisdictionIdsByProvider = new Map<string, string[]>();

for (const jurisdiction of catalog.jurisdictions) {
  const ids = jurisdictionIdsByProvider.get(jurisdiction.providerId) ?? [];
  ids.push(jurisdiction.id);
  jurisdictionIdsByProvider.set(jurisdiction.providerId, ids);
}

const duplicateProviderIds = catalog.providers
  .filter((provider, index, providers) => providers.findIndex((candidate) => candidate.id === provider.id) !== index)
  .map((provider) => provider.id);
if (duplicateProviderIds.length) throw new Error(`Duplicate Nevada provider IDs: ${unique(duplicateProviderIds).join(", ")}`);

const catalogProviderIds = new Set(catalog.providers.map((provider) => provider.id));
const missingProviderReferences = catalog.jurisdictions
  .filter((jurisdiction) => !catalogProviderIds.has(jurisdiction.providerId))
  .map((jurisdiction) => `${jurisdiction.id}:${jurisdiction.providerId}`);
if (missingProviderReferences.length) {
  throw new Error(`Jurisdictions reference missing providers: ${missingProviderReferences.join(", ")}`);
}

const merged = catalog.providers.map((provider): ExtendedMeetingSourceSeed => {
  const previous = existingById.get(provider.id);
  const discoveryUrls = provider.replaceSourceUrls
    ? unique(provider.discoveryUrls)
    : unique([...(previous?.discoveryUrls ?? []), ...provider.discoveryUrls]);
  const meetingIndexUrl = provider.replaceSourceUrls
    ? provider.discoveryUrls[0] ?? provider.website
    : previous?.meetingIndexUrl ?? discoveryUrls[0] ?? provider.website;
  return {
    id: provider.id,
    name: previous?.name ?? provider.name,
    jurisdiction: previous?.jurisdiction ?? provider.jurisdiction,
    level: previous?.level ?? provider.level,
    website: provider.website,
    sourceUrl: provider.replaceSourceUrls ? meetingIndexUrl : previous?.sourceUrl ?? meetingIndexUrl,
    meetingIndexUrl,
    agendaArchiveUrl: provider.agendaArchiveUrl ?? previous?.agendaArchiveUrl ?? null,
    minutesArchiveUrl: provider.minutesArchiveUrl ?? previous?.minutesArchiveUrl ?? null,
    packetArchiveUrl: provider.packetArchiveUrl ?? previous?.packetArchiveUrl ?? null,
    videoArchiveUrl: provider.videoArchiveUrl ?? previous?.videoArchiveUrl ?? null,
    scraperType: provider.replaceSourceUrls ? provider.scraperType : previous?.scraperType ?? provider.scraperType,
    active: previous?.active ?? true,
    notes:
      previous?.notes ??
      "Official jurisdiction root registered for bounded browser discovery, public JSON capture, linked-document retrieval, native text extraction, and OCR fallback.",
    providerGroup: provider.providerGroup,
    discoveryUrls,
    allowedHosts: unique([...(previous?.allowedHosts ?? []), ...(provider.allowedHosts ?? [])]),
    platformHints: unique([...(previous?.platformHints ?? []), ...(provider.platformHints ?? [])]),
    coverageJurisdictionIds: unique(jurisdictionIdsByProvider.get(provider.id) ?? []),
    directCollectionCadenceDays: 1,
    advancedCollectionCadenceDays: 7,
  };
});

const catalogMissingExisting = existing.filter((source) => !catalogProviderIds.has(source.id));
if (catalogMissingExisting.length) {
  throw new Error(
    `Meeting sources must be represented in the statewide catalog before generation: ${catalogMissingExisting.map((source) => source.id).join(", ")}`,
  );
}

writeFileSync(SEED_PATH, `${JSON.stringify(merged, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      providers: merged.length,
      jurisdictions: catalog.jurisdictions.length,
      countyProviders: merged.filter((source) => source.providerGroup === "county").length,
      cityProviders: merged.filter((source) => source.providerGroup === "city").length,
      schoolProviders: merged.filter((source) => source.providerGroup === "school").length,
      stateProviders: merged.filter((source) => source.providerGroup === "state").length,
      output: path.relative(ROOT, SEED_PATH),
    },
    null,
    2,
  ),
);
