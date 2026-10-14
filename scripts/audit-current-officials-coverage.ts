import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalPromotionExists, createOfficialsProvenance, writeEnvironmentArtifact } from "@/lib/officials/source-evidence";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const COVERAGE_PATH = path.join(GENERATED_DIR, "officials-coverage-audit.json");
const ROOT_CAUSE_PATH = path.join(GENERATED_DIR, "carson-city-officials-root-cause-audit.json");
const HEALTH_PATH = path.join(GENERATED_DIR, "officials-source-health.json");

type RuntimeOfficial = {
  id: string;
  name: string;
  title: string;
  jurisdiction: string;
  communityName: string;
  role_category: string;
  selection_method: string;
  current_status: string;
  acting_or_interim: boolean;
  source_url: string | null;
  last_verified_at: string | null;
  aliases?: string[];
};

type RosterSeed = {
  providerId: string;
  sourceName: string;
  sourceUrl?: string | null;
  jurisdictionSlug: string;
  jurisdictionName: string;
  members?: Array<{ fullName: string; status?: string | null }>;
};

type RosterRecord = {
  fullName: string;
  bodyId: string;
  organizationId: string;
};

function readJson<T>(relativePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function recordsFrom<T>(relativePath: string): T[] {
  const value = readJson<unknown>(relativePath, []);
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && Array.isArray((value as { records?: unknown[] }).records)) {
    return (value as { records: T[] }).records;
  }
  return [];
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/"([^"]+)"/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesJurisdiction(record: RuntimeOfficial, jurisdictionId: string, jurisdictionName: string) {
  const haystack = normalize(`${record.jurisdiction} ${record.communityName}`);
  if (jurisdictionId === "nshe" && haystack.includes("nevada system of higher education")) return true;
  return haystack.includes(normalize(jurisdictionId)) || haystack.includes(normalize(jurisdictionName));
}

const generatedAt = new Date().toISOString();
const currentOfficials = recordsFrom<RuntimeOfficial>("data/generated/current-officials-runtime.json");
const communityOfficials = recordsFrom<RuntimeOfficial>("data/generated/nevada-community-officials.json");
const actionRuntime = recordsFrom<Record<string, unknown>>("data/generated/officials-runtime.json");
const officialActions = recordsFrom<Record<string, unknown>>("data/generated/public-meeting-official-actions.json");
const rosterSeeds = readJson<RosterSeed[]>("data/seed/public-meeting-official-rosters.json", []);
const governingRosters = recordsFrom<RosterRecord>("data/generated/governing-body-rosters.json");
const sourceHealth = readJson<{ records?: Array<Record<string, unknown>>; provenance?: Record<string, unknown> }>("data/generated/officials-source-health.json", { records: [] });

const priorityJurisdictions = [
  { id: "carson-city", name: "Carson City", requiredGoverning: 5 },
  { id: "reno", name: "Reno", requiredGoverning: 0 },
  { id: "sparks", name: "Sparks", requiredGoverning: 0 },
  { id: "washoe-county", name: "Washoe County", requiredGoverning: 0 },
  { id: "elko", name: "Elko", requiredGoverning: 5 },
  { id: "elko-county", name: "Elko County", requiredGoverning: 5 },
  { id: "clark-county", name: "Clark County", requiredGoverning: 0 },
  { id: "las-vegas", name: "Las Vegas", requiredGoverning: 0 },
  { id: "henderson", name: "Henderson", requiredGoverning: 0 },
  { id: "north-las-vegas", name: "North Las Vegas", requiredGoverning: 0 },
  { id: "clark-county-school-district", name: "CCSD", requiredGoverning: 0 },
  { id: "nshe", name: "NSHE", requiredGoverning: 0 },
  { id: "nevada-legislature", name: "Nevada Legislature", requiredGoverning: 0 },
];

const seedByJurisdiction = new Map<string, RosterSeed[]>();
for (const seed of rosterSeeds) {
  const keys = [seed.jurisdictionSlug, normalize(seed.jurisdictionName)];
  for (const key of keys) {
    const list = seedByJurisdiction.get(key) ?? [];
    list.push(seed);
    seedByJurisdiction.set(key, list);
  }
}

const sourceHealthByJurisdiction = new Map<string, Array<Record<string, unknown>>>();
for (const source of sourceHealth.records ?? []) {
  const id = String(source.jurisdictionId ?? "");
  const list = sourceHealthByJurisdiction.get(id) ?? [];
  list.push(source);
  sourceHealthByJurisdiction.set(id, list);
}

function classificationFor(input: {
  runtimeCount: number;
  governingCount: number;
  requiredGoverning: number;
  sourceCount: number;
  seedCount: number;
  healthStatuses: string[];
}) {
  const hasReviewedSource = input.healthStatuses.some((status) => status === "healthy" || status === "partial");
  const governingRequirementMet = input.requiredGoverning === 0 || input.governingCount >= input.requiredGoverning;

  if (input.runtimeCount > 0 && hasReviewedSource && governingRequirementMet) return "complete";
  if (input.runtimeCount > 0 && hasReviewedSource) return "partial";
  if (input.runtimeCount > 0) return "unverified_roster";
  if (input.sourceCount > 0 && hasReviewedSource) return "linkage_failed";
  if (input.seedCount > 0) return "source_configured_not_imported";
  if (input.sourceCount > 0) return "source_configured_not_imported";
  return "source_missing";
}

