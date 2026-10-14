import { NEVADA_BETA_SOURCE_DEFINITIONS } from "@/lib/civic-data/source-definitions";
import { syncCivicSource } from "@/lib/civic-data/service";
import type { CivicSourceAdapterKey, ImportMode } from "@/lib/civic-data/types";

export const OFFICIALS_SOURCE_ADAPTER_KEYS: CivicSourceAdapterKey[] = [
  "nevada-legislature",
  "nevada-state-government",
  "nevada-federal-delegation",
  "reno",
  "carson-city",
  "washoe-county",
];

export async function syncNevadaOfficialsSources(mode: ImportMode = "scheduled") {
  const sourceSlugs = NEVADA_BETA_SOURCE_DEFINITIONS.filter((source) => OFFICIALS_SOURCE_ADAPTER_KEYS.includes(source.adapterKey)).map((source) => source.slug);
  const results = [];

  for (const sourceSlug of sourceSlugs) {
    results.push(await syncCivicSource(sourceSlug, mode));
  }

  return results;
}

export const ELECTIONS_SOURCE_ADAPTER_KEYS: CivicSourceAdapterKey[] = ["nevada-secretary-of-state"];

export async function syncNevadaElectionsSources(mode: ImportMode = "scheduled") {
  const sourceSlugs = NEVADA_BETA_SOURCE_DEFINITIONS.filter((source) => ELECTIONS_SOURCE_ADAPTER_KEYS.includes(source.adapterKey)).map((source) => source.slug);
  const results = [];

  for (const sourceSlug of sourceSlugs) {
    results.push(await syncCivicSource(sourceSlug, mode));
  }

  return results;
}

const JOB_SOURCE_SLUGS = {
  "candidate-election-daily": [
    "nevada-secretary-of-state-elections",
    "nevada-secretary-of-state-election-results",
    "nevada-secretary-of-state-precinct-results",
    "nevada-secretary-of-state-candidate-filings",
  ],
  "voter-registration-monthly": ["nevada-secretary-of-state-voter-registration-statistics"],
  "legislative-weekly": ["nevada-legislature-nelis"],
  "county-election-daily": NEVADA_BETA_SOURCE_DEFINITIONS.filter((source) => source.adapterKey === "county-election-office").map((source) => source.slug),
  "profile-enrichment-weekly": ["nevada-secretary-of-state-candidate-filings"],
} as const;

export type CivicImportJobKey = keyof typeof JOB_SOURCE_SLUGS;

export function getCivicImportJobKeys() {
  return Object.keys(JOB_SOURCE_SLUGS) as CivicImportJobKey[];
}

export async function syncCivicImportJob(jobKey: CivicImportJobKey, mode: ImportMode = "scheduled") {
  const results = [];

  for (const sourceSlug of JOB_SOURCE_SLUGS[jobKey]) {
    results.push(await syncCivicSource(sourceSlug, mode));
  }

  return results;
}
