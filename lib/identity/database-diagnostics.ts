import { createHash } from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";

import { ADMIN_OPERATION_TABLES, IDENTITY_TABLES, isDatabaseConfigured } from "@/lib/identity/durable-storage";
import { getPrismaClient } from "@/lib/prisma";

export type DatabaseDiagnosticStatus =
  | "database_url_missing"
  | "malformed_database_url"
  | "unsupported_prisma_engine"
  | "dns_failure"
  | "tcp_connection_failure"
  | "connection_timeout"
  | "tls_failure"
  | "authentication_failure"
  | "database_not_found"
  | "database_reachable"
  | "prisma_migration_table_missing"
  | "pending_migrations"
  | "schema_mismatch"
  | "insufficient_database_permissions"
  | "environment_network_unavailable"
  | "unknown_error";

type ProbeStatus = "ok" | "skipped" | "failed" | "timeout";

export type DatabaseConnectivityAudit = {
  generatedAt: string;
  safe: {
    credentialsRedacted: true;
    readOnlyQuery: true;
    boundedTimeoutMs: number;
    schemaChanges: false;
  };
  configuration: {
    configured: boolean;
    provider: string | null;
    protocol: string | null;
    hostSummary: string | null;
    hostFingerprint: string | null;
    port: number | null;
    databaseNamePresent: boolean;
    schemaParameterPresent: boolean;
    placeholderLike: boolean;
  };
  probes: {
    url: { status: ProbeStatus; reason: string | null };
    dns: { status: ProbeStatus; reason: string | null };
    tcp: { status: ProbeStatus; reason: string | null };
    readOnlyQuery: { status: ProbeStatus; reason: string | null };
    migrationTable: { status: ProbeStatus; reason: string | null; appliedMigrations: number | null; localMigrations: number };
    schema: { status: ProbeStatus; reason: string | null; missingTables: string[] };
  };
  classification: DatabaseDiagnosticStatus;
  operatorGuidance: string[];
  sensitiveValuesIncluded: false;
};

const DEFAULT_TIMEOUT_MS = 5000;
const SUPPORTED_PROTOCOLS = new Set(["postgresql:", "postgres:"]);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutValue: T) {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(timeoutValue), timeoutMs);
    }),
  ]);
}

function summarizeHost(hostname: string | null) {
  if (!hostname) return null;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return hostname;
  const labels = hostname.split(".");
  if (labels.length <= 1) return `${hostname.slice(0, 3)}***`;
  const suffix = labels.slice(-2).join(".");
  return `${labels[0].slice(0, 3)}***.${suffix}`;
}

function fingerprintHost(hostname: string | null) {
  if (!hostname) return null;
  return createHash("sha256").update(hostname).digest("hex").slice(0, 12);
}

function safeErrorReason(error: unknown) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  let databaseHost: string | null = null;
  try {
    databaseHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null;
  } catch {
    databaseHost = null;
  }
  return message
    .replaceAll(process.env.DATABASE_URL ?? "", "[redacted_database_url]")
    .replaceAll(databaseHost ?? "", "[redacted_database_host]")
    .replace(/\/\/[^:@/\s]+:[^@/\s]+@/g, "//[redacted]@")
    .replace(/password=([^&\s]+)/gi, "password=[redacted]")
    .replace(/sslcert=([^&\s]+)/gi, "sslcert=[redacted]")
    .replace(/sslkey=([^&\s]+)/gi, "sslkey=[redacted]")
    .slice(0, 500);
}

function classifyError(reason: string | null): DatabaseDiagnosticStatus {
  const text = (reason ?? "").toLowerCase();
  if (!text) return "unknown_error";
  if (text.includes("timed out") || text.includes("timeout") || text.includes("etimedout")) return "connection_timeout";
  if (text.includes("getaddrinfo") || text.includes("enotfound") || text.includes("enodata")) return "dns_failure";
  if (text.includes("enotreach") || text.includes("enetunreach") || text.includes("ehostunreach") || text.includes("network is unreachable")) return "environment_network_unavailable";
  if (text.includes("authentication failed") || text.includes("password authentication failed") || text.includes("invalid_authorization")) return "authentication_failure";
  if (text.includes("database") && text.includes("does not exist")) return "database_not_found";
  if (text.includes("permission denied") || text.includes("insufficient privilege") || text.includes("42501")) return "insufficient_database_permissions";
  if (text.includes("tls") || text.includes("ssl") || text.includes("certificate")) return "tls_failure";
  if (text.includes("can't reach database server") || text.includes("connect econnrefused") || text.includes("econnreset")) return "tcp_connection_failure";
  return "unknown_error";
}