const rows = priorityJurisdictions.map((jurisdiction) => {
  const runtime = currentOfficials.filter((record) => matchesJurisdiction(record, jurisdiction.id, jurisdiction.name));
  const communityRuntime = communityOfficials.filter((record) => matchesJurisdiction(record, jurisdiction.id, jurisdiction.name));
  const sources = sourceHealthByJurisdiction.get(jurisdiction.id) ?? [];
  const seeds = seedByJurisdiction.get(jurisdiction.id) ?? seedByJurisdiction.get(normalize(jurisdiction.name)) ?? [];
  const governing = runtime.filter((record) => record.role_category === "governing_body" && record.current_status !== "former");
  const governingOrCouncilExecutive = runtime.filter(
    (record) =>
      record.current_status !== "former" &&
      (record.role_category === "governing_body" || (record.role_category === "elected_executive" && /\bmayor\b/i.test(record.title))),
  );
  const otherElected = runtime.filter((record) => ["elected_executive", "elected_constitutional_office", "judiciary"].includes(record.role_category));
  const appointed = runtime.filter((record) => ["appointed_executive", "department_leadership"].includes(record.role_category));
  const healthStatuses = sources.map((source) => String(source.sourceHealth ?? "unknown"));
  const classification = classificationFor({
    runtimeCount: runtime.length,
    governingCount: governingOrCouncilExecutive.length,
    requiredGoverning: jurisdiction.requiredGoverning,
    sourceCount: sources.length,
    seedCount: seeds.length,
    healthStatuses,
  });
  return {
    jurisdictionId: jurisdiction.id,
    jurisdictionName: jurisdiction.name,
    currentElectedGoverningOfficials: governingOrCouncilExecutive.length,
    otherElectedOffices: otherElected.length,
    appointedExecutiveLeadership: appointed.length,
    configuredOfficialDirectorySources: sources.length + seeds.length,
    sourceHealth: healthStatuses.length ? [...new Set(healthStatuses)].join(",") : seeds.length ? "configured_seed_only" : "missing",
    lastVerified: runtime.map((record) => record.last_verified_at).filter(Boolean).sort().at(-1) ?? null,
    publicRuntimeCount: runtime.length,
    communityRuntimeCount: communityRuntime.length,
    missingOfficeCount: Math.max(0, jurisdiction.requiredGoverning - governingOrCouncilExecutive.length),
    emptyPublicSectionRisk: runtime.length === 0,
    adapterStatus: classification,
    manualFallbackStatus: sources.some((source) => source.cachedPath) ? "cached_html_available" : seeds.length ? "seed_roster_available" : "manual_review_needed",
  };
});

const carsonRuntime = rows.find((row) => row.jurisdictionId === "carson-city");
const carsonOfficials = currentOfficials.filter((record) => matchesJurisdiction(record, "carson-city", "Carson City"));
const carsonNames = new Set(carsonOfficials.map((record) => normalize(record.name)));
const requiredCarsonNames = ["Lori Bagwell", "Stacey Giomi", "Maurice White", "Curtis Horton", "Lisa Schuette"];
const missingCarsonNames = requiredCarsonNames.filter((name) => !carsonNames.has(normalize(name)));
const mauriceRecords = carsonOfficials.filter((record) => normalize(record.name).includes("maurice") || (record.aliases ?? []).some((alias) => normalize(alias).includes("maurice")));

const failures: string[] = [];
if (!carsonRuntime || carsonRuntime.currentElectedGoverningOfficials < 5) failures.push("Carson City has fewer than five current governing officials.");
if (missingCarsonNames.length) failures.push(`Missing Carson City governing officials: ${missingCarsonNames.join(", ")}`);
if (mauriceRecords.length !== 1) failures.push(`Maurice White duplicate/merge guard failed: ${mauriceRecords.length} records.`);
if (carsonOfficials.some((record) => !record.source_url || !record.last_verified_at)) failures.push("A Carson City official is missing source URL or last verified date.");
if (carsonOfficials.filter((record) => record.selection_method === "elected" && record.role_category === "governing_body").length < 5) {
  failures.push("Carson City governing officials are not all classified as elected.");
}
if (carsonOfficials.some((record) => record.role_category === "department_leadership" && record.selection_method === "elected")) {
  failures.push("A department leadership record is incorrectly labeled elected.");
}
if (!carsonOfficials.some((record) => record.title === "Acting Fire Chief" && record.acting_or_interim)) {
  failures.push("Acting Fire Chief title/status was not preserved.");
}
if (carsonOfficials.some((record) => /student government/i.test(`${record.title} ${record.role_category}`))) {
  failures.push("Student-government record appeared in current officials runtime.");
}
for (const row of rows) {
  if (row.publicRuntimeCount === 0 && /healthy|partial/.test(row.sourceHealth) && row.configuredOfficialDirectorySources > 0) {
    failures.push(`${row.jurisdictionName} has configured healthy/partial official source coverage but zero runtime officials.`);
  }
}

