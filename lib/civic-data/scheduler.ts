import { NEVADA_BETA_SOURCE_DEFINITIONS } from "@/lib/civic-data/source-definitions";
import { syncCivicSource } from "@/lib/civic-data/service";

export async function syncScheduledNevadaBetaSources() {
  const results = [];

  for (const source of NEVADA_BETA_SOURCE_DEFINITIONS) {
    results.push(await syncCivicSource(source.slug, "scheduled"));
  }

  return results;
}

