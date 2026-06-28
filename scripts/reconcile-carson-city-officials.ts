import {
  CARSON_EVIDENCE_PATH,
  CARSON_PROMOTION_AUDIT_PATH,
  CARSON_RECONCILIATION_PATH,
  readJson,
  reconcileCarsonCityOfficials,
  writeEnvironmentArtifact,
  writeJson,
  writeReconciliationArtifacts,
  writeRunArtifact,
  type OfficialsEvidenceArtifact,
  type OfficialsPromotionAudit,
} from "@/lib/officials/source-evidence";
import type { CurrentOfficialRuntimeRecord } from "@/lib/officials/current-officeholders";
import path from "node:path";

function argValue(name: string) {
  const flag = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return flag?.split("=").slice(1).join("=");
}

function latestRunId() {
  const run = readJson<{ runId?: string }>("data/generated/officials-retrieval-run.json", {});
  return run.runId ?? null;
}

const runId = argValue("--run-id") ?? latestRunId();
const runEvidencePath = runId ? path.join(process.cwd(), "data", "generated", "audits", runId, "carson-city-officials-source-evidence.json") : null;
const evidence = runEvidencePath ? readJson<OfficialsEvidenceArtifact | null>(runEvidencePath, null) ?? readJson<OfficialsEvidenceArtifact | null>(CARSON_EVIDENCE_PATH, null) : readJson<OfficialsEvidenceArtifact | null>(CARSON_EVIDENCE_PATH, null);
if (!evidence) {
  console.error("carson_city_officials_source_evidence_missing");
  process.exit(1);
}

const runtimeArtifact = readJson<{ records?: CurrentOfficialRuntimeRecord[] }>("data/generated/current-officials-runtime.json", { records: [] });
const reconciliation = reconcileCarsonCityOfficials({
  evidence,
  existingRuntime: runtimeArtifact.records ?? [],
});
writeReconciliationArtifacts(reconciliation);

const promotionAudit: OfficialsPromotionAudit = {
  generatedAt: reconciliation.generatedAt,
  runId: reconciliation.runId,
  promotedAt: null,
  promotedFromRunId: null,
  jurisdiction: "carson-city",
  status: reconciliation.promotion.eligible ? "not_promoted" : "blocked",
  recordsPromoted: 0,
  conflictsRemaining: reconciliation.reviewQueue.filter((item) => item.severity === "critical").length,
  sourceHashes: evidence.sources.map((source) => ({
    sourceId: source.sourceId,
    contentHash: source.contentHash,
    cachedPath: source.cachedPath,
  })),
  canonicalArtifacts: [],
  blockers: reconciliation.promotion.blockers,
  provenance: reconciliation.provenance,
  sensitiveValuesIncluded: false,
};

if (!readJson<{ promotion?: unknown } | null>("data/generated/current-officials-canonical.json", null)?.promotion) {
  writeJson(CARSON_PROMOTION_AUDIT_PATH, promotionAudit);
}
writeRunArtifact("carson-city-officials-promotion-audit", reconciliation.runId, promotionAudit);
writeEnvironmentArtifact("carson-city-officials-promotion-audit", reconciliation.provenance, promotionAudit);

console.log(JSON.stringify({
  runId: reconciliation.runId,
  recordsParsed: reconciliation.parser.recordsParsed,
  sourceFilesParsed: reconciliation.parser.sourceFilesParsed,
  reviewQueueRecords: reconciliation.parser.reviewQueueRecords,
  eligibleForPromotion: reconciliation.promotion.eligible,
  blockers: reconciliation.promotion.blockers,
  output: [CARSON_RECONCILIATION_PATH, CARSON_PROMOTION_AUDIT_PATH],
}, null, 2));
