import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export type AuditEnvironment =
  | "codex_sandbox"
  | "local_network_enabled"
  | "github_actions"
  | "production"
  | "unknown";

export type NetworkCapability = "available" | "unavailable" | "unknown";

export type AuditProvenance = {
  runId: string;
  generatedAt: string;
  executionEnvironment: AuditEnvironment;
  networkCapability: NetworkCapability;
  databaseReachability: string;
  storageBackend: string;
  workerBackend: string;
  gitCommit: string | null;
  canonicalStatus: "not_canonical" | "canonical" | "promoted_from_run";
  artifactName: string;
};

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const AUDITS_DIR = path.join(GENERATED_DIR, "audits");

function safeGitCommit() {
  try {
    return execSync("git rev-parse --short=12 HEAD", { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function detectAuditEnvironment(databaseReachability?: string): AuditEnvironment {
  if (process.env.CODEX_SANDBOX || process.env.CODEX_SANDBOX_NETWORK_DISABLED) return "codex_sandbox";
  if (process.env.GITHUB_ACTIONS === "true") return "github_actions";
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") return "production";
  if (databaseReachability === "database_reachable") return "local_network_enabled";
  return "unknown";
}

export function detectNetworkCapability(databaseReachability?: string): NetworkCapability {
  if (process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1" || process.env.CODEX_SANDBOX_NETWORK_DISABLED === "true") return "unavailable";
  if (databaseReachability === "database_reachable") return "available";
  return "unknown";
}

export function environmentSlug(environment: AuditEnvironment) {
  return environment.replaceAll("_", "-");
}

export function createAuditProvenance(input: {
  artifactName: string;
  databaseReachability?: string | null;
  storageBackend?: string | null;
  workerBackend?: string | null;
  generatedAt?: string;
  executionEnvironment?: AuditEnvironment;
  networkCapability?: NetworkCapability;
}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const databaseReachability = input.databaseReachability ?? "unknown";
  const executionEnvironment = input.executionEnvironment ?? detectAuditEnvironment(databaseReachability);
  const runId = `${generatedAt.replace(/[-.\u003ATZ]/g, "").slice(0, 14)}-${environmentSlug(executionEnvironment)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    runId,
    generatedAt,
    executionEnvironment,
    networkCapability: input.networkCapability ?? detectNetworkCapability(databaseReachability),
    databaseReachability,
    storageBackend: input.storageBackend ?? "unknown",
    workerBackend: input.workerBackend ?? "unknown",
    gitCommit: safeGitCommit(),
    canonicalStatus: "not_canonical" as const,
    artifactName: input.artifactName,
  };
}

export function writeProvenancedAudit<T extends Record<string, unknown>>(artifactName: string, report: T & { provenance?: AuditProvenance }) {
  const provenance = report.provenance ?? createAuditProvenance({ artifactName });
  const next = { ...report, provenance };
  mkdirSync(GENERATED_DIR, { recursive: true });
  const runDir = path.join(AUDITS_DIR, provenance.runId);
  mkdirSync(runDir, { recursive: true });

  const environmentPath = path.join(GENERATED_DIR, `${artifactName}.${environmentSlug(provenance.executionEnvironment)}.json`);
  const runPath = path.join(runDir, `${artifactName}.json`);
  writeFileSync(runPath, `${JSON.stringify(next, null, 2)}\n`);
  writeFileSync(environmentPath, `${JSON.stringify(next, null, 2)}\n`);
  return { report: next, runPath, environmentPath };
}

export function readAuditByRunId(runId: string, artifactName: string) {
  const filePath = path.join(AUDITS_DIR, runId, `${artifactName}.json`);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown> & { provenance?: AuditProvenance };
}

export function readJsonIfExists(filePath: string) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

export function promoteAudit(input: {
  runId: string;
  artifactName: string;
  requireNetwork?: boolean;
}) {
  const source = readAuditByRunId(input.runId, input.artifactName);
  if (!source) throw new Error("audit_source_not_found");
  const provenance = source.provenance;
  if (!provenance) throw new Error("audit_source_missing_provenance");
  if (source.sensitiveValuesIncluded !== false) throw new Error("audit_source_sensitive_values_not_explicitly_absent");
  if (input.requireNetwork !== false && provenance.networkCapability !== "available") throw new Error("audit_source_not_network_enabled");
  if (!provenance.databaseReachability || provenance.databaseReachability === "unknown") throw new Error("audit_source_missing_database_check");
  const promotion = source.promotion as { eligible?: boolean } | undefined;
  if (promotion && promotion.eligible === false) throw new Error("audit_source_not_eligible_for_promotion");

  const canonicalPath = path.join(GENERATED_DIR, `${input.artifactName}.json`);
  const archiveDir = path.join(AUDITS_DIR, "canonical-archive");
  mkdirSync(archiveDir, { recursive: true });
  if (existsSync(canonicalPath)) {
    const archivePath = path.join(archiveDir, `${new Date().toISOString().replace(/[-.\u003ATZ]/g, "").slice(0, 14)}-${input.artifactName}.json`);
    renameSync(canonicalPath, archivePath);
  }
  const promoted = {
    ...source,
    provenance: {
      ...provenance,
      canonicalStatus: "promoted_from_run" as const,
    },
    promotedAt: new Date().toISOString(),
    promotedFromRunId: input.runId,
  };
  writeFileSync(canonicalPath, `${JSON.stringify(promoted, null, 2)}\n`);
  return { canonicalPath, promoted };
}