function sandboxNetworkDisabled() {
  return process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1" || process.env.CODEX_SANDBOX_NETWORK_DISABLED === "true";
}

async function tcpProbe(hostname: string, port: number, timeoutMs: number) {
  return new Promise<{ status: ProbeStatus; reason: string | null }>((resolve) => {
    const socket = net.createConnection({ host: hostname, port });
    const done = (status: ProbeStatus, reason: string | null) => {
      socket.destroy();
      resolve({ status, reason });
    };
    socket.setTimeout(timeoutMs, () => done("timeout", "connection_timeout"));
    socket.once("connect", () => done("ok", null));
    socket.once("error", (error) => done("failed", safeErrorReason(error)));
  });
}

export async function runDatabaseConnectivityAudit(options: { timeoutMs?: number } = {}): Promise<DatabaseConnectivityAudit> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const localMigrations = await import("node:fs").then(({ existsSync, readdirSync }) => {
    const migrationsDir = `${process.cwd()}/prisma/migrations`;
    if (!existsSync(migrationsDir)) return 0;
    return readdirSync(migrationsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
  });

  const audit: DatabaseConnectivityAudit = {
    generatedAt: new Date().toISOString(),
    safe: {
      credentialsRedacted: true,
      readOnlyQuery: true,
      boundedTimeoutMs: timeoutMs,
      schemaChanges: false,
    },
    configuration: {
      configured: isDatabaseConfigured(),
      provider: null,
      protocol: null,
      hostSummary: null,
      hostFingerprint: null,
      port: null,
      databaseNamePresent: false,
      schemaParameterPresent: false,
      placeholderLike: Boolean(process.env.DATABASE_URL?.includes("placeholder")),
    },
    probes: {
      url: { status: "skipped", reason: null },
      dns: { status: "skipped", reason: null },
      tcp: { status: "skipped", reason: null },
      readOnlyQuery: { status: "skipped", reason: null },
      migrationTable: { status: "skipped", reason: null, appliedMigrations: null, localMigrations },
      schema: { status: "skipped", reason: null, missingTables: [] },
    },
    classification: "unknown_error",
    operatorGuidance: [],
    sensitiveValuesIncluded: false,
  };

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes("placeholder")) {
    audit.probes.url = { status: "failed", reason: "DATABASE_URL is missing or placeholder-like." };
    audit.classification = "database_url_missing";
    audit.operatorGuidance.push("Set DATABASE_URL in a network-enabled terminal or protected deployment environment, then rerun npm run database:diagnose.");
    return audit;
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch (error) {
    audit.probes.url = { status: "failed", reason: safeErrorReason(error) };
    audit.classification = "malformed_database_url";
    audit.operatorGuidance.push("Fix DATABASE_URL formatting; do not paste credentials into issue reports or generated artifacts.");
    return audit;
  }

  audit.configuration = {
    configured: true,
    provider: parsed.protocol.replace(":", ""),
    protocol: parsed.protocol,
    hostSummary: summarizeHost(parsed.hostname),
    hostFingerprint: fingerprintHost(parsed.hostname),
    port: parsed.port ? Number(parsed.port) : 5432,
    databaseNamePresent: parsed.pathname.replace("/", "").length > 0,
    schemaParameterPresent: parsed.searchParams.has("schema"),
    placeholderLike: false,
  };
  audit.probes.url = { status: "ok", reason: null };

  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    audit.classification = "unsupported_prisma_engine";
    audit.operatorGuidance.push("This project expects the Prisma PostgreSQL provider. Preserve production provider compatibility before changing engines.");
    return audit;
  }

  const hostname = parsed.hostname;
  const port = parsed.port ? Number(parsed.port) : 5432;
  const dnsResult = await withTimeout(
    dns.lookup(hostname).then(() => ({ status: "ok" as ProbeStatus, reason: null })).catch((error) => ({ status: "failed" as ProbeStatus, reason: safeErrorReason(error) })),
    timeoutMs,
    { status: "timeout" as ProbeStatus, reason: "dns_timeout" },
  );
  audit.probes.dns = dnsResult;
  if (dnsResult.status !== "ok") {
    audit.classification = dnsResult.status === "timeout" || sandboxNetworkDisabled() ? "environment_network_unavailable" : classifyError(dnsResult.reason);
    audit.operatorGuidance.push("DNS did not resolve from this execution environment; retry from the user's Mac terminal or protected CI before treating the database endpoint as invalid.");
    return audit;
  }

  audit.probes.tcp = await tcpProbe(hostname, port, timeoutMs);
  if (audit.probes.tcp.status !== "ok") {
    const tcpClass = classifyError(audit.probes.tcp.reason);
    audit.classification = audit.probes.tcp.status === "timeout" || tcpClass === "connection_timeout" || tcpClass === "environment_network_unavailable"
      ? "environment_network_unavailable"
      : tcpClass === "unknown_error"
        ? "tcp_connection_failure"
        : tcpClass;
    audit.operatorGuidance.push("TCP connectivity is blocked or failing before Prisma can verify schema. Run the operator sequence from a network-enabled environment.");
    return audit;
  }

  const prisma = getPrismaClient();
  const readOnly = await withTimeout(
    prisma.$queryRawUnsafe<Array<{ ok: number }>>("select 1 as ok").then(() => ({ status: "ok" as ProbeStatus, reason: null })).catch((error) => ({ status: "failed" as ProbeStatus, reason: safeErrorReason(error) })),
    timeoutMs,
    { status: "timeout" as ProbeStatus, reason: "prisma_read_only_query_timeout" },
  );
  audit.probes.readOnlyQuery = readOnly;
  if (readOnly.status !== "ok") {
    audit.classification = readOnly.status === "timeout" ? "connection_timeout" : classifyError(readOnly.reason);
    audit.operatorGuidance.push("The network path opened but the read-only Prisma query failed. Review authentication, database name, TLS, and permissions.");
    await prisma.$disconnect().catch(() => null);
    return audit;
  }

  const migrationTable = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    "select count(*)::bigint as count from information_schema.tables where table_schema='public' and table_name='_prisma_migrations'",
  ).catch((error) => {
    audit.probes.migrationTable = { status: "failed", reason: safeErrorReason(error), appliedMigrations: null, localMigrations };
    return null;
  });
  if (!migrationTable || Number(migrationTable[0]?.count ?? 0) === 0) {
    audit.probes.migrationTable = { status: "failed", reason: "Prisma migration table missing.", appliedMigrations: null, localMigrations };
    audit.classification = "prisma_migration_table_missing";
  } else {
    const applied = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>('select count(*)::bigint as count from "_prisma_migrations" where "finished_at" is not null').catch(() => [{ count: BigInt(0) }]);
    const appliedMigrations = Number(applied[0]?.count ?? 0);
    audit.probes.migrationTable = { status: "ok", reason: null, appliedMigrations, localMigrations };
    if (localMigrations > appliedMigrations) audit.classification = "pending_migrations";
  }

  const expectedTables = [...IDENTITY_TABLES, ...ADMIN_OPERATION_TABLES];
  const tableRows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `select table_name from information_schema.tables where table_schema='public' and table_name in (${expectedTables.map((table) => `'${table}'`).join(",")})`,
  ).catch((error) => {
    audit.probes.schema = { status: "failed", reason: safeErrorReason(error), missingTables: expectedTables };
    return null;
  });
  if (tableRows) {
    const existing = new Set(tableRows.map((row) => row.table_name));
    const missingTables = expectedTables.filter((table) => !existing.has(table));
    audit.probes.schema = {
      status: missingTables.length ? "failed" : "ok",
      reason: missingTables.length ? "Sprint 2I durable identity/admin-operation tables are missing." : null,
      missingTables,
    };
    if (missingTables.length && audit.classification === "database_reachable") audit.classification = "schema_mismatch";
  }

  await prisma.$disconnect().catch(() => null);

  if (audit.classification === "unknown_error") audit.classification = "database_reachable";
  if (audit.classification === "database_reachable" && audit.probes.schema.status === "failed") audit.classification = "schema_mismatch";
  if (audit.classification === "database_reachable" && audit.probes.migrationTable.status === "failed") audit.classification = "prisma_migration_table_missing";
  if (!audit.operatorGuidance.length) {
    audit.operatorGuidance.push(
      audit.classification === "database_reachable"
        ? "Database is reachable for read-only diagnostics. Continue with migration status and identity migration dry-run."
        : "Resolve the classified blocker before applying durable identity migration.",
    );
  }

  return audit;
}
