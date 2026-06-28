import {
  CARSON_EVIDENCE_PATH,
  readJson,
  writeSourceVerificationDiagnostic,
  type OfficialsEvidenceArtifact,
} from "@/lib/officials/source-evidence";
import path from "node:path";

const retrievalRun = readJson<Record<string, unknown> | null>("data/generated/officials-retrieval-run.json", null);
const runId = typeof retrievalRun?.runId === "string" ? retrievalRun.runId : null;
const runEvidencePath = runId ? path.join(process.cwd(), "data", "generated", "audits", runId, "carson-city-officials-source-evidence.json") : null;
const evidence = runEvidencePath
  ? readJson<OfficialsEvidenceArtifact | null>(runEvidencePath, null) ?? readJson<OfficialsEvidenceArtifact | null>(CARSON_EVIDENCE_PATH, null)
  : readJson<OfficialsEvidenceArtifact | null>(CARSON_EVIDENCE_PATH, null);

if (!evidence) {
  console.error("carson_city_officials_source_evidence_missing");
  process.exit(1);
}

const diagnostic = writeSourceVerificationDiagnostic(evidence, retrievalRun);
console.log(JSON.stringify({
  runId: diagnostic.runId,
  attempted: diagnostic.totals.attempted,
  verified: diagnostic.totals.verified,
  cached: diagnostic.totals.cached,
  rejected: diagnostic.totals.rejected,
  falsePositiveRule: diagnostic.falsePositiveRule,
  output: "data/generated/carson-city-source-verification-diagnostic.json",
}, null, 2));
