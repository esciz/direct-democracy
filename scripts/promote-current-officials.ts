import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  archiveIfExists,
  CARSON_EVIDENCE_PATH,
  CARSON_PROMOTION_AUDIT_PATH,
  CARSON_RECONCILIATION_PATH,
  CURRENT_CANONICAL_PATH,
  CURRENT_COMMUNITY_PATH,
  CURRENT_FULL_PATH,
  CURRENT_RUNTIME_PATH,
  OFFICIALS_SOURCE_HEALTH_PATH,
  officialSourceHealthFromEvidence,
  readJson,
  writeEnvironmentArtifact,
  writeJson,
  writeRunArtifact,
  writeCurrentOfficialsArtifacts,
  type OfficialsEvidenceArtifact,
  type OfficialsPromotionAudit,
  type OfficialsReconciliationArtifact,
} from "@/lib/officials/source-evidence";

function argValue(name: string) {
  const flag = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return flag?.split("=").slice(1).join("=");
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: process.cwd(), encoding: "utf8", stdio: "inherit", env: process.env });
  if (result.status !== 0 || result.error) throw new Error(result.error?.message ?? `${command} ${args.join(" ")} failed with ${result.status}`);
}

const jurisdiction = argValue("--jurisdiction");
const runId = argValue("--run-id");
const confirm = argValue("--confirm");

if (jurisdiction !== "carson-city") throw new Error("officials_promotion_requires_--jurisdiction=carson-city");
if (!runId) throw new Error("officials_promotion_requires_--run-id=<run-id>");
if (confirm !== "promote-carson-city-officials") throw new Error("officials_promotion_requires_--confirm=promote-carson-city-officials");

const runReconciliationPath = path.join(process.cwd(), "data", "generated", "audits", runId, "carson-city-officials-source-reconciliation.json");
const runEvidencePath = path.join(process.cwd(), "data", "generated", "audits", runId, "carson-city-officials-source-evidence.json");
const reconciliation = readJson<OfficialsReconciliationArtifact | null>(runReconciliationPath, null) ?? readJson<OfficialsReconciliationArtifact | null>(CARSON_RECONCILIATION_PATH, null);
const evidence = readJson<OfficialsEvidenceArtifact | null>(runEvidencePath, null) ?? readJson<OfficialsEvidenceArtifact | null>(CARSON_EVIDENCE_PATH, null);

if (!reconciliation || reconciliation.runId !== runId) throw new Error("officials_promotion_reconciliation_run_not_found");
if (!evidence || evidence.runId !== runId) throw new Error("officials_promotion_evidence_run_not_found");
if (!reconciliation.promotion.eligible) throw new Error(`officials_promotion_blocked:${reconciliation.promotion.blockers.join(";")}`);
if (evidence.provenance.executionEnvironment === "codex_sandbox") throw new Error("officials_promotion_rejects_codex_sandbox");
if (evidence.provenance.networkCapability !== "available") throw new Error("officials_promotion_requires_network_enabled_evidence");
if (evidence.evidencePersistence?.importRequiredBeforePromotion) throw new Error("officials_promotion_requires_imported_or_durable_evidence");
if (evidence.sources.some((source) => !source.verified || !source.cachedPath || !source.contentHash)) throw new Error("officials_promotion_requires_verified_cached_sources");

const generatedAt = new Date().toISOString();
const promotion = {
  status: "promoted" as const,
  promotedAt: generatedAt,
  promotedFromRunId: runId,
  evidenceRunId: evidence.runId,
  reconciliationRunId: reconciliation.runId,
  executionEnvironment: evidence.provenance.executionEnvironment,
  networkCapability: evidence.provenance.networkCapability,
  sourceHashes: evidence.sources.map((source) => ({ sourceId: source.sourceId, contentHash: source.contentHash })),
};

for (const [filePath, label] of [
  [CURRENT_CANONICAL_PATH, "current-officials-canonical"],
  [CURRENT_FULL_PATH, "current-officials"],
  [CURRENT_RUNTIME_PATH, "current-officials-runtime"],
  [CURRENT_COMMUNITY_PATH, "nevada-community-officials"],
  [OFFICIALS_SOURCE_HEALTH_PATH, "officials-source-health"],
] as const) {
  archiveIfExists(filePath, label);
}

const canonical = {
  generatedAt,
  schemaVersion: 1,
  jurisdiction: "carson-city",
  records: reconciliation.promotedRecords,
  sources: evidence.sources,
  promotion,
  sensitiveValuesIncluded: false,
};
writeJson(CURRENT_CANONICAL_PATH, canonical);
writeCurrentOfficialsArtifacts({
  generatedAt,
  records: reconciliation.promotedRecords,
  sources: evidence.sources,
  sourcePolicy: "Current officeholders are generated from explicitly promoted Carson City official source evidence; historical actions and vote attribution remain separate.",
  promotion,
});

const health = officialSourceHealthFromEvidence({
  generatedAt,
  sources: evidence.sources,
  currentOfficialCount: reconciliation.promotedRecords.length,
  canonicalPromotion: promotion,
  provenance: {
    ...evidence.provenance,
    canonicalStatus: "promoted_from_run",
    promotionStatus: "promoted",
  },
});
writeJson(OFFICIALS_SOURCE_HEALTH_PATH, health);

const promotionAudit: OfficialsPromotionAudit = {
  generatedAt,
  runId,
  promotedAt: generatedAt,
  promotedFromRunId: runId,
  jurisdiction: "carson-city",
  status: "promoted",
  recordsPromoted: reconciliation.promotedRecords.length,
  conflictsRemaining: reconciliation.reviewQueue.filter((item) => item.severity === "critical").length,
  sourceHashes: evidence.sources.map((source) => ({
    sourceId: source.sourceId,
    contentHash: source.contentHash,
    cachedPath: source.cachedPath,
  })),
  canonicalArtifacts: [
    path.relative(process.cwd(), CURRENT_CANONICAL_PATH),
    path.relative(process.cwd(), CURRENT_FULL_PATH),
    path.relative(process.cwd(), CURRENT_RUNTIME_PATH),
    path.relative(process.cwd(), CURRENT_COMMUNITY_PATH),
    path.relative(process.cwd(), OFFICIALS_SOURCE_HEALTH_PATH),
  ],
  blockers: [],
  provenance: {
    ...evidence.provenance,
    canonicalStatus: "promoted_from_run",
    promotionStatus: "promoted",
  },
  sensitiveValuesIncluded: false,
};
writeJson(CARSON_PROMOTION_AUDIT_PATH, promotionAudit);
writeRunArtifact("carson-city-officials-promotion-audit", runId, promotionAudit);
writeEnvironmentArtifact("carson-city-officials-promotion-audit", promotionAudit.provenance, promotionAudit);

run("npm", ["run", "communities:relationships"]);
run("npm", ["run", "communities:report"]);
run("npm", ["run", "browse:audit"]);

console.log(JSON.stringify({
  status: "promoted",
  runId,
  recordsPromoted: reconciliation.promotedRecords.length,
  canonicalArtifacts: promotionAudit.canonicalArtifacts,
}, null, 2));
