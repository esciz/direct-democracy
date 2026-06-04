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
  "unr",
  "asun",
];

export async function syncNevadaOfficialsSources(mode: ImportMode = "scheduled") {
  const sourceSlugs = NEVADA_BETA_SOURCE_DEFINITIONS.filter((source) => OFFICIALS_SOURCE_ADAPTER_KEYS.includes(source.adapterKey)).map((source) => source.slug);
  const results = [];

  for (const sourceSlug of sourceSlugs) {
    results.push(await syncCivicSource(sourceSlug, mode));
  }

  return results;
}