const rootCause = {
  generatedAt,
  jurisdiction: "Carson City",
  currentSourceCounts: {
    officialDirectorySources: sourceHealthByJurisdiction.get("carson-city")?.length ?? 0,
    governingBodyRosterRecords: governingRosters.filter((record) => record.organizationId === "carson-city-board-of-supervisors").length,
    officialActionRecords: officialActions.filter((record) => /carson/i.test(JSON.stringify(record))).length,
    legacyOfficialsRuntimeRecords: actionRuntime.length,
    currentOfficialsRuntimeRecords: carsonOfficials.length,
    communityOfficialsRuntimeRecords: communityOfficials.filter((record) => matchesJurisdiction(record, "carson-city", "Carson City")).length,
  },
  findings: [
    "The legacy data/generated/officials-runtime.json artifact contains official-action records, not a comprehensive current officeholder directory.",
    "Carson City governing-body roster records existed in generated roster artifacts, but generated public community officials were tied to roster seeds/action summaries instead of a current-officeholder runtime.",
    "Public current official visibility depended on meeting/action-derived artifacts, so officials with zero parsed actions could disappear from community pages.",
    "Student-government enum cleanup remains correct; unsupported student-government rows are excluded from public official queries and current-official runtime generation.",
  ],
  missingLinkageReasons: [
    "No dedicated current-officeholder runtime artifact existed.",
    "Governing body roster records were not promoted into nevada-community-officials.json.",
    "officials-runtime.json name implied public profile coverage but actually held sparse official action records.",
    "The community page empty state described official action records as a prerequisite for officials.",
  ],
  recommendedReusePath: [
    "Keep Prisma Official/Office/Jurisdiction models for durable normalized imports.",
    "Keep public-meeting official actions and attendance for historical attribution.",
    "Use current-officials-runtime.json for public current officeholder visibility.",
    "Join current officials to actions only by stable person/official IDs when available; never require action count for display.",
  ],
};

const coverage = {
  generatedAt,
  provenance: createOfficialsProvenance({
    artifactName: "officials-coverage-audit",
    generatedAt,
    downloads: sourceHealth.records?.filter((source) => Boolean(source.cachedPath)).length ?? 0,
    cacheCount: sourceHealth.records?.filter((source) => Boolean(source.cachedPath)).length ?? 0,
    parseCount: currentOfficials.length,
    promotionStatus: "not_requested",
  }),
  totals: {
    priorityJurisdictions: rows.length,
    complete: rows.filter((row) => row.adapterStatus === "complete").length,
    partial: rows.filter((row) => row.adapterStatus === "partial").length,
    unverifiedRosters: rows.filter((row) => row.adapterStatus === "unverified_roster").length,
    sourceConfiguredNotImported: rows.filter((row) => row.adapterStatus === "source_configured_not_imported").length,
    sourceMissing: rows.filter((row) => row.adapterStatus === "source_missing").length,
    linkageFailed: rows.filter((row) => row.adapterStatus === "linkage_failed").length,
    emptyPublicSectionRisks: rows.filter((row) => row.emptyPublicSectionRisk).length,
    runtimeOfficials: currentOfficials.length,
    carsonCityRuntimeOfficials: carsonOfficials.length,
    failures: failures.length,
  },
  rows,
  failures,
};

const health = {
  ...sourceHealth,
  provenance: sourceHealth.provenance && typeof sourceHealth.provenance.executionEnvironment === "string"
    ? sourceHealth.provenance as ReturnType<typeof createOfficialsProvenance>
    : createOfficialsProvenance({
    artifactName: "officials-source-health",
    generatedAt,
    downloads: sourceHealth.records?.filter((source) => Boolean(source.cachedPath)).length ?? 0,
    cacheCount: sourceHealth.records?.filter((source) => Boolean(source.cachedPath)).length ?? 0,
    parseCount: currentOfficials.length,
    promotionStatus: "not_requested",
  }),
  records: (sourceHealth.records ?? []).map((source) => ({
    ...source,
    currentOfficialCount: currentOfficials.filter((record) => matchesJurisdiction(record, String(source.jurisdictionId ?? ""), String(source.jurisdictionName ?? ""))).length,
  })),
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(ROOT_CAUSE_PATH, `${JSON.stringify(rootCause, null, 2)}\n`);
writeFileSync(COVERAGE_PATH, `${JSON.stringify(coverage, null, 2)}\n`);
if (canonicalPromotionExists()) {
  writeEnvironmentArtifact("officials-source-health", health.provenance, health);
} else {
  writeFileSync(HEALTH_PATH, `${JSON.stringify(health, null, 2)}\n`);
}

console.log(JSON.stringify(coverage.totals, null, 2));
console.log(`Wrote ${path.relative(process.cwd(), ROOT_CAUSE_PATH)} and ${path.relative(process.cwd(), COVERAGE_PATH)}`);

if (failures.length) {
  console.error("Officials coverage audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
