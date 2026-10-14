import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import nextConfig from "../next.config";
import { PACKED_CIVIC_FILES, packedCivicPath } from "@/lib/dataops/packed-runtime";

const workerDirectories = [
  "public-meeting-document-cache", "public-meeting-document-text-cache",
  "public-meeting-ocr-text-cache", "public-meeting-adapter-text-cache", "public-meeting-text",
  "nv-sos-text", "audits", "admin-operations",
].map((directory) => `data/generated/${directory}/`);
const workerManifests = [
  "data/generated/accountability-graph.json",
  "data/generated/public-meeting-source-documents.json",
  "data/generated/public-meeting-document-cache-index.json",
  "data/generated/public-meeting-document-text.json",
  "data/generated/public-meeting-document-association-review-candidates.json",
];
const runtimeFiles = [
  "data/generated/accountability-graph-runtime.json",
  "data/generated/events-runtime.json", "data/generated/public-meeting-items-runtime.json",
  "data/generated/voting-cards-runtime.json", "data/generated/public-meeting-bodies.json",
  "data/seed/public-meeting-sources.json",
];
const metadataFiles = [
  "data/generated/public-meeting-lifecycle.json", "data/generated/public-meeting-content-verification.json",
  "data/generated/public-meeting-cache-manifest.json", "data/generated/public-meeting-document-cache-audit.json",
];
const exclusions = nextConfig.outputFileTracingExcludes!["/*"].map((pattern) => pattern.replace(/^\.\//, ""));
const excluded = (file: string) => exclusions.some((pattern) => path.matchesGlob(file, pattern));
for (const directory of workerDirectories) assert.equal(excluded(`${directory}fixture/source.txt`), true, `${directory} must remain worker-only`);
for (const file of workerManifests) assert.equal(excluded(file), true, `${file} must remain worker-only`);
assert.equal(excluded("data/generated/loose-evidence.pdf"), true);
for (const file of [...runtimeFiles, ...metadataFiles]) assert.equal(excluded(file), false, `${file} must remain available to web readers`);
const includes = nextConfig.outputFileTracingIncludes!["/*"].map(pattern => pattern.replace(/^\.\//, ""));
for (const name of PACKED_CIVIC_FILES) {
  const original = `data/generated/${name}`;
  const packed = packedCivicPath(original);
  assert.equal(excluded(original), true, `${original} must use its lossless build copy`);
  assert.equal(excluded(packed), false, `${packed} must remain available to web readers`);
  assert.ok(includes.includes(packed), `${packed} must be explicitly traced`);
}

if (process.argv.includes("--config-only")) {
  console.log("Event bundle configuration preserves runtime, decisions, and audit reports while excluding worker evidence, extraction manifests, text caches, and local logs.");
} else {
  const tracePath = path.resolve(process.argv.find((arg) => arg.startsWith("--trace="))?.slice(8) ?? ".next/server/app/events/[eventId]/page.js.nft.json");
  assert.ok(existsSync(tracePath), "Build the app before checking the actual event trace.");
  const trace = JSON.parse(readFileSync(tracePath, "utf8")) as { files: string[] };
  const rows = trace.files.map((file) => {
    const absolute = path.resolve(path.dirname(tracePath), file);
    return { path: path.relative(process.cwd(), absolute), bytes: existsSync(absolute) ? statSync(absolute).size : 0 };
  });
  const leaked = rows.filter((row) => workerDirectories.some((directory) => row.path.startsWith(directory)) || workerManifests.includes(row.path) || /^data\/generated\/.*\.pdf$/i.test(row.path));
  assert.deepEqual(leaked.map((row) => row.path), [], "Worker cache files leaked into the built event function.");
  for (const file of runtimeFiles) {
    if (existsSync(file)) assert.ok(rows.some((row) => row.path === file), `${file} is missing from the built event function`);
  }
  for (const name of PACKED_CIVIC_FILES) {
    const original = `data/generated/${name}`;
    if (existsSync(original)) assert.ok(rows.some(row => row.path === packedCivicPath(original)), `${original} needs its lossless build copy`);
    assert.ok(!rows.some(row => row.path === original), `${original} should use its compressed build copy`);
  }
  const bytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  assert.ok(bytes < 250 * 1024 * 1024, `Event function is ${bytes} bytes and exceeds the 250 MiB deployment budget; compact runtime data before publishing.`);
  console.log(JSON.stringify({
    files: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    workerCacheFiles: leaked.length,
    largestFiles: rows.sort((a, b) => b.bytes - a.bytes).slice(0, 12),
  }, null, 2));
}
