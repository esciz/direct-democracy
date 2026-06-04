import { NEVADA_BETA_SOURCE_DEFINITIONS } from "@/lib/civic-data/source-definitions";
import { syncCivicSource } from "@/lib/civic-data/service";
import { syncNevadaOfficialsSources } from "@/lib/civic-data/import-jobs";

export async function syncScheduledNevadaBetaSources() {
  const results = [];

  for (const source of NEVADA_BETA_SOURCE_DEFINITIONS) {
    results.push(await syncCivicSource(source.slug, "scheduled"));
  }

  return results;
}

export async function syncScheduledNevadaOfficialsSources() {
  return syncNevadaOfficialsSources("scheduled");
}
