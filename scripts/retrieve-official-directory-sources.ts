import { mkdirSync, writeFileSync } from "node:fs";
import { lookup } from "node:dns/promises";
import path from "node:path";

import { getOfficialDirectorySources } from "@/lib/officials/current-officeholders";
import {
  buildEvidenceArtifact,
  buildFailedEvidenceRecord,
  buildRetrievedEvidenceRecord,
  CARSON_SOURCE_MANIFEST_PATH,
  officialExecutionEnvironment,
  officialNetworkCapability,
  OFFICIALS_GENERATED_DIR,
  OFFICIALS_RAW_DIR,
  type OfficialsNetworkDiagnostics,
  type OfficialsSourceDiagnosticClassification,
  type OfficialsRetrievalStatus,
  writeEnvironmentSourceHealth,
  writeEvidenceArtifacts,
  writeJson,
  writeSourceVerificationDiagnostic,
} from "@/lib/officials/source-evidence";

const RUN_PATH = path.join(OFFICIALS_GENERATED_DIR, "officials-retrieval-run.json");

function argValue(name: string) {
  const flag = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return flag?.split("=").slice(1).join("=");
}

function classifyError(error: unknown, networkDiagnostics: OfficialsNetworkDiagnostics): { status: OfficialsRetrievalStatus; diagnosticClassification: OfficialsSourceDiagnosticClassification; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  if (/redirect|maximum redirects/i.test(message)) return { status: "source_unavailable", diagnosticClassification: "redirect_loop", message };
  if (/CERT|TLS|SSL|certificate/i.test(message)) return { status: "source_unavailable", diagnosticClassification: "tls_failure", message };
  if (/ETIMEDOUT|timeout|abort|AbortError/i.test(message)) return { status: "source_unavailable", diagnosticClassification: "timeout", message };
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return {
      status: networkDiagnostics.dns === "blocked" ? "blocked_by_environment" : "source_unavailable",
      diagnosticClassification: networkDiagnostics.dns === "blocked" ? "environment_dns_blocked" : "source_dns_failure",
      message,
    };
  }
  if (/network|fetch failed|EPERM|ECONNREFUSED|operation not permitted|not permitted/i.test(message)) {
    return { status: "blocked_by_environment", diagnosticClassification: "environment_dns_blocked", message };
  }
  return { status: "source_unavailable", diagnosticClassification: "unknown_error", message };
}

async function networkDiagnostics(generatedAt: string): Promise<OfficialsNetworkDiagnostics> {
  const checkedUrls: OfficialsNetworkDiagnostics["checkedUrls"] = [];
  let dns: OfficialsNetworkDiagnostics["dns"] = "unknown";
  let https: OfficialsNetworkDiagnostics["https"] = "unknown";

  try {
    await lookup("www.google.com");
    dns = "available";
    checkedUrls.push({ url: "dns:www.google.com", ok: true, status: "resolved", message: null });
  } catch (error) {
    dns = "blocked";
    checkedUrls.push({ url: "dns:www.google.com", ok: false, status: "dns_failed", message: error instanceof Error ? error.message : String(error) });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch("https://www.google.com", { method: "HEAD", redirect: "follow", signal: controller.signal });
    clearTimeout(timeout);
    https = response.ok || [301, 302, 303, 307, 308].includes(response.status) ? "available" : "blocked";
    checkedUrls.push({ url: "https://www.google.com", ok: https === "available", status: `http_${response.status}`, message: null });
  } catch (error) {
    https = "blocked";
    checkedUrls.push({ url: "https://www.google.com", ok: false, status: "https_failed", message: error instanceof Error ? error.message : String(error) });
  }

  const downloadsHint = https === "available" && dns === "available" ? 1 : 0;
  return {
    generatedAt,
    environment: officialExecutionEnvironment(downloadsHint),
    runnerType: process.env.RUNNER_NAME ?? process.env.RUNNER_OS ?? (process.env.GITHUB_ACTIONS === "true" ? "github_actions" : "local"),
    commitSha: process.env.GITHUB_SHA ?? null,
    triggerType: process.env.GITHUB_EVENT_NAME ?? "manual",
    actor: process.env.GITHUB_ACTOR ?? process.env.USER ?? "unknown",
    dns,
    https,
    networkCapability: officialNetworkCapability(downloadsHint),
    checkedUrls,
  };
}

function filteredSources(generatedAt: string) {
  const jurisdiction = argValue("--jurisdiction");
  const sourceId = argValue("--source-id");
  return getOfficialDirectorySources(generatedAt).filter((source) => {
    if (!source.sourceUrl.startsWith("http")) return false;
    if (jurisdiction && source.jurisdictionId !== jurisdiction) return false;
    if (sourceId && source.id !== sourceId) return false;
    return true;
  });
}

