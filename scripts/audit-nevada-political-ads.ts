import fs from "node:fs";
import path from "node:path";

import type { PoliticalAd } from "@/types/domain";

const GENERATED_PATH = path.join(process.cwd(), "data/generated/nevada-political-ads.json");
const REVIEW_QUEUE_PATH = path.join(process.cwd(), "data/generated/nevada-political-ads-review-queue.json");
const AUDIT_PATH = path.join(process.cwd(), "data/generated/nevada-political-ads-audit.json");

type GeneratedAdsFile = {
  generatedAt?: string;
  ads?: PoliticalAd[];
  totals?: Record<string, unknown>;
};

type ReviewQueueFile = {
  records?: unknown[];
};

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

const generated = readJson<GeneratedAdsFile>(GENERATED_PATH, { ads: [] });
const reviewQueue = readJson<ReviewQueueFile>(REVIEW_QUEUE_PATH, { records: [] });
const ads = Array.isArray(generated.ads) ? generated.ads : [];
const recordsMissingSource = ads.filter((ad) => !ad.platformUrl && !ad.archiveUrl && !ad.media.some((media) => media.url));
const recordsWithExampleSources = ads.filter((ad) =>
  [ad.platformUrl, ad.archiveUrl, ...ad.claims.flatMap((claim) => claim.evidence.map((evidence) => evidence.url))]
    .filter(Boolean)
    .some((url) => String(url).includes("example.com")),
);
const publishedAds = ads.filter((ad) => ad.status === "published" || ad.status === "archived");
const pendingAds = ads.filter((ad) => ad.status === "pendingReview" || ad.status === "draft");
const sourceTypes = [...new Set(ads.map((ad) => ad.sourceType))].sort();
const sponsorTypes = [...new Set(ads.map((ad) => ad.sponsorType))].sort();
const geographyCounts = ads.reduce<Record<string, number>>((counts, ad) => {
  const key = ad.geographies[0]?.county ?? ad.geographies[0]?.state ?? "Unknown";
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

const failures = [
  recordsMissingSource.length ? `${recordsMissingSource.length} generated ad record(s) are missing source URLs or source media.` : null,
  recordsWithExampleSources.length ? `${recordsWithExampleSources.length} generated ad record(s) contain example.com demo URLs.` : null,
].filter((failure): failure is string => Boolean(failure));

const audit = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? "failed" : ads.length ? "ready" : "limited_data",
  totals: {
    generatedAds: ads.length,
    publishedAds: publishedAds.length,
    pendingAds: pendingAds.length,
    reviewQueueRecords: Array.isArray(reviewQueue.records) ? reviewQueue.records.length : 0,
    recordsMissingSource: recordsMissingSource.length,
    recordsWithExampleSources: recordsWithExampleSources.length,
  },
  sourceTypes,
  sponsorTypes,
  geographyCounts,
  failures,
  nextSteps: ads.length
    ? ["Review claim ratings and relation links for each imported ad.", "Attach screenshots, transcripts, or archive URLs when available."]
    : [
        "Add reviewed source-backed records to data/manual-sources/political-ads/nevada-reviewed-ads.json.",
        "Configure META_AD_LIBRARY_ACCESS_TOKEN or import a reviewed platform export for Nevada political/social issue ads.",
      ],
};

fs.writeFileSync(AUDIT_PATH, JSON.stringify(audit, null, 2));
console.log("Nevada political ads audit complete.");
console.log(JSON.stringify(audit.totals, null, 2));

if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}
