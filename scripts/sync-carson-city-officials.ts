import { spawnSync } from "node:child_process";
import { lookup } from "node:dns/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function runArtifactPath(runId: string, artifactName: string) {
  return path.join("data", "generated", "audits", runId, `${artifactName}.json`);
}

function readRunOrGeneric<T>(runId: string | null | undefined, artifactName: string, genericPath: string, fallback: T): T {
  if (runId) {
    const runScoped = readJson<T | null>(runArtifactPath(runId, artifactName), null);
    if (runScoped) return runScoped;
  }
  return readJson<T>(genericPath, fallback);
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: "utf8", stdio: "inherit", env: process.env });
  if (result.status !== 0 || result.error) {
    throw new Error(result.error?.message ?? `${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

function assertNetworkFlag() {
  if (process.env.OFFICIALS_NETWORK_ENABLED !== "true") {
    throw new Error("OFFICIALS_NETWORK_ENABLED=true is required for officials:carson-city:sync.");
  }
}

async function assertNetworkAvailable() {
  try {
    await lookup("www.google.com");
  } catch (error) {
    throw new Error(`DNS unavailable; refusing officials sync: ${error instanceof Error ? error.message : String(error)}`);
  }

  let timeout: NodeJS.Timeout | null = null;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch("https://www.google.com", { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (!response.ok && ![301, 302, 303, 307, 308].includes(response.status)) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    throw new Error(`HTTPS unavailable; refusing officials sync: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function normalizedHashSet(values: Array<{ sourceId?: unknown; contentHash?: unknown }>) {
  return values
    .map((value) => `${String(value.sourceId ?? "")}:${String(value.contentHash ?? "")}`)
    .filter((value) => !value.endsWith(":"))
    .sort()
    .join("|");
}

function canonicalHashSet() {
  const canonical = readJson<{ promotion?: { sourceHashes?: Array<{ sourceId?: unknown; contentHash?: unknown }> }; sources?: Array<{ sourceId?: unknown; contentHash?: unknown }> }>("data/generated/current-officials-canonical.json", {});
  return normalizedHashSet(canonical.promotion?.sourceHashes ?? canonical.sources ?? []);
}

function evidenceHashSet(runId?: string | null) {
  const evidence = readRunOrGeneric<{ sources?: Array<{ sourceId?: unknown; contentHash?: unknown }> }>(
    runId,
    "carson-city-officials-source-evidence",
    "data/generated/carson-city-officials-source-evidence.json",
    {},
  );
  return normalizedHashSet(evidence.sources ?? []);
}

function governingGuardPasses(records: Array<JsonRecord>) {
  const governing = records.filter((record) => record.roleCategory === "governing_body");
  const mayors = governing.filter((record) => record.sourceTitle === "Mayor");
  const wardSupervisors = governing.filter((record) => /^Supervisor, Ward [1-4]$/.test(String(record.sourceTitle ?? "")));
  const wards = new Set(wardSupervisors.map((record) => record.wardOrDistrict));
  const maurice = records.filter((record) => /maurice/i.test(String(record.publicDisplayName ?? "")) || (Array.isArray(record.aliases) && record.aliases.some((alias) => /maurice/i.test(String(alias)))));
  const departmentElected = records.filter((record) => record.roleCategory === "department_leadership" && record.selectionMethod === "elected");
  return {
    ok: mayors.length === 1 && wardSupervisors.length === 4 && wards.size === 4 && maurice.length === 1 && departmentElected.length === 0,
    mayors: mayors.length,
    wardSupervisors: wardSupervisors.length,
    wards: wards.size,
    mauriceRecords: maurice.length,
    departmentElected: departmentElected.length,
  };
}

function printSummary(status: string, runId?: string | null, extra: Record<string, unknown> = {}) {
  const retrieval = readJson<{ runId?: string; totals?: Record<string, number>; records?: Array<JsonRecord> }>("data/generated/officials-retrieval-run.json", {});
  const activeRunId = runId ?? retrieval.runId ?? null;
  const evidence = readRunOrGeneric<{ sources?: Array<JsonRecord> }>(
    activeRunId,
    "carson-city-officials-source-evidence",
    "data/generated/carson-city-officials-source-evidence.json",
    {},
  );
  const reconciliation = readRunOrGeneric<{
    parser?: Record<string, number>;
    promotion?: { blockers?: string[]; status?: string };
    reviewQueue?: Array<{ severity?: string }>;
    promotedRecords?: Array<JsonRecord>;
    comparisons?: {
      exactMatches?: unknown[];
      titleDifferences?: unknown[];
      nameDifferences?: unknown[];
    };
  }>(activeRunId, "carson-city-officials-source-reconciliation", "data/generated/carson-city-officials-source-reconciliation.json", {});
  const promotion = readRunOrGeneric<{ status?: string; recordsPromoted?: number; promotedFromRunId?: string | null }>(
    activeRunId,
    "carson-city-officials-promotion-audit",
    "data/generated/carson-city-officials-promotion-audit.json",
    {},
  );
  const health = readJson<{ audit?: { totals?: Record<string, number> }; canonicalPromotion?: unknown }>("data/generated/officials-source-health.json", {});
  const verifiedSources = evidence.sources?.filter((source) => source.verified).length ?? 0;
  const downloadedSources = (retrieval.totals?.retrievedVerified ?? 0) + (retrieval.totals?.changed ?? 0) + (retrieval.totals?.unchanged ?? 0);
  const cachedSources = evidence.sources?.filter((source) => source.cachedPath && source.contentHash).length ?? 0;
  const sourceHashesPresent = evidence.sources?.filter((source) => source.contentHash).length ?? 0;
  const hashes = (evidence.sources ?? []).map((source) => ({
    sourceId: source.sourceId,
    hash: typeof source.contentHash === "string" ? `${source.contentHash.slice(0, 12)}...` : null,
  }));
  const reviewQueueRecords = reconciliation.reviewQueue?.length ?? 0;
  const criticalConflicts = reconciliation.reviewQueue?.filter((item) => item.severity === "critical").length ?? 0;
  const exactMatches = reconciliation.comparisons?.exactMatches?.length ?? 0;
  const normalizedMatches = exactMatches + (reconciliation.comparisons?.titleDifferences?.length ?? 0) + (reconciliation.comparisons?.nameDifferences?.length ?? 0);

  console.log(JSON.stringify({
    status,
    runId: activeRunId,
    sourcesAttempted: retrieval.totals?.attempted ?? evidence.sources?.length ?? 0,
    downloads: downloadedSources,
    sourcesVerified: verifiedSources,
    sourcesCached: cachedSources,
    sourceHashesPresent,
    unchanged: retrieval.totals?.unchanged ?? 0,
    changed: retrieval.totals?.changed ?? 0,
    hashes,
    parsedOfficials: reconciliation.parser?.recordsParsed ?? 0,
    exactMatches,
    normalizedMatches,
    conflicts: reviewQueueRecords,
    criticalConflicts,
    promotionStatus: promotion.status ?? reconciliation.promotion?.status ?? "not_run",
    promotedFromRunId: promotion.promotedFromRunId ?? null,
    recordsPromoted: promotion.recordsPromoted ?? 0,
    canonicalHealth: health.audit?.totals ?? null,
    ...extra,
  }, null, 2));
}

async function main() {
  assertNetworkFlag();
  await assertNetworkAvailable();

  run("npm", ["run", "officials:retrieve", "--", "--jurisdiction=carson-city"]);
  const retrieval = readJson<{ runId?: string }>("data/generated/officials-retrieval-run.json", {});
  if (!retrieval.runId) throw new Error("officials sync could not determine the retrieval run ID.");

  run("npm", ["run", "officials:reconcile", "--", `--run-id=${retrieval.runId}`]);
  run("npm", ["run", "officials:coverage-audit"]);

  const reconciliation = readRunOrGeneric<{ promotion?: { eligible?: boolean; blockers?: string[] }; reviewQueue?: Array<{ severity?: string }>; promotedRecords?: Array<JsonRecord> }>(
    retrieval.runId,
    "carson-city-officials-source-reconciliation",
    "data/generated/carson-city-officials-source-reconciliation.json",
    {},
  );
  const reviewQueueRecords = reconciliation.reviewQueue?.length ?? 0;
  const criticalConflicts = reconciliation.reviewQueue?.filter((item) => item.severity === "critical").length ?? 0;
  const guard = governingGuardPasses(reconciliation.promotedRecords ?? []);
  const clean = Boolean(reconciliation.promotion?.eligible) && reviewQueueRecords === 0 && guard.ok;

  if (!clean) {
    printSummary("stopped_without_promotion", retrieval.runId, {
      blockers: [
        ...(reconciliation.promotion?.blockers ?? []),
        ...(reviewQueueRecords > 0 ? [`Reconciliation review queue contains ${reviewQueueRecords} item(s).`] : []),
        ...(guard.ok ? [] : ["Carson City governing-body guard failed."]),
      ],
      governingGuard: guard,
    });
    process.exitCode = 2;
    return;
  }

  const currentHashSet = canonicalHashSet();
  const nextHashSet = evidenceHashSet(retrieval.runId);
  if (currentHashSet && nextHashSet && currentHashSet === nextHashSet) {
    run("npm", ["run", "communities:relationships"]);
    run("npm", ["run", "communities:report"]);
    run("npm", ["run", "browse:audit"]);
    printSummary("already_canonical_hashes_unchanged", retrieval.runId, {
      promotionStatus: "skipped_unchanged",
      governingGuard: guard,
    });
    return;
  }

  run("npm", ["run", "officials:promote", "--", "--jurisdiction=carson-city", `--run-id=${retrieval.runId}`, "--confirm=promote-carson-city-officials"]);
  printSummary("promoted", retrieval.runId, { governingGuard: guard });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
