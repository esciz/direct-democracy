import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "rss-source-registry.json");

type RssCandidate = {
  id: string;
  sourceName: string;
  jurisdiction: string;
  rssUrl?: string;
  sourceUrl?: string;
  category?: string;
  sourceCategory?: string;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

const generatedAt = new Date().toISOString();
const capabilities = readJson<{ rssCapableSources?: RssCandidate[]; seedExamples?: RssCandidate[] }>("nevada-rss-source-capabilities.json", {});
const candidates = [...(capabilities.rssCapableSources ?? []), ...(capabilities.seedExamples ?? [])];
const seen = new Set<string>();
const records = candidates
  .map((source) => {
    const feedUrl = source.rssUrl ?? source.sourceUrl ?? null;
    return {
      id: source.id,
      feedUrl,
      sourceOwner: source.sourceName,
      jurisdiction: source.jurisdiction,
      sourceCategory: source.sourceCategory ?? source.category ?? "rss_or_public_notice",
      lastCheckedAt: null,
      latestItemDate: null,
      discoveredLinks: [],
      linkedCivicEntities: [],
      status: feedUrl ? "registered" : "needs_feed_url",
      role: "freshness_and_discovery",
      policy: "RSS complements official ingestion; it does not replace agendas, minutes, packets, court, election, or budget records.",
      generatedAt,
    };
  })
  .filter((record) => {
    const key = `${record.feedUrl ?? record.id}|${record.jurisdiction}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .sort((left, right) => left.jurisdiction.localeCompare(right.jurisdiction) || left.sourceOwner.localeCompare(right.sourceOwner));

const audit = {
  generatedAt,
  totals: {
    rssSources: records.length,
    registeredFeeds: records.filter((record) => record.status === "registered").length,
    needsFeedUrl: records.filter((record) => record.status === "needs_feed_url").length,
    jurisdictions: new Set(records.map((record) => record.jurisdiction)).size,
  },
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, records, audit }, null, 2)}\n`);
console.log(`Generated RSS source registry with ${records.length} sources at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
