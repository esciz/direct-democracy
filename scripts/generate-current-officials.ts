import { readFileSync } from "node:fs";
import path from "node:path";

import { getOfficialDirectorySources, getSeededCurrentOfficeholders, type CurrentOfficialRuntimeRecord, type CurrentOfficeholderRecord } from "@/lib/officials/current-officeholders";
import {
  CURRENT_COMMUNITY_PATH,
  CURRENT_FULL_PATH,
  CURRENT_RUNTIME_PATH,
  readCanonicalOfficials,
  writeCurrentOfficialsArtifacts,
} from "@/lib/officials/source-evidence";

type OfficialActionRecord = {
  official_id?: string | null;
  official_name_raw?: string | null;
};

function readJson<T>(relativePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/"([^"]+)"/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function attachActionCounts(records: CurrentOfficialRuntimeRecord[]) {
  const actions = readJson<OfficialActionRecord[]>("data/generated/public-meeting-official-actions.json", []);
  return records.map((record) => {
    const normalizedName = normalize(record.name);
    const normalizedAliases = new Set([normalizedName, ...record.aliases.map(normalize)]);
    const relatedActionCount = actions.filter((action) => {
      const raw = normalize(action.official_name_raw);
      return Boolean(raw) && (normalizedAliases.has(raw) || [...normalizedAliases].some((alias) => alias.endsWith(` ${raw}`)));
    }).length;
    return { ...record, related_action_count: relatedActionCount };
  });
}

const generatedAt = new Date().toISOString();
const canonical = readCanonicalOfficials();
const usingPromotedCanonical = Boolean(canonical?.records?.length);
const reviewedSeedRecords = getSeededCurrentOfficeholders(generatedAt);
const records = usingPromotedCanonical
  ? mergeCanonicalWithReviewedSeeds(canonical!.records!, reviewedSeedRecords)
  : reviewedSeedRecords;
const sources = usingPromotedCanonical ? canonical!.sources ?? getOfficialDirectorySources(generatedAt) : getOfficialDirectorySources(generatedAt);

function mergeCanonicalWithReviewedSeeds(canonicalRecords: CurrentOfficeholderRecord[], seedRecords: CurrentOfficeholderRecord[]) {
  const merged = new Map<string, CurrentOfficeholderRecord>();
  for (const record of canonicalRecords) merged.set(`${record.stablePersonId}:${record.stableOfficeId}`, record);
  for (const record of seedRecords) {
    const key = `${record.stablePersonId}:${record.stableOfficeId}`;
    if (merged.has(key)) continue;
    merged.set(key, record);
  }
  return [...merged.values()];
}

const result = writeCurrentOfficialsArtifacts({
  generatedAt,
  records,
  sources,
  sourcePolicy: usingPromotedCanonical
    ? "Current officeholders merge explicitly promoted official source evidence with reviewed Nevada governing-body roster seeds; historical actions and vote attribution remain separate."
    : "Current officeholders are generated from the reviewed Carson City baseline until verified official source evidence is promoted.",
  promotion: canonical?.promotion ?? null,
  relatedActionCounts: attachActionCounts,
});
const runtime = result.runtime;

console.log(
  JSON.stringify(
    {
      generatedAt,
      sourceMode: usingPromotedCanonical ? "promoted_canonical_source_evidence" : "reviewed_baseline_pending_promotion",
      officials: records.length,
      runtime: runtime.length,
      governingOfficials: runtime.filter((record) => record.role_category === "governing_body").length,
      elected: runtime.filter((record) => record.selection_method === "elected").length,
      appointedOrActing: runtime.filter((record) => record.selection_method === "appointed" || record.selection_method === "acting").length,
      output: [CURRENT_FULL_PATH, CURRENT_RUNTIME_PATH, CURRENT_COMMUNITY_PATH].map((filePath) => path.relative(process.cwd(), filePath)),
    },
    null,
    2,
  ),
);
