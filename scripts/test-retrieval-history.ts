import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const root = process.cwd(); const require = createRequire(import.meta.url);
const fixture = mkdtempSync(path.join(os.tmpdir(), "dd-retrieval-history-"));
try {
  const generated = path.join(fixture, "data/generated"); mkdirSync(generated, { recursive: true });
  const write = (name: string, data: unknown) => writeFileSync(path.join(generated, name), JSON.stringify(data));
  const document = (id: string) => ({ id, meetingId: "meeting", meetingItemIds: [], organizationId: "source", jurisdiction: "Nevada", documentType: "minutes", sourceUrl: `https://example.gov/${id}.pdf`, sourceHost: "example.gov", sourcePlatform: "official", cached: false, retrievalStatus: "remote_discovered", priorityBody: true });
  write("public-meeting-source-documents.json", { records: [document("old-failure"), document("retried")] });
  write("public-meeting-document-refresh-state.json", { records: [
    { documentId: "old-failure", status: "failed", lastAttemptAt: "2026-09-06T10:00:00Z", nextAttemptAt: "2026-09-07T10:00:00Z", consecutiveFailures: 3, failureReason: "HTTP 503" },
    { documentId: "retried", status: "newly_cached", lastAttemptAt: "2026-09-07T10:00:00Z", nextAttemptAt: "2026-09-14T10:00:00Z", consecutiveFailures: 0 },
  ] });
  write("dataops-retrieval-run.json", { generatedAt: "2026-09-07T10:00:00Z", attempts: [{ documentId: "retried", status: "newly_cached", failureReason: null }] });
  execFileSync(process.execPath, ["--import", require.resolve("tsx"), path.join(root, "scripts/generate-public-meeting-retrieval-queue.ts")], { cwd: fixture, env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json") }, stdio: "pipe" });
  const result = JSON.parse(readFileSync(path.join(generated, "public-meeting-retrieval-queue.json"), "utf8"));
  const old = result.records.find((row: { documentId: string }) => row.documentId === "old-failure");
  assert.equal(old.retrievalState, "failed"); assert.equal(old.failureReason, "HTTP 503"); assert.equal(old.retryCount, 3);
  assert.equal(old.nextAttemptAt, "2026-09-07T10:00:00Z");
  console.log("Retrieval history passed: a single-document retry preserves unrelated failure and backoff records.");
} finally { rmSync(fixture, { recursive: true, force: true }); }
