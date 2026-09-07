import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const script = path.join(process.cwd(), "scripts/audit-dataops-freshness.ts");
const fixture = mkdtempSync(path.join(os.tmpdir(), "dd-freshness-audit-"));
const generated = path.join(fixture, "data/generated");
mkdirSync(generated, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(path.join(generated, name), JSON.stringify(data));
const metadataPath = "data/manual-sources/public-meetings/henderson-city-council/metadata/undated-api-json-1-shared-getfontsizecookie.json";
const metadata = {
  documentId: "historical-font-size", meetingId: "obsolete-meeting", documentType: "unknown", sourceUrl: null,
  sourcePath: metadataPath, stableLocalPath: metadataPath, contentHash: "a".repeat(64), sourceVersion: 1,
};
const missingMinutes = {
  documentId: "real-minutes", meetingId: "current-meeting", documentType: "minutes", sourceUrl: "https://example.gov/minutes.pdf",
  stableLocalPath: "data/generated/public-meeting-document-cache/source/minutes.pdf", contentHash: "b".repeat(64), sourceVersion: 1,
};
type Reference = { id?: string; documentId?: string; sourcePath?: string; cachePath?: string };
function setup(options: {
  cache?: unknown[]; documents?: Reference[]; queue?: Reference[]; meetings?: Array<{ id: string; meeting_alias_ids?: string[] }>;
} = {}) {
  write("public-meeting-document-cache-index.json", { records: options.cache ?? [metadata] });
  write("public-meeting-source-documents.json", { records: options.documents ?? [] });
  write("public-meeting-retrieval-queue.json", { records: options.queue ?? [] });
  write("public-meetings.json", options.meetings ?? [{ id: "current-meeting" }]);
  write("dataops-monitoring-status.json", { records: [{ healthStatus: "healthy" }] });
  write("rss-source-registry.json", { records: [{ id: "rss" }] });
  write("dataops-reprocessing-runs.json", { runs: [{ id: "processed" }] });
}
function run() {
  const result = spawnSync(process.execPath, ["--import", require.resolve("tsx"), script], {
    cwd: fixture,
    env: { ...process.env, GITHUB_ACTIONS: "false", DATAOPS_ALLOW_EXTERNAL_MEETING_CACHE: "false" },
    encoding: "utf8",
  });
  assert.equal(result.error, undefined);
  const audit = JSON.parse(readFileSync(path.join(generated, "dataops-freshness-audit.json"), "utf8"));
  return { status: result.status, audit };
}

try {
  setup();
  let result = run();
  assert.equal(result.status, 0);
  assert.equal(result.audit.totals.cacheRecords, 1, "Historical cache inventory remains visible");
  assert.equal(result.audit.totals.auditedCacheRecords, 0);
  assert.equal(result.audit.totals.excludedMetadataCacheRecords, 1);
  assert.equal(result.audit.totals.missingLocalCacheFiles, 0);

  setup({ cache: [metadata, missingMinutes] });
  result = run();
  assert.equal(result.status, 1, "A missing real minutes document must still fail beside excluded metadata");
  assert.equal(result.audit.totals.excludedMetadataCacheRecords, 1);
  assert.equal(result.audit.totals.auditedCacheRecords, 1);
  assert.equal(result.audit.totals.missingLocalCacheFiles, 1);
  assert.deepEqual(result.audit.failures, ["Cached document real-minutes local path does not exist"]);

  const scenarios: Array<[string, Parameters<typeof setup>[0]]> = [
    ["Known minutes cannot be excluded", { cache: [{ ...metadata, documentType: "minutes" }] }],
    ["An ordinary unknown document cannot be excluded", { cache: [{ ...missingMinutes, documentType: "unknown", sourceUrl: null }] }],
    ["Other cookie metadata cannot be excluded", { cache: [{ ...metadata, sourcePath: metadataPath.replace("getfontsizecookie", "sessioncookie"), stableLocalPath: metadataPath.replace("getfontsizecookie", "sessioncookie") }] }],
    ["A source URL prevents the metadata exception", { cache: [{ ...metadata, sourceUrl: "https://example.gov/source" }] }],
    ["A current document ID prevents exclusion", { documents: [{ id: metadata.documentId }] }],
    ["A current queue ID prevents exclusion", { queue: [{ documentId: metadata.documentId }] }],
    ["A current document with a different ID but same path prevents exclusion", { documents: [{ id: "new-id", sourcePath: metadataPath }] }],
    ["A current queue cache path prevents exclusion", { queue: [{ documentId: "new-id", cachePath: metadataPath }] }],
    ["A current meeting prevents exclusion", { meetings: [{ id: metadata.meetingId }] }],
    ["A current meeting alias prevents exclusion", { meetings: [{ id: "canonical", meeting_alias_ids: [metadata.meetingId] }] }],
  ];
  for (const [message, options] of scenarios) {
    setup(options);
    result = run();
    assert.equal(result.status, 1, message);
    assert.equal(result.audit.totals.excludedMetadataCacheRecords, 0, message);
    assert.equal(result.audit.totals.missingLocalCacheFiles, 1, message);
  }
  for (const unavailable of ["public-meeting-source-documents.json", "public-meeting-retrieval-queue.json", "public-meetings.json"]) {
    setup();
    rmSync(path.join(generated, unavailable));
    result = run();
    assert.equal(result.status, 1, "Unavailable current references cannot prove historical metadata is obsolete");
    assert.equal(result.audit.totals.excludedMetadataCacheRecords, 0);
  }
  console.log("DataOps freshness fixtures passed: narrowly counted orphan metadata, real missing evidence, current IDs/paths/meeting aliases, and unavailable-reference boundaries.");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
