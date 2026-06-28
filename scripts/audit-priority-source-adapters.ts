import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "priority-source-adapter-readiness.json");

const PRIORITY_ORGANIZATIONS = new Map<string, string>([
  ["carson-city-board-of-supervisors", "Carson City"],
  ["reno-city-council", "Reno"],
  ["sparks-city-council", "Sparks"],
  ["washoe-county-commission", "Washoe County"],
  ["clark-county-commission", "Clark County"],
  ["las-vegas-city-council", "Las Vegas"],
  ["henderson-city-council", "Henderson"],
  ["north-las-vegas-city-council", "North Las Vegas"],
  ["clark-county-school-district", "Clark County School District"],
  ["nshe-board-of-regents", "NSHE Board of Regents"],
  ["nv-legislature", "Nevada Legislature"],
  ["nv-senate", "Nevada Senate"],
  ["nv-assembly", "Nevada Assembly"],
]);

type SourceDocument = {
  id: string;
  meetingId: string;
  organizationId: string | null;
  jurisdiction: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  priorityBody: boolean;
};

type RetrievalRecord = {
  documentId: string;
  organizationId: string | null;
  documentType: string;
  sourceUrl: string | null;
  sourceHost: string | null;
  sourcePlatform: string;
  retrievalState: string;
  failureReason: string | null;
};

type AdapterRecoveryRecord = {
  adapterId: string;
  documentId: string;
  recoveryStatus: string;
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function adapterPathFor(platform: string, host: string | null) {
  if (platform === "granicus") return "generic fetch plus Granicus empty-shell companion-agenda recovery";
  if (platform === "primegov") return "generic fetch plus large-download retry; browser/session adapter if source blocks";
  if (platform === "boarddocs") return "generic fetch for public files; BoardDocs browser/manual cache fallback for CloudFront 403 portal pages";
  if (platform === "nevada_legislature") return "generic fetch plus NELIS/manual source registry validation";
  if (host?.includes("cloudfront.net")) return "generic fetch plus high-byte packet retry";
  return "generic fetch, cache, native text extraction, OCR when needed";
}

function statusFor(total: number, extracted: number, blocked: number, recovered: number) {
  if (!total) return "not_configured";
  if (blocked === 0) return recovered ? "adapter_recovered" : "covered";
  if (extracted + recovered > 0) return "partial_adapter_needed";
  return "adapter_needed";
}

const generatedAt = new Date().toISOString();
const documents = readJson<{ records?: SourceDocument[] }>("public-meeting-source-documents.json", { records: [] }).records ?? [];
const queue = readJson<{ records?: RetrievalRecord[] }>("public-meeting-retrieval-queue.json", { records: [] }).records ?? [];
const recoveries = readJson<{ records?: AdapterRecoveryRecord[] }>("public-meeting-source-adapter-recovery.json", { records: [] }).records ?? [];
const queueByDocument = new Map(queue.map((record) => [record.documentId, record]));
const recoveredByDocument = new Map(recoveries.filter((record) => record.recoveryStatus.startsWith("recovered")).map((record) => [record.documentId, record]));

const rows = Array.from(
  documents
    .filter((document) => document.priorityBody || (document.organizationId && PRIORITY_ORGANIZATIONS.has(document.organizationId)))
    .reduce((map, document) => {
      const organizationId = document.organizationId ?? "unknown";
      const key = `${organizationId}|${document.sourcePlatform}|${document.sourceHost ?? "local"}`;
      const current = map.get(key) ?? {
        organizationId,
        jurisdictionName: PRIORITY_ORGANIZATIONS.get(organizationId) ?? document.jurisdiction ?? organizationId,
        sourcePlatform: document.sourcePlatform,
        sourceHost: document.sourceHost,
        documents: 0,
        extracted: 0,
        blocked: 0,
        recoveredByAdapter: 0,
        failed: 0,
        ocrRequired: 0,
        unavailable: 0,
        blockedByNetwork: 0,
        adapterPath: adapterPathFor(document.sourcePlatform, document.sourceHost),
        sampleBlockedSources: [] as Array<{ documentId: string; sourceUrl: string | null; state: string; reason: string | null }>,
      };
      const queueRecord = queueByDocument.get(document.id);
      const recovered = recoveredByDocument.get(document.id);
      const state = queueRecord?.retrievalState ?? "unknown";
      current.documents += 1;
      if (state === "extracted") current.extracted += 1;
      if (recovered) current.recoveredByAdapter += 1;
      if (["failed", "unavailable", "blocked_by_network", "ocr_required"].includes(state)) {
        current.blocked += 1;
        if (state === "failed") current.failed += 1;
        if (state === "ocr_required") current.ocrRequired += 1;
        if (state === "unavailable") current.unavailable += 1;
        if (state === "blocked_by_network") current.blockedByNetwork += 1;
        if (current.sampleBlockedSources.length < 5) {
          current.sampleBlockedSources.push({ documentId: document.id, sourceUrl: document.sourceUrl, state, reason: queueRecord?.failureReason ?? null });
        }
      }
      map.set(key, current);
      return map;
    }, new Map<string, any>())
    .values(),
).map((row) => ({
  ...row,
  status: statusFor(row.documents, row.extracted, row.blocked, row.recoveredByAdapter),
  extractionCoverage: Number(((row.extracted + row.recoveredByAdapter) / Math.max(1, row.documents)).toFixed(3)),
  nextAction:
    row.blocked === 0
      ? "continue scheduled monitoring"
      : row.sourcePlatform === "granicus"
        ? "run meetings:adapters:recover, then review any remaining Granicus shells"
        : row.sourcePlatform === "boarddocs"
          ? "use browser/manual cache fallback for BoardDocs public portal pages if source documents remain blocked"
          : row.sourcePlatform === "primegov"
            ? "retry high-byte generic fetch, then add per-host PrimeGov adapter only for persistent blocks"
            : "inspect blocked samples and add source-specific adapter only if generic fetch/OCR cannot recover",
}));

const uncoveredPriority = Array.from(PRIORITY_ORGANIZATIONS.entries())
  .filter(([organizationId]) => !rows.some((row) => row.organizationId === organizationId))
  .map(([organizationId, jurisdictionName]) => ({ organizationId, jurisdictionName, status: "not_configured", nextAction: "add meeting source registry entry before Sprint 2 expansion" }));

const allRows = [...rows, ...uncoveredPriority].sort((left, right) => left.jurisdictionName.localeCompare(right.jurisdictionName) || String(left.sourcePlatform ?? "").localeCompare(String(right.sourcePlatform ?? "")));
const audit = {
  generatedAt,
  totals: {
    priorityOrganizations: PRIORITY_ORGANIZATIONS.size,
    adapterRows: allRows.length,
    coveredRows: allRows.filter((row) => row.status === "covered" || row.status === "adapter_recovered").length,
    partialRows: allRows.filter((row) => row.status === "partial_adapter_needed").length,
    adapterNeededRows: allRows.filter((row) => row.status === "adapter_needed").length,
    notConfiguredRows: allRows.filter((row) => row.status === "not_configured").length,
    blockedDocuments: allRows.reduce((sum, row) => sum + (row.blocked ?? 0), 0),
    recoveredByAdapter: allRows.reduce((sum, row) => sum + (row.recoveredByAdapter ?? 0), 0),
  },
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, rows: allRows, audit }, null, 2)}\n`);
console.log(`Generated priority source adapter readiness at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