async function retrieveSource(source: ReturnType<typeof getOfficialDirectorySources>[number], generatedAt: string, diagnostics: OfficialsNetworkDiagnostics) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(source.sourceUrl, {
      headers: {
        "user-agent": process.env.DATAOPS_USER_AGENT ?? "DirectDemocracyDataOps/0.1 public-source retrieval",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const declaredContentType = response.headers.get("content-type");
    const finalUrl = response.url || source.sourceUrl;
    const redirectCount = response.redirected || finalUrl !== source.sourceUrl ? 1 : 0;
    const body = await response.text();

    return buildRetrievedEvidenceRecord({
      source,
      generatedAt,
      finalUrl,
      httpStatus: response.status,
      declaredContentType,
      body,
      redirectCount,
    });
  } catch (error) {
    clearTimeout(timeout);
    const classification = classifyError(error, diagnostics);
    return buildFailedEvidenceRecord({
      source,
      generatedAt,
      status: classification.status,
      diagnosticClassification: classification.diagnosticClassification,
      errorMessage: classification.message,
      rejectionReason: classification.diagnosticClassification,
    });
  }
}

async function main() {
  const generatedAt = new Date().toISOString();
  const sources = filteredSources(generatedAt);
  const diagnostics = await networkDiagnostics(generatedAt);

  mkdirSync(OFFICIALS_GENERATED_DIR, { recursive: true });
  mkdirSync(OFFICIALS_RAW_DIR, { recursive: true });

  const records = [];
  for (const source of sources) {
    records.push(await retrieveSource(source, generatedAt, diagnostics));
  }

  const evidence = buildEvidenceArtifact({
    generatedAt,
    records,
    networkDiagnostics: diagnostics,
    workerBackend: process.env.GITHUB_ACTIONS === "true" ? "github_actions" : "local_operator",
  });
  writeEvidenceArtifacts(evidence);
  writeEnvironmentSourceHealth(evidence, 0);
  writeJson(CARSON_SOURCE_MANIFEST_PATH, {
    generatedAt,
    runId: evidence.runId,
    jurisdiction: evidence.jurisdiction,
    evidencePersistence: evidence.evidencePersistence,
    sources: records.map((record) => ({
      sourceId: record.sourceId,
      sourceUrl: record.sourceUrl,
      finalUrl: record.finalUrl,
      status: record.status,
      diagnosticClassification: record.diagnosticClassification,
      cachedPath: record.cachedPath,
      versionedCachedPath: record.versionedCachedPath,
      contentHash: record.contentHash,
      bytes: record.bytes,
      pageTitle: record.verification.pageTitle,
      verifierClassification: record.diagnosticClassification,
      positiveSignals: record.verification.positiveSignals,
      negativeSignals: record.verification.negativeSignals,
      parserEligibility: record.verification.parserEligibility,
      lastCheckedAt: record.lastCheckedAt,
      lastSeenAt: record.lastSeenAt,
    })),
    sensitiveValuesIncluded: false,
  });

  const report = {
    generatedAt,
    runId: evidence.runId,
    environment: evidence.provenance.executionEnvironment,
    networkCapability: evidence.provenance.networkCapability,
    networkDiagnostics: diagnostics,
    records,
    totals: {
      attempted: records.length,
      retrievedVerified: records.filter((record) => record.status === "retrieved_verified").length,
      unchanged: records.filter((record) => record.status === "unchanged").length,
      changed: records.filter((record) => record.status === "changed").length,
      blockedByEnvironment: records.filter((record) => record.status === "blocked_by_environment").length,
      sourceUnavailable: records.filter((record) => record.status === "source_unavailable").length,
      probableErrorPages: records.filter((record) => record.status === "probable_error_page").length,
      contentMismatch: records.filter((record) => record.status === "content_mismatch").length,
      cachedFilesAdded: records.filter((record) => Boolean(record.cachedPath && record.contentHash)).length,
    },
    artifacts: [
      "data/generated/carson-city-officials-source-evidence.json",
      "data/generated/carson-city-officials-source-manifest.json",
      `data/generated/audits/${evidence.runId}/carson-city-officials-source-evidence.json`,
      `data/generated/carson-city-officials-source-evidence.${evidence.provenance.executionEnvironment.replaceAll("_", "-")}.json`,
    ],
    note: "A source is marked retrieved only when verified HTML is written to a local cache. Raw HTML is never written into generated public artifacts.",
  };

  writeFileSync(RUN_PATH, `${JSON.stringify(report, null, 2)}\n`);
  writeJson(path.join(OFFICIALS_GENERATED_DIR, `officials-retrieval-run.${evidence.provenance.executionEnvironment.replaceAll("_", "-")}.json`), report);
  writeSourceVerificationDiagnostic(evidence, report);
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(`Wrote ${path.relative(process.cwd(), RUN_PATH)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
